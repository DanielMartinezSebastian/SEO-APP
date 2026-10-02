import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { buildProjectView, projectToMarkdown } from '../shared/project.js';

// Un sitio de servicios con dos públicos: quien quiere una web y quien quiere automatizar procesos
const WEB = 'seo_report_full_2025-01-08T10-16-07-163.json';
const AUTO = 'seo_report_full_2025-01-09T10-16-07-163.json';

const item = (keyword, data, suggestions = []) => ({ keyword, country: 'ES', language: 'es', timestamp: '2025-01-08T10:16:07.163Z', suggestions, ideas: [], keywordData: data, errors: [] });
const webReport = [item('diseño web empresas', {
  'diseño web empresas': { search_volume: 2400, competition: 0.8, cpc: 6 },
  'diseño web barato': { search_volume: 880, competition: 0.3, cpc: 3 },
  'programador freelance': { search_volume: 590, competition: 0.3, cpc: 2 }
}, ['diseño web barato', 'programador freelance'])];
const autoReport = [item('automatizar procesos', {
  'automatizar procesos': { search_volume: 720, competition: 0.2, cpc: 9 },
  'software a medida': { search_volume: 5400, competition: 0.25, cpc: 7 },
  'programador freelance': { search_volume: 590, competition: 0.3, cpc: 2 }
}, ['software a medida', 'programador freelance'])];

const study = { name: '', audits: [], pageAudits: [], trends: null };
const studies = [{ filename: WEB, report: webReport, study }, { filename: AUTO, report: autoReport, study }];

test('proyecto: prioriza targets, detecta solapes y sitúa cada target en su página', () => {
  const project = {
    name: 'Servicios', site: 'ejemplo.com',
    targets: [
      { id: 'a', name: 'Web', audience: 'Pymes sin web', studies: [WEB] },
      { id: 'b', name: 'Automatización', studies: [AUTO] },
      { id: 'c', name: 'Formación', studies: [] }
    ],
    siteUrls: { urls: ['https://ejemplo.com/', 'https://ejemplo.com/diseno-web-empresas', 'https://ejemplo.com/blog/programador-freelance'], total: 3 }
  };
  const view = buildProjectView(project, studies);

  assert.strictEqual(view.totals.targets, 3);
  // «programador freelance» está en los dos estudios y cuenta una sola vez
  assert.strictEqual(view.totals.keywords, 5);
  assert.strictEqual(view.totals.volume, 2400 + 880 + 590 + 720 + 5400);

  // el target fácil y con valor va primero; el que no tiene estudio, último
  assert.deepStrictEqual(view.targets.map((target) => target.name), ['Automatización', 'Web', 'Formación']);
  assert.strictEqual(view.targets[2].priorityScore, 0);

  assert.deepStrictEqual(view.overlaps.map((entry) => entry.keyword), ['programador freelance']);
  assert.deepStrictEqual(view.overlaps[0].targets.sort(), ['Automatización', 'Web']);

  const web = view.targets.find((target) => target.name === 'Web');
  const auto = view.targets.find((target) => target.name === 'Automatización');
  assert.strictEqual(web.page, 'https://ejemplo.com/diseno-web-empresas');
  assert.strictEqual(auto.page, null);
  assert(auto.gaps.includes('automatizar procesos'));

  // la página del blog recibe la misma keyword desde los dos targets
  const shared = view.pages.find((page) => page.shared);
  assert.strictEqual(shared.path, '/blog/programador-freelance');

  const titles = view.findings.map((finding) => finding.title);
  assert(titles.some((title) => title.includes('Empezar por «Automatización»')));
  assert(titles.some((title) => title.includes('Sin página propia: «Automatización»')));
  assert(titles.some((title) => title.includes('sin estudio')));
  assert(titles.some((title) => title.includes('más de un target')));

  assert(view.plan.some((task) => task.area === 'Arquitectura' && task.title.includes('página de aterrizaje de «Automatización»')));
  assert(view.plan.some((task) => task.title.includes('keywords repetidas')));
  assert.deepStrictEqual(view.plan.map((task) => task.priority), view.plan.map((_, index) => index + 1));
  // la vista se puede serializar tal cual (la devuelve la API)
  assert.doesNotThrow(() => JSON.stringify(view));
  assert(projectToMarkdown(project, view).includes('| 1 | Automatización |'));
});

// ---------- API ----------

let resultsDir;
let server;
let baseUrl;

before(async () => {
  resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-app-projects-'));
  process.env.SEO_RESULTS_DIR = resultsDir;
  await fs.writeFile(path.join(resultsDir, WEB), JSON.stringify(webReport));
  await fs.writeFile(path.join(resultsDir, AUTO), JSON.stringify(autoReport));
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

const send = async (method, url, body) => {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
};

test('API de proyectos: crear, añadir targets con estudios existentes, ver, informe y borrar', async () => {
  assert.strictEqual((await send('POST', '/projects', {})).status, 400);
  assert.strictEqual((await send('GET', '/projects/..%2Fsecreto')).status, 400);
  assert.strictEqual((await send('GET', '/projects/00000000')).status, 404);

  const created = await send('POST', '/projects', { name: 'Servicios', site: 'http://localhost:3000' });
  assert.strictEqual(created.status, 201);
  const { id } = created.body.project;
  assert.match(id, /^[a-f0-9]{8}$/);
  assert.strictEqual(created.body.project.site, 'localhost:3000');

  assert.strictEqual((await send('POST', `/projects/${id}/targets`, { name: '' })).status, 400);
  assert.strictEqual((await send('POST', `/projects/${id}/targets`, { name: 'Web', studies: ['../x.json'] })).status, 400);
  assert.strictEqual((await send('POST', `/projects/${id}/targets`, { name: 'Web', studies: ['seo_report_full_2020-01-01T00-00-00-000.json'] })).status, 404);

  const first = await send('POST', `/projects/${id}/targets`, { name: 'Web', audience: 'Pymes', studies: [WEB] });
  assert.strictEqual(first.status, 201);
  assert.strictEqual((await send('POST', `/projects/${id}/targets`, { name: 'web', studies: [WEB] })).status, 400);
  const second = await send('POST', `/projects/${id}/targets`, { name: 'Automatización', studies: [AUTO] });
  assert.strictEqual(second.body.view.overlaps.length, 1);
  assert.strictEqual(second.body.view.targets[0].name, 'Automatización');

  const list = await send('GET', '/projects');
  assert.strictEqual(list.body.projects.length, 1);
  assert.strictEqual(list.body.projects[0].totals.targets, 2);
  // los archivos de proyecto no aparecen como estudios
  assert.strictEqual((await send('GET', '/reports')).body.reports.length, 2);

  const markdown = await (await fetch(`${baseUrl}/projects/${id}?format=md`)).text();
  assert(markdown.startsWith('# Servicios'));
  assert(markdown.includes('## Plan de acción'));

  // un estudio borrado no rompe el proyecto: se señala
  await send('DELETE', `/report/${WEB}`);
  const after = await send('GET', `/projects/${id}`);
  assert.deepStrictEqual(after.body.view.targets.find((target) => target.name === 'Web').missingStudies, [WEB]);

  const targetId = after.body.project.targets[0].id;
  assert.strictEqual((await send('DELETE', `/projects/${id}/targets/${targetId}`)).body.view.targets.length, 1);
  assert.strictEqual((await send('DELETE', `/projects/${id}`)).status, 200);
  assert.strictEqual((await send('GET', `/projects/${id}`)).status, 404);
  // borrar el proyecto conserva sus estudios
  assert.strictEqual((await send('GET', '/reports')).body.reports.length, 1);
});
