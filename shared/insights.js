// Lectura estratégica de un reporte: qué keywords atacar, cómo se relacionan y qué intención tienen.
// Lógica pura, compartida por el frontend (página «Estrategia») y el servidor (informe PDF).
import { contentTokens, normalize, tokenize } from './text.js';

export const TYPE_LABELS = { main: 'Principal', suggestion: 'Sugerencia', similar: 'Similar', idea: 'Idea' };

export const INTENT_LABELS = {
  transactional: 'Transaccional',
  commercial: 'Comparativa',
  informational: 'Informativa',
  local: 'Local',
  general: 'General'
};

export const INTENT_HINTS = {
  transactional: 'Quien busca quiere comprar o contratar: fichas de producto, categorías y páginas de servicio.',
  commercial: 'Quien busca está comparando opciones: comparativas, rankings y reseñas.',
  informational: 'Quien busca quiere aprender: guías, tutoriales y preguntas frecuentes.',
  local: 'Quien busca quiere algo cerca: ficha de Google Business y páginas por zona.',
  general: 'Búsqueda genérica: página pilar que reparta hacia contenidos más concretos.'
};

// Lugares que convierten una búsqueda en local («fontanero madrid»). No es un nomenclátor completo: cubre las
// capitales de provincia españolas y las mayores ciudades de los mercados que ofrece la app.
const PLACES = new Set(`a coruna, albacete, alicante, almeria, avila, badajoz, barcelona, bilbao, burgos, caceres, cadiz, castellon,
ceuta, ciudad real, cordoba, cuenca, girona, gijon, granada, guadalajara, huelva, huesca, jaen, las palmas, leon, lleida, logrono, lugo,
madrid, malaga, melilla, murcia, ourense, oviedo, palencia, palma, pamplona, pontevedra, salamanca, san sebastian, santander, segovia,
sevilla, soria, tarragona, tenerife, teruel, toledo, valencia, valladolid, vigo, vitoria, zamora, zaragoza, alcala de henares, mostoles,
getafe, leganes, hospitalet, badalona, sabadell, terrassa, elche, cartagena, jerez, marbella, ibiza, mallorca, canarias, asturias,
cantabria, galicia, andalucia, cataluna, euskadi, navarra, extremadura, aragon,
ciudad de mexico, cdmx, guadalajara, monterrey, puebla, tijuana, bogota, medellin, cali, buenos aires, cordoba, rosario, santiago, lima,
quito, caracas, montevideo, miami, new york, los angeles, chicago, houston, london, manchester, paris, lyon, marseille, berlin, munich,
hamburg, roma, milano, napoli, lisboa, porto`.split(',').map((place) => place.trim()));
const PLACE_WORDS = Math.max(...[...PLACES].map((place) => place.split(' ').length));

// Lugares que aparecen en una keyword, ya normalizados
export function placesIn(keyword) {
  const tokens = tokenize(keyword);
  const found = new Set();
  for (let start = 0; start < tokens.length; start++) {
    for (let length = Math.min(PLACE_WORDS, tokens.length - start); length >= 1; length--) {
      const candidate = tokens.slice(start, start + length).join(' ');
      if (PLACES.has(candidate)) {
        found.add(candidate);
        break;
      }
    }
  }
  return [...found];
}

// Las palabras interrogativas solo cuentan al principio: «zapatos que no se mojan» no es una pregunta
const QUESTION_START = /^(como|que|por que|para que|cual|cuales|cuando|donde|cuanto|cuanta|cuantos|quien|how|what|why|when|where|which|who|comment|pourquoi|quel|quelle|wie|was|warum|welche|come|cosa|perche|quale)\b/;

// Palabras que delatan la intención, ya normalizadas (sin tildes). Se prueban en este orden.
const INTENT_PATTERNS = [
  ['local', /\b(cerca|cerca de mi|near me|nearby|a domicilio|en mi zona|24 horas|24h|24 h|pres de moi|in der nahe|vicino a me)\b/],
  ['transactional', /\b(comprar|compra|precio|precios|barato|baratos|barata|baratas|oferta|ofertas|descuento|tienda|online|venta|alquiler|alquilar|contratar|presupuesto|envio|outlet|rebajas|buy|price|prices|cheap|deal|deals|sale|shop|store|order|acheter|prix|kaufen|preis|comprare|prezzo)\b/],
  ['commercial', /\b(mejor|mejores|vs|versus|comparativa|comparar|opiniones|opinion|analisis|review|reviews|alternativas|alternativa|top|ranking|best|compare|comparison|meilleur|avis|beste|test|migliore|recensioni)\b/],
  ['informational', /\b(guia|tutorial|ejemplos|ejemplo|significado|definicion|tipos|ideas|consejos|paso a paso|curso|aprender|que es|para que sirve|guide|examples|meaning|tips|learn|how to)\b/]
];

