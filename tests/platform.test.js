import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildBrief, briefToMarkdown } from '../shared/brief.js';
import { buildInsights, classifyIntent, placesIn } from '../shared/insights.js';
import { mapKeywords } from '../shared/keywordMap.js';
import { buildActionPlan } from '../shared/plan.js';
import { analyzeContent } from '../shared/contentAnalysis.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const item = (keyword, data, extra = {}) => ({ keyword, country: 'ES', language: 'es', suggestions: [], ideas: [], keywordData: data, errors: [], ...extra });

// ---------- Problema clásico: negocio local ----------

test('negocio local: detecta la intención por ciudad y descarta las búsquedas de otra zona', () => {
  assert.deepStrictEqual(placesIn('Fontanero urgente en San Sebastián'), ['san sebastian']);
  assert.strictEqual(classifyIntent('fontanero madrid'), 'local');
  assert.strictEqual(classifyIntent('cómo llegar a madrid'), 'informational');
  assert.strictEqual(classifyIntent('zapatos que no se mojan'), 'general');

  const report = [item('fontanero madrid', {
    'fontanero madrid': { search_volume: 2400, competition: 0.9, cpc: 3 },
    'fontanero madrid barato': { search_volume: 300, competition: 0.3, cpc: 2 },
    'fontanero urgente sevilla': { search_volume: 480, competition: 0.2, cpc: 2 }
  }, { suggestions: ['fontanero madrid barato', 'fontanero urgente sevilla'] })];
  const insights = buildInsights(report);

  assert.strictEqual(insights.keywords.find((entry) => entry.keyword === 'fontanero urgente sevilla').offTarget, true);
  assert(!insights.opportunities.some((entry) => entry.keyword === 'fontanero urgente sevilla'));
  assert(!insights.quickWins.some((entry) => entry.keyword === 'fontanero urgente sevilla'));
  assert(insights.recommendations.some((entry) => entry.title.includes('otras zonas')));
  // el plan propone la parte local
  assert(buildActionPlan(report).some((task) => task.area === 'Local'));
});

// ---------- Problema clásico: qué escribir ----------

