// Operaciones sobre estudios. Es la única capa que toca data/results: la usan la API, la CLI y el servidor MCP,
// así que las tres hacen exactamente lo mismo.
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDomainData } from '../api/keywordsur.js';
import { DEFAULT_COUNTRY, RESULTS_DIR } from '../config.js';
import { analyzeContent, relatedKeywordsFor } from '../../shared/contentAnalysis.js';
import { buildBrief, briefToMarkdown } from '../../shared/brief.js';
import { buildInsights } from '../../shared/insights.js';
import { buildActionPlan } from '../../shared/plan.js';
import { ExportService } from './exportService.js';
import { KeywordAnalyzer, mergeSuggestionsIntoReport, pendingSuggestions } from './keywordService.js';
import { auditUrl } from './pageAuditService.js';
import { auditSite, readSitemap } from './siteAuditService.js';
import { getTrends } from '../api/googleTrends.js';
import { buildTrendInsights } from '../../shared/seasonality.js';
import { mapKeywords } from '../../shared/keywordMap.js';
import { buildReportMarkdown } from './markdownService.js';
import { buildReportPdf } from './pdfService.js';
import {
  ValidationError,
  auditsNameFor,
  isLocalSite,
  csvNameFor,
  isReportJson,
  parseAudit,
  parseCountry,
  parseKeywords,
  parseLanguage,
  parseSite,
  parseStudyMeta,
  reportTimestamp,
  studyNameFor
} from '../utils/validation.js';

export class NotFoundError extends Error {}

const filePath = (name) => path.join(RESULTS_DIR, name);

function requireReport(filename) {
  if (!isReportJson(filename)) throw new ValidationError('Nombre de archivo de reporte inválido');
  return filePath(filename);
}

async function readJson(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath(name), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    if (error.code === 'ENOENT') throw new NotFoundError('Estudio no encontrado');
    throw error;
  }
}

export async function readReport(filename) {
  requireReport(filename);
  const data = await readJson(filename);
  if (!Array.isArray(data)) throw new Error('El archivo no tiene el formato de un estudio');
  return data;
}

const EMPTY_STUDY = { name: '', client: '', site: '', author: '', notes: '', audits: [], pageAudits: [], siteData: null, siteUrls: null, siteAudit: null, trends: null };

// Ficha del estudio: datos del cliente y auditorías. Vive en un archivo aparte para no mezclar textos largos
// con los datos de keywords. Los estudios anteriores guardaban solo las auditorías, en otro archivo.
export async function readStudy(filename) {
  requireReport(filename);
  const study = await readJson(studyNameFor(filename), null);
  if (study) return { ...EMPTY_STUDY, ...study };
  const legacyAudits = await readJson(auditsNameFor(filename), []);
  return { ...EMPTY_STUDY, audits: Array.isArray(legacyAudits) ? legacyAudits : [] };
}

const writeStudy = (filename, study) => fs.writeFile(filePath(studyNameFor(filename)), JSON.stringify(study, null, 2));

