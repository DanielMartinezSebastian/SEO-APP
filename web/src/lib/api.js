const BASE_URL = '/api/seo';

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que esté funcionando.');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Respuesta sin JSON (p. ej. un error del proxy)
  }

  if (!response.ok || body?.success === false) {
    const detail = [body?.error, body?.message].filter(Boolean).join(': ');
    throw new Error(detail || `Error ${response.status}: ${response.statusText}`);
  }

  return body;
}

const json = (method, payload) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const studyPath = (filename, rest = '') => `/report/${encodeURIComponent(filename)}${rest}`;

// ---------- Estudios ----------

export const listStudies = () => request('/reports').then((result) => result.reports || []);

// { data: keywords del estudio, study: ficha y auditorías, summary: totales }
export const getStudy = (filename) => request(studyPath(filename));

export const createStudy = (input) => request('/analyze', json('POST', input));

export const updateStudy = (filename, meta) => request(studyPath(filename, '/study'), json('PATCH', meta)).then((result) => result.study);

export const deleteStudy = (filename) => request(studyPath(filename), { method: 'DELETE' });

export const completeSuggestions = (filename) => request('/analyze-suggestions', json('POST', { filename }));

// ---------- Auditorías ----------

export const auditUrl = (input) => request('/audit/url', json('POST', input)).then((result) => result.result);

export const saveTextAudit = (filename, audit) => request(studyPath(filename, '/audits'), json('POST', audit));

export const savePageAudit = (filename, input) => request(studyPath(filename, '/page-audits'), json('POST', input));

export const deleteAudit = (filename, id) =>
  request(studyPath(filename, `/audits/${encodeURIComponent(id)}`), { method: 'DELETE' });

// Qué URL del sitio del cliente cubre cada keyword; `refresh` vuelve a leer el sitemap
export const getKeywordMap = (filename, refresh = false) => request(studyPath(filename, `/keyword-map${refresh ? '?refresh' : ''}`));

// Audita el sitio del estudio por su sitemap y lo guarda; devuelve la ficha actualizada
export const runSiteAudit = (filename, pages) => request(studyPath(filename, '/site-audit'), json('POST', { pages })).then((result) => result.study);

// Tendencias de Google Trends. mode: '' (lo guardado, o pedirlo si no hay), 'refresh' (todo) o 'retry' (lo que falló)
export const getTrends = (filename, mode = '') => request(studyPath(filename, `/trends${mode ? `?${mode}` : ''}`));

// ---------- Entregables (enlaces de descarga) ----------

const fileUrl = (filename, rest) => `${BASE_URL}${studyPath(filename, rest)}`;

export const pdfUrl = (filename) => fileUrl(filename, '/pdf');
export const markdownUrl = (filename) => fileUrl(filename, '/markdown?download');
export const keywordsCsvUrl = (filename) => fileUrl(filename, '/keywords.csv');
export const jsonUrl = (filename) => `${BASE_URL}/download/${encodeURIComponent(filename)}`;
