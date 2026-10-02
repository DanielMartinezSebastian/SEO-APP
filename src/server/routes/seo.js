import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { RESULTS_DIR } from '../../config.js';
import * as studies from '../../services/studyService.js';
import * as projects from '../../services/projectService.js';
import { NotFoundError } from '../../services/studyService.js';
import { briefToMarkdown } from '../../../shared/brief.js';
import { planToMarkdown } from '../../../shared/plan.js';
import { trendsToMarkdown } from '../../../shared/seasonality.js';
import { ValidationError, isReportFile } from '../../utils/validation.js';

const router = express.Router();

// Envuelve un handler async y traduce sus errores a la respuesta de error común de la API
const route = (errorLabel, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotFoundError || error.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: error instanceof NotFoundError ? error.message : 'Estudio no encontrado' });
    }
    if (error.upstream) {
      return res.status(502).json({ success: false, error: 'No se pudo consultar la fuente de datos', message: error.message });
    }
    console.error(error);
    res.status(500).json({ success: false, error: errorLabel, message: error.message });
  }
};

// ¿Puede esta petición auditar direcciones locales (un sitio en desarrollo)? Sí cuando quien la hace ya está en
// este equipo o en la red privada. Detrás de un proxy inverso todas las peticiones parecen locales, así que si
// hay cabeceras de reenvío se trata como externa (para ese caso está SEO_ALLOW_PRIVATE_URLS=1).
const PRIVATE_CLIENT = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|f[cd])/i;
function canAuditLocal(req) {
  if (req.headers['x-forwarded-for'] || req.headers.forwarded) return false;
  const address = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return PRIVATE_CLIENT.test(address);
}

const wantsMarkdown = (req) => req.query.format === 'md' || req.query.format === 'markdown';
const attachment = (res, type, filename) => {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};
const exportName = (filename, prefix, extension) => filename.replace('seo_report_full_', prefix).replace(/\.json$/, extension);

// ---------- Estudios ----------

// GET /api/seo/reports - Listar los estudios
router.get('/reports', route('Error al listar estudios', async (req, res) => {
  const reports = await studies.listStudies();
  res.json({ success: true, count: reports.length, reports });
}));

// POST /api/seo/analyze - Crear un estudio: analiza las keywords y guarda la ficha del cliente
router.post('/analyze', route('Error durante el análisis', async (req, res) => {
  const created = await studies.createStudy(req.body || {});
  res.json({
    success: true,
    message: 'Análisis completado exitosamente',
    summary: created.legacySummary,
    study: created.summary,
    files: { json: created.filename, csv: created.csvFilename },
    downloadUrls: {
      json: `/api/seo/download/${created.filename}`,
      csv: `/api/seo/download/${created.csvFilename}`
    },
    data: created.report
  });
}));

// GET /api/seo/report/:filename - Datos completos de un estudio
router.get('/report/:filename', route('Error al leer el estudio', async (req, res) => {
  const { filename, report, study, summary } = await studies.getStudy(req.params.filename);
  res.json({ success: true, filename, data: report, study, summary });
}));

// PATCH /api/seo/report/:filename/study - Actualizar la ficha del estudio (nombre, cliente, sitio, autor, notas, color)
router.patch('/report/:filename/study', route('Error al guardar la ficha', async (req, res) => {
  res.json({ success: true, study: await studies.updateStudy(req.params.filename, req.body || {}) });
}));

// DELETE /api/seo/report/:filename - Eliminar un estudio con su CSV, su ficha y sus auditorías
router.delete('/report/:filename', route('Error al eliminar el estudio', async (req, res) => {
  const filesDeleted = await studies.deleteStudy(req.params.filename);
  res.json({ success: true, message: 'Estudio eliminado exitosamente', filesDeleted });
}));

// POST /api/seo/analyze-suggestions - Completar los datos de las sugerencias e ideas pendientes
router.post('/analyze-suggestions', route('Error analizando sugerencias', async (req, res) => {
  const { filename, country } = req.body || {};
  const result = await studies.completeSuggestions(filename, country);
  res.json({
    success: true,
    message: result.updated
      ? [
        `${result.analyzed} de ${result.attemptedCount} sugerencias obtuvieron datos SEO.`,
        result.withoutData > 0 ? `${result.withoutData} no tienen datos disponibles.` : '',
        result.failed > 0 ? `${result.failed} no se pudieron consultar y siguen pendientes.` : ''
      ].filter(Boolean).join(' ')
      : 'No hay sugerencias nuevas para analizar',
    suggestionsAttempted: result.attemptedCount,
    suggestionsAnalyzed: result.analyzed,
    suggestionsWithoutData: result.withoutData,
    suggestionsFailed: result.failed,
    updated: result.updated,
    data: result.report
  });
}));

// ---------- Proyectos: un sitio con varios targets ----------

// GET /api/seo/projects - Listar los proyectos
router.get('/projects', route('Error al listar proyectos', async (req, res) => {
  res.json({ success: true, projects: await projects.listProjects() });
}));

