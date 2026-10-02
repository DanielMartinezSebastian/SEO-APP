// Brief de contenido para una keyword del estudio: lo que necesita quien va a escribir (persona o agente)
// para producir una página bien enfocada. Sale de los datos del estudio, sin inventar nada.
import { buildInsights, classifyIntent, INTENT_LABELS } from './insights.js';
import { contentTokens, normalize, tokenize } from './text.js';

// Tipo de página, extensión orientativa y datos estructurados recomendados según la intención
const PLAYBOOK = {
  transactional: {
    pageType: 'Página de producto, categoría o servicio',
    words: [500, 900],
    schema: ['Product u Offer', 'BreadcrumbList', 'FAQPage'],
    titles: (kw) => [`${kw}: precios y opciones`, `Comprar ${kw} online`, `${kw} al mejor precio`],
    angle: 'Deja claro qué se ofrece, cuánto cuesta y cómo conseguirlo. La llamada a la acción va arriba.'
  },
  commercial: {
    pageType: 'Comparativa, ranking o guía de compra',
    words: [1500, 2200],
    schema: ['Article', 'ItemList', 'FAQPage'],
    titles: (kw) => [`${kw}: comparativa y cuál elegir`, `${kw}: guía de compra`, `${kw}: opiniones y alternativas`],
    angle: 'Compara opciones con criterios explícitos y una tabla resumen. Di cuál recomiendas y para quién.'
  },
  informational: {
    pageType: 'Guía, tutorial o artículo de preguntas frecuentes',
    words: [1200, 1800],
    schema: ['Article', 'FAQPage', 'HowTo si hay pasos'],
    titles: (kw) => [`${kw}: guía paso a paso`, `${kw}: todo lo que necesitas saber`, `${kw} explicado con ejemplos`],
    angle: 'Responde la pregunta en el primer párrafo y desarrolla después. Usa ejemplos propios.'
  },
  local: {
    pageType: 'Página de servicio por zona y ficha de Google Business',
    words: [500, 800],
    schema: ['LocalBusiness', 'BreadcrumbList', 'FAQPage'],
    titles: (kw) => [`${kw}: dónde y cómo`, `${kw} en tu zona`, `${kw}: horarios, precios y contacto`],
    angle: 'Nombre, dirección, teléfono, horario y zona de servicio visibles. Reseñas y fotos reales.'
  },
  general: {
    pageType: 'Página pilar que reparte hacia contenidos más concretos',
    words: [1200, 2000],
    schema: ['Article u Organization', 'BreadcrumbList', 'FAQPage'],
    titles: (kw) => [`${kw}: guía completa`, `${kw}: tipos, precios y cómo elegir`, `Todo sobre ${kw}`],
    angle: 'Cubre el tema a lo ancho y enlaza a una página propia por cada subtema.'
  }
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * @param {object[]} report  datos del estudio
 * @param {string} keyword   keyword objetivo (cualquiera del estudio, o una nueva)
 * @returns {object|null}
 */
export function buildBrief(report, keyword) {
  const insights = buildInsights(report);
  const key = normalize(keyword).trim();
  if (!key) return null;

  const entry = insights.keywords.find((candidate) => normalize(candidate.keyword).trim() === key);
  const parent = entry?.parent || keyword;
  const intent = entry?.intent || classifyIntent(keyword);
  const playbook = PLAYBOOK[intent];

  // Familia de la keyword: lo que cuelga de la misma keyword principal
  const family = insights.keywords.filter((candidate) => candidate.parent === parent && normalize(candidate.keyword).trim() !== key);
  const ownTokens = new Set(tokenize(keyword));
  // las más cercanas primero: las que comparten todas las palabras de la keyword objetivo
  const shares = (candidate) => [...ownTokens].every((token) => tokenize(candidate.keyword).includes(token));
  const close = family.filter(shares);
  const pool = close.length >= 5 ? close : family;

  const byVolume = (a, b) => (b.volume || 0) - (a.volume || 0);
  const secondary = [...pool].sort((a, b) => b.score - a.score || byVolume(a, b)).filter((candidate) => candidate.volume > 0).slice(0, 10);
  const questions = pool.filter((candidate) => candidate.intent === 'informational').sort(byVolume).slice(0, 8);

  // Términos que más se repiten en la familia: el vocabulario que el texto debería cubrir
  const termCount = new Map();
  for (const candidate of pool) {
    for (const term of new Set(contentTokens(candidate.keyword))) {
      if (ownTokens.has(term) || term.length < 3) continue;
      const current = termCount.get(term) || { term, count: 0, volume: 0 };
      current.count += 1;
      current.volume += candidate.volume || 0;
      termCount.set(term, current);
    }
  }
  const terms = [...termCount.values()].sort((a, b) => b.count - a.count || b.volume - a.volume).slice(0, 25);

  // Esquema: un H2 por subtema con peso, más las preguntas y un cierre de FAQ
  const subtopics = insights.clusters
    .filter((cluster) => cluster.keywords.some((candidate) => candidate.parent === parent))
    .map((cluster) => cluster.keywords.filter((candidate) => candidate.parent === parent && normalize(candidate.keyword).trim() !== key))
    // un subtema necesita al menos dos keywords de esta familia; su título es la más buscada del grupo
    .filter((members) => members.length >= 2)
    .slice(0, 6)
    .map((members) => ({ heading: capitalize(members[0].keyword), covers: members.slice(1, 5).map((candidate) => candidate.keyword) }));
  const inSubtopics = new Set(subtopics.flatMap((section) => [section.heading.toLowerCase(), ...section.covers]));
  const looseQuestions = questions.filter((question) => !inSubtopics.has(question.keyword.toLowerCase()));
  const outline = [
    ...subtopics,
    ...looseQuestions.slice(0, 3).map((question) => ({ heading: capitalize(question.keyword), covers: [] })),
    { heading: 'Preguntas frecuentes', covers: looseQuestions.slice(3).map((question) => question.keyword) }
  ];

  const otherMains = insights.keywords.filter((candidate) => candidate.type === 'main' && candidate.keyword !== parent);

  return {
    keyword,
    inStudy: Boolean(entry),
    parent,
    intent,
    intentLabel: INTENT_LABELS[intent],
    metrics: entry ? { volume: entry.volume, competition: entry.competition ?? entry.parentCompetition, cpc: entry.cpc, score: entry.score } : null,
    pageType: playbook.pageType,
    angle: playbook.angle,
    wordCount: { min: playbook.words[0], max: playbook.words[1] },
    titleIdeas: playbook.titles(keyword).map(capitalize),
    h1: capitalize(keyword),
    outline,
    secondaryKeywords: secondary.map((candidate) => ({ keyword: candidate.keyword, volume: candidate.volume, score: candidate.score })),
    questions: questions.map((candidate) => ({ keyword: candidate.keyword, volume: candidate.volume })),
    terms: terms.map((item) => item.term),
    internalLinks: otherMains.map((candidate) => candidate.keyword),
    schema: playbook.schema,
    checklist: [
      'Keyword en el título (hacia el principio), en el H1 y en las primeras 100 palabras.',
      'Título de 30 a 60 caracteres y meta descripción de 120 a 160 con la keyword y un beneficio.',
      'Un H2 por subtema; bajo cada H2, una respuesta directa de 40 a 60 palabras antes de desarrollar.',
      'Preguntas frecuentes como pares pregunta-respuesta (y marcado FAQPage).',
      'De 3 a 5 enlaces internos por cada 1.000 palabras, con texto de enlace descriptivo.',
      'Autor identificado y fecha de actualización visibles.',
      'Imágenes con texto alternativo descriptivo.',
      'Revisar la ortografía de las keywords al usarlas: el autocompletado las devuelve sin tildes (como → cómo).'
    ]
  };
}

const number = (value) => (typeof value === 'number' ? Math.round(value).toLocaleString('es-ES') : 'sin dato');

export function briefToMarkdown(brief) {
  if (!brief) return '';
  const lines = [
    `# Brief de contenido: ${brief.keyword}`,
    '',
    `- **Intención:** ${brief.intentLabel}`,
    `- **Tipo de página:** ${brief.pageType}`,
    `- **Extensión orientativa:** ${brief.wordCount.min}-${brief.wordCount.max} palabras`
  ];
  if (brief.metrics) {
    lines.push(`- **Demanda:** ${number(brief.metrics.volume)} búsquedas/mes · competencia ` +
      `${typeof brief.metrics.competition === 'number' ? `${Math.round(brief.metrics.competition * 100)} %` : 'sin dato'} · puntuación ${brief.metrics.score}/100`);
  } else {
    lines.push('- **Demanda:** la keyword no está en el estudio; no hay datos propios.');
  }
  lines.push('', `**Enfoque:** ${brief.angle}`, '', '## Título y H1', '', `- H1: ${brief.h1}`, ...brief.titleIdeas.map((title) => `- Título SEO: ${title}`));

  lines.push('', '## Esquema propuesto', '');
  brief.outline.forEach((section) => {
    lines.push(`- **H2: ${section.heading}**${section.covers.length ? ` — cubre: ${section.covers.join(', ')}` : ''}`);
  });

  if (brief.secondaryKeywords.length) {
    lines.push('', '## Keywords secundarias', '', '| Keyword | Búsquedas/mes | Puntuación |', '|---|---:|---:|',
      ...brief.secondaryKeywords.map((item) => `| ${item.keyword} | ${number(item.volume)} | ${item.score} |`));
  }
  if (brief.questions.length) {
    lines.push('', '## Preguntas que responder', '', ...brief.questions.map((item) => `- ${item.keyword}`));
  }
  if (brief.terms.length) {
    lines.push('', '## Vocabulario a cubrir', '', brief.terms.join(', '));
  }
  if (brief.internalLinks.length) {
    lines.push('', '## Enlaces internos', '', `Enlazar hacia las páginas de: ${brief.internalLinks.join(', ')}.`);
  }
  lines.push('', '## Datos estructurados', '', brief.schema.map((type) => `- ${type}`).join('\n'));
  lines.push('', '## Comprobaciones antes de publicar', '', ...brief.checklist.map((item) => `- [ ] ${item}`), '');
  return lines.join('\n');
}
