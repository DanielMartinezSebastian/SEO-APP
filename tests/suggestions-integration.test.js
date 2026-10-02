import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const REPORT = 'seo_report_full_2025-01-08T10-16-07-163.json';
const CSV = 'seo_report_summary_2025-01-08T10-16-07-163.csv';

const sampleReport = () => [
  {
    keyword: 'zapatos',
    country: 'ES',
    language: 'es',
    domain: 'zapatos.es',
    timestamp: '2025-01-08T10:16:07.163Z',
    suggestions: ['zapatos mujer', 'zapatos nike', 'zapatos raros'],
    keywordData: {
      'zapatos mujer': { search_volume: 0, competition: 0, cpc: 0 },
      zapatos: { search_volume: 135000, competition: 0.98, cpc: 0.31 }
    },
    domainData: { 'zapatos.es': { traffic: 1000, keyword_count_top10: 10 } },
    urlAnalysis: { 'https://www.zapatos.es': { words: 1404 } },
    errors: []
  }
];

let resultsDir;
let server;
let baseUrl;
let service;

before(async () => {
  // La carpeta de resultados se fija antes de cargar la app para no tocar data/results
  resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-app-test-'));
  process.env.SEO_RESULTS_DIR = resultsDir;
  await fs.writeFile(path.join(resultsDir, REPORT), JSON.stringify(sampleReport()));
  await fs.writeFile(path.join(resultsDir, CSV), 'Keyword\nzapatos\n');
  await fs.writeFile(path.join(resultsDir, 'secreto.json'), '{"secret":1}');

  service = await import('../src/services/keywordService.js');
  const { default: app } = await import('../src/server/app.js');
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/seo`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(resultsDir, { recursive: true, force: true });
});

const post = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});

test('pendingSuggestions: una sugerencia con volumen 0 no está pendiente', () => {
  assert.deepStrictEqual([...service.pendingSuggestions(sampleReport())], ['zapatos nike', 'zapatos raros']);
});

test('mergeSuggestionsIntoReport añade datos y marca las sugerencias sin datos', () => {
  const original = sampleReport();
  const merged = service.mergeSuggestionsIntoReport(
    original,
    { 'zapatos nike': { search_volume: 9900, competition: 1, cpc: 0.2 } },
    new Set(['zapatos nike', 'zapatos raros'])
  );

  assert.strictEqual(merged[0].keywordData['zapatos nike'].search_volume, 9900);
  assert.deepStrictEqual(merged[0].keywordData['zapatos raros'], { no_data: true });
  assert.strictEqual(service.pendingSuggestions(merged).size, 0);
  assert.strictEqual(original[0].keywordData['zapatos nike'], undefined, 'no debe modificar el original');
});

test('mergeSuggestionsIntoReport deja pendientes las sugerencias que no se pudieron consultar', () => {
  const merged = service.mergeSuggestionsIntoReport(sampleReport(), {}, new Set(['zapatos nike']));
  assert.deepStrictEqual([...service.pendingSuggestions(merged)], ['zapatos raros']);
});

test('getSummary usa el dominio guardado en el reporte', () => {
  const analyzer = new service.KeywordAnalyzer();
  const [item] = sampleReport();
  analyzer.results.set(item.keyword, item);
  const [summary] = analyzer.getSummary();
  assert.strictEqual(summary.domainTraffic, 1000);
  assert.strictEqual(summary.pageWords, 1404);
});

test('GET /reports lista keywords y fecha ISO', async () => {
  const body = await (await fetch(`${baseUrl}/reports`)).json();
  assert.strictEqual(body.count, 1);
  assert.strictEqual(body.reports[0].timestamp, '2025-01-08T10:16:07.163Z');
  assert.deepStrictEqual(body.reports[0].keywords, ['zapatos']);
  assert.strictEqual(body.reports[0].country, 'ES');
});

test('los endpoints rechazan nombres de archivo fuera de data/results', async () => {
  const traversal = [
    ['GET', `${baseUrl}/download/..%2F..%2Fpackage.json`],
    ['GET', `${baseUrl}/download/secreto.json`],
    ['GET', `${baseUrl}/report/seo_report_full_%2F..%2Fsecreto.json`],
    ['DELETE', `${baseUrl}/report/seo_report_%2F..%2Fsecreto.json`]
  ];
  for (const [method, url] of traversal) {
    const response = await fetch(url, { method });
    assert.strictEqual(response.status, 400, `${method} ${url}`);
  }

  const response = await post(`${baseUrl}/analyze-suggestions`, { filename: 'seo_report_full_/../secreto.json' });
  assert.strictEqual(response.status, 400);

  await fs.access(path.join(resultsDir, 'secreto.json'));
});

test('GET /report y /download sirven un reporte válido', async () => {
  const report = await (await fetch(`${baseUrl}/report/${REPORT}`)).json();
  assert.strictEqual(report.data[0].keyword, 'zapatos');

  const download = await fetch(`${baseUrl}/download/${CSV}`);
  assert.strictEqual(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);

  const missing = await fetch(`${baseUrl}/report/seo_report_full_2000-01-01T00-00-00-000.json`);
  assert.strictEqual(missing.status, 404);
});

test('POST /analyze valida la entrada con 400', async () => {
  const cases = [
    { keywords: [] },
    { keywords: [123] },
    { keywords: ['   '] },
    { keywords: ['a'], country: 'ES&x=1' },
    { keywords: ['a'], language: 'español' },
    { keywords: Array.from({ length: 26 }, (_, i) => `kw${i}`) },
    '{mal'
  ];
  for (const body of cases) {
    const response = await post(`${baseUrl}/analyze`, body);
    assert.strictEqual(response.status, 400, JSON.stringify(body));
    assert.strictEqual((await response.json()).success, false);
  }
});

test('la API no envía cabeceras CORS y responde 404 en JSON a rutas desconocidas', async () => {
  const response = await fetch(`${baseUrl}/no-existe`, { headers: { Origin: 'https://example.com' } });
  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.headers.get('access-control-allow-origin'), null);
  assert.strictEqual((await response.json()).success, false);
});

test('las auditorías de contenido se guardan, se listan y se borran', async () => {
  const url = `${baseUrl}/report/${REPORT}/audits`;
  assert.deepStrictEqual((await (await fetch(url)).json()).audits, []);

  const invalid = await post(url, { keyword: 'zapatos' });
  assert.strictEqual(invalid.status, 400);

  const saved = await post(url, { keyword: 'zapatos', title: 'Zapatos de mujer', text: 'Los zapatos de mujer más cómodos. '.repeat(20) });
  assert.strictEqual(saved.status, 201);
  const { audit } = await saved.json();
  assert.strictEqual(audit.name, 'Zapatos de mujer');
  assert(audit.result.score > 0);
  // el campo semántico sale del estudio: «mujer» viene de la sugerencia «zapatos mujer»
  assert(audit.result.related.used.includes('mujer'));

  assert.strictEqual((await (await fetch(url)).json()).audits.length, 1);
  assert.strictEqual((await fetch(`${url}/no-existe`, { method: 'DELETE' })).status, 404);
});

test('la ficha del estudio se guarda y valida el sitio y el color', async () => {
  const url = `${baseUrl}/report/${REPORT}/study`;
  const patch = (body) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const saved = await (await patch({ name: 'Estudio de prueba', client: 'Calzados Ñandú', author: 'Agencia', accent: '#0057b8' })).json();
  assert.strictEqual(saved.study.client, 'Calzados Ñandú');
  // lo que no se envía se conserva: las auditorías siguen ahí
  assert.strictEqual(saved.study.audits.length, 1);

  assert.strictEqual((await patch({ accent: 'rojo' })).status, 400);
  assert.strictEqual((await patch({ site: 'no es un dominio' })).status, 400);
});

test('insights, plan y brief se sirven en JSON y en Markdown', async () => {
  const insights = await (await fetch(`${baseUrl}/report/${REPORT}/insights`)).json();
  assert(insights.insights.keywords.length >= 4);

  const plan = await (await fetch(`${baseUrl}/report/${REPORT}/plan`)).json();
  assert(plan.plan.length > 0);
  assert.deepStrictEqual(plan.plan.map((task) => task.priority), plan.plan.map((_, index) => index + 1));

  const brief = await fetch(`${baseUrl}/report/${REPORT}/brief?keyword=zapatos&format=md`);
  assert.match(brief.headers.get('content-type'), /markdown/);
  assert.match(await brief.text(), /# Brief de contenido: zapatos/);
  assert.strictEqual((await fetch(`${baseUrl}/report/${REPORT}/brief`)).status, 400);
});

test('la auditoría de URL: direcciones locales solo para quien llama desde la red local', async () => {
  const audit = (url, headers = {}) => fetch(`${baseUrl}/audit/url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ url })
  });
  const local = `http://127.0.0.1:${server.address().port}/`;

  // esta petición sale del propio equipo: puede auditar un sitio local (aquí, la propia app)
  const own = await audit(local);
  assert.strictEqual(own.status, 200);
  assert.strictEqual((await own.json()).result.environment, 'local');

  // detrás de un proxy inverso la petición viene de fuera: no puede usar la app para leer la red interna
  const proxied = await audit(local, { 'X-Forwarded-For': '203.0.113.7' });
  assert.strictEqual(proxied.status, 400);
  assert.match((await proxied.json()).error, /sitios públicos/);

  // nunca: metadatos de nube, otros protocolos, vacío
  for (const url of ['http://169.254.169.254/latest/meta-data', 'file:///etc/passwd', '']) {
    assert.strictEqual((await audit(url)).status, 400, url);
  }
});