async function unlinkIfExists(name) {
  try {
    await fs.unlink(filePath(name));
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}

function describe(filename, report, study) {
  const insights = buildInsights(report);
  return {
    filename,
    timestamp: reportTimestamp(filename),
    name: study.name || report.map((item) => item.keyword).join(', '),
    client: study.client,
    site: study.site,
    keywords: report.map((item) => item.keyword),
    country: report[0]?.country || null,
    language: report[0]?.language || null,
    totals: {
      keywords: insights.totals.keywords,
      volume: insights.totals.volume,
      quickWins: insights.quickWins.length,
      audits: study.audits.length + study.pageAudits.length
    },
    errors: report.reduce((total, item) => total + (item.errors?.length || 0), 0),
    downloadUrl: `/api/seo/download/${filename}`,
    csvDownloadUrl: `/api/seo/download/${csvNameFor(filename)}`
  };
}

export async function listStudies() {
  let files = [];
  try {
    files = await fs.readdir(RESULTS_DIR);
  } catch (error) {
    // Sin carpeta de resultados todavía no hay estudios
    if (error.code !== 'ENOENT') throw error;
  }

  const studies = await Promise.all(files.filter(isReportJson).map(async (filename) => {
    try {
      return describe(filename, await readReport(filename), await readStudy(filename));
    } catch {
      return { filename, timestamp: reportTimestamp(filename), name: filename, keywords: [], unreadable: true, totals: { keywords: 0, volume: 0, quickWins: 0, audits: 0 } };
    }
  }));
  return studies.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Acepta el nombre de archivo o «latest»: cómodo desde la CLI y para agentes
export async function resolveFilename(reference) {
  if (reference && reference !== 'latest' && reference !== 'ultimo') {
    return reference.endsWith('.json') ? reference : `${reference}.json`;
  }
  const [latest] = await listStudies();
  if (!latest) throw new NotFoundError('No hay estudios todavía');
  return latest.filename;
}

export async function getStudy(filename) {
  const [report, study] = await Promise.all([readReport(filename), readStudy(filename)]);
  return { filename, report, study, summary: describe(filename, report, study) };
}

/**
 * Crea un estudio: analiza las keywords y, si se indica el sitio del cliente, consulta sus datos de dominio.
 * @param {{ keywords: string[], country?: string, language?: string, name?: string, client?: string, site?: string, author?: string }} input
 */
export async function createStudy(input) {
  const keywords = parseKeywords(input?.keywords);
  const country = parseCountry(input?.country);
  const language = parseLanguage(input?.language);
  const meta = parseStudyMeta(input);

  const analyzer = new KeywordAnalyzer();
  await analyzer.analyzeMultipleKeywords(keywords, country, language);
  const { jsonPath, csvPath } = await new ExportService().exportFullReport(analyzer);
  const filename = path.basename(jsonPath);

  const study = { ...EMPTY_STUDY, ...meta, createdAt: new Date().toISOString() };
  // un sitio en desarrollo no tiene datos de dominio que consultar
  if (meta.site && !isLocalSite(meta.site)) {
    try {
      const domain = await getDomainData(meta.site, country);
      study.siteData = domain?.[meta.site] || null;
    } catch (error) {
      study.siteData = null;
      study.siteError = error.message;
    }
  }
  await writeStudy(filename, study);

  return { filename, csvFilename: path.basename(csvPath), ...(await getStudy(filename)), legacySummary: analyzer.getSummary() };
}

export async function updateStudy(filename, input) {
  const { study, report } = await getStudy(filename);
  const meta = parseStudyMeta({ ...study, ...input });
  const next = { ...study, ...meta };
  // al cambiar de sitio se renuevan sus datos de dominio y se descarta su sitemap
  if (meta.site !== study.site) {
    next.siteData = null;
    next.siteUrls = null;
    next.siteAudit = null;
    if (meta.site && !isLocalSite(meta.site)) {
      try {
        const domain = await getDomainData(meta.site, report[0]?.country || DEFAULT_COUNTRY);
        next.siteData = domain?.[meta.site] || null;
      } catch {
        next.siteData = null;
      }
    }
  }
  await writeStudy(filename, next);
  return next;
}

export async function deleteStudy(filename) {
  const target = requireReport(filename);
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code === 'ENOENT') throw new NotFoundError('Estudio no encontrado');
    throw error;
  }
  const csvDeleted = await unlinkIfExists(csvNameFor(filename));
  await unlinkIfExists(auditsNameFor(filename));
  await unlinkIfExists(studyNameFor(filename));
  return { json: filename, csv: csvDeleted ? csvNameFor(filename) : null };
}

// Completa los datos de las sugerencias e ideas que quedaron pendientes
export async function completeSuggestions(filename, requestedCountry) {
  const report = await readReport(filename);
  // El estudio recuerda el país con el que se generó; los antiguos no, y se usa el indicado o el de por defecto
  const country = parseCountry(report[0]?.country || requestedCountry || DEFAULT_COUNTRY);
  const pending = [...pendingSuggestions(report)];
  if (pending.length === 0) {
    return { updated: false, attemptedCount: 0, analyzed: 0, withoutData: 0, failed: 0, report };
  }

  const analyzer = new KeywordAnalyzer();
  const { data, errors, attempted } = await analyzer.analyzeSuggestions(pending, country);
  if (attempted.size === 0) {
    const error = new Error(`No se pudo consultar ninguna sugerencia. ${errors[0] || ''}`.trim());
    error.upstream = true;
    throw error;
  }

  const merged = mergeSuggestionsIntoReport(report, data, attempted);
  await fs.writeFile(filePath(filename), JSON.stringify(merged, null, 2));
  merged.forEach((item) => analyzer.results.set(item.keyword, item));
  await new ExportService().exportToCSV(analyzer.getSummary(), csvNameFor(filename).replace(/\.csv$/, ''));

  const analyzed = pending.filter((keyword) => typeof data[keyword]?.search_volume === 'number').length;
  return { updated: true, attemptedCount: pending.length, analyzed, withoutData: attempted.size - analyzed, failed: pending.length - attempted.size, report: merged };
}