// POST /api/seo/projects - Crear un proyecto ({ name, client?, site?, author?, notes? })
router.post('/projects', route('Error al crear el proyecto', async (req, res) => {
  res.status(201).json({ success: true, project: await projects.createProject(req.body || {}) });
}));

// GET /api/seo/projects/:id - El proyecto y su vista combinada (?format=md para el informe en Markdown)
router.get('/projects/:id', route('Error al leer el proyecto', async (req, res) => {
  if (wantsMarkdown(req)) {
    if (req.query.download !== undefined) attachment(res, 'text/markdown; charset=utf-8', `proyecto_seo_${req.params.id}.md`);
    else res.type('text/markdown');
    return res.send(await projects.exportProjectMarkdown(req.params.id));
  }
  res.json({ success: true, ...(await projects.getProject(req.params.id)) });
}));

// PATCH /api/seo/projects/:id - Cambiar nombre, cliente, sitio, autor o notas
router.patch('/projects/:id', route('Error al guardar el proyecto', async (req, res) => {
  await projects.updateProject(req.params.id, req.body || {});
  res.json({ success: true, ...(await projects.getProject(req.params.id)) });
}));

// DELETE /api/seo/projects/:id - Eliminar el proyecto (sus estudios se conservan)
router.delete('/projects/:id', route('Error al eliminar el proyecto', async (req, res) => {
  res.json({ success: true, deleted: await projects.deleteProject(req.params.id) });
}));

// POST /api/seo/projects/:id/targets - Añadir un target ({ name, audience?, page?, keywords?, studies? })
router.post('/projects/:id/targets', route('Error al añadir el target', async (req, res) => {
  res.status(201).json({ success: true, ...(await projects.addTarget(req.params.id, req.body || {})) });
}));

// PATCH /api/seo/projects/:id/targets/:targetId - Cambiar nombre, público, página o estudios de un target
router.patch('/projects/:id/targets/:targetId', route('Error al guardar el target', async (req, res) => {
  res.json({ success: true, ...(await projects.updateTarget(req.params.id, req.params.targetId, req.body || {})) });
}));

// DELETE /api/seo/projects/:id/targets/:targetId - Quitar un target (sus estudios se conservan)
router.delete('/projects/:id/targets/:targetId', route('Error al quitar el target', async (req, res) => {
  res.json({ success: true, ...(await projects.removeTarget(req.params.id, req.params.targetId)) });
}));

// POST /api/seo/projects/:id/site-audit - Auditar el sitio del proyecto por su sitemap ({ pages? })
router.post('/projects/:id/site-audit', route('Error al auditar el sitio', async (req, res) => {
  res.status(201).json({ success: true, ...(await projects.runProjectSiteAudit(req.params.id, { allowLocal: canAuditLocal(req), pages: Number(req.body?.pages) || undefined })) });
}));

// ---------- Lecturas derivadas (pensadas para agentes e integraciones) ----------

// GET /api/seo/report/:filename/insights - Ranking de oportunidades, intención, temas y conclusiones
router.get('/report/:filename/insights', route('Error al calcular la estrategia', async (req, res) => {
  res.json({ success: true, insights: await studies.getInsights(req.params.filename) });
}));

// GET /api/seo/report/:filename/plan - Plan de acción priorizado (?format=md para Markdown)
router.get('/report/:filename/plan', route('Error al calcular el plan', async (req, res) => {
  const plan = await studies.getPlan(req.params.filename);
  if (wantsMarkdown(req)) return res.type('text/markdown').send(planToMarkdown(plan));
  res.json({ success: true, plan });
}));

// GET /api/seo/report/:filename/brief?keyword=... - Brief de contenido (?format=md para Markdown)
router.get('/report/:filename/brief', route('Error al generar el brief', async (req, res) => {
  const { brief } = await studies.getBrief(req.params.filename, req.query.keyword);
  if (wantsMarkdown(req)) return res.type('text/markdown').send(briefToMarkdown(brief));
  res.json({ success: true, brief });
}));

// GET /api/seo/report/:filename/keyword-map - Qué URL del sitio corresponde a cada keyword (?refresh relee el sitemap)
router.get('/report/:filename/keyword-map', route('Error al calcular el mapa de keywords', async (req, res) => {
  res.json({ success: true, ...(await studies.getKeywordMap(req.params.filename, { refresh: req.query.refresh !== undefined, allowLocal: canAuditLocal(req) })) });
}));

// GET /api/seo/report/:filename/trends - Tendencias y estacionalidad (?refresh las vuelve a pedir, ?retry solo lo que falló, ?format=md)
router.get('/report/:filename/trends', route('Error al consultar las tendencias', async (req, res) => {
  const result = await studies.getStudyTrends(req.params.filename, { refresh: req.query.refresh !== undefined, retry: req.query.retry !== undefined });
  if (wantsMarkdown(req)) return res.type('text/markdown').send(trendsToMarkdown(result.insights));
  res.json({ success: true, ...result });
}));

