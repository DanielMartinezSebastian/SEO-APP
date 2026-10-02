import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { buildActionPlan } from '../shared/plan.js';
import { analyzeTrend, buildTrendInsights, trendsToMarkdown } from '../shared/seasonality.js';
import { isLocalSite, siteOrigin } from '../shared/site.js';
import { auditSite, readSitemap } from '../src/services/siteAuditService.js';
import { ValidationError, parseSite } from '../src/utils/validation.js';

// ---------- Sitio del estudio: dominio o sitio en desarrollo ----------

test('parseSite acepta dominios y sitios en desarrollo con puerto', () => {
  assert.strictEqual(parseSite('https://www.Ejemplo.com/ruta'), 'ejemplo.com');
  assert.strictEqual(parseSite('localhost:3000'), 'localhost:3000');
  assert.strictEqual(parseSite('http://localhost:5173/blog'), 'localhost:5173');
  assert.strictEqual(parseSite('192.168.1.20:8080'), '192.168.1.20:8080');
  assert.strictEqual(parseSite('miweb.test'), 'miweb.test');
  assert.throws(() => parseSite('no es un dominio'), ValidationError);
  assert.throws(() => parseSite('intranet'), ValidationError);

  assert.strictEqual(isLocalSite('10.0.0.5:8000'), true);
  assert.strictEqual(isLocalSite('172.20.1.1'), true);
  assert.strictEqual(isLocalSite('172.32.1.1'), false);
  assert.strictEqual(isLocalSite('ejemplo.com'), false);
  assert.strictEqual(siteOrigin('localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(siteOrigin('ejemplo.com'), 'https://ejemplo.com');
});

// ---------- Auditoría de sitio por su sitemap, en local ----------

const words = (count) => Array.from({ length: count }, (_, index) => `palabra${index}`).join(' ');
const page = ({ title = 'Título', meta = 'Descripción de la página', h1 = '<h1>Encabezado</h1>', body = words(200), head = '' }) =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="${meta}">${head}</head><body><main>${h1}<p>${body}</p></main></body></html>`;

// Un sitio de desarrollo cuyo sitemap y robots.txt ya usan el dominio de producción, como suele pasar
function devSite() {
  const pages = {
    '/': page({ title: 'Portada', head: '<link rel="canonical" href="https://produccion.example/">' }),
    '/servicios': page({ title: 'Servicios', meta: 'Lo que hacemos' }),
    '/blog/uno': page({ title: 'Repetido', meta: 'Uno' }),
    '/blog/dos': page({ title: 'Repetido', meta: 'Dos' }),
    '/corta': page({ title: 'Corta', meta: 'Poca cosa', body: 'Casi nada.' }),
    '/oculta': page({ title: 'Oculta', meta: 'No indexar', head: '<meta name="robots" content="noindex">' }),
    '/spa': '<!doctype html><html><head><title>App</title><meta name="description" content="App"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'
  };
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/robots.txt') return res.end('User-agent: *\nAllow: /\nSitemap: https://produccion.example/sitemap-index.xml\n');
    if (url === '/sitemap-index.xml') {
      res.setHeader('Content-Type', 'application/xml');
      return res.end('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://produccion.example/sitemap-pages.xml</loc></sitemap></sitemapindex>');
    }
    if (url === '/sitemap-pages.xml') {
      res.setHeader('Content-Type', 'application/xml');
      const entries = [...Object.keys(pages), '/rota', '/vieja', '/servicios'].map((route) => `<url><loc>https://produccion.example${route}</loc></url>`).join('');
      return res.end(`<?xml version="1.0"?><urlset>${entries}</urlset>`);
    }
    if (url === '/vieja') {
      res.writeHead(301, { Location: '/servicios' });
      return res.end();
    }
    if (pages[url]) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(pages[url]);
    }
    res.statusCode = 404;
    res.end('No existe');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('auditoría de sitio: lee el sitemap de un sitio local y agrupa los problemas', async () => {
  const server = await devSite();
  const site = `127.0.0.1:${server.address().port}`;
  try {
    // sin permiso, las direcciones locales siguen prohibidas
    await assert.rejects(readSitemap(site), ValidationError);

    const sitemap = await readSitemap(site, { allowLocal: true });
    assert.strictEqual(sitemap.declaredInRobots, true);
    assert.deepStrictEqual(sitemap.sources.map((source) => source.type), ['índice', 'urls']);
    assert.strictEqual(sitemap.total, 9);
    assert.strictEqual(sitemap.duplicates, 1);
    assert.strictEqual(sitemap.foreignHost, 9);

    const audit = await auditSite(site, { allowLocal: true });
    assert.strictEqual(audit.environment, 'local');
    assert.strictEqual(audit.checked, 9);
    const issue = (id) => audit.issues.find((item) => item.id === id);
    assert.deepStrictEqual(issue('broken').urls, ['https://produccion.example/rota']);
    assert.deepStrictEqual(issue('redirect').urls, ['https://produccion.example/vieja']);
    assert.deepStrictEqual(issue('empty').urls, ['https://produccion.example/spa']);
    assert.deepStrictEqual(issue('thin').urls, ['https://produccion.example/corta']);
    assert.strictEqual(issue('noindex').severity, 'media');
    assert.strictEqual(issue('title-duplicate').count, 2);
    // la canónica a la misma ruta en producción es lo esperado en local
    assert.strictEqual(issue('canonical'), undefined);
    assert(audit.sitemap.issues.some((text) => text.includes('otro dominio')));
    assert(audit.score > 0 && audit.score < 100);

    // el plan de acción recoge los problemas del sitio
    const plan = buildActionPlan([], { site, siteAudit: audit });
    assert(plan.some((task) => task.area === 'Técnico' && task.title.includes('no responden 200')));
  } finally {
    server.close();
  }
});