export function classifyIntent(keyword) {
  const text = normalize(keyword).trim();
  // una pregunta es informativa aunque nombre un lugar («cómo llegar a madrid»)
  if (QUESTION_START.test(text)) return 'informational';
  if (placesIn(keyword).length > 0) return 'local';
  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (pattern.test(text)) return intent;
  }
  return 'general';
}

// Raíz aproximada de una palabra: quita plurales para que «fontanero» y «fontaneros» cuenten como el mismo término
export function stem(token) {
  return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const mainData = (item) => item?.keywordData?.[item.keyword] || {};
const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// Todas las keywords del reporte, una por texto. Si una aparece varias veces (p. ej. como sugerencia de una
// keyword y similar de otra) se conserva la entrada con más datos.
export function collectKeywords(report) {
  const byKeyword = new Map();

  const add = (keyword, type, parent, data) => {
    if (typeof keyword !== 'string' || !keyword.trim()) return;
    const entry = {
      keyword,
      type,
      parent,
      volume: numberOrNull(data?.search_volume),
      // la fuente no da competencia para las keywords similares
      competition: numberOrNull(data?.competition),
      cpc: numberOrNull(data?.cpc),
      words: tokenize(keyword).length,
      intent: classifyIntent(keyword)
    };
    const key = normalize(keyword).trim();
    const existing = byKeyword.get(key);
    const filled = (candidate) => [candidate.volume, candidate.competition, candidate.cpc].filter((value) => value !== null).length;
    if (!existing || existing.type !== 'main' && (type === 'main' || filled(entry) > filled(existing))) {
      byKeyword.set(key, entry);
    }
  };

  for (const item of Array.isArray(report) ? report : []) {
    const data = mainData(item);
    add(item.keyword, 'main', item.keyword, data);
    for (const suggestion of item.suggestions || []) add(suggestion, 'suggestion', item.keyword, item.keywordData?.[suggestion]);
    for (const idea of item.ideas || []) add(idea.keyword, 'idea', item.keyword, item.keywordData?.[idea.keyword]);
    for (const similar of data.similar_keywords || []) add(similar.keyword, 'similar', item.keyword, similar);
  }

  // competencia de la keyword principal de cada entrada, como referencia cuando falta la propia
  const items = Array.isArray(report) ? report : [];
  const mainCompetition = new Map(items.map((item) => [item.keyword, numberOrNull(mainData(item).competition)]));
  // Si las keywords principales nombran un lugar, el estudio es de esa zona: una sugerencia de otra ciudad
  // («fontanero urgente sevilla» en un estudio de Madrid) no es una oportunidad para este cliente.
  const studyPlaces = new Set(items.flatMap((item) => placesIn(item.keyword)));
  return [...byKeyword.values()].map((entry) => {
    const places = placesIn(entry.keyword);
    return {
      ...entry,
      parentCompetition: mainCompetition.get(entry.parent) ?? null,
      offTarget: studyPlaces.size > 0 && places.length > 0 && !places.some((place) => studyPlaces.has(place))
    };
  });
}

// Puntuación 0-100 de lo atractiva que es una keyword: demanda (50 %), poca competencia (35 %) y valor
// comercial según el CPC (15 %). El volumen y el CPC van en escala logarítmica para que una keyword
// enorme no aplaste al resto. Sin dato de competencia (las keywords similares no lo traen) se usa la de
// su keyword principal, y si tampoco existe, un valor medio: así una keyword sin dato no adelanta a las
// que sí lo tienen solo por faltarle.
export function opportunityScore(entry, maxVolume) {
  if (!entry.volume) return 0;
  const volume = Math.log10(entry.volume + 1) / Math.log10(Math.max(maxVolume, 10) + 1);
  const known = entry.competition ?? entry.parentCompetition ?? 0.5;
  const competition = 1 - Math.min(Math.max(known, 0), 1);
  const cpc = Math.min(1, Math.log10(1 + (entry.cpc || 0) * 10) / Math.log10(31));
  return Math.round(100 * (0.5 * volume + 0.35 * competition + 0.15 * cpc));
}

// Agrupa las keywords por el término que más comparten, quitando las palabras de su keyword principal
// (si todo cuelga de «zapatos», «zapatos» no distingue nada). Cada keyword va a un solo grupo.
export function clusterByTerms(entries) {
  const termMembers = new Map();
  const termsOf = new Map();

  for (const entry of entries) {
    if (entry.type === 'main') continue;
    const parentStems = new Set(tokenize(entry.parent).map(stem));
    // se agrupa por raíz: «urgencia» y «urgencias» son el mismo tema, y «fontaneros» no distingue nada de «fontanero»
    const terms = [...new Set(contentTokens(entry.keyword)
      .filter((token) => token.length > 2 && !/^\d+$/.test(token))
      .map(stem)
      .filter((term) => !parentStems.has(term)))];
    termsOf.set(entry, terms);
    for (const term of terms) {
      if (!termMembers.has(term)) termMembers.set(term, []);
      termMembers.get(term).push(entry);
    }
  }

  const volumeOf = (members) => members.reduce((total, entry) => total + (entry.volume || 0), 0);
  const rankedTerms = [...termMembers.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || volumeOf(b[1]) - volumeOf(a[1]));

  const assigned = new Set();
  const clusters = [];
  for (const [term] of rankedTerms) {
    const members = termMembers.get(term).filter((entry) => !assigned.has(entry));
    if (members.length < 2) continue;
    members.forEach((entry) => assigned.add(entry));
    const withCompetition = members.filter((entry) => entry.competition !== null);
    clusters.push({
      term,
      keywords: members.sort((a, b) => (b.volume || 0) - (a.volume || 0)),
      totalVolume: volumeOf(members),
      avgCompetition: withCompetition.length
        ? withCompetition.reduce((total, entry) => total + entry.competition, 0) / withCompetition.length
        : null
    });
  }

  return clusters.sort((a, b) => b.totalVolume - a.totalVolume);
}

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const formatInt = (value) => Math.round(value).toLocaleString('es-ES');

export function buildInsights(report) {
  const collected = collectKeywords(report);
  const maxVolume = collected.reduce((max, entry) => Math.max(max, entry.volume || 0), 0);
  const keywords = collected
    .map((entry) => ({ ...entry, score: opportunityScore(entry, maxVolume) }))
    .sort((a, b) => b.score - a.score || (b.volume || 0) - (a.volume || 0));

  // las keywords de otra zona se conservan en el listado, pero no compiten como oportunidad
  const withVolume = keywords.filter((entry) => entry.volume > 0 && !entry.offTarget);
  const medianVolume = median(withVolume.map((entry) => entry.volume));

  // Victorias rápidas: demanda por encima de la mediana y competencia baja, con dato real de competencia
  const quickWins = withVolume.filter((entry) => entry.competition !== null && entry.competition < 0.4 && entry.volume >= medianVolume);

  const intents = Object.keys(INTENT_LABELS).map((intent) => {
    const members = keywords.filter((entry) => entry.intent === intent);
    return { intent, label: INTENT_LABELS[intent], count: members.length, volume: members.reduce((total, entry) => total + (entry.volume || 0), 0) };
  });

  const lengthBuckets = [
    { label: '1 palabra', test: (words) => words <= 1 },
    { label: '2 palabras', test: (words) => words === 2 },
    { label: '3 palabras', test: (words) => words === 3 },
    { label: '4 o más', test: (words) => words >= 4 }
  ].map(({ label, test }) => {
    const members = keywords.filter((entry) => test(entry.words));
    return { label, count: members.length, volume: members.reduce((total, entry) => total + (entry.volume || 0), 0) };
  });

  const onTarget = keywords.filter((entry) => !entry.offTarget);
  const clusters = clusterByTerms(onTarget);
  const questions = onTarget.filter((entry) => entry.intent === 'informational').sort((a, b) => (b.volume || 0) - (a.volume || 0));

  return {
    keywords,
    totals: {
      keywords: keywords.length,
      withData: withVolume.length,
      volume: withVolume.reduce((total, entry) => total + entry.volume, 0),
      medianVolume
    },
    opportunities: withVolume.slice(0, 20),
    quickWins,
    intents,
    lengthBuckets,
    clusters,
    questions,
    recommendations: buildRecommendations({ keywords, withVolume, quickWins, intents, clusters, lengthBuckets, questions })
  };
}

// Conclusiones en lenguaje llano, cada una con el dato que la sostiene
function buildRecommendations({ keywords, withVolume, quickWins, intents, clusters, lengthBuckets, questions }) {
  const recommendations = [];
  if (withVolume.length === 0) {
    recommendations.push({
      level: 'warning',
      title: 'Sin datos de demanda',
      text: 'Ninguna keyword del estudio tiene volumen de búsqueda. Prueba con términos más generales o con otro país.'
    });
    return recommendations;
  }

  const [best] = withVolume;
  recommendations.push({
    level: 'success',
    title: 'Prioridad n.º 1',
    text: `«${best.keyword}» es la mejor oportunidad del estudio (${best.score}/100): ${formatInt(best.volume)} búsquedas al mes` +
      (best.competition === null ? '.' : ` con una competencia del ${Math.round(best.competition * 100)} %.`)
  });

  if (quickWins.length > 0) {
    recommendations.push({
      level: 'success',
      title: 'Victorias rápidas',
      text: `${plural(quickWins.length, 'keyword combina', 'keywords combinan')} demanda por encima de la mediana y competencia baja: ` +
        `${quickWins.slice(0, 5).map((entry) => `«${entry.keyword}»`).join(', ')}. Son las primeras para las que crear o mejorar contenido.`
    });
  } else {
    recommendations.push({
      level: 'warning',
      title: 'Mercado disputado',
      text: 'No hay keywords con buena demanda y competencia baja. Conviene atacar la cola larga (3 o más palabras) antes que los términos principales.'
    });
  }

  const mains = keywords.filter((entry) => entry.type === 'main' && entry.competition !== null);
  const hardMains = mains.filter((entry) => entry.competition > 0.7);
  if (hardMains.length > 0) {
    recommendations.push({
      level: 'warning',
      title: 'Keywords principales muy competidas',
      text: `${hardMains.map((entry) => `«${entry.keyword}»`).join(', ')} ${hardMains.length === 1 ? 'tiene' : 'tienen'} una competencia superior al 70 %. ` +
        'Trabájalas a largo plazo con una página pilar y apóyalas con contenidos de cola larga que enlacen a ella.'
    });
  }

  const topIntent = [...intents].filter((entry) => entry.intent !== 'general').sort((a, b) => b.volume - a.volume)[0];
  if (topIntent && topIntent.volume > 0) {
    recommendations.push({
      level: 'info',
      title: `Intención dominante: ${topIntent.label.toLowerCase()}`,
      text: `${plural(topIntent.count, 'keyword', 'keywords')} (${formatInt(topIntent.volume)} búsquedas al mes) ${topIntent.count === 1 ? 'tiene' : 'tienen'} intención ${topIntent.label.toLowerCase()}. ${INTENT_HINTS[topIntent.intent]}`
    });
  }

  const offTarget = keywords.filter((entry) => entry.offTarget);
  if (offTarget.length > 0) {
    recommendations.push({
      level: 'info',
      title: 'Búsquedas de otras zonas, descartadas',
      text: `${plural(offTarget.length, 'keyword nombra', 'keywords nombran')} un lugar distinto al del estudio (por ejemplo ${offTarget.slice(0, 3).map((entry) => `«${entry.keyword}»`).join(', ')}). ` +
        'Siguen en el listado, pero no cuentan como oportunidad.'
    });
  }

  if (clusters.length > 0) {
    recommendations.push({
      level: 'info',
      title: 'Temas para estructurar el contenido',
      text: `Las keywords se agrupan en ${clusters.length} temas. Los de más demanda: ` +
        `${clusters.slice(0, 4).map((cluster) => `«${cluster.term}» (${cluster.keywords.length} keywords, ${formatInt(cluster.totalVolume)} búsquedas)`).join('; ')}. ` +
        'Cada tema puede ser una página o una sección propia.'
    });
  }

  const longTail = lengthBuckets.slice(2).reduce((total, bucket) => total + bucket.count, 0);
  if (longTail > 0) {
    recommendations.push({
      level: 'info',
      title: 'Cola larga',
      text: `${longTail} de ${keywords.length} keywords tienen 3 o más palabras. Suelen convertir mejor y posicionar antes: úsalas como títulos de artículos y apartados.`
    });
  }

  if (questions.length > 0) {
    recommendations.push({
      level: 'info',
      title: 'Preguntas que responder',
      text: `Hay ${plural(questions.length, 'búsqueda', 'búsquedas')} en forma de pregunta o de consulta informativa, como ${questions.slice(0, 4).map((entry) => `«${entry.keyword}»`).join(', ')}. ` +
        'Respóndelas en un bloque de preguntas frecuentes o en artículos propios.'
    });
  }

  return recommendations;
}