// ---------- Lecturas derivadas ----------

export async function getInsights(filename) {
  return buildInsights(await readReport(filename));
}

export async function getPlan(filename) {
  const { report, study } = await getStudy(filename);
  return buildActionPlan(report, withDerived(report, study));
}

export async function getBrief(filename, keyword) {
  if (typeof keyword !== 'string' || !keyword.trim()) throw new ValidationError('Se requiere la keyword del brief');
  const brief = buildBrief(await readReport(filename), keyword.trim());
  return { brief, markdown: briefToMarkdown(brief) };
}

// ---------- Auditorías ----------

// Texto suelto, sin guardar: lo usa la CLI y cualquier agente que solo quiera la nota
export async function auditText(input, filename) {
  const audit = parseAudit(input);
  const report = filename ? await readReport(filename) : [];
  return analyzeContent({ ...audit, relatedKeywords: relatedKeywordsFor(report, audit.keyword), language: report[0]?.language || input.language || 'es' });
}

export async function saveTextAudit(filename, input) {
  const audit = parseAudit(input);
  const { report, study } = await getStudy(filename);
  // El análisis se repite en el servidor: lo guardado no depende de lo que calcule el navegador
  const result = analyzeContent({ ...audit, relatedKeywords: relatedKeywordsFor(report, audit.keyword), language: report[0]?.language });
  const saved = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...audit,
    name: audit.name || audit.title || audit.keyword || 'Texto sin título',
    result
  };
  study.audits = [saved, ...study.audits];
  await writeStudy(filename, study);
  return { audit: saved, audits: study.audits };
}

// `allowLocal` permite auditar sitios en desarrollo (localhost, red privada). Lo deciden quienes llaman: la CLI y
// MCP lo activan (quien los ejecuta ya está en la máquina); la API, solo si la petición viene de la red local.
export async function auditPage(input, filename, { allowLocal = false } = {}) {
  const url = typeof input?.url === 'string' ? input.url : '';
  const keyword = typeof input?.keyword === 'string' ? input.keyword.trim().slice(0, 100) : '';
  const report = filename ? await readReport(filename) : [];
  return auditUrl(url, { keyword, relatedKeywords: relatedKeywordsFor(report, keyword), language: report[0]?.language || input?.language || 'es', allowLocal });
}

const STATUS_RANK = { fail: 0, warn: 1, skip: 2, ok: 2 };

// Qué ha cambiado respecto a la auditoría anterior de la misma página: lo que se mira al iterar en desarrollo
export function auditChanges(previous, result) {
  if (!previous) return null;
  const before = new Map(previous.result.checks.map((check) => [check.id, check]));
  const improved = [];
  const worsened = [];
  for (const check of result.checks) {
    const old = before.get(check.id);
    if (!old || old.status === check.status) continue;
    const delta = STATUS_RANK[check.status] - STATUS_RANK[old.status];
    if (delta > 0) improved.push(check.label);
    if (delta < 0) worsened.push(check.label);
  }
  return { previousScore: previous.result.score, scoreDelta: result.score - previous.result.score, previousAt: previous.createdAt, improved, worsened };
}

export async function savePageAudit(filename, input, options) {
  const { study } = await getStudy(filename);
  const result = await auditPage(input, filename, options);
  const keyword = (input.keyword || '').trim();
  const previous = study.pageAudits.find((audit) => audit.url === result.url && audit.keyword === keyword);
  const saved = { id: randomUUID(), createdAt: new Date().toISOString(), url: result.url, keyword, result, changes: auditChanges(previous, result) };
  // una auditoría por URL y keyword: la nueva sustituye a la anterior
  study.pageAudits = [saved, ...study.pageAudits.filter((audit) => !(audit.url === saved.url && audit.keyword === saved.keyword))];
  await writeStudy(filename, study);
  return { audit: saved, pageAudits: study.pageAudits };
}

export async function removeAudit(filename, id) {
  const { study } = await getStudy(filename);
  const audits = study.audits.filter((audit) => audit.id !== id);
  const pageAudits = study.pageAudits.filter((audit) => audit.id !== id);
  if (audits.length === study.audits.length && pageAudits.length === study.pageAudits.length) {
    throw new NotFoundError('Auditoría no encontrada');
  }
  await writeStudy(filename, { ...study, audits, pageAudits });
  return { audits, pageAudits };
}