test('los entregables: PDF, Markdown y CSV de keywords', async () => {
  const pdf = await fetch(`${baseUrl}/report/${REPORT}/pdf`);
  assert.strictEqual(pdf.status, 200);
  assert.strictEqual(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('content-disposition'), /informe_seo_.*\.pdf/);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.strictEqual(bytes.subarray(0, 5).toString(), '%PDF-');
  // portada + resumen, plan, oportunidades, intención, contenido, auditorías y metodología
  assert((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 8);

  const markdown = await (await fetch(`${baseUrl}/report/${REPORT}/markdown`)).text();
  assert.match(markdown, /^# Estudio de prueba/);
  assert.match(markdown, /Calzados Ñandú/);
  assert.match(markdown, /## 2\. Plan de acción/);
  assert.match(markdown, /## 6\. Auditorías/);

  const csv = await (await fetch(`${baseUrl}/report/${REPORT}/keywords.csv`)).text();
  assert.match(csv, /keyword,tipo,keyword_principal,intencion,busquedas_mes,competencia,cpc,puntuacion/);
  assert.match(csv, /zapatos,main,zapatos,general,135000/);

  assert.strictEqual((await fetch(`${baseUrl}/report/..%2Fsecreto.json/pdf`)).status, 400);
});

test('DELETE /report borra el JSON, su CSV y sus auditorías', async () => {
  const body = await (await fetch(`${baseUrl}/report/${REPORT}`, { method: 'DELETE' })).json();
  assert.deepStrictEqual(body.filesDeleted, { json: REPORT, csv: CSV });
  await assert.rejects(fs.access(path.join(resultsDir, REPORT)));
  await assert.rejects(fs.access(path.join(resultsDir, REPORT.replace('_full_', '_study_'))));
});