test('brief: intención, estructura y vocabulario salen del estudio', () => {
  const report = [item('pan casero', {
    'pan casero': { search_volume: 12100, competition: 0.2, cpc: 0.1 },
    'pan casero receta': { search_volume: 6600, competition: 0.1, cpc: 0.1 },
    'pan casero receta facil': { search_volume: 900, competition: 0.1, cpc: 0.1 },
    'como hacer pan casero': { search_volume: 3600, competition: 0.18, cpc: 0.08 }
  }, { suggestions: ['pan casero receta', 'pan casero receta facil'], ideas: [{ keyword: 'como hacer pan casero', group: 'pregunta' }] })];

  const brief = buildBrief(report, 'como hacer pan casero');
  assert.strictEqual(brief.intent, 'informational');
  assert.strictEqual(brief.inStudy, true);
  assert.strictEqual(brief.metrics.volume, 3600);
  assert(brief.terms.includes('receta'));
  assert(brief.outline.at(-1).heading === 'Preguntas frecuentes');

  const markdown = briefToMarkdown(brief);
  assert.match(markdown, /^# Brief de contenido: como hacer pan casero/);
  assert.match(markdown, /## Esquema propuesto/);

  // una keyword que no está en el estudio también tiene brief, y avisa de que no hay datos
  const outside = buildBrief(report, 'comprar panificadora');
  assert.strictEqual(outside.inStudy, false);
  assert.strictEqual(outside.intent, 'transactional');
  assert.match(briefToMarkdown(outside), /no está en el estudio/);
});

// ---------- Problema clásico: contenido para buscadores con IA ----------

test('auditoría de texto: premia la respuesta directa bajo cada subtítulo', () => {
  const answer = 'El pan casero necesita harina, agua, sal y levadura. Mezcla, amasa diez minutos y deja reposar una hora antes de hornear a doscientos grados.';
  const filler = Array.from({ length: 12 }, () => answer).join(' ');
  const direct = analyzeContent({ keyword: 'pan casero', text: `# Pan casero\n\n${answer}\n\n## ¿Qué ingredientes lleva?\n\n${answer}\n\n${filler}\n\n## ¿Cuánto tarda?\n\n${answer}\n\n${filler}` });
  const buried = analyzeContent({ keyword: 'pan casero', text: `# Pan casero\n\n${answer}\n\n## Ingredientes\n\n${filler}\n\n## Tiempo\n\n${filler}` });
  const status = (result, id) => result.checks.find((check) => check.id === id).status;

  assert.strictEqual(status(direct, 'answer-first'), 'ok');
  assert.strictEqual(status(direct, 'question-headings'), 'ok');
  assert.strictEqual(status(buried, 'answer-first'), 'fail');
  assert.strictEqual(status(buried, 'question-headings'), 'warn');
  assert(direct.score > buried.score);
});

// ---------- Problema clásico: qué página posiciona cada keyword ----------

test('mapa de keywords: página propia, coincidencia parcial, hueco y canibalización', () => {
  const urls = [
    'https://tienda.com/',
    'https://tienda.com/zapatillas-running',
    'https://tienda.com/zapatillas-running-hombre',
    'https://tienda.com/blog/zapatillas-trail',
    'https://tienda.com/ofertas/zapatillas-trail',
    'https://tienda.com/contacto'
  ];
  const map = Object.fromEntries(mapKeywords(['zapatillas running', 'zapatilla running hombre', 'zapatillas trail', 'botas de montaña', 'zapatillas running mujer'], urls).map((entry) => [entry.keyword, entry]));

  assert.strictEqual(map['zapatillas running'].url, 'https://tienda.com/zapatillas-running');
  // la página más concreta no compite con la general
  assert.deepStrictEqual(map['zapatillas running'].alternatives, []);
  // singular y plural son la misma keyword
  assert.strictEqual(map['zapatilla running hombre'].url, 'https://tienda.com/zapatillas-running-hombre');
  assert.strictEqual(map['zapatillas trail'].alternatives.length, 1);
  assert.strictEqual(map['botas de montaña'].url, null);
  assert.strictEqual(map['zapatillas running mujer'].coverage < 1, true);

  const report = [item('botas de montaña', { 'botas de montaña': { search_volume: 5000, competition: 0.5, cpc: 0.4 } })];
  const plan = buildActionPlan(report, { keywordMap: mapKeywords(['botas de montaña'], urls) });
  assert.match(plan[0].title, /Crear la página de «botas de montaña»/);
});

// ---------- Despliegue privado ----------

test('con SEO_AUTH la app pide credenciales en la interfaz y en la API', async () => {
  const resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-app-auth-'));
  const port = 41000 + Math.floor(Math.random() * 2000);
  const server = spawn(process.execPath, [path.join(ROOT, 'bin/seo.js'), 'serve', '--port', String(port)], {
    env: { ...process.env, SEO_AUTH: 'agencia:secreto', SEO_RESULTS_DIR: resultsDir, HOST: '127.0.0.1' },
    stdio: 'ignore'
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 50 && !ready; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      ready = await fetch(`${base}/api/health`).then((response) => response.ok, () => false);
    }
    assert(ready, 'el servidor no arrancó');

    const basic = (credentials) => ({ headers: { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` } });
    const anonymous = await fetch(`${base}/api/seo/reports`);
    assert.strictEqual(anonymous.status, 401);
    assert.match(anonymous.headers.get('www-authenticate'), /Basic/);
    assert.strictEqual((await fetch(`${base}/`)).status, 401);
    assert.strictEqual((await fetch(`${base}/api/seo/reports`, basic('agencia:otra'))).status, 401);
    assert.strictEqual((await fetch(`${base}/api/seo/reports`, basic('agencia:secreto'))).status, 200);
  } finally {
    server.kill();
    await fs.rm(resultsDir, { recursive: true, force: true });
  }
});

// ---------- Sitios en desarrollo ----------

test('auditoría local: un sitio en localhost se audita con permiso y se compara con la pasada anterior', async () => {
  const http = await import('node:http');
  const { auditUrl, assertPublicUrl } = await import('../src/services/pageAuditService.js');
  const { auditChanges } = await import('../src/services/studyService.js');

  const paragraph = 'El pan casero se hace con harina, agua, sal y levadura. Amasa diez minutos y deja reposar la masa una hora antes de hornear.';
  let title = 'Inicio';
  const site = http.createServer((req, res) => {
    if (req.url === '/robots.txt') return res.end('User-agent: *\nAllow: /\nSitemap: http://localhost/sitemap.xml\n');
    if (req.url !== '/pan') return res.writeHead(404).end('no');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<html lang="es"><head><title>${title}</title><meta name="viewport" content="width=device-width">
      <link rel="canonical" href="https://panaderia.example/pan"></head>
      <body><main><h1>Pan casero</h1><p>${paragraph}</p><a href="https://panaderia.example/recetas">recetas</a><a href="/contacto">contacto</a></main></body></html>`);
  });
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${site.address().port}/pan`;

  try {
    // sin permiso, una dirección local se rechaza; los metadatos de nube, siempre
    await assert.rejects(auditUrl(url), /sitios públicos/);
    await assert.rejects(assertPublicUrl('http://169.254.169.254/latest', { allowLocal: true }), /no se puede auditar/);
    // sin protocolo, en local se asume http
    assert.strictEqual((await assertPublicUrl('localhost:3000/x', { allowLocal: true })).protocol, 'http:');

    const first = await auditUrl(url, { keyword: 'pan casero', allowLocal: true });
    const status = (result, id) => result.checks.find((check) => check.id === id)?.status;
    assert.strictEqual(first.environment, 'local');
    assert.strictEqual(status(first, 'https'), 'skip');
    assert.strictEqual(status(first, 'speed'), 'skip');
    // la canónica apunta a la misma ruta en producción: correcto en desarrollo
    assert.strictEqual(status(first, 'canonical'), 'ok');
    // el enlace absoluto al dominio de producción cuenta como interno
    assert.strictEqual(first.stats.internalLinks, 2);
    assert.strictEqual(status(first, 'title-keyword'), 'fail');
    assert.strictEqual(status(first, 'robots'), 'ok');

    // se corrige el título y se vuelve a auditar: la comparación lo recoge
    title = 'Pan casero: receta paso a paso';
    const second = await auditUrl(url, { keyword: 'pan casero', allowLocal: true });
    const changes = auditChanges({ result: first, createdAt: new Date().toISOString() }, second);
    assert(changes.scoreDelta > 0);
    assert(changes.improved.includes('Keyword en el título'));
    assert.deepStrictEqual(changes.worsened, []);
  } finally {
    await new Promise((resolve) => site.close(resolve));
  }
});

test('auditoría local: una página que se pinta con JavaScript se señala como vacía', async () => {
  const http = await import('node:http');
  const { auditUrl } = await import('../src/services/pageAuditService.js');
  const site = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  try {
    const result = await auditUrl(`http://127.0.0.1:${site.address().port}/`, { allowLocal: true });
    assert.strictEqual(result.checks.find((check) => check.id === 'rendered').status, 'fail');
  } finally {
    await new Promise((resolve) => site.close(resolve));
  }
});
