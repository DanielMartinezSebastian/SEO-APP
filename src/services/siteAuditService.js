// Auditoría de sitio a partir de su sitemap: qué declara, qué responde cada URL y qué problemas se repiten.
// Vale para un sitio publicado y para uno en desarrollo (localhost, red privada) cuando quien llama lo permite.
import { parse } from 'node-html-parser';
import { assertPublicUrl, fetchText } from './pageAuditService.js';
import { ValidationError, isLocalSite, siteOrigin } from '../utils/validation.js';

const MAX_SITEMAPS = 8;
const MAX_URLS = 500;
const CONCURRENCY = 5;
const THIN_WORDS = 150;

const locs = (xml) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((match) => match[1].replace(/&amp;/g, '&'));
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * Lee el sitemap de un sitio: el declarado en robots.txt o, si no hay, /sitemap.xml. Sigue los índices.
 * @returns {{ origin, sources, declaredInRobots, urls, total, truncated, duplicates, foreignHost, withLastmod, problems }}
 */
export async function readSitemap(site, { allowLocal = false, limit = MAX_URLS } = {}) {
  const origin = (await assertPublicUrl(`${siteOrigin(site)}/`, { allowLocal })).origin;
  const get = async (target, maxBytes) => fetchText(await assertPublicUrl(target, { allowLocal }), { maxBytes, allowLocal });

  let robots = null;
  try {
    robots = await get(`${origin}/robots.txt`, 512 * 1024);
  } catch {
    // sin robots.txt se prueba la ruta habitual
  }
  const declared = robots && robots.status === 200 && !/<html/i.test(robots.body)
    ? [...robots.body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((match) => match[1])
    : [];
  const problems = [];
  // En desarrollo robots.txt suele declarar el sitemap del dominio de producción: se pide la misma ruta en local
  const toLocal = (target) => {
    try {
      const url = new URL(target);
      return isLocalSite(site) && url.origin !== origin ? `${origin}${url.pathname}${url.search}` : target;
    } catch {
      return target;
    }
  };
  const queue = (declared.length > 0 ? declared.slice(0, 3) : [`${origin}/sitemap.xml`]).map(toLocal);
  const sources = [];
  const seen = new Set();
  const all = [];
  let withLastmod = 0;

  while (queue.length > 0 && sources.length < MAX_SITEMAPS) {
    const target = queue.shift();
    if (seen.has(target)) continue;
    seen.add(target);
    let response;
    try {
      response = await get(target, 5 * 1024 * 1024);
    } catch (error) {
      problems.push(`No se pudo leer ${target}: ${error.message}`);
      continue;
    }
    if (response.status !== 200) {
      problems.push(`${target} responde ${response.status}.`);
      continue;
    }
    if (!/<(urlset|sitemapindex)\b/i.test(response.body)) {
      problems.push(`${target} no es un sitemap XML válido (no contiene <urlset> ni <sitemapindex>).`);
      continue;
    }
    const found = locs(response.body);
    if (/<sitemapindex\b/i.test(response.body)) {
      sources.push({ url: target, type: 'índice', entries: found.length });
      queue.push(...found.map(toLocal));
    } else {
      sources.push({ url: target, type: 'urls', entries: found.length });
      all.push(...found);
      withLastmod += (response.body.match(/<lastmod>/gi) || []).length;
    }
  }

  if (all.length === 0) {
    throw new ValidationError(`No se encontró un sitemap con URLs en ${origin} (ni en robots.txt ni en /sitemap.xml). ${problems.join(' ')}`.trim());
  }

  const unique = [...new Set(all)];
  const siteHost = new URL(origin).host;
  const foreign = unique.filter((url) => {
    try {
      return new URL(url).host.replace(/^www\./, '') !== siteHost.replace(/^www\./, '');
    } catch {
      return true;
    }
  });

  return {
    origin,
    sources,
    declaredInRobots: declared.length > 0,
    urls: unique.slice(0, limit),
    total: unique.length,
    truncated: unique.length > limit,
    duplicates: all.length - unique.length,
    // URLs del sitemap que apuntan a otro dominio. En desarrollo es lo normal: son las de producción
    foreignHost: foreign.length,
    foreignExample: foreign[0] || null,
    withLastmod,
    problems
  };
}

// Lo mínimo de una página para detectar problemas de sitio, sin la auditoría completa
async function inspectPage(listedUrl, { origin, local, allowLocal }) {
  // en un sitio local, una URL del sitemap con el dominio de producción se pide en local por la misma ruta
  let target = listedUrl;
  try {
    const parsed = new URL(listedUrl);
    if (local && parsed.origin !== origin) target = `${origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return { url: listedUrl, status: 0, error: 'URL no válida' };
  }

  let page;
  try {
    page = await fetchText(await assertPublicUrl(target, { allowLocal }), { allowLocal });
  } catch (error) {
    return { url: listedUrl, fetchedUrl: target, status: 0, error: error.message };
  }

  const root = parse(page.body, { comment: false });
  const finalUrl = page.finalUrl;
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
  const robotsMeta = (root.querySelector('meta[name="robots"]')?.getAttribute('content') || '').toLowerCase();
  const scripts = (page.body.match(/<script\b/gi) || []).length;
  const body = root.querySelector('main') || root.querySelector('body') || root;
  const h1 = root.querySelectorAll('h1').length;
  body.querySelectorAll('script, style, noscript, nav, header, footer, aside, form, svg, iframe').forEach((node) => node.remove());
  const words = (body.text.match(/[\p{L}\p{N}]+/gu) || []).length;

  let canonicalElsewhere = false;
  if (canonical) {
    try {
      const canon = new URL(canonical, finalUrl);
      const final = new URL(finalUrl);
      const samePath = canon.pathname.replace(/\/$/, '') === final.pathname.replace(/\/$/, '');
      // en local, la misma ruta en el dominio de producción es lo esperado
      canonicalElsewhere = !(samePath && (canon.origin === final.origin || local));
    } catch {
      canonicalElsewhere = true;
    }
  }

  return {
    url: listedUrl,
    fetchedUrl: target,
    finalUrl,
    status: page.status,
    ms: page.ms,
    redirected: new URL(finalUrl).pathname.replace(/\/$/, '') !== new URL(target).pathname.replace(/\/$/, ''),
    title: root.querySelector('title')?.text.replace(/\s+/g, ' ').trim() || '',
    metaDescription: root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
    h1,
    words,
    noindex: robotsMeta.includes('noindex') || String(page.headers['x-robots-tag'] || '').toLowerCase().includes('noindex'),
    canonical,
    canonicalElsewhere,
    empty: words < 40 && scripts > 0
  };
}

async function inBatches(items, size, run) {
  const results = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...await Promise.all(items.slice(start, start + size).map(run)));
  }
  return results;
}

const groupBy = (pages, key) => {
  const groups = new Map();
  for (const page of pages) {
    const value = page[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(page.url);
  }
  return [...groups.entries()].filter(([, urls]) => urls.length > 1);
};

/**
 * Audita un sitio por su sitemap: lee el sitemap, pide hasta `pages` URLs y agrupa los problemas.
 * @returns {{ site, origin, environment, fetchedAt, sitemap, checked, pages, issues, score }}
 */
export async function auditSite(site, { allowLocal = false, pages: pageLimit = 40 } = {}) {
  if (!site) throw new ValidationError('Indica el sitio a auditar (ejemplo.com o localhost:3000)');
  const local = isLocalSite(site);
  const sitemap = await readSitemap(site, { allowLocal });
  const sample = sitemap.urls.slice(0, Math.min(Math.max(1, pageLimit), 100));
  const pages = await inBatches(sample, CONCURRENCY, (url) => inspectPage(url, { origin: sitemap.origin, local, allowLocal }));

  const ok = pages.filter((page) => page.status === 200);
  // una URL que redirige se cuenta como redirección; su contenido es el de otra página y no se evalúa aquí
  const content = ok.filter((page) => !page.redirected);
  const issues = [];
  // severity: alta = impide posicionar esa URL; media = resta; baja = higiene
  const issue = (id, severity, title, affected, why, fix) => {
    if (affected.length > 0) issues.push({ id, severity, title: `${title} (${affected.length})`, urls: affected.slice(0, 15), count: affected.length, why, fix });
  };
  const urlsOf = (list) => list.map((page) => page.url);

  issue('broken', 'alta', 'URLs del sitemap que no responden 200', urlsOf(pages.filter((page) => page.status !== 200)),
    'El sitemap promete a Google páginas que no existen o fallan: desperdicia rastreo y resta confianza en el sitemap.',
    'Corrige la página o quita la URL del sitemap. Códigos: ' + [...new Set(pages.filter((page) => page.status !== 200).map((page) => page.status || 'sin respuesta'))].join(', ') + '.');
  issue('empty', 'alta', 'Páginas que llegan sin contenido en el HTML', urlsOf(content.filter((page) => page.empty)),
    'El contenido se pinta con JavaScript en el navegador: los rastreadores que no lo ejecutan, y los buscadores con IA, ven la página vacía.',
    'Sirve esas páginas ya renderizadas (SSR o generación estática).');
  issue('noindex', local ? 'media' : 'alta', 'Páginas con noindex dentro del sitemap', urlsOf(content.filter((page) => page.noindex)),
    'Una página no puede estar a la vez en el sitemap y pedir que no se indexe.',
    local ? 'Si el noindex es solo del entorno de desarrollo, comprueba que producción no lo lleve.' : 'Quita el noindex o saca la URL del sitemap.');
  issue('redirect', 'media', 'URLs del sitemap que redirigen', urlsOf(ok.filter((page) => page.redirected)),
    'El sitemap debe listar la URL final, no una que redirige.',
    'Sustituye cada URL por su destino.');
  issue('canonical', 'media', 'Páginas cuya canónica apunta a otra URL', urlsOf(content.filter((page) => page.canonicalElsewhere)),
    'Google indexará la URL canónica, no la del sitemap.',
    'El sitemap debe listar solo URLs canónicas: corrige la canónica o cambia la URL del sitemap.');
  issue('title-missing', 'alta', 'Páginas sin título', urlsOf(content.filter((page) => !page.title)),
    'El título es la señal on-page de más peso y el texto del resultado en Google.', 'Añade un <title> único a cada página.');
  const duplicatedTitles = groupBy(content, 'title');
  issue('title-duplicate', 'media', 'Títulos repetidos', duplicatedTitles.flatMap(([, urls]) => urls),
    'Varias páginas con el mismo título compiten entre sí y Google no sabe cuál mostrar.',
    'Un título distinto por página. Repetidos: ' + duplicatedTitles.slice(0, 3).map(([title, urls]) => `«${title}» (${urls.length})`).join('; ') + '.');
  issue('meta-missing', 'baja', 'Páginas sin meta descripción', urlsOf(content.filter((page) => !page.metaDescription)),
    'Sin ella Google improvisa el texto del resultado.', 'Meta descripción de 120 a 160 caracteres por página.');
  const duplicatedMeta = groupBy(content, 'metaDescription');
  issue('meta-duplicate', 'baja', 'Meta descripciones repetidas', duplicatedMeta.flatMap(([, urls]) => urls),
    'La misma descripción en varias páginas no ayuda a distinguirlas en los resultados.', 'Una descripción propia por página.');
  issue('h1', 'media', 'Páginas sin H1 o con varios', urlsOf(content.filter((page) => !page.empty && page.h1 !== 1)),
    'El H1 dice de qué trata la página; debe haber uno.', 'Un único H1 por página, con su keyword principal.');
  issue('thin', 'media', `Páginas con menos de ${THIN_WORDS} palabras`, urlsOf(content.filter((page) => !page.empty && page.words < THIN_WORDS)),
    'Con tan poco texto es difícil que la página responda a una búsqueda.',
    'Amplía el contenido o, si la página no debe posicionar, sácala del sitemap.');

  // --- problemas del propio sitemap ---
  const sitemapIssues = [];
  if (!sitemap.declaredInRobots) sitemapIssues.push('El sitemap no está declarado en robots.txt (línea «Sitemap: …»).');
  if (sitemap.duplicates > 0) sitemapIssues.push(`${plural(sitemap.duplicates, 'URL repetida', 'URLs repetidas')} en el sitemap.`);
  if (sitemap.foreignHost > 0) {
    sitemapIssues.push(local
      ? `${plural(sitemap.foreignHost, 'URL apunta', 'URLs apuntan')} a otro dominio (${sitemap.foreignExample}): es lo esperado si el sitemap ya usa el dominio de producción; se han comprobado en local por la misma ruta.`
      : `${plural(sitemap.foreignHost, 'URL apunta', 'URLs apuntan')} a un dominio distinto del sitio (${sitemap.foreignExample}): Google las ignorará.`);
  }
  if (sitemap.withLastmod === 0) sitemapIssues.push('Ninguna URL lleva <lastmod>: Google no sabe qué páginas han cambiado.');
  sitemapIssues.push(...sitemap.problems);

  const SEVERITY_ORDER = { alta: 0, media: 1, baja: 2 };
  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);

  // Nota: porcentaje de URLs comprobadas sin ningún problema grave o medio
  const flagged = new Set(issues.filter((item) => item.severity !== 'baja').flatMap((item) => {
    const affected = pages.filter((page) => item.urls.includes(page.url)).map((page) => page.url);
    return affected;
  }));
  const score = pages.length ? Math.round(((pages.length - flagged.size) / pages.length) * 100) : 0;

  return {
    site,
    origin: sitemap.origin,
    environment: local ? 'local' : 'publico',
    fetchedAt: new Date().toISOString(),
    sitemap: {
      sources: sitemap.sources,
      declaredInRobots: sitemap.declaredInRobots,
      total: sitemap.total,
      truncated: sitemap.truncated,
      withLastmod: sitemap.withLastmod,
      issues: sitemapIssues
    },
    checked: pages.length,
    score,
    issues,
    pages: pages.map(({ canonical, fetchedUrl, ...page }) => page),
    urls: sitemap.urls
  };
}
