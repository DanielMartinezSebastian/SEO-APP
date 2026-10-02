// Servidor MCP (Model Context Protocol) por stdio: permite que un agente de IA use SEO App como herramientas.
// Se arranca con `seo mcp`. Todo lo que no sea protocolo va a stderr; stdout es solo para los mensajes MCP.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as studies from '../services/studyService.js';
import * as projects from '../services/projectService.js';
import { projectToMarkdown } from '../../shared/project.js';
import { planToMarkdown } from '../../shared/plan.js';
import { describeTrend } from '../../shared/seasonality.js';

const STUDY = z.string().default('latest').describe('Nombre de archivo del estudio (seo_report_full_….json) o «latest» para el más reciente');

const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const text = (value) => ({ content: [{ type: 'text', text: value }] });

// Un fallo de una herramienta se devuelve como resultado con isError: el agente lo lee y puede corregir la llamada
const tool = (handler) => async (args) => {
  try {
    return await handler(args);
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
};

// Resumen compacto de las keywords: los agentes no necesitan los 100 objetos completos por defecto
const slimKeyword = (entry) => ({
  keyword: entry.keyword, type: entry.type, parent: entry.parent, intent: entry.intent,
  volume: entry.volume, competition: entry.competition, cpc: entry.cpc, score: entry.score
});

export function createMcpServer() {
  const server = new McpServer({ name: 'seo-app', version: '2.0.0' });

  server.registerTool('list_studies', {
    title: 'Listar estudios',
    description: 'Lista los estudios de keywords guardados, del más reciente al más antiguo, con sus keywords principales, cliente, sitio y totales.',
    inputSchema: {}
  }, tool(async () => json(await studies.listStudies())));

  server.registerTool('create_study', {
    title: 'Crear estudio',
    description: 'Analiza de 1 a 25 keywords (volumen, competencia, CPC, sugerencias de Google, preguntas, comparativas y keywords similares) y guarda el estudio. Tarda unos 5 segundos por keyword. Devuelve el resumen y el nombre de archivo para usar en las demás herramientas.',
    inputSchema: {
      keywords: z.array(z.string()).min(1).max(25).describe('Keywords principales del estudio'),
      country: z.string().length(2).default('ES').describe('País, código de dos letras (ES, US, FR, DE, IT…)'),
      language: z.string().length(2).default('es').describe('Idioma, código de dos letras'),
      name: z.string().optional().describe('Nombre del estudio o proyecto'),
      client: z.string().optional().describe('Nombre del cliente'),
      site: z.string().optional().describe('Dominio del sitio del cliente (ejemplo.com)')
    }
  }, tool(async (args) => {
    const created = await studies.createStudy(args);
    const insights = await studies.getInsights(created.filename);
    return json({ filename: created.filename, summary: created.summary, conclusions: insights.recommendations, topOpportunities: insights.opportunities.slice(0, 10).map(slimKeyword) });
  }));

  server.registerTool('get_insights', {
    title: 'Estrategia del estudio',
    description: 'Conclusiones del estudio, ranking de oportunidades (puntuación 0-100), victorias rápidas, reparto por intención de búsqueda y temas en los que se agrupan las keywords.',
    inputSchema: { study: STUDY, limit: z.number().int().min(1).max(200).default(25).describe('Máximo de keywords por lista') }
  }, tool(async ({ study, limit }) => {
    const insights = await studies.getInsights(await studies.resolveFilename(study));
    return json({
      totals: insights.totals,
      conclusions: insights.recommendations,
      opportunities: insights.opportunities.slice(0, limit).map(slimKeyword),
      quickWins: insights.quickWins.slice(0, limit).map(slimKeyword),
      intents: insights.intents,
      clusters: insights.clusters.slice(0, limit).map((cluster) => ({ term: cluster.term, totalVolume: cluster.totalVolume, keywords: cluster.keywords.map((entry) => entry.keyword) })),
      questions: insights.questions.slice(0, limit).map((entry) => entry.keyword)
    });
  }));

  server.registerTool('get_keywords', {
    title: 'Keywords del estudio',
    description: 'Todas las keywords de un estudio con volumen, competencia, CPC, intención y puntuación, ordenadas por puntuación. Se pueden filtrar por tipo o intención.',
    inputSchema: {
      study: STUDY,
      type: z.enum(['main', 'suggestion', 'idea', 'similar']).optional().describe('Filtrar por tipo de keyword'),
      intent: z.enum(['transactional', 'commercial', 'informational', 'local', 'general']).optional().describe('Filtrar por intención de búsqueda'),
      limit: z.number().int().min(1).max(500).default(50)
    }
  }, tool(async ({ study, type, intent, limit }) => {
    const insights = await studies.getInsights(await studies.resolveFilename(study));
    const keywords = insights.keywords.filter((entry) => (!type || entry.type === type) && (!intent || entry.intent === intent));
    return json({ total: keywords.length, keywords: keywords.slice(0, limit).map(slimKeyword) });
  }));

  server.registerTool('content_brief', {
    title: 'Brief de contenido',
    description: 'Brief en Markdown para escribir una página sobre una keyword: intención, tipo de página, extensión, títulos, esquema de H2, keywords secundarias, preguntas, vocabulario y comprobaciones. Úsalo antes de redactar.',
    inputSchema: { study: STUDY, keyword: z.string().describe('Keyword objetivo de la página') }
  }, tool(async ({ study, keyword }) => text((await studies.getBrief(await studies.resolveFilename(study), keyword)).markdown)));

  server.registerTool('audit_text', {
    title: 'Auditar un texto',
    description: 'Puntúa de 0 a 100 un texto (plano, Markdown o HTML) frente a una keyword: extensión, uso de la keyword, título, meta descripción, encabezados, legibilidad, respuestas directas para buscadores con IA y cobertura de los términos del estudio. Úsalo después de redactar y repite hasta que no queden fallos.',
    inputSchema: {
      text: z.string().describe('Texto a auditar'),
      keyword: z.string().describe('Keyword objetivo'),
      title: z.string().optional().describe('Título SEO'),
      metaDescription: z.string().optional().describe('Meta descripción'),
      study: z.string().optional().describe('Estudio del que tomar los términos relacionados («latest» o nombre de archivo)'),
      save: z.boolean().default(false).describe('Guardar la auditoría en el estudio para que salga en el informe'),
      name: z.string().optional().describe('Nombre con el que guardarla')
    }
  }, tool(async ({ study, save, ...input }) => {
    const filename = study ? await studies.resolveFilename(study) : undefined;
    if (save) {
      if (!filename) throw new Error('Para guardar la auditoría hay que indicar el estudio');
      return json((await studies.saveTextAudit(filename, input)).audit.result);
    }
    return json(await studies.auditText(input, filename));
  }));

  server.registerTool('audit_url', {
    title: 'Auditar una URL',
    description: 'Descarga una página y la audita (pública o en desarrollo: localhost y red privada también valen). Con save, compara con la auditoría anterior de la misma URL y devuelve qué mejoró y qué empeoró. Comprueba: respuesta del servidor, indexabilidad, canónica, datos estructurados, título, meta, encabezados, contenido frente a la keyword, enlaces internos, robots.txt, sitemap y acceso de rastreadores de IA. No mide Core Web Vitals.',
    inputSchema: {
      url: z.string().describe('URL a auditar; puede ser local, como http://localhost:3000/pagina'),
      keyword: z.string().optional().describe('Keyword que debería posicionar la página'),
      study: z.string().optional().describe('Estudio del que tomar los términos relacionados'),
      save: z.boolean().default(false).describe('Guardar la auditoría en el estudio para que salga en el informe y en el plan de acción')
    }
  }, tool(async ({ url, keyword, study, save }) => {
    const filename = study ? await studies.resolveFilename(study) : undefined;
    if (save) {
      if (!filename) throw new Error('Para guardar la auditoría hay que indicar el estudio');
      const { audit } = await studies.savePageAudit(filename, { url, keyword }, { allowLocal: true });
      return json({ ...audit.result, changes: audit.changes });
    }
    return json(await studies.auditPage({ url, keyword }, filename, { allowLocal: true }));
  }));

  server.registerTool('keyword_map', {
    title: 'Mapa de keywords',
    description: 'Relaciona las keywords principales y las mejores oportunidades con las URLs del sitemap del sitio del cliente: qué página cubre cada keyword, cuáles no tienen página (hueco de contenido) y dónde compiten varias páginas. Requiere que el estudio tenga sitio.',
    inputSchema: { study: STUDY, refresh: z.boolean().default(false).describe('Volver a leer el sitemap') }
  }, tool(async ({ study, refresh }) => json(await studies.getKeywordMap(await studies.resolveFilename(study), { refresh, allowLocal: true }))));

  server.registerTool('site_audit', {
    title: 'Auditar un sitio por su sitemap',
    description: 'Lee el sitemap (el declarado en robots.txt o /sitemap.xml, siguiendo índices), descarga hasta 100 de sus URLs y agrupa los problemas: URLs rotas o que redirigen, noindex dentro del sitemap, canónicas a otra URL, títulos y meta descripciones ausentes o repetidos, H1, contenido escaso y páginas vacías sin JavaScript. Vale para sitios publicados y en desarrollo (localhost:3000, IPs de la red interna): en local, las URLs del sitemap con el dominio de producción se comprueban en local por la misma ruta. Sin site se usa el sitio del estudio, se guarda y se compara con la pasada anterior.',
    inputSchema: {
      site: z.string().optional().describe('Sitio a auditar (ejemplo.com, localhost:3000, 192.168.1.20:8080). Si se omite, el del estudio'),
      study: STUDY,
      pages: z.number().int().min(1).max(100).default(40).describe('Cuántas URLs del sitemap comprobar')
    }
  }, tool(async ({ site, study, pages }) => {
    if (site) return json(await studies.auditSitemap(site, { allowLocal: true, pages }));
    const saved = await studies.runSiteAudit(await studies.resolveFilename(study), { allowLocal: true, pages });
    return json(saved.siteAudit);
  }));

  server.registerTool('get_trends', {
    title: 'Tendencias y estacionalidad',
    description: 'Google Trends de las keywords principales y las mejores oportunidades del estudio (5 años): patrón estacional, meses de temporada alta, tendencia del último año, próximo pico con la fecha en que el contenido debe estar publicado, calendario de campañas a 12 meses, consultas en auge que el estudio no contempla y hallazgos que cruzan la tendencia con competencia e intención. El resultado se guarda; refresh lo vuelve a pedir. Google limita las peticiones: no lo llames en bucle.',
    inputSchema: {
      study: STUDY,
      refresh: z.boolean().default(false).describe('Volver a consultar Google Trends'),
      keywords: z.array(z.string()).max(10).optional().describe('Keywords concretas que añadir (por defecto, las principales y las mejores oportunidades)')
    }
  }, tool(async ({ study, refresh, keywords }) => {
    const { insights } = await studies.getStudyTrends(await studies.resolveFilename(study), { refresh, keywords });
    return json({
      fetchedAt: insights.fetchedAt,
      geo: insights.geo,
      keywords: insights.items.map((item) => ({ keyword: item.keyword, role: item.role, summary: describeTrend(item), ...item.analysis, volume: item.entry?.volume ?? null, competition: item.entry?.competition ?? null })),
      findings: insights.findings,
      calendar: insights.calendar.filter((month) => month.peaks.length || month.publish.length || month.campaigns.length),
      risingNotInStudy: insights.newQueries,
      coverage: insights.coverage
    });
  }));

  server.registerTool('action_plan', {
    title: 'Plan de acción',
    description: 'Tareas priorizadas por impacto y esfuerzo a partir del estudio y de sus auditorías guardadas, en Markdown.',
    inputSchema: { study: STUDY }
  }, tool(async ({ study }) => text(planToMarkdown(await studies.getPlan(await studies.resolveFilename(study))))));

  server.registerTool('client_report', {
    title: 'Informe para el cliente',
    description: 'Informe completo del estudio en Markdown: resumen ejecutivo, plan de acción, oportunidades, intención y temas, briefs, auditorías y metodología. Para el PDF, usa la CLI: seo report <estudio> --format pdf.',
    inputSchema: { study: STUDY }
  }, tool(async ({ study }) => text(await studies.exportMarkdown(await studies.resolveFilename(study)))));

  // ---------- Proyectos: un sitio con varios targets ----------
  const PROJECT = z.string().default('latest').describe('Identificador del proyecto (8 caracteres) o «latest» para el más reciente');

  server.registerTool('list_projects', {
    title: 'Listar proyectos',
    description: 'Lista los proyectos. Un proyecto es un sitio con varios targets (públicos o líneas de negocio: servicios distintos, categorías de una tienda…), cada uno con sus estudios de keywords.',
    inputSchema: {}
  }, tool(async () => json(await projects.listProjects())));

  server.registerTool('create_project', {
    title: 'Crear proyecto',
    description: 'Crea un proyecto vacío para un sitio que atiende a varios públicos. Después añade un target por público con add_target.',
    inputSchema: {
      name: z.string().describe('Nombre del proyecto'),
      site: z.string().optional().describe('Sitio (ejemplo.com, o localhost:3000 si está en desarrollo)'),
      client: z.string().optional(), author: z.string().optional(), notes: z.string().optional()
    }
  }, tool(async (args) => json(await projects.createProject(args))));

  server.registerTool('add_target', {
    title: 'Añadir un target al proyecto',
    description: 'Añade un público o línea de negocio al proyecto. Con keywords (2 a 6, las que usaría ESE público para buscar; unos 5 s por keyword) crea su estudio; con studies enlaza estudios existentes. Un target = una intención = una página de aterrizaje. Devuelve la vista del proyecto actualizada.',
    inputSchema: {
      project: PROJECT,
      name: z.string().describe('Nombre del target: el público o el servicio («Automatización para pymes», «Zapatillas trail»)'),
      audience: z.string().optional().describe('A quién va dirigido y qué problema tiene'),
      page: z.string().optional().describe('Ruta de su página de aterrizaje si ya existe (/servicios/automatizacion)'),
      keywords: z.array(z.string()).max(25).optional().describe('Keywords con las que crear el estudio del target'),
      studies: z.array(z.string()).optional().describe('Nombres de archivo de estudios existentes que enlazar'),
      country: z.string().length(2).optional(), language: z.string().length(2).optional()
    }
  }, tool(async ({ project, ...input }) => json((await projects.addTarget(await projects.resolveProject(project), input)).view)));

  server.registerTool('project_overview', {
    title: 'Vista del proyecto',
    description: 'Combina los targets del proyecto: prioridad de cada uno (demanda 40 %, facilidad 40 %, valor comercial 20 %), página de aterrizaje detectada o ausente, keywords repetidas entre targets (riesgo de canibalización) con el target al que asignarlas, páginas reclamadas por varios targets, calendario conjunto, conclusiones y plan de acción. format=markdown devuelve el informe del proyecto.',
    inputSchema: { project: PROJECT, format: z.enum(['json', 'markdown']).default('json') }
  }, tool(async ({ project, format }) => {
    const data = await projects.getProject(await projects.resolveProject(project));
    return format === 'markdown' ? text(projectToMarkdown(data.project, data.view)) : json({ project: { id: data.project.id, name: data.project.name, site: data.project.site, siteScore: data.project.siteAudit?.score ?? null }, ...data.view });
  }));

  server.registerTool('project_site_audit', {
    title: 'Auditar el sitio del proyecto',
    description: 'Audita el sitio del proyecto por su sitemap (vale localhost y red interna) y guarda sus URLs: a partir de ahí project_overview sabe qué página corresponde a cada target, cuáles faltan y cuáles se comparten. Repetir tras cada cambio de estructura.',
    inputSchema: { project: PROJECT, pages: z.number().int().min(1).max(100).default(40) }
  }, tool(async ({ project, pages }) => {
    const data = await projects.runProjectSiteAudit(await projects.resolveProject(project), { allowLocal: true, pages });
    return json({ siteAudit: data.project.siteAudit, findings: data.view.findings, targets: data.view.targets.map((target) => ({ name: target.name, page: target.page, coverage: target.coverage, gaps: target.gaps })) });
  }));

  server.registerTool('update_study', {
    title: 'Actualizar la ficha del estudio',
    description: 'Cambia los datos del estudio que salen en el informe: nombre, cliente, sitio, autor y notas.',
    inputSchema: {
      study: STUDY,
      name: z.string().optional(), client: z.string().optional(), site: z.string().optional(), author: z.string().optional(), notes: z.string().optional()
    }
  }, tool(async ({ study, ...meta }) => {
    const changes = Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
    const { audits, pageAudits, ...saved } = await studies.updateStudy(await studies.resolveFilename(study), changes);
    return json(saved);
  }));

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  console.error('SEO App · servidor MCP listo (stdio)');
}