// ---------- Tendencias ----------

// Cinco años hasta septiembre de 2026, con forma mensual y crecimiento anual dados
const NOW = new Date('2026-10-02T00:00:00Z');
function series(shape, growth = 1) {
  const points = [];
  for (let index = 59; index >= 0; index--) {
    const date = new Date(Date.UTC(2026, 8 - index, 1));
    const yearsAgo = Math.floor(index / 12);
    points.push({
      month: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      value: Math.round(shape[date.getUTCMonth()] * growth ** (4 - yearsAgo))
    });
  }
  return points;
}
const FLAT = new Array(12).fill(50);
const CHRISTMAS = [30, 25, 25, 25, 25, 25, 25, 25, 30, 40, 70, 90];
const SUMMER = [10, 10, 15, 20, 30, 45, 50, 45, 25, 15, 10, 10];

test('analyzeTrend distingue demanda estable, temporada y tendencia', () => {
  const flat = analyzeTrend(series(FLAT), NOW);
  assert.strictEqual(flat.pattern, 'stable');
  assert.strictEqual(flat.direction, 'flat');
  assert.strictEqual(flat.next, null);

  const christmas = analyzeTrend(series(CHRISTMAS), NOW);
  assert.strictEqual(christmas.pattern, 'very-seasonal');
  assert.strictEqual(christmas.peakMonths[0], 11);
  // en octubre, el primer mes de temporada alta (noviembre) está a un mes: ya no da tiempo a contenido nuevo
  assert.deepStrictEqual([christmas.next.peak, christmas.next.monthsUntil, christmas.next.status], [10, 1, 'urgent']);
  assert.strictEqual(christmas.next.campaignFrom, 9);

  const summer = analyzeTrend(series(SUMMER), NOW);
  assert.strictEqual(summer.next.status, 'later');
  assert.strictEqual(summer.next.publishBy, (summer.next.peak + 9) % 12);

  // el crecimiento de fondo no se confunde con temporada
  const growing = analyzeTrend(series(new Array(12).fill(20), 1.4), NOW);
  assert.strictEqual(growing.pattern, 'stable');
  assert.strictEqual(growing.direction, 'rising');
  assert(growing.yearChange >= 35);

  assert.strictEqual(analyzeTrend(series(new Array(12).fill(0)), NOW).enough, false);
  assert.strictEqual(analyzeTrend([], NOW).enough, false);
});