// ---------- Mapa de keywords ----------

// Keywords que merece la pena situar en el sitio: las principales y las mejores oportunidades
function keywordsToMap(report) {
  const insights = buildInsights(report);
  return [...new Set([
    ...insights.keywords.filter((entry) => entry.type === 'main').map((entry) => entry.keyword),
    ...insights.quickWins.slice(0, 10).map((entry) => entry.keyword),
    ...insights.opportunities.slice(0, 15).map((entry) => entry.keyword)
  ])];
}

// La ficha con lo que se deriva de ella ya calculado (mapa de keywords y lectura de tendencias): es lo que
// necesitan el plan y los informes
function withDerived(report, study) {
  return {
    ...study,
    ...(study.siteUrls ? { keywordMap: mapKeywords(keywordsToMap(report), study.siteUrls.urls) } : {}),
    ...(study.trends ? { trendInsights: buildTrendInsights(report, study.trends) } : {})
  };
}

function requireSite(study) {
  if (!study.site) throw new ValidationError('Indica primero el sitio web del cliente en la ficha del estudio (ejemplo.com o localhost:3000)');
  return study.site;
}

// Lee el sitemap del sitio del cliente y lo guarda en la ficha. `allowLocal`: igual que en las auditorías de página
export async function refreshSiteUrls(filename, { allowLocal = false } = {}) {
  const { study } = await getStudy(filename);
  const sitemap = await readSitemap(requireSite(study), { allowLocal });
  study.siteUrls = { fetchedAt: new Date().toISOString(), urls: sitemap.urls, total: sitemap.total };
  await writeStudy(filename, study);
  return study;
}

export async function getKeywordMap(filename, { refresh = false, allowLocal = false } = {}) {
  const { report, study: current } = await getStudy(filename);
  const study = refresh || !current.siteUrls ? await refreshSiteUrls(filename, { allowLocal }) : current;
  return { site: study.site, fetchedAt: study.siteUrls.fetchedAt, urlCount: study.siteUrls.urls.length, map: mapKeywords(keywordsToMap(report), study.siteUrls.urls) };
}

// ---------- Auditoría de sitio (sitemap) ----------

// Qué ha cambiado respecto a la pasada anterior: problemas resueltos y problemas nuevos
function siteAuditChanges(previous, result) {
  if (!previous) return null;
  const before = new Map(previous.issues.map((issue) => [issue.id, issue.count]));
  const after = new Map(result.issues.map((issue) => [issue.id, issue.count]));
  const titleOf = (issue) => issue.title.replace(/ (d+)$/, '');
  return {
    previousAt: previous.fetchedAt,
    previousScore: previous.score,
    scoreDelta: result.score - previous.score,
    fixed: previous.issues.filter((issue) => !after.has(issue.id)).map(titleOf),
    appeared: result.issues.filter((issue) => !before.has(issue.id)).map(titleOf),
    reduced: result.issues.filter((issue) => before.has(issue.id) && before.get(issue.id) > issue.count).map((issue) => `${titleOf(issue)}: ${before.get(issue.id)} → ${issue.count}`),
    grown: result.issues.filter((issue) => before.has(issue.id) && before.get(issue.id) < issue.count).map((issue) => `${titleOf(issue)}: ${before.get(issue.id)} → ${issue.count}`)
  };
}

// Audita un sitio cualquiera por su sitemap, sin guardar
export async function auditSitemap(site, options) {
  return auditSite(parseSite(site), options);
}

// Audita el sitio del estudio por su sitemap, lo guarda en la ficha y renueva el mapa de keywords
export async function runSiteAudit(filename, { allowLocal = false, pages } = {}) {
  const { study } = await getStudy(filename);
  const { urls, ...result } = await auditSite(requireSite(study), { allowLocal, pages });
  study.siteAudit = { ...result, changes: siteAuditChanges(study.siteAudit, result) };
  study.siteUrls = { fetchedAt: result.fetchedAt, urls, total: result.sitemap.total };
  await writeStudy(filename, study);
  return study;
}

// ---------- Tendencias (Google Trends) ----------

const MAX_TREND_KEYWORDS = 10;

