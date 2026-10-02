#!/usr/bin/env node
// CLI de SEO App. Hace lo mismo que la interfaz web, sin servidor: pensada para terminal, scripts y agentes de IA.
// Con --json la salida estándar es solo JSON; los avisos y el progreso van siempre a stderr.
import fs from 'fs/promises';
import path from 'path';
import Table from 'cli-table3';
import * as studies from '../src/services/studyService.js';
import * as projects from '../src/services/projectService.js';
import { projectToMarkdown } from '../shared/project.js';
import { INTENT_LABELS, TYPE_LABELS } from '../shared/insights.js';
import { planToMarkdown } from '../shared/plan.js';
import { describeTrend, trendsToMarkdown } from '../shared/seasonality.js';

const HELP = `SEO App — estudios de keywords, auditorías e informes

Uso: seo <comando> [argumentos] [opciones]

Estudios
  seo studies                              Lista los estudios guardados
  seo new "kw1, kw2" [opciones]            Crea un estudio (unos 5 s por keyword)
      --country ES --language es           Mercado (por defecto ES / es)
      --name "…" --client "…" --site dominio.com --author "…"
  seo show [estudio]                       Resumen y conclusiones
  seo set [estudio] --client "…" …         Cambia la ficha (nombre, cliente, sitio, autor, notas, accent #rrggbb)
  seo delete <estudio> --yes               Borra el estudio y sus archivos

Proyectos (un sitio con varios targets: públicos o líneas de negocio)
  seo projects                             Lista los proyectos
  seo project new "Nombre" [--site dominio|localhost:3000 --client "…"]
  seo project target [proyecto] "Nombre del target" --keywords "kw1, kw2" [--audience "a quién va" --page /ruta]
      Crea el estudio del target (o enlaza uno existente con --study archivo)
  seo project show [proyecto]              Prioridad de targets, solapes, páginas, conclusiones
  seo project plan [proyecto]              Plan de acción conjunto
  seo project site [proyecto] [--pages 40] Audita el sitio por su sitemap y sitúa cada target en sus páginas
  seo project report [proyecto] [--out ruta]   Informe del proyecto en Markdown
  seo project delete <proyecto> --yes      Borra el proyecto (conserva sus estudios)

Análisis
  seo keywords [estudio]                   Keywords por puntuación
      --top 30 --type main|suggestion|idea|similar --intent transactional|commercial|informational|local|general
  seo insights [estudio]                   Oportunidades, victorias rápidas, intención y temas
  seo map [estudio] [--refresh]            Qué URL del sitio cubre cada keyword (lee el sitemap)
  seo trends [estudio] [--refresh|--retry] Estacionalidad, tendencia, consultas en auge y calendario (Google Trends)
      --keywords "kw1, kw2"               Añade keywords concretas (máximo 10 por petición)
  seo plan [estudio]                       Plan de acción priorizado
  seo brief [estudio] "<keyword>"          Brief de contenido en Markdown

Auditorías
  seo audit text <archivo|-> --keyword "…" [--title "…" --meta "…"] [--study estudio] [--save --name "…"]
  seo audit url <url> [--keyword "…"] [--study estudio] [--save] [--watch 5]
      La URL puede ser local (http://localhost:3000/…). Con --save compara con la auditoría anterior;
      con --watch repite cada N segundos y avisa cuando algo cambia.
  seo site [estudio] [--pages 40]          Audita el sitio del estudio por su sitemap y lo guarda
  seo site --site localhost:3000           Lo mismo para cualquier sitio, sin estudio (vale local o red interna)

Entregables
  seo report [estudio] --format pdf|md|csv [--out ruta]

Servicios
  seo serve [--port 3000]                  Arranca la interfaz web y la API
  seo mcp                                  Servidor MCP por stdio para agentes de IA

Opciones comunes
  --json     Salida en JSON (para scripts y agentes)
  [estudio]  Nombre de archivo del estudio; si se omite o es «latest», el más reciente

Código de salida: 0 si va bien, 1 si hay un error (el mensaje va a stderr).`;