test('buildTrendInsights cruza la tendencia con el estudio y alimenta el plan', () => {
  const report = [{
    keyword: 'cesta de navidad', country: 'ES', language: 'es', errors: [], ideas: [],
    suggestions: ['cesta de navidad gourmet', 'cesta regalo empresa'],
    keywordData: {
      'cesta de navidad': { search_volume: 9900, competition: 0.9, cpc: 0.8 },
      'cesta de navidad gourmet': { search_volume: 1300, competition: 0.3, cpc: 0.7 },
      'cesta regalo empresa': { search_volume: 880, competition: 0.4, cpc: 1.1 }
    }
  }];
  const trends = {
    fetchedAt: NOW.toISOString(),
    geo: 'ES',
    items: [
      { keyword: 'cesta de navidad', role: 'main', series: series(CHRISTMAS, 0.8),
        top: [{ query: 'cesta de navidad gourmet', value: 100 }, { query: 'lotes de navidad', value: 80 }],
        rising: [{ query: 'cesta de navidad sin alcohol', value: 5000, breakout: true }, { query: 'cesta de navidad gourmet', value: 120, breakout: false }] },
      { keyword: 'cesta regalo empresa', role: 'opportunity', series: series(FLAT, 1.4), top: [], rising: [] },
      { keyword: 'cesta rara', role: 'opportunity', series: [], top: [], rising: [], error: 'sin datos' }
    ]
  };
  const insights = buildTrendInsights(report, trends, NOW);

  assert.deepStrictEqual(insights.newQueries.map((query) => query.query), ['cesta de navidad sin alcohol']);
  assert.strictEqual(insights.coverage.covered, 1);
  assert.strictEqual(insights.seasonalCount, 1);
  const november = insights.calendar.find((month) => month.month === 10);
  assert.deepStrictEqual(november.peaks, ['cesta de navidad']);
  assert(insights.calendar[0].campaigns.includes('cesta de navidad'));
  assert(insights.findings.some((finding) => finding.title.includes('temporada alta')));
  assert(insights.findings.some((finding) => finding.title.includes('Demanda al alza y poca competencia')));
  assert(insights.findings.some((finding) => finding.title.includes('pierden interés')));
  assert(trendsToMarkdown(insights).includes('| cesta de navidad | Muy estacional |'));

  const plan = buildActionPlan(report, { trends });
  assert(plan.some((task) => task.area === 'Calendario'));
  assert(plan.some((task) => task.title.includes('consultas en auge')));
});

// ---------- Regresiones encontradas auditando un sitio real ----------

test('el contenido de <main> incluye su cabecera y el texto de sus formularios', async () => {
  const { parse } = await import('node-html-parser');
  const { stripChrome } = await import('../src/services/pageAuditService.js');
  const html = '<body><header>Menú del sitio</header><main><nav>Inicio / Contacto</nav><header><h1>Contacto</h1><p>Entradilla de la página</p></header><form><label>Tu nombre</label><input name="n"><button>Enviar</button></form><aside>Respondo en un día</aside></main><footer>Pie</footer></body>';
  const main = stripChrome(parse(html).querySelector('main'));
  assert.strictEqual(main.text.replace(/\s+/g, ' ').trim(), 'ContactoEntradilla de la páginaTu nombreRespondo en un día');
  // sin <main>, la cabecera y el pie del sitio no son contenido
  const body = stripChrome(parse('<body><header>Menú</header><p>Texto</p><footer>Pie</footer></body>').querySelector('body'));
  assert.strictEqual(body.text.trim(), 'Texto');
});

test('una keyword «similar» ajena al tema no cuenta en los totales', async () => {
  const { buildInsights } = await import('../shared/insights.js');
  const insights = buildInsights([{
    keyword: 'core web vitals', country: 'ES', language: 'es', suggestions: [], ideas: [], errors: [],
    keywordData: { 'core web vitals': { search_volume: 1000, competition: 0.2, cpc: 1, similar_keywords: [
      { keyword: 'speedtest', search_volume: 368000, cpc: 0.1 },
      { keyword: 'web vitals google', search_volume: 9000, cpc: 0.5 },
      { keyword: 'lighthouse', search_volume: 3000, cpc: 0.5 }
    ] } }
  }]);
  assert.strictEqual(insights.keywords.find((entry) => entry.keyword === 'speedtest').offTopic, true);
  // comparte palabras con la principal, o no la supera por tanto: se queda
  assert.strictEqual(insights.keywords.find((entry) => entry.keyword === 'web vitals google').offTopic, false);
  assert.strictEqual(insights.keywords.find((entry) => entry.keyword === 'lighthouse').offTopic, false);
  assert.strictEqual(insights.totals.volume, 13000);
  assert(insights.recommendations.some((item) => item.title.includes('ajenas al tema')));
});