// Las keywords principales y las más buscadas del resto: pocas, porque Google limita las peticiones, y con
// volumen, porque por debajo de unos cientos de búsquedas Trends no tiene datos
function keywordsForTrends(report) {
  const insights = buildInsights(report);
  const mains = insights.keywords.filter((entry) => entry.type === 'main').slice(0, 6).map((entry) => ({ keyword: entry.keyword, role: 'main' }));
  const seen = new Set(mains.map((entry) => entry.keyword));
  const others = [...insights.keywords]
    .filter((entry) => entry.type !== 'main' && !entry.offTarget && entry.volume >= 300)
    .sort((a, b) => b.volume - a.volume)
    .filter((entry) => {
      if (seen.has(entry.keyword)) return false;
      seen.add(entry.keyword);
      return true;
    })
    .slice(0, MAX_TREND_KEYWORDS - mains.length)
    .map((entry) => ({ keyword: entry.keyword, role: 'opportunity' }));
  return [...mains, ...others];
}

/**
 * Tendencias del estudio: interés de 5 años y consultas relacionadas de sus keywords, con la lectura cruzada.
 * Se guardan en la ficha; `refresh` las vuelve a pedir. `keywords` permite elegir cuáles (por defecto, las
 * principales y las mejores oportunidades).
 */
export async function getStudyTrends(filename, { refresh = false, retry = false, keywords } = {}) {
  const { report, study } = await getStudy(filename);
  // `retry`: solo lo que Google dejó a medias (keywords sin serie o sin consultas relacionadas)
  const incomplete = study.trends ? study.trends.items.filter((item) => item.error || item.relatedError).map((item) => item.keyword) : [];
  if (retry && !refresh && !keywords?.length && incomplete.length > 0) keywords = incomplete;
  if (!study.trends || refresh || keywords?.length) {
    const wanted = keywords?.length
      ? parseKeywords(keywords).slice(0, MAX_TREND_KEYWORDS).map((keyword) => ({ keyword, role: report.some((item) => item.keyword === keyword) ? 'main' : 'opportunity' }))
      : keywordsForTrends(report);
    const geo = report[0]?.country || DEFAULT_COUNTRY;
    // las consultas relacionadas solo se piden para las principales: son las que definen el tema
    const fetched = await getTrends(wanted.map((entry) => ({ keyword: entry.keyword, related: entry.role === 'main' })), geo, report[0]?.language || 'es');
    const previous = new Map((study.trends?.items || []).map((item) => [item.keyword, item]));
    // si esta vez falla algo que ya se tenía, se conserva lo anterior
    const fresh = fetched.map((item, index) => {
      const old = previous.get(item.keyword);
      if (item.error && old && !old.error) return old;
      if (item.relatedError && old && !old.error && !old.relatedError) return { ...item, top: old.top, rising: old.rising, relatedError: undefined, role: wanted[index].role };
      return { ...item, role: wanted[index].role };
    });
    // al pedir keywords concretas se añaden a las que ya había
    // al pedir keywords concretas (o reintentar) se conservan las demás, cada una en su sitio; las principales, primero
    const byKeyword = new Map(fresh.map((item) => [item.keyword, item]));
    const existing = keywords?.length && study.trends ? study.trends.items.map((item) => byKeyword.get(item.keyword) || item) : [];
    const added = fresh.filter((item) => !existing.includes(item));
    const items = [...existing, ...added];
    study.trends = { fetchedAt: new Date().toISOString(), geo, items: [...items.filter((item) => item.role === 'main'), ...items.filter((item) => item.role !== 'main')] };
    await writeStudy(filename, study);
  }
  return { trends: study.trends, insights: buildTrendInsights(report, study.trends) };
}

// ---------- Entregables ----------

export async function exportPdf(filename, overrides = {}) {
  const { report, study } = await getStudy(filename);
  return buildReportPdf(report, { ...withDerived(report, study), ...overrides });
}

export async function exportMarkdown(filename, overrides = {}) {
  const { report, study } = await getStudy(filename);
  return buildReportMarkdown(report, { ...withDerived(report, study), ...overrides });
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Todas las keywords del estudio con su puntuación: para hojas de cálculo
export async function exportKeywordsCsv(filename) {
  const insights = await getInsights(filename);
  const rows = [
    ['keyword', 'tipo', 'keyword_principal', 'intencion', 'busquedas_mes', 'competencia', 'cpc', 'puntuacion'],
    ...insights.keywords.map((entry) => [entry.keyword, entry.type, entry.parent, entry.intent, entry.volume, entry.competition, entry.cpc, entry.score])
  ];
  // BOM para que Excel abra los acentos en UTF-8
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export { parseSite };
