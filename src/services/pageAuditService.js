import axios from 'axios';
import dns from 'dns/promises';
import net from 'net';
import { parse } from 'node-html-parser';
import { analyzeContent } from '../../shared/contentAnalysis.js';
import { REQUEST_TIMEOUT_MS } from '../config.js';
import { ValidationError } from '../utils/validation.js';

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; SEO-App-Audit/1.0)';
// Rastreadores de buscadores y asistentes con IA cuyo acceso conviene decidir a propósito
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
const STATUS_POINTS = { ok: 1, warn: 0.5, fail: 0 };

// ---------- Seguridad: la URL la escribe el usuario y la pide el servidor ----------

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:');
}

// Direcciones que no se piden nunca, ni con las locales permitidas: los metadatos de las nubes (169.254.169.254
// y similares) entregan credenciales de la máquina a quien los consulte.
function isForbiddenAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (a === 169 && b === 254) || a === 0 || a >= 224;
  }
  return address.toLowerCase().startsWith('fe80') || address === '::';
}

// SEO_ALLOW_PRIVATE_URLS fija la política para toda la instancia: «1» permite siempre las direcciones locales,
// «0» nunca. Sin la variable decide quien llama (ver `canAuditLocal` en las rutas; la CLI y MCP las permiten).
export function localAllowed(requested) {
  if (process.env.SEO_ALLOW_PRIVATE_URLS === '1') return true;
  if (process.env.SEO_ALLOW_PRIVATE_URLS === '0') return false;
  return Boolean(requested);
}

const looksLocal = (value) => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|[^/:]+\.(local|localhost|test)\b)/i.test(value);

// Solo http(s). Hacia direcciones públicas, salvo que `allowLocal` permita las de la propia máquina y la red
// privada (para auditar un sitio en desarrollo): sin ese filtro, la auditoría serviría para leer servicios internos.
export async function assertPublicUrl(value, { allowLocal = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError('Se requiere una URL');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new ValidationError('Solo se pueden auditar URLs http o https');
  }
  let url;
  try {
    // sin protocolo se asume https, salvo en direcciones locales, donde lo normal es http
    const raw = value.trim();
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `${looksLocal(raw) ? 'http' : 'https'}://${raw}`);
  } catch {
    throw new ValidationError('La URL no es válida');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ValidationError('Solo se pueden auditar URLs http o https');
  if (url.username || url.password) throw new ValidationError('La URL no puede llevar usuario ni contraseña');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address);
  if (addresses.length === 0) throw new ValidationError(`No se pudo resolver el dominio ${host}`);
  if (addresses.some(isForbiddenAddress)) throw new ValidationError('Esa dirección no se puede auditar');
  if (addresses.some(isPrivateAddress) && !localAllowed(allowLocal)) {
    throw new ValidationError('Solo se pueden auditar sitios públicos. Las direcciones locales (localhost, red privada) se auditan desde el propio equipo o la red local, o con SEO_ALLOW_PRIVATE_URLS=1.');
  }
  return url;
}

export const isLocalUrl = (url) => {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return host === 'localhost' || /\.(local|localhost|test)$/i.test(host) || (net.isIP(host) !== 0 && isPrivateAddress(host));
};

export async function fetchText(url, { maxBytes = MAX_HTML_BYTES, allowLocal = false } = {}) {
  const started = Date.now();
  const response = await axios.get(url.toString(), {
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: maxBytes,
    maxRedirects: 5,
    responseType: 'text',
    transformResponse: (data) => data,
    validateStatus: () => true,
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7' },
    // cada salto de una redirección vuelve a pasar el filtro de direcciones privadas
    beforeRedirect: (options) => {
      if (!net.isIP(options.hostname)) return;
      if (isForbiddenAddress(options.hostname) || (isPrivateAddress(options.hostname) && !localAllowed(allowLocal))) {
        throw new Error('Redirección hacia una dirección privada');
      }
    }
  });
  return {
    status: response.status,
    body: typeof response.data === 'string' ? response.data : '',
    headers: response.headers,
    finalUrl: response.request?.res?.responseUrl || url.toString(),
    ms: Date.now() - started
  };
}

const safeFetch = (url, allowLocal = false) => fetchText(url, { maxBytes: 512 * 1024, allowLocal }).catch(() => null);