// ---------- Argumentos ----------

const BOOLEAN_FLAGS = new Set(['json', 'save', 'yes', 'help', 'md', 'csv', 'refresh', 'retry']);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split(/=(.*)/s);
      if (inline !== undefined) flags[name] = inline;
      else if (BOOLEAN_FLAGS.has(name) || argv[index + 1] === undefined || argv[index + 1].startsWith('--')) flags[name] = true;
      else flags[name] = argv[++index];
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, ...rest] = positional;

const out = (text) => process.stdout.write(`${text}\n`);
const info = (text) => process.stderr.write(`${text}\n`);
const emit = (data, human) => out(flags.json ? JSON.stringify(data, null, 2) : human(data));

const int = (value) => (typeof value === 'number' ? Math.round(value).toLocaleString('es-ES') : '—');
const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : '—');
const euro = (value) => (typeof value === 'number' ? `${value.toFixed(2).replace('.', ',')} €` : '—');
const table = (head, rows) => {
  const result = new Table({ head, style: { head: [], border: [] } });
  result.push(...rows);
  return result.toString();
};
const keywordRows = (entries) => entries.map((entry) => [entry.keyword, TYPE_LABELS[entry.type], INTENT_LABELS[entry.intent], int(entry.volume), percent(entry.competition), euro(entry.cpc), entry.score]);
const KEYWORD_HEAD = ['Keyword', 'Tipo', 'Intención', 'Búsquedas', 'Comp.', 'CPC', 'Punt.'];

const STATUS = { ok: '✔ Correcto ', warn: '● Mejorable', fail: '✖ Falla    ', skip: '· Sin eval.' };
const auditText = (result, heading) => [
  `${heading}: ${result.score}/100 — ${result.verdict}`,
  '',
  ...result.checks.map((check) => `${STATUS[check.status]}  ${check.label}\n             ${check.detail}`)
].join('\n');

const study = (reference) => studies.resolveFilename(reference);

