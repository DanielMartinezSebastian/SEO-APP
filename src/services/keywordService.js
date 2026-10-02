import { getGoogleSuggestions } from '../api/googleSuggestions.js';
import { getKeywordData } from '../api/keywordsur.js';
import { DEFAULT_COUNTRY } from '../config.js';
import chalk from 'chalk';

const PAUSE_MS = 1000;
const KEYWORDS_BATCH_SIZE = 10;
const MAX_IDEAS = 30;

const pause = () => new Promise(resolve => setTimeout(resolve, PAUSE_MS));

// Búsquedas con las que se amplía cada keyword en el autocompletado de Google para sacar más ideas:
// preguntas, comparativas y modificadores. `%s` es la keyword.
const IDEA_QUERIES = {
  es: { pregunta: ['cómo %s', 'qué %s', 'cuál %s'], comparativa: ['mejor %s', '%s vs'], modificador: ['%s para', '%s con', '%s sin'] },
  en: { pregunta: ['how %s', 'what %s', 'which %s'], comparativa: ['best %s', '%s vs'], modificador: ['%s for', '%s with', '%s without'] },
  fr: { pregunta: ['comment %s', 'quel %s', 'pourquoi %s'], comparativa: ['meilleur %s', '%s vs'], modificador: ['%s pour', '%s avec', '%s sans'] },
  de: { pregunta: ['wie %s', 'was %s', 'welche %s'], comparativa: ['beste %s', '%s vs'], modificador: ['%s für', '%s mit', '%s ohne'] },
  it: { pregunta: ['come %s', 'cosa %s', 'quale %s'], comparativa: ['migliore %s', '%s vs'], modificador: ['%s per', '%s con', '%s senza'] },
  pt: { pregunta: ['como %s', 'o que %s', 'qual %s'], comparativa: ['melhor %s', '%s vs'], modificador: ['%s para', '%s com', '%s sem'] }
};

// Keywords derivadas de una keyword del reporte: sugerencias de Google e ideas ampliadas
const relatedOf = (report) => [...(report.suggestions || []), ...(report.ideas || []).map(idea => idea.keyword)];

// Una keyword derivada está pendiente mientras no tenga entrada en keywordData. Las que la API no conoce se
// guardan con `no_data` para no volver a pedirlas en cada análisis.
export function isSuggestionPending(report, suggestion) {
  return !report.keywordData || !(suggestion in report.keywordData);
}

export function pendingSuggestions(reportData) {
  const pending = new Set();
  for (const report of reportData) {
    for (const suggestion of relatedOf(report)) {
      if (isSuggestionPending(report, suggestion)) pending.add(suggestion);
    }
  }
  return pending;
}

// Combina en una copia del reporte los datos obtenidos para sus sugerencias pendientes
export function mergeSuggestionsIntoReport(originalData, suggestionsData, attempted) {
  const mergedData = JSON.parse(JSON.stringify(originalData)); // Deep copy

  mergedData.forEach(report => {
    report.keywordData = report.keywordData || {};
    relatedOf(report).forEach(suggestion => {
      if (!isSuggestionPending(report, suggestion)) return;
      if (suggestionsData[suggestion]) {
        report.keywordData[suggestion] = suggestionsData[suggestion];
      } else if (attempted.has(suggestion)) {
        report.keywordData[suggestion] = { no_data: true };
      }
    });
  });

  return mergedData;
}

// Dominio que los estudios antiguos deducían de la keyword (keyword.es). Los nuevos ya no lo hacen: el dominio
// del cliente se indica en la ficha del estudio. Se conserva para leer el resumen de los antiguos.
export function domainOf(item) {
  return item.domain || `${sanitizeKeywordForUrl(item.keyword)}.es`;
}

// Función para limpiar keywords y crear URLs válidas
export function sanitizeKeywordForUrl(keyword) {
  return keyword
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '-')           // Espacios -> guiones
    .replace(/[^a-z0-9\-]/g, '')    // Eliminar caracteres especiales
    .replace(/-+/g, '-')            // Múltiples guiones -> un guión
    .replace(/^-|-$/g, '');         // Eliminar guiones al inicio/final
}

// Ideas de keywords a partir del autocompletado de Google con preguntas, comparativas y modificadores.
// Un fallo en una de las búsquedas no invalida las demás.
async function getKeywordIdeas(keyword, country, language, exclude) {
  const queries = IDEA_QUERIES[language] || IDEA_QUERIES.en;
  const requests = Object.entries(queries).flatMap(([group, templates]) =>
    templates.map(template => ({ group, query: template.replace('%s', keyword) })));

  const results = await Promise.allSettled(
    requests.map(request => getGoogleSuggestions(request.query, country, language)));

  const seen = new Set([keyword, ...exclude].map(value => value.toLowerCase()));
  const ideas = [];
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    for (const suggestion of result.value) {
      const key = suggestion.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ideas.push({ keyword: suggestion, group: requests[index].group });
    }
  });

  // Reparto equilibrado entre grupos al recortar: una idea de cada grupo por turno
  const byGroup = Object.keys(queries).map(group => ideas.filter(idea => idea.group === group));
  const balanced = [];
  for (let round = 0; balanced.length < MAX_IDEAS && byGroup.some(group => group.length > round); round++) {
    for (const group of byGroup) {
      if (group[round] && balanced.length < MAX_IDEAS) balanced.push(group[round]);
    }
  }

  if (results.every(result => result.status === 'rejected')) {
    throw new Error(`Error obteniendo ideas de keywords: ${results[0].reason.message}`);
  }
  return balanced;
}