// ---------- Comprobaciones de sitio: robots.txt, sitemap y llms.txt ----------

// Reglas de robots.txt que aplican a un rastreador: su grupo propio o, si no tiene, el de «*»
function robotsRulesFor(robots, bot) {
  const groups = [];
  let current = null;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (field === 'disallow' || field === 'allow')) {
      current.rules.push({ field, value });
    }
  }
  const own = groups.find((group) => group.agents.includes(bot.toLowerCase()));
  return (own || groups.find((group) => group.agents.includes('*')))?.rules || [];
}

const blocksEverything = (rules) => rules.some((rule) => rule.field === 'disallow' && rule.value === '/') && !rules.some((rule) => rule.field === 'allow' && rule.value === '/');

async function siteChecks(url, check, allowLocal) {
  const origin = url.origin;
  const [robots, llms] = await Promise.all([safeFetch(new URL('/robots.txt', origin), allowLocal), safeFetch(new URL('/llms.txt', origin), allowLocal)]);
  const robotsText = robots && robots.status === 200 && !/<html/i.test(robots.body) ? robots.body : null;

  if (!robotsText) {
    check('robots', 'Sitio', 'robots.txt', 1, 'warn', `${origin}/robots.txt no existe o no es un archivo de texto. Sin él no se puede indicar el sitemap ni controlar el rastreo.`);
  } else if (blocksEverything(robotsRulesFor(robotsText, 'Googlebot'))) {
    check('robots', 'Sitio', 'robots.txt', 3, 'fail', 'robots.txt bloquea todo el sitio a Googlebot (Disallow: /).');
  } else {
    check('robots', 'Sitio', 'robots.txt', 1, 'ok', 'Existe y no bloquea el sitio a Googlebot.');
  }

  const sitemapUrls = robotsText ? [...robotsText.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((match) => match[1]) : [];
  let sitemapFound = sitemapUrls.length > 0;
  if (!sitemapFound) {
    const sitemap = await safeFetch(new URL('/sitemap.xml', origin), allowLocal);
    sitemapFound = Boolean(sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body));
  }
  check('sitemap', 'Sitio', 'Sitemap XML', 1, sitemapFound ? 'ok' : 'warn',
    sitemapFound
      ? (sitemapUrls.length ? `Declarado en robots.txt: ${sitemapUrls[0]}` : 'Existe /sitemap.xml, pero no está declarado en robots.txt.')
      : 'No se encontró sitemap ni en robots.txt ni en /sitemap.xml. Ayuda a que Google descubra todas las páginas.');

  if (robotsText) {
    const blocked = AI_BOTS.filter((bot) => blocksEverything(robotsRulesFor(robotsText, bot)));
    check('ai-bots', 'Sitio', 'Acceso de los rastreadores de IA', 1, blocked.length === 0 ? 'ok' : 'warn',
      blocked.length === 0
        ? `robots.txt no bloquea a ${AI_BOTS.join(', ')}: el contenido puede aparecer citado en respuestas de IA.`
        : `robots.txt bloquea a ${blocked.join(', ')}. Si es a propósito, bien; si no, el sitio no aparecerá en las respuestas de esos asistentes.`);
  }

  const hasLlms = Boolean(llms && llms.status === 200 && !/<html/i.test(llms.body) && llms.body.trim().length > 0);
  check('llms', 'Sitio', 'llms.txt', 0, hasLlms ? 'ok' : 'skip',
    hasLlms ? 'El sitio publica /llms.txt.' : 'No hay /llms.txt. Es una convención emergente y opcional para orientar a los asistentes de IA; ningún buscador lo exige.');

  return { robots: Boolean(robotsText), sitemap: sitemapFound, llms: hasLlms };
}

// ---------- Auditoría de la página ----------

const textOf = (node) => (node ? node.text.replace(/\s+/g, ' ').trim() : '');

function schemaTypes(root) {
  const types = new Set();
  const collect = (value) => {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== 'object') return;
    [].concat(value['@type'] || []).forEach((type) => typeof type === 'string' && types.add(type));
    collect(value['@graph']);
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collect(JSON.parse(script.text));
    } catch {
      types.add('(JSON-LD con errores)');
    }
  }
  return [...types];
}

