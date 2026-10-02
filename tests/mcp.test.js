import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Un agente de IA conectado por MCP: arranca `seo mcp` como proceso hijo y usa sus herramientas de verdad.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = 'seo_report_full_2025-01-08T10-16-07-163.json';

const report = [
  {
    keyword: 'pan casero',
    country: 'ES',
    language: 'es',
    timestamp: '2025-01-08T10:16:07.163Z',
    suggestions: ['pan casero receta', 'pan casero sin levadura'],
    ideas: [{ keyword: 'como hacer pan casero', group: 'pregunta' }],
    keywordData: {
      'pan casero': { search_volume: 12100, competition: 0.2, cpc: 0.1, similar_keywords: [{ keyword: 'receta pan', search_volume: 2400, cpc: 0.1 }] },
      'pan casero receta': { search_volume: 6600, competition: 0.1, cpc: 0.1 },
      'pan casero sin levadura': { search_volume: 880, competition: 0.1, cpc: 0.05 },
      'como hacer pan casero': { search_volume: 3600, competition: 0.18, cpc: 0.08 }
    },
    errors: []
  }
];

let resultsDir;
let client;

before(async () => {
  resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-app-mcp-'));
  await fs.writeFile(path.join(resultsDir, REPORT), JSON.stringify(report));
  client = new Client({ name: 'test-agent', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'bin/seo.js'), 'mcp'],
    env: { ...process.env, SEO_RESULTS_DIR: resultsDir },
    stderr: 'ignore'
  }));
});

after(async () => {
  await client.close();
  await fs.rm(resultsDir, { recursive: true, force: true });
});

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return { ...result, text: result.content[0].text };
};

test('el servidor MCP anuncia las herramientas con su descripción', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  for (const expected of ['list_studies', 'create_study', 'get_insights', 'get_keywords', 'content_brief', 'audit_text', 'audit_url', 'action_plan', 'client_report', 'update_study']) {
    assert(names.includes(expected), `falta ${expected}`);
  }
  assert(tools.every((tool) => tool.description.length > 40));
});

test('un agente lee el estudio: lista, estrategia y keywords filtradas', async () => {
  const studies = JSON.parse((await call('list_studies')).text);
  assert.strictEqual(studies[0].filename, REPORT);

  const insights = JSON.parse((await call('get_insights', { study: 'latest' })).text);
  assert(insights.quickWins.some((entry) => entry.keyword === 'pan casero receta'));
  assert(insights.conclusions.length > 0);

  const ideas = JSON.parse((await call('get_keywords', { type: 'idea' })).text);
  assert.deepStrictEqual(ideas.keywords.map((entry) => entry.keyword), ['como hacer pan casero']);
});

test('ciclo de redacción: brief, auditoría de un borrador flojo y de uno corregido', async () => {
  const brief = (await call('content_brief', { keyword: 'como hacer pan casero' })).text;
  assert.match(brief, /# Brief de contenido: como hacer pan casero/);
  assert.match(brief, /Informativa/);

  const weak = JSON.parse((await call('audit_text', { text: 'El pan está rico.', keyword: 'como hacer pan casero', study: 'latest' })).text);
  const paragraph = 'Mezcla la harina con el agua y la sal. Amasa diez minutos y deja reposar la masa una hora. Hornea a doscientos grados hasta que la corteza suene hueca.';
  const strong = JSON.parse((await call('audit_text', {
    keyword: 'como hacer pan casero',
    title: 'Como hacer pan casero: receta paso a paso',
    metaDescription: 'Aprende como hacer pan casero con esta receta sencilla: ingredientes, amasado, reposo y horneado explicados paso a paso, con o sin levadura.',
    text: ['# Como hacer pan casero', `Para saber como hacer pan casero solo hacen falta harina, agua, sal y tiempo. ${paragraph}`,
      '## ¿Qué ingredientes lleva la receta?', paragraph, '## ¿Cómo se amasa?', paragraph, '## Pan casero sin levadura', paragraph,
      ...Array.from({ length: 30 }, () => paragraph), 'Más en [recetas](/recetas).'].join('\n\n'),
    study: 'latest',
    save: true,
    name: 'Receta de pan'
  })).text);

  assert(weak.score < 40, `borrador flojo: ${weak.score}`);
  assert(strong.score >= 75, `borrador corregido: ${strong.score}`);
  assert(strong.related.used.includes('receta'));
});

test('el plan y el informe recogen lo guardado; los errores vuelven como resultado legible', async () => {
  await call('update_study', { client: 'Panadería Sol', name: 'Blog de recetas' });
  const reportText = (await call('client_report')).text;
  assert.match(reportText, /^# Blog de recetas/);
  assert.match(reportText, /Panadería Sol/);
  assert.match(reportText, /Texto: Receta de pan/);

  assert.match((await call('action_plan')).text, /### 1\./);

  // por MCP las direcciones locales están permitidas (sitios en desarrollo); los metadatos de nube, nunca
  const failed = await call('audit_url', { url: 'http://169.254.169.254/latest/meta-data' });
  assert.strictEqual(failed.isError, true);
  assert.match(failed.text, /no se puede auditar/);
});