// POST /api/seo/report/:filename/trends - Añadir keywords concretas a las tendencias ({ keywords: [] })
router.post('/report/:filename/trends', route('Error al consultar las tendencias', async (req, res) => {
  res.json({ success: true, ...(await studies.getStudyTrends(req.params.filename, { keywords: req.body?.keywords })) });
}));

// ---------- Auditorías ----------

// POST /api/seo/audit/text - Auditar un texto sin guardarlo ({ text, keyword, title, metaDescription, filename? })
router.post('/audit/text', route('Error al auditar el texto', async (req, res) => {
  res.json({ success: true, result: await studies.auditText(req.body || {}, req.body?.filename) });
}));

// POST /api/seo/audit/url - Auditar una URL pública sin guardarla ({ url, keyword, filename? })
router.post('/audit/url', route('Error al auditar la URL', async (req, res) => {
  res.json({ success: true, result: await studies.auditPage(req.body || {}, req.body?.filename, { allowLocal: canAuditLocal(req) }) });
}));

// POST /api/seo/audit/site - Auditar un sitio por su sitemap sin guardarlo ({ site, pages? })
router.post('/audit/site', route('Error al auditar el sitio', async (req, res) => {
  res.json({ success: true, result: await studies.auditSitemap(req.body?.site, { allowLocal: canAuditLocal(req), pages: Number(req.body?.pages) || undefined }) });
}));

// POST /api/seo/report/:filename/site-audit - Auditar el sitio del estudio por su sitemap y guardarlo ({ pages? })
router.post('/report/:filename/site-audit', route('Error al auditar el sitio', async (req, res) => {
  const study = await studies.runSiteAudit(req.params.filename, { allowLocal: canAuditLocal(req), pages: Number(req.body?.pages) || undefined });
  res.status(201).json({ success: true, study });
}));

// GET /api/seo/report/:filename/audits - Auditorías guardadas en el estudio
router.get('/report/:filename/audits', route('Error al leer las auditorías', async (req, res) => {
  const { study } = await studies.getStudy(req.params.filename);
  res.json({ success: true, audits: study.audits, pageAudits: study.pageAudits });
}));

// POST /api/seo/report/:filename/audits - Auditar un texto y guardarlo en el estudio
router.post('/report/:filename/audits', route('Error al guardar la auditoría', async (req, res) => {
  res.status(201).json({ success: true, ...(await studies.saveTextAudit(req.params.filename, req.body || {})) });
}));

// POST /api/seo/report/:filename/page-audits - Auditar una URL y guardarla en el estudio
router.post('/report/:filename/page-audits', route('Error al auditar la página', async (req, res) => {
  res.status(201).json({ success: true, ...(await studies.savePageAudit(req.params.filename, req.body || {}, { allowLocal: canAuditLocal(req) })) });
}));

// DELETE /api/seo/report/:filename/audits/:id - Quitar una auditoría (de texto o de página)
router.delete('/report/:filename/audits/:id', route('Error al eliminar la auditoría', async (req, res) => {
  res.json({ success: true, ...(await studies.removeAudit(req.params.filename, req.params.id)) });
}));

// ---------- Entregables ----------

// GET /api/seo/report/:filename/pdf - Informe para el cliente en PDF
router.get('/report/:filename/pdf', route('Error al generar el PDF', async (req, res) => {
  const { filename } = req.params;
  const pdf = await studies.exportPdf(filename);
  attachment(res, 'application/pdf', exportName(filename, 'informe_seo_', '.pdf'));
  res.send(pdf);
}));

// GET /api/seo/report/:filename/markdown - El mismo informe en Markdown
router.get('/report/:filename/markdown', route('Error al generar el informe', async (req, res) => {
  const { filename } = req.params;
  const markdown = await studies.exportMarkdown(filename);
  if (req.query.download !== undefined) attachment(res, 'text/markdown; charset=utf-8', exportName(filename, 'informe_seo_', '.md'));
  else res.type('text/markdown');
  res.send(markdown);
}));

// GET /api/seo/report/:filename/keywords.csv - Todas las keywords con su puntuación
router.get('/report/:filename/keywords.csv', route('Error al exportar las keywords', async (req, res) => {
  const { filename } = req.params;
  const csv = await studies.exportKeywordsCsv(filename);
  attachment(res, 'text/csv; charset=utf-8', exportName(filename, 'keywords_', '.csv'));
  res.send(csv);
}));

// GET /api/seo/download/:filename - Descargar el JSON o el CSV de resumen de un estudio
router.get('/download/:filename', route('Error al descargar archivo', async (req, res) => {
  const { filename } = req.params;
  if (!isReportFile(filename)) {
    throw new ValidationError('Nombre de archivo inválido');
  }
  const data = await fs.readFile(path.join(RESULTS_DIR, filename));
  attachment(res, filename.endsWith('.json') ? 'application/json' : 'text/csv; charset=utf-8', filename);
  res.send(data);
}));

export default router;