/**
 * Descarga una URL y la audita: técnica, on-page, contenido frente a una keyword y señales de sitio.
 * Con `allowLocal` admite sitios en desarrollo (localhost y red privada); en ellos no se evalúa lo que solo
 * tiene sentido en producción (HTTPS, tiempo de respuesta).
 * @param {string} rawUrl
 * @param {{ keyword?: string, relatedKeywords?: string[], language?: string, allowLocal?: boolean }} [options]
 */
export async function auditUrl(rawUrl, { keyword = '', relatedKeywords = [], language = 'es', allowLocal = false } = {}) {
  const url = await assertPublicUrl(rawUrl, { allowLocal });
  let page;
  try {
    page = await fetchText(url, { allowLocal });
  } catch (error) {
    throw new ValidationError(`No se pudo descargar ${url}: ${error.message}`);
  }

  const checks = [];
  const check = (id, group, label, weight, status, detail) => checks.push({ id, group, label, weight, status, detail });
  const finalUrl = new URL(page.finalUrl);
  const local = isLocalUrl(finalUrl);
  const root = parse(page.body, { comment: false });
  const head = (selector) => root.querySelector(selector);

  // --- Técnico ---
  check('status', 'Técnico', 'Respuesta del servidor', 3, page.status === 200 ? 'ok' : 'fail',
    page.status === 200 ? `200 OK en ${page.ms} ms.` : `La página responde ${page.status}: Google no la indexará así.`);
  if (local && finalUrl.protocol !== 'https:') {
    check('https', 'Técnico', 'HTTPS', 0, 'skip', 'Entorno local: se sirve por HTTP. Comprueba que en producción vaya por HTTPS.');
  } else {
    check('https', 'Técnico', 'HTTPS', 2, finalUrl.protocol === 'https:' ? 'ok' : 'fail',
      finalUrl.protocol === 'https:' ? 'La página se sirve por HTTPS.' : 'La página se sirve por HTTP sin cifrar.');
  }
  if (finalUrl.toString() !== url.toString()) {
    check('redirect', 'Técnico', 'Redirección', 0, 'skip', `${url} redirige a ${finalUrl}. Enlaza siempre a la URL final.`);
  }
  if (local) {
    check('speed', 'Técnico', 'Tiempo de respuesta', 0, 'skip', `${page.ms} ms en el entorno local: un servidor de desarrollo no dice nada de la velocidad en producción.`);
  } else {
    check('speed', 'Técnico', 'Tiempo de respuesta', 1, page.ms < 800 ? 'ok' : page.ms < 2000 ? 'warn' : 'fail',
      `El servidor tardó ${page.ms} ms en entregar el HTML. Es solo el documento: no mide Core Web Vitals (LCP, INP, CLS), que hay que revisar en PageSpeed Insights.`);
  }

  const robotsMeta = (head('meta[name="robots"]')?.getAttribute('content') || '').toLowerCase();
  const xRobots = String(page.headers['x-robots-tag'] || '').toLowerCase();
  const noindex = robotsMeta.includes('noindex') || xRobots.includes('noindex');
  check('indexable', 'Técnico', 'Indexable', 3, !noindex ? 'ok' : local ? 'warn' : 'fail',
    !noindex ? 'No lleva «noindex».'
      : local ? 'La página lleva «noindex». Es habitual en desarrollo: asegúrate de que la versión de producción no lo lleve.'
        : 'La página lleva «noindex»: Google no la mostrará en resultados.');

  const canonical = head('link[rel="canonical"]')?.getAttribute('href');
  let canonicalStatus = 'warn';
  let canonicalDetail = 'No declara URL canónica. Conviene que cada página se señale a sí misma para evitar duplicados.';
  let canonicalHost = null;
  if (canonical) {
    const target = new URL(canonical, finalUrl);
    canonicalHost = target.hostname;
    const samePath = target.pathname.replace(/\/$/, '') === finalUrl.pathname.replace(/\/$/, '');
    const same = samePath && target.origin === finalUrl.origin;
    // en desarrollo la canónica ya suele apuntar al dominio de producción: lo que importa es que la ruta coincida
    const production = local && samePath && target.origin !== finalUrl.origin;
    canonicalStatus = same || production ? 'ok' : 'warn';
    canonicalDetail = same ? 'La canónica apunta a la propia página.'
      : production ? `La canónica apunta a la misma ruta en ${target.origin}, el dominio de producción.`
        : `La canónica apunta a otra URL (${target}): Google indexará aquella, no esta.`;
  }
  check('canonical', 'Técnico', 'URL canónica', 1, canonicalStatus, canonicalDetail);

  check('viewport', 'Técnico', 'Adaptada a móvil', 2, head('meta[name="viewport"]') ? 'ok' : 'fail',
    head('meta[name="viewport"]') ? 'Declara viewport.' : 'Falta la etiqueta viewport: la página no se adapta a móvil y Google indexa primero la versión móvil.');
  const lang = root.querySelector('html')?.getAttribute('lang');
  check('lang', 'Técnico', 'Idioma declarado', 1, lang ? 'ok' : 'warn', lang ? `lang="${lang}".` : 'Falta el atributo lang en <html>.');

  // --- Datos estructurados y redes ---
  const types = schemaTypes(root);
  check('schema', 'Datos estructurados', 'Marcado schema.org', 2, types.length > 0 && !types.includes('(JSON-LD con errores)') ? 'ok' : 'warn',
    types.length > 0
      ? `Tipos encontrados: ${types.join(', ')}.`
      : 'Sin datos estructurados JSON-LD. Article, Product, LocalBusiness, FAQPage o BreadcrumbList habilitan resultados enriquecidos y ayudan a los buscadores con IA a entender la página.');
  const og = ['og:title', 'og:description', 'og:image'].filter((property) => !head(`meta[property="${property}"]`));
  check('open-graph', 'Datos estructurados', 'Open Graph', 1, og.length === 0 ? 'ok' : 'warn',
    og.length === 0 ? 'Título, descripción e imagen para compartir en redes.' : `Faltan ${og.join(', ')}: el enlace se verá pobre al compartirlo.`);

  // --- Contenido: el cuerpo sin cabecera, pie ni menús ---
  const title = textOf(head('title'));
  const metaDescription = head('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  // el H1 se cuenta en todo el documento: muchas plantillas lo ponen en la cabecera, fuera de <main>
  const h1Count = root.querySelectorAll('h1').length;
  const body = root.querySelector('main') || root.querySelector('article') || root.querySelector('body') || root;
  const links = body.querySelectorAll('a[href]').map((anchor) => anchor.getAttribute('href')).filter((href) => href && !/^(#|javascript:|mailto:|tel:)/i.test(href));
  const internal = links.filter((href) => {
    try {
      // en desarrollo, los enlaces absolutos al dominio de producción (el de la canónica) también son internos
      const host = new URL(href, finalUrl).hostname.replace(/^www\./, '');
      return host === finalUrl.hostname.replace(/^www\./, '') || (canonicalHost !== null && host === canonicalHost.replace(/^www\./, ''));
    } catch {
      return false;
    }
  });
  body.querySelectorAll('script, style, noscript, nav, header, footer, aside, form, svg, iframe').forEach((node) => node.remove());

  // se cuentan en el HTML original: del cuerpo ya se han quitado para medir solo el texto
  const scripts = (page.body.match(/<script\b/gi) || []).length;
  const content = analyzeContent({ text: body.innerHTML, keyword, title, metaDescription, relatedKeywords, language });
  // Una página que se pinta en el navegador llega sin texto: es lo que ve un rastreador que no ejecuta JavaScript
  if (content.stats.words < 40 && scripts > 0) {
    check('rendered', 'Técnico', 'Contenido en el HTML', 3, 'fail',
      `El HTML trae ${content.stats.words} palabras y ${scripts} scripts: el contenido se pinta con JavaScript en el navegador. ` +
      'Los buscadores con IA y parte de los rastreadores no lo ejecutan; sirve el contenido ya renderizado (SSR o generación estática). ' +
      'Esta auditoría tampoco lo ejecuta, así que el resto de comprobaciones de contenido miden esa página vacía.');
  }
  // de la auditoría de texto se descarta el recuento de enlaces: aquí se mide sobre la página entera
  // Un listado de productos no es un artículo: la keyword se repite en cada nombre de producto y no hay prosa que medir
  const listing = types.some((type) => ['ItemList', 'Product', 'CollectionPage', 'OfferCatalog'].includes(type));
  const PROSE_CHECKS = new Set(['answer-first', 'question-headings', 'readability', 'sentences', 'paragraphs']);
  for (const item of content.checks) {
    // el recuento de enlaces se mide más abajo sobre la página entera
    if (item.id === 'links') continue;
    if (item.id === 'h1') {
      checks.push({ ...item, status: h1Count === 1 ? 'ok' : 'warn', detail: h1Count === 1 ? 'Hay un H1.' : h1Count === 0 ? 'La página no tiene H1.' : `Hay ${h1Count} H1; debería haber solo uno.` });
    } else if (listing && PROSE_CHECKS.has(item.id)) {
      checks.push({ ...item, weight: 0, status: 'skip', detail: 'No se evalúa en un listado de productos: mide la prosa de un artículo.' });
    } else if (listing && item.id === 'keyword-density' && item.status === 'fail' && content.stats.keywordOccurrences > 0) {
      checks.push({ ...item, status: 'warn', detail: `${item.detail} En un listado es normal que la keyword se repita en el nombre de cada producto; revisa solo que el texto introductorio no la fuerce.` });
    } else {
      checks.push(item);
    }
  }
  if (!checks.some((item) => item.id === 'h1')) {
    check('h1', 'Estructura', 'Un único H1', 1, h1Count === 1 ? 'ok' : 'warn', h1Count === 1 ? 'Hay un H1.' : h1Count === 0 ? 'La página no tiene H1.' : `Hay ${h1Count} H1; debería haber solo uno.`);
  }

  if (!title) check('title-missing', 'Título y meta', 'Título SEO', 3, 'fail', 'La página no tiene etiqueta <title>.');
  if (!metaDescription) {
    const index = checks.findIndex((item) => item.id === 'meta-length');
    if (index >= 0) checks.splice(index, 1);
    check('meta-missing', 'Título y meta', 'Meta descripción', 1, 'warn', 'La página no tiene meta descripción: Google improvisará el texto del resultado.');
  }

  const perThousand = content.stats.words ? (internal.length / content.stats.words) * 1000 : 0;
  check('internal-links', 'Estructura', 'Enlaces internos', 2, internal.length >= 3 ? 'ok' : internal.length > 0 ? 'warn' : 'fail',
    `${internal.length} enlaces internos y ${links.length - internal.length} externos en el contenido (${perThousand.toFixed(1).replace('.', ',')} internos por cada 1.000 palabras). Lo habitual es de 3 a 5 por cada 1.000 palabras, con texto descriptivo.`);

  const hasAuthor = Boolean(root.querySelector('[rel="author"], [itemprop="author"], meta[name="author"]')) || types.some((type) => /Person/.test(type));
  const hasDate = Boolean(root.querySelector('time, meta[property="article:modified_time"], meta[property="article:published_time"]'));
  check('eeat', 'IA y fragmentos', 'Autor y fecha visibles', listing ? 0 : 1, listing ? 'skip' : hasAuthor && hasDate ? 'ok' : 'warn',
    `${hasAuthor ? 'Autor identificado' : 'Sin autor identificable'} y ${hasDate ? 'fecha de publicación o actualización' : 'sin fecha'}. Son señales de experiencia y actualidad (E-E-A-T) para páginas de contenido; en páginas de producto importan menos.`);

  const site = await siteChecks(finalUrl, check, allowLocal);

  const scored = checks.filter((item) => item.status !== 'skip');
  const totalWeight = scored.reduce((total, item) => total + item.weight, 0);
  const earned = scored.reduce((total, item) => total + item.weight * STATUS_POINTS[item.status], 0);
  const score = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  return {
    url: finalUrl.toString(),
    requestedUrl: url.toString(),
    title,
    metaDescription,
    score,
    verdict: score >= 80 ? 'En buen estado' : score >= 60 ? 'Aceptable, con mejoras claras' : score >= 40 ? 'Necesita trabajo' : 'Problemas serios',
    pageType: listing ? 'listado' : 'contenido',
    environment: local ? 'local' : 'publico',
    stats: {
      ...content.stats,
      // en un listado no hay prosa: la legibilidad no significa nada
      readability: listing ? null : content.stats.readability,
      status: page.status,
      responseMs: page.ms,
      internalLinks: internal.length,
      externalLinks: links.length - internal.length,
      schemaTypes: types,
      ...site
    },
    checks,
    related: content.related
  };
}

