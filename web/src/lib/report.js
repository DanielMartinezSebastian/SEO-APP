// Lógica pura sobre los datos de un reporte (sin DOM), compartida por las páginas y los tests.

// Datos SEO de la keyword principal. La API devuelve `keywordData` indexado por keyword
// y sin orden garantizado, así que hay que buscar por clave y no coger la primera entrada.
export function mainKeywordData(item) {
  return item?.keywordData?.[item.keyword] || {};
}

export function hasSeoData(item, keyword) {
  return typeof item?.keywordData?.[keyword]?.search_volume === 'number';
}

// Sugerencias que aún no se han consultado. Las que la API no conoce quedan guardadas con `no_data`
// y ya no cuentan como pendientes (mismo criterio que el servidor).
export function countMissingSuggestions(reportData) {
  if (!Array.isArray(reportData)) return 0;
  const pending = new Set();
  for (const item of reportData) {
    for (const suggestion of [...(item.suggestions || []), ...(item.ideas || []).map((idea) => idea.keyword)]) {
      if (!item.keywordData || !(suggestion in item.keywordData)) pending.add(suggestion);
    }
  }
  return pending.size;
}

// seo_report_full_2025-07-31T18-45-31-805.json -> Date (los reportes antiguos llevan una Z final)
export function dateFromFilename(filename) {
  const match = /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z?\.json$/.exec(filename || '');
  if (!match) return null;
  const [, y, mo, d, h, mi, s, ms] = match;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms));
}

export function csvFilenameFor(filename) {
  return filename.replace('seo_report_full_', 'seo_report_summary_').replace(/\.json$/, '.csv');
}

export function summarizeReport(reportData) {
  const items = Array.isArray(reportData) ? reportData : [];
  const count = items.length;
  const sum = (pick) => items.reduce((total, item) => total + (pick(mainKeywordData(item)) || 0), 0);

  return {
    totalKeywords: count,
    totalVolume: sum((kd) => kd.search_volume),
    avgCPC: count ? sum((kd) => kd.cpc) / count : 0,
    avgCompetition: count ? sum((kd) => kd.competition) / count : 0,
    totalSuggestions: items.reduce((total, item) => total + (item.suggestions?.length || 0), 0),
    totalDomains: new Set(items.flatMap((item) => Object.keys(item.domainData || {}))).size,
    totalUrls: new Set(items.flatMap((item) => Object.keys(item.urlAnalysis || {}))).size,
    totalErrors: items.reduce((total, item) => total + (item.errors?.length || 0), 0)
  };
}

// Aplana el reporte en una lista de keywords (principal, similares y sugerencias) para el análisis gráfico
export function flattenKeywords(reportData) {
  const all = [];

  (reportData || []).forEach((item, index) => {
    const keywordData = mainKeywordData(item);

    all.push({
      keyword: item.keyword,
      type: 'main',
      search_volume: keywordData.search_volume || 0,
      cpc: keywordData.cpc || 0,
      competition: keywordData.competition || 0,
      similar_count: keywordData.similar_keywords?.length || 0,
      suggestions_count: item.suggestions?.length || 0,
      keyword_length: item.keyword.length,
      parent_keyword: item.keyword,
      group_index: index
    });

    (keywordData.similar_keywords || []).forEach((similar) => {
      all.push({
        keyword: similar.keyword,
        type: 'similar',
        search_volume: similar.search_volume || 0,
        cpc: similar.cpc || 0,
        competition: similar.competition || 0,
        similar_count: 0,
        suggestions_count: 0,
        keyword_length: similar.keyword.length,
        parent_keyword: item.keyword,
        group_index: index
      });
    });

    all.push(...ideaEntries(item, index));

    (item.suggestions || []).forEach((suggestion) => {
      const suggestionData = item.keywordData?.[suggestion] || {};
      all.push({
        keyword: suggestion,
        type: 'suggestion',
        search_volume: suggestionData.search_volume || 0,
        cpc: suggestionData.cpc || 0,
        competition: suggestionData.competition || 0,
        similar_count: suggestionData.similar_keywords?.length || 0,
        suggestions_count: 0,
        keyword_length: suggestion.length,
        parent_keyword: item.keyword,
        group_index: index
      });
    });
  });

  return all.map((kw) => ({ ...kw, id: keywordId(kw) }));
}

// Ideas ampliadas (preguntas, comparativas y modificadores) de una keyword, con el mismo formato que el resto
function ideaEntries(item, index) {
  return (item.ideas || []).map((idea) => {
    const data = item.keywordData?.[idea.keyword] || {};
    return {
      keyword: idea.keyword,
      type: 'idea',
      search_volume: data.search_volume || 0,
      cpc: data.cpc || 0,
      competition: data.competition || 0,
      similar_count: data.similar_keywords?.length || 0,
      suggestions_count: 0,
      keyword_length: idea.keyword.length,
      parent_keyword: item.keyword,
      group_index: index
    };
  });
}

// Una misma keyword puede aparecer como similar de una principal y sugerencia de otra
export function keywordId(kw) {
  return `${kw.type}|${kw.parent_keyword}|${kw.keyword}`;
}

export function sortKeywords(keywords, metric, order) {
  const direction = order === 'asc' ? 1 : -1;
  return [...keywords].sort((a, b) => {
    const aVal = a[metric];
    const bVal = b[metric];
    if (typeof aVal === 'string' || typeof bVal === 'string') {
      return direction * String(aVal ?? '').localeCompare(String(bVal ?? ''), 'es');
    }
    return direction * ((aVal || 0) - (bVal || 0));
  });
}
