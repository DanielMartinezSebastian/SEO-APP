import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE, MAX_KEYWORDS, MAX_KEYWORD_LENGTH } from '../config.js';
import { isLocalSite, siteOrigin } from '../../shared/site.js';

// Error cuyo mensaje es seguro devolver al cliente con un 400
export class ValidationError extends Error {}

// Los nombres los genera ExportService: seo_report_full_2025-07-31T18-45-31-805.json (los antiguos con Z final).
// Al no admitir separadores de ruta ni «..», el nombre no puede salir de data/results.
const REPORT_JSON = /^seo_report_full_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z?\.json$/;
const REPORT_FILE = /^seo_report_(full|summary)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z?\.(json|csv)$/;

export const isReportJson = (filename) => typeof filename === 'string' && REPORT_JSON.test(filename);
export const isReportFile = (filename) => typeof filename === 'string' && REPORT_FILE.test(filename);

export function reportTimestamp(filename) {
  const match = /_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z?\.\w+$/.exec(filename);
  if (!match) return null;
  const [, date, h, m, s, ms] = match;
  return `${date}T${h}:${m}:${s}.${ms}Z`;
}

export function csvNameFor(jsonFilename) {
  return jsonFilename.replace('seo_report_full_', 'seo_report_summary_').replace(/\.json$/, '.csv');
}

export function parseKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new ValidationError('Se requiere un array de keywords');
  }

  const cleaned = [];
  for (const keyword of keywords) {
    if (typeof keyword !== 'string') {
      throw new ValidationError('Todas las keywords deben ser texto');
    }
    const value = keyword.trim();
    if (!value) continue;
    if (value.length > MAX_KEYWORD_LENGTH) {
      throw new ValidationError(`Cada keyword admite como máximo ${MAX_KEYWORD_LENGTH} caracteres`);
    }
    if (!cleaned.includes(value)) cleaned.push(value);
  }

  if (cleaned.length === 0) {
    throw new ValidationError('Se requiere al menos una keyword no vacía');
  }
  if (cleaned.length > MAX_KEYWORDS) {
    throw new ValidationError(`Se admiten como máximo ${MAX_KEYWORDS} keywords por análisis`);
  }
  return cleaned;
}

export function parseCountry(country = DEFAULT_COUNTRY) {
  if (typeof country !== 'string' || !/^[A-Za-z]{2}$/.test(country)) {
    throw new ValidationError('País inválido: se espera un código de dos letras (ES, US…)');
  }
  return country.toUpperCase();
}

export function parseLanguage(language = DEFAULT_LANGUAGE) {
  if (typeof language !== 'string' || !/^[A-Za-z]{2}$/.test(language)) {
    throw new ValidationError('Idioma inválido: se espera un código de dos letras (es, en…)');
  }
  return language.toLowerCase();
}

// Auditorías de contenido guardadas junto a un reporte
export function auditsNameFor(jsonFilename) {
  return jsonFilename.replace('seo_report_full_', 'seo_report_audits_');
}

const text = (value, max, label) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${label} debe ser texto`);
  if (value.length > max) throw new ValidationError(`${label} admite como máximo ${max} caracteres`);
  return value.trim();
};

export const MAX_AUDIT_TEXT = 200000;

export function parseAudit(body) {
  const audit = {
    name: text(body?.name, 120, 'El nombre'),
    keyword: text(body?.keyword, MAX_KEYWORD_LENGTH, 'La keyword'),
    title: text(body?.title, 300, 'El título'),
    metaDescription: text(body?.metaDescription, 600, 'La meta descripción'),
    text: text(body?.text, MAX_AUDIT_TEXT, 'El texto')
  };
  if (!audit.text) throw new ValidationError('Se requiere el texto a analizar');
  return audit;
}

// Datos de portada del informe PDF (llegan por query string)
export function parsePdfMeta(query) {
  return {
    client: text(query?.client, 120, 'El cliente'),
    project: text(query?.project, 120, 'El proyecto'),
    author: text(query?.author, 120, 'El autor')
  };
}

// Ficha del estudio (cliente, sitio, auditorías) guardada junto al reporte
export function studyNameFor(jsonFilename) {
  return jsonFilename.replace('seo_report_full_', 'seo_report_study_');
}

export { isLocalSite, siteOrigin };

// Sitio del cliente: se acepta una URL o un dominio y se guarda solo el host, sin www. Un sitio en desarrollo
// conserva el puerto (localhost:3000), que es parte de su dirección.
export function parseSite(value) {
  const raw = text(value, 200, 'El sitio');
  if (!raw) return '';
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    throw new ValidationError('El sitio debe ser un dominio válido (ejemplo.com o localhost:3000)');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const site = url.port ? `${host}:${url.port}` : host;
  if (isLocalSite(site)) return site;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
    throw new ValidationError('El sitio debe ser un dominio válido (ejemplo.com o localhost:3000)');
  }
  return host;
}

export function parseStudyMeta(input) {
  const accent = text(input?.accent, 7, 'El color');
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) {
    throw new ValidationError('El color debe tener formato #rrggbb');
  }
  return {
    name: text(input?.name, 120, 'El nombre'),
    client: text(input?.client, 120, 'El cliente'),
    site: parseSite(input?.site),
    author: text(input?.author, 120, 'El autor'),
    notes: text(input?.notes, 2000, 'Las notas'),
    accent
  };
}