async function readInput(source) {
  if (!source || source === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return fs.readFile(source, 'utf8');
}

// ---------- Comandos ----------

const commands = {
  async studies() {
    const list = await studies.listStudies();
    emit(list, () => (list.length === 0
      ? 'No hay estudios. Crea uno con: seo new "keyword 1, keyword 2"'
      : table(['Estudio', 'Cliente', 'Keywords', 'Búsquedas', 'Archivo'], list.map((item) => [item.name, item.client || '—', item.totals.keywords, int(item.totals.volume), item.filename]))));
  },

  async new() {
    const keywords = (rest[0] || '').split(',').map((keyword) => keyword.trim()).filter(Boolean);
    info(`Analizando ${keywords.length} keywords (unos ${keywords.length * 5} s)…`);
    const created = await studies.createStudy({ ...flags, keywords });
    const insights = await studies.getInsights(created.filename);
    emit({ filename: created.filename, summary: created.summary, conclusions: insights.recommendations },
      () => [`Estudio creado: ${created.filename}`, `${insights.totals.keywords} keywords · ${int(insights.totals.volume)} búsquedas al mes`, '',
        ...insights.recommendations.map((item) => `• ${item.title}: ${item.text}`)].join('\n'));
  },

  async show() {
    const { summary, study: sheet } = await studies.getStudy(await study(rest[0]));
    const insights = await studies.getInsights(summary.filename);
    emit({ ...summary, study: { ...sheet, audits: sheet.audits.length, pageAudits: sheet.pageAudits.length }, conclusions: insights.recommendations },
      () => [
        `${summary.name}  (${summary.filename})`,
        [summary.client && `Cliente: ${summary.client}`, summary.site && `Sitio: ${summary.site}`, summary.country && `Mercado: ${summary.country}/${summary.language}`].filter(Boolean).join(' · '),
        `${summary.totals.keywords} keywords · ${int(summary.totals.volume)} búsquedas al mes · ${summary.totals.quickWins} victorias rápidas · ${summary.totals.audits} auditorías`,
        '',
        ...insights.recommendations.map((item) => `• ${item.title}: ${item.text}`)
      ].filter((line) => line !== '').join('\n'));
  },

  async set() {
    const { json: _json, ...changes } = flags;
    const { audits, pageAudits, ...saved } = await studies.updateStudy(await study(rest[0]), changes);
    emit(saved, () => `Ficha actualizada: ${Object.entries(saved).filter(([key, value]) => value && typeof value === 'string' && key !== 'createdAt').map(([key, value]) => `${key}=${value}`).join(' · ')}`);
  },

  async delete() {
    if (!rest[0] || !flags.yes) throw new Error('Indica el estudio y confirma con --yes: seo delete <estudio> --yes');
    const deleted = await studies.deleteStudy(await study(rest[0]));
    emit(deleted, () => `Eliminado ${deleted.json}`);
  },

  async projects() {
    const list = await projects.listProjects();
    emit(list, () => (list.length === 0
      ? 'No hay proyectos. Crea uno con: seo project new "Nombre" --site dominio.com'
      : table(['Proyecto', 'Sitio', 'Targets', 'Keywords', 'Búsquedas', 'Id'], list.map((item) => [item.name, item.site || '—', item.targets.map((target) => target.name).join('\n') || '—', item.totals.keywords, int(item.totals.volume), item.id]))));
  },

  async project() {
    const [action, ...args] = rest;
    const showView = ({ project, view }) => [
      `${project.name}  (${project.id})${project.site ? ` · ${project.site}` : ''}`,
      `${view.totals.targets} targets · ${view.totals.keywords} keywords · ${int(view.totals.volume)} búsquedas al mes`,
      '',
      view.targets.length ? table(['N.º', 'Target', 'Búsquedas', 'Vict. rápidas', 'Comp.', 'Facilidad', 'Prioridad', 'Página'],
        view.targets.map((target) => [target.priority, target.name, int(target.totals.volume), target.quickWins, percent(target.avgCompetition), `${target.ease}/100`, `${target.priorityScore}/100`, target.page ? target.page.replace(/^https?:\/\/[^/]+/, '') || '/' : (target.coverage === null ? '—' : 'sin página')]))
        : 'Sin targets. Añade uno con: seo project target "Nombre" --keywords "kw1, kw2"',
      '',
      ...view.findings.map((finding) => `• ${finding.title}. ${finding.text}`),
      view.overlaps.length ? `\nKEYWORDS REPETIDAS\n${table(['Keyword', 'Búsquedas', 'Targets', 'Asignar a'], view.overlaps.slice(0, 15).map((entry) => [entry.keyword, int(entry.volume), entry.targets.join(', '), entry.suggestedOwner]))}` : ''
    ].join('\n').trim();

    if (action === 'new') {
      const created = await projects.createProject({ ...flags, name: args[0] });
      return emit(created, () => `Proyecto creado: ${created.name} (${created.id}). Añade targets con: seo project target ${created.id} "Nombre" --keywords "kw1, kw2"`);
    }
    if (action === 'target') {
      // seo project target "Nombre"   o   seo project target <proyecto> "Nombre"
      const [reference, name] = args.length >= 2 ? args : [undefined, args[0]];
      const keywords = typeof flags.keywords === 'string' ? flags.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean) : [];
      if (keywords.length) info(`Creando el estudio del target (${keywords.length} keywords, unos ${keywords.length * 5} s)…`);
      const result = await projects.addTarget(await projects.resolveProject(reference), {
        name, audience: typeof flags.audience === 'string' ? flags.audience : undefined, page: typeof flags.page === 'string' ? flags.page : undefined,
        keywords, studies: typeof flags.study === 'string' ? [await study(flags.study)] : [], country: typeof flags.country === 'string' ? flags.country : undefined, language: typeof flags.language === 'string' ? flags.language : undefined
      });
      return emit(result, showView);
    }
    if (action === 'site') {
      info('Leyendo el sitemap y comprobando las páginas…');
      const result = await projects.runProjectSiteAudit(await projects.resolveProject(args[0]), { allowLocal: true, pages: Number(flags.pages) || undefined });
      return emit(result, (data) => `Sitio auditado: ${data.project.siteAudit.score}/100 · ${data.project.siteAudit.checked} de ${data.project.siteAudit.sitemap.total} URLs\n\n${showView(data)}`);
    }
    if (action === 'plan') {
      const { view } = await projects.getProject(await projects.resolveProject(args[0]));
      return emit(view.plan, () => view.plan.map((task) => `${task.priority}. [${task.area}${task.target ? ` · ${task.target}` : ''} · impacto ${task.impact}] ${task.title}\n   Por qué: ${task.why}\n   Cómo: ${task.how}`).join('\n\n') || 'Sin tareas: añade targets con estudio.');
    }
    if (action === 'report') {
      const data = await projects.getProject(await projects.resolveProject(args[0]));
      const markdown = projectToMarkdown(data.project, data.view);
      if (!flags.out) return out(markdown);
      await fs.writeFile(path.resolve(flags.out), markdown);
      return emit({ file: path.resolve(flags.out) }, () => `Informe guardado en ${path.resolve(flags.out)}`);
    }
    if (action === 'delete') {
      if (!args[0] || !flags.yes) throw new Error('Indica el proyecto y confirma con --yes: seo project delete <proyecto> --yes');
      const deleted = await projects.deleteProject(args[0]);
      return emit(deleted, () => `Proyecto ${deleted.id} eliminado (sus estudios se conservan)`);
    }
    if (action === 'show' || !action) {
      return emit(await projects.getProject(await projects.resolveProject(args[0])), showView);
    }
    throw new Error('Uso: seo project new|target|show|plan|site|report|delete (ver seo help)');
  },

  async keywords() {
    const insights = await studies.getInsights(await study(rest[0]));
    const filtered = insights.keywords
      .filter((entry) => (!flags.type || entry.type === flags.type) && (!flags.intent || entry.intent === flags.intent))
      .slice(0, Number(flags.top) || 30);
    emit(filtered, () => table(KEYWORD_HEAD, keywordRows(filtered)));
  },

  async insights() {
    const insights = await studies.getInsights(await study(rest[0]));
    emit(insights, () => [
      'CONCLUSIONES',
      ...insights.recommendations.map((item) => `• ${item.title}: ${item.text}`),
      '',
      'MEJORES OPORTUNIDADES',
      table(KEYWORD_HEAD, keywordRows(insights.opportunities.slice(0, 15))),
      '',
      `VICTORIAS RÁPIDAS (${insights.quickWins.length})`,
      insights.quickWins.length ? table(KEYWORD_HEAD, keywordRows(insights.quickWins.slice(0, 10))) : 'Ninguna keyword con demanda sobre la mediana y competencia inferior al 40 %.',
      '',
      'INTENCIÓN',
      table(['Intención', 'Keywords', 'Búsquedas'], insights.intents.map((entry) => [entry.label, entry.count, int(entry.volume)])),
      '',
      'TEMAS',
      table(['Tema', 'Keywords', 'Búsquedas'], insights.clusters.slice(0, 12).map((cluster) => [cluster.term, cluster.keywords.length, int(cluster.totalVolume)]))
    ].join('\n'));
  },

  async map() {
    const result = await studies.getKeywordMap(await study(rest[0]), { refresh: Boolean(flags.refresh), allowLocal: true });
    emit(result, () => [
      `${result.site}: ${result.urlCount} URLs en el sitemap`,
      table(['Keyword', 'Página', 'Compiten'], result.map.map((entry) => [entry.keyword, entry.url || '— sin página: crear', entry.alternatives.length || '']))
    ].join('\n'));
  },

  async trends() {
    const keywords = typeof flags.keywords === 'string' ? flags.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean) : undefined;
    info('Consultando Google Trends (unos segundos por keyword)…');
    const { insights } = await studies.getStudyTrends(await study(rest[0]), { refresh: Boolean(flags.refresh), retry: Boolean(flags.retry), keywords });
    const { items, ...summary } = insights;
    const busy = insights.calendar.filter((month) => month.peaks.length || month.publish.length || month.campaigns.length);
    emit({ ...summary, items: items.map(({ entry, ...item }) => item) }, () => [
      'TENDENCIAS (5 años)',
      ...insights.items.map((item) => `• ${item.keyword}: ${describeTrend(item)}`),
      '',
      'LECTURA',
      ...insights.findings.map((finding) => `• ${finding.title}. ${finding.text}`),
      '',
      'CALENDARIO',
      busy.length === 0 ? 'Ninguna keyword analizada tiene temporada: no hace falta calendario.'
        : table(['Mes', 'Publicar contenido para', 'Arrancar campaña de', 'En temporada alta'],
          busy.map((month) => [`${month.label} ${month.year}`, month.publish.join('\n') || '—', month.campaigns.join('\n') || '—', month.peaks.join('\n') || '—'])),
      '',
      insights.newQueries.length ? `CONSULTAS EN AUGE QUE NO ESTÁN EN EL ESTUDIO\n${insights.newQueries.slice(0, 15).map((query) => `• ${query.query} (${query.breakout ? 'disparada' : `+${query.value} %`}, desde «${query.from}»)`).join('\n')}` : ''
    ].join('\n').trim());
  },

  async site() {
    const pages = Number(flags.pages) || undefined;
    info('Leyendo el sitemap y comprobando las páginas…');
    const result = typeof flags.site === 'string'
      ? await studies.auditSitemap(flags.site, { allowLocal: true, pages })
      : (await studies.runSiteAudit(await study(rest[0]), { allowLocal: true, pages })).siteAudit;
    const { changes } = result;
    emit(result, () => [
      `${result.origin}${result.environment === 'local' ? ' (desarrollo)' : ''}: ${result.score}/100 · ${result.checked} de ${result.sitemap.total} URLs del sitemap comprobadas`,
      ...result.sitemap.sources.map((source) => `  ${source.url} (${source.type}, ${source.entries} entradas)`),
      ...result.sitemap.issues.map((issue) => `  ● ${issue}`),
      changes ? `Respecto a la pasada anterior: ${changes.previousScore} → ${result.score}${changes.fixed.length ? ` · resuelto: ${changes.fixed.join(', ')}` : ''}${changes.appeared.length ? ` · nuevo: ${changes.appeared.join(', ')}` : ''}` : '',
      ' ',
      result.issues.length === 0 ? 'Sin problemas en las páginas comprobadas.' : result.issues.map((issue) => [
        `[${issue.severity.toUpperCase()}] ${issue.title}`,
        `  ${issue.why}`,
        `  Cómo: ${issue.fix}`,
        ...issue.urls.slice(0, 8).map((url) => `    ${url}`),
        issue.count > 8 ? `    … y ${issue.count - 8} más` : ''
      ].filter(Boolean).join('\n')).join('\n\n')
    ].filter((line) => line !== '').join('\n'));
  },

  async plan() {
    const plan = await studies.getPlan(await study(rest[0]));
    emit(plan, () => planToMarkdown(plan));
  },

  async brief() {
    // seo brief "<keyword>"  o  seo brief <estudio> "<keyword>"
    const [reference, keyword] = rest.length >= 2 ? rest : [undefined, rest[0]];
    const { brief, markdown } = await studies.getBrief(await study(reference), keyword);
    emit(brief, () => markdown);
  },

  async audit() {
    const [kind, target] = rest;
    const filename = flags.study ? await study(flags.study === true ? undefined : flags.study) : undefined;
    if (flags.save && !filename) throw new Error('Para guardar la auditoría indica el estudio con --study');

    if (kind === 'text') {
      const input = { text: await readInput(target), keyword: flags.keyword, title: flags.title, metaDescription: flags.meta, name: flags.name };
      const result = flags.save ? (await studies.saveTextAudit(filename, input)).audit.result : await studies.auditText(input, filename);
      return emit(result, () => auditText(result, 'Texto'));
    }
    if (kind === 'url') {
      const input = { url: target, keyword: typeof flags.keyword === 'string' ? flags.keyword : '' };
      const runOnce = async () => {
        if (!flags.save) return { result: await studies.auditPage(input, filename, { allowLocal: true }), changes: null };
        const { audit } = await studies.savePageAudit(filename, input, { allowLocal: true });
        return { result: audit.result, changes: audit.changes };
      };
      const changesText = (changes) => (!changes ? '' : '\n\n' + [
        `Respecto a la auditoría anterior: ${changes.previousScore} → ${changes.previousScore + changes.scoreDelta} (${changes.scoreDelta >= 0 ? '+' : ''}${changes.scoreDelta})`,
        changes.improved.length ? `  Mejora: ${changes.improved.join(', ')}` : '',
        changes.worsened.length ? `  Empeora: ${changes.worsened.join(', ')}` : '',
        !changes.improved.length && !changes.worsened.length ? '  Sin cambios en las comprobaciones.' : ''
      ].filter((line) => line !== '').join('\n'));

      // --watch N: repite la auditoría cada N segundos y avisa solo cuando algo cambia (para trabajar en desarrollo)
      if (flags.watch) {
        const seconds = Math.max(2, Number(flags.watch) || 5);
        let last = null;
        info(`Vigilando ${target} cada ${seconds} s. Ctrl+C para salir.`);
        for (;;) {
          try {
            const { result } = await runOnce();
            const signature = JSON.stringify(result.checks.map((check) => [check.id, check.status]));
            if (signature !== last?.signature) {
              const changes = last ? studies.auditChanges({ result: last.result, createdAt: last.at }, result) : null;
              out(flags.json ? JSON.stringify({ ...result, changes }) : `[${new Date().toLocaleTimeString('es-ES')}] ${last ? `${result.score}/100${changesText(changes)}` : auditText(result, result.url)}`);
              last = { signature, result, at: new Date().toISOString() };
            }
          } catch (error) {
            info(`[${new Date().toLocaleTimeString('es-ES')}] ${error.message}`);
          }
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        }
      }

      const { result, changes } = await runOnce();
      return emit({ ...result, changes }, () => auditText(result, result.url) + changesText(changes));
    }
    throw new Error('Uso: seo audit text <archivo|-> --keyword "…"   |   seo audit url <url> [--keyword "…"]');
  },

  async report() {
    const filename = await study(rest[0]);
    const format = flags.format || (flags.md ? 'md' : flags.csv ? 'csv' : 'pdf');
    const builders = {
      pdf: [() => studies.exportPdf(filename), 'informe_seo_', '.pdf'],
      md: [() => studies.exportMarkdown(filename), 'informe_seo_', '.md'],
      csv: [() => studies.exportKeywordsCsv(filename), 'keywords_', '.csv']
    };
    if (!builders[format]) throw new Error('Formato no válido: usa --format pdf, md o csv');
    const [build, prefix, extension] = builders[format];
    const content = await build();

    // Markdown y CSV sin --out se imprimen: cómodo para tuberías y agentes
    if (!flags.out && format !== 'pdf') return out(content);
    const target = path.resolve(flags.out || filename.replace('seo_report_full_', prefix).replace(/\.json$/, extension));
    await fs.writeFile(target, content);
    emit({ file: target, format, bytes: Buffer.byteLength(content) }, () => `Informe guardado en ${target}`);
  },

  async serve() {
    if (flags.port) process.env.PORT = String(flags.port);
    await import('../src/server/server.js');
  },

  async mcp() {
    const { startMcpServer } = await import('../src/mcp/server.js');
    await startMcpServer();
  }
};

if (!command || flags.help || command === 'help') {
  out(HELP);
} else if (!commands[command]) {
  info(`Comando desconocido: ${command}\n`);
  info(HELP);
  process.exitCode = 1;
} else {
  commands[command]().catch((error) => {
    if (flags.json) out(JSON.stringify({ error: error.message }));
    info(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