// Datos SEO de una lista de keywords, por lotes. Devuelve los datos, los errores y qué keywords se consultaron.
async function getKeywordDataInBatches(keywords, country) {
  const data = {};
  const errors = [];
  const attempted = new Set();

  for (let start = 0; start < keywords.length; start += KEYWORDS_BATCH_SIZE) {
    const batch = keywords.slice(start, start + KEYWORDS_BATCH_SIZE);
    try {
      Object.assign(data, await getKeywordData(batch, country));
      batch.forEach(keyword => attempted.add(keyword));
    } catch (error) {
      errors.push(error.message);
    }
  }

  return { data, errors, attempted };
}

export class KeywordAnalyzer {
  constructor() {
    this.results = new Map();
  }

  sanitizeKeywordForUrl(keyword) {
    return sanitizeKeywordForUrl(keyword);
  }

  async analyzeKeyword(keyword, country = 'ES', language = 'es') {
    const result = {
      keyword,
      country,
      language,
      timestamp: new Date().toISOString(),
      suggestions: [],
      ideas: [],
      keywordData: {},
      errors: []
    };

    // Cada paso es independiente: si uno falla se anota el error y se sigue con los demás
    const step = async (run) => {
      try {
        await run();
      } catch (error) {
        result.errors.push(error.message);
      }
    };

    // 1. Obtener sugerencias
    await step(async () => {
      result.suggestions = await getGoogleSuggestions(keyword, country, language);
    });

    // 2. Ampliar con preguntas, comparativas y modificadores
    await step(async () => {
      result.ideas = await getKeywordIdeas(keyword, country, language, result.suggestions);
    });

    // 3. Datos SEO de la keyword, sus sugerencias y sus ideas
    await step(async () => {
      const keywordsToAnalyze = [...new Set([keyword, ...relatedOf(result)])];
      const { data, errors, attempted } = await getKeywordDataInBatches(keywordsToAnalyze, country);
      result.keywordData = data;
      // las consultadas sin respuesta quedan marcadas para no volver a pedirlas
      relatedOf(result).forEach(related => {
        if (attempted.has(related) && !(related in data)) result.keywordData[related] = { no_data: true };
      });
      result.errors.push(...new Set(errors));
    });

    if (result.errors.length > 0) {
      console.error(chalk.red(`❌ "${keyword}" analizada con ${result.errors.length} errores: ${result.errors.join(' | ')}`));
    } else {
      console.error(chalk.green(`✅ Análisis completado para "${keyword}" (${result.suggestions.length} sugerencias, ${result.ideas.length} ideas)`));
    }

    this.results.set(keyword, result);
    return result;
  }

  async analyzeMultipleKeywords(keywords, country = 'ES', language = 'es') {
    console.error(chalk.blue(`\n📊 Iniciando análisis de ${keywords.length} keywords...\n`));

    for (const [index, keyword] of keywords.entries()) {
      // Pequeña pausa entre peticiones
      if (index > 0) await pause();
      await this.analyzeKeyword(keyword, country, language);
    }

    return this.getResults();
  }

  // Obtiene los datos SEO de una lista de sugerencias, por lotes. Devuelve { datos por keyword, errores, consultadas }
  async analyzeSuggestions(suggestions, country = DEFAULT_COUNTRY) {
    console.error(chalk.blue(`\n🔍 Analizando ${suggestions.length} sugerencias para obtener datos SEO...\n`));
    return getKeywordDataInBatches(suggestions, country);
  }

  getResults() {
    return Array.from(this.results.values());
  }

  getSummary() {
    const summary = [];

    for (const [keyword, data] of this.results) {
      const keywordInfo = data.keywordData?.[keyword] || {};
      const domain = domainOf(data);
      const domainInfo = data.domainData?.[domain] || {};
      const urlInfo = data.urlAnalysis?.[`https://www.${domain}`] || {};

      summary.push({
        keyword,
        searchVolume: keywordInfo.search_volume || 0,
        competition: keywordInfo.competition || 0,
        cpc: keywordInfo.cpc || 0,
        suggestionsCount: data.suggestions?.length || 0,
        domainTraffic: domainInfo.traffic || 0,
        domainKeywords: domainInfo.keyword_count_top10 || 0,
        pageWords: urlInfo.words || 0,
        errors: data.errors?.length || 0
      });
    }

    return summary;
  }
}
