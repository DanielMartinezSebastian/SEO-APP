// Auditoría SEO de un texto frente a una keyword objetivo y al campo semántico del estudio.
// Lógica pura, compartida por el frontend (análisis en vivo) y el servidor (auditorías guardadas y PDF).
import { contentTokens, normalize, tokenize } from './text.js';

export const LIMITS = {
  minWords: 300,
  goodWords: 600,
  titleMin: 30,
  titleMax: 60,
  metaMin: 120,
  metaMax: 160,
  densityMin: 0.5,
  densityMax: 2.5,
  densityStuffing: 3.5,
  longSentenceWords: 25,
  longSentenceShare: 0.25,
  longParagraphWords: 150,
  wordsPerHeading: 300,
  relatedCoverage: 0.3,
  readabilityGood: 55,
  readabilityPoor: 40,
  // respuesta directa bajo cada subtítulo: lo que extraen los resultados con IA y los fragmentos destacados
  answerMinWords: 20,
  answerMaxWords: 80,
  answerShare: 0.5
};

const STATUS_POINTS = { ok: 1, warn: 0.5, fail: 0 };

// ---------- Lectura del texto (plano, Markdown o HTML) ----------

function extractStructure(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  const isHtml = /<(p|h[1-6]|div|a|img|ul|ol|li|br|strong|em|span)\b[^>]*>/i.test(text);
  const headings = [];
  const links = [];
  const images = [];
  let body = text;

  if (isHtml) {
    body = body.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
    body.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
      headings.push({ level: Number(level), text: inner.replace(/<[^>]+>/g, ' ').trim() });
      return '';
    });
    body.replace(/<a\b[^>]*href=["']?([^"'\s>]+)/gi, (_, href) => (links.push(href), ''));
    body.replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = /alt=["']([^"']*)["']/i.exec(tag);
      // alt="" es la forma correcta de marcar una imagen decorativa: no es lo mismo que no llevar el atributo
      images.push({ alt: alt ? alt[1].trim() : '', decorative: Boolean(alt) && alt[1].trim() === '' });
      return '';
    });
    body = body
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|section|article|blockquote)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  } else {
    body.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => (images.push({ alt: alt.trim() }), ''));
    body.replace(/(?<!!)\[[^\]]+\]\(([^)\s]+)[^)]*\)/g, (_, href) => (links.push(href), ''));
    body = body
      .split('\n')
      .map((line) => {
        const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
        if (!heading) return line;
        headings.push({ level: heading[1].length, text: heading[2].replace(/#+\s*$/, '').trim() });
        return `\n${heading[2]}\n`;
      })
      .join('\n')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`>]+/g, ' ');
  }

  const paragraphs = body.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const plain = paragraphs.join('\n\n');
  const hasMarkup = isHtml || headings.length > 0 || links.length > 0 || images.length > 0;
  return { plain, paragraphs, headings, links, images, hasMarkup };
}

const splitSentences = (text) => text.split(/(?<=[.!?…])\s+|\n+/).map((sentence) => sentence.trim()).filter((sentence) => /\p{L}/u.test(sentence));
const words = (text) => text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];

// ---------- Legibilidad ----------

// Sílabas aproximadas: grupos de vocales, separando los hiatos de vocales fuertes y las cerradas tónicas
function countSyllables(word) {
  const lower = word.toLowerCase();
  const groups = lower.match(/[aeiouáéíóúüy]+/g);
  if (!groups) return 1;
  let count = 0;
  for (const group of groups) {
    count += 1;
    for (let index = 1; index < group.length; index++) {
      const pair = group[index - 1] + group[index];
      if (/[aeoáéó][aeoáéó]/.test(pair) || /[íú]/.test(pair)) count += 1;
    }
  }
  return count;
}

// Español: índice de perspicuidad de Szigriszt-Pazos. Inglés: Flesch Reading Ease. Ambos van de 0 a 100
// (más alto = más fácil). Para otros idiomas se usa la fórmula española como aproximación.
function readability(wordList, sentenceCount, language) {
  if (wordList.length === 0 || sentenceCount === 0) return null;
  const syllablesPerWord = wordList.reduce((total, word) => total + countSyllables(word), 0) / wordList.length;
  const wordsPerSentence = wordList.length / sentenceCount;
  const score = language === 'en'
    ? 206.835 - 84.6 * syllablesPerWord - 1.015 * wordsPerSentence
    : 206.835 - 62.3 * syllablesPerWord - wordsPerSentence;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function readabilityLabel(score) {
  if (score >= 80) return 'muy fácil';
  if (score >= 65) return 'bastante fácil';
  if (score >= 55) return 'normal';
  if (score >= 40) return 'algo difícil';
  return 'difícil';
}

// ---------- Keyword ----------

// Apariciones de la frase exacta, sin distinguir tildes ni mayúsculas
function countPhrase(haystackTokens, phraseTokens) {
  if (phraseTokens.length === 0) return 0;
  let count = 0;
  for (let index = 0; index <= haystackTokens.length - phraseTokens.length; index++) {
    if (phraseTokens.every((token, offset) => haystackTokens[index + offset] === token)) count += 1;
  }
  return count;
}

const containsPhrase = (text, phraseTokens) => countPhrase(tokenize(text), phraseTokens) > 0;
// Todas las palabras con significado de la keyword, en cualquier orden
const containsAllTerms = (text, phrase) => {
  const tokens = new Set(tokenize(text));
  const terms = contentTokens(phrase);
  return terms.length > 0 && terms.every((term) => tokens.has(term));
};

const round = (value, digits = 1) => Number(value.toFixed(digits));
// número con coma decimal para los textos de detalle
const es = (value) => String(value).replace(".", ",");

/**
 * @param {object} input
 * @param {string} input.text            texto a auditar (plano, Markdown o HTML)
 * @param {string} [input.keyword]       keyword objetivo
 * @param {string} [input.title]         título SEO (etiqueta <title>)
 * @param {string} [input.metaDescription]
 * @param {string[]} [input.relatedKeywords] keywords del estudio relacionadas con la objetivo
 * @param {string} [input.language]      código de idioma del estudio (es, en…)
 */
export function analyzeContent({ text = '', keyword = '', title = '', metaDescription = '', relatedKeywords = [], language = 'es' } = {}) {
  const structure = extractStructure(text);
  const wordList = words(structure.plain);
  const sentences = splitSentences(structure.plain);
  const bodyTokens = tokenize(structure.plain);
  const keywordTokens = tokenize(keyword);
  const hasKeyword = keywordTokens.length > 0;

  const occurrences = countPhrase(bodyTokens, keywordTokens);
  const density = wordList.length > 0 ? (occurrences * keywordTokens.length / wordList.length) * 100 : 0;
  const readabilityScore = readability(wordList, sentences.length, language);
  const sentenceLengths = sentences.map((sentence) => words(sentence).length);
  const longSentences = sentenceLengths.filter((length) => length > LIMITS.longSentenceWords).length;
  const paragraphLengths = structure.paragraphs.map((paragraph) => words(paragraph).length);
  const longestParagraph = Math.max(0, ...paragraphLengths);
  const h1 = structure.headings.filter((heading) => heading.level === 1);
  const subheadings = structure.headings.filter((heading) => heading.level > 1);

  // Términos del campo semántico: palabras con significado de las keywords relacionadas que no están ya en la objetivo
  const ownTerms = new Set(contentTokens(keyword));
  const relatedTerms = [...new Set(relatedKeywords.flatMap((related) => contentTokens(related)))]
    .filter((term) => !ownTerms.has(term) && term.length > 2);
  const bodyTermSet = new Set(bodyTokens);
  const relatedUsed = relatedTerms.filter((term) => bodyTermSet.has(term));
  const relatedMissing = relatedTerms.filter((term) => !bodyTermSet.has(term));
  const keywordsUsed = relatedKeywords.filter((related) => containsPhrase(structure.plain, tokenize(related)));

  const checks = [];
  const check = (id, group, label, weight, status, detail) => checks.push({ id, group, label, weight, status, detail });
  const skip = (id, group, label, detail) => checks.push({ id, group, label, weight: 0, status: 'skip', detail });

  // --- Contenido ---
  check('length', 'Contenido', 'Extensión del texto', 3,
    wordList.length >= LIMITS.goodWords ? 'ok' : wordList.length >= LIMITS.minWords ? 'warn' : 'fail',
    `${wordList.length} palabras. Menos de ${LIMITS.minWords} suele quedarse corto para posicionar; a partir de ${LIMITS.goodWords} hay margen para cubrir el tema.`);

  if (hasKeyword) {
    const firstWords = bodyTokens.slice(0, 100);
    check('keyword-intro', 'Keyword', 'Keyword al principio del texto', 2,
      countPhrase(firstWords, keywordTokens) > 0 ? 'ok' : containsAllTerms(firstWords.join(' '), keyword) ? 'warn' : 'fail',
      'La keyword debería aparecer en las primeras 100 palabras: deja claro de qué trata la página.');

    check('keyword-density', 'Keyword', 'Densidad de la keyword', 3,
      occurrences === 0 ? 'fail'
        : density > LIMITS.densityStuffing ? 'fail'
          : density < LIMITS.densityMin || density > LIMITS.densityMax ? 'warn' : 'ok',
      occurrences === 0
        ? 'La keyword exacta no aparece en el texto.'
        : `${occurrences} apariciones, ${es(round(density))} % del texto. Lo razonable es entre ${es(LIMITS.densityMin)} % y ${es(LIMITS.densityMax)} %; por encima de ${es(LIMITS.densityStuffing)} % parece relleno.`);
  } else {
    skip('keyword-intro', 'Keyword', 'Keyword al principio del texto', 'Indica una keyword objetivo para evaluarlo.');
    skip('keyword-density', 'Keyword', 'Densidad de la keyword', 'Indica una keyword objetivo para evaluarlo.');
  }

  // --- Título y meta descripción ---
  if (title.trim()) {
    const length = title.trim().length;
    check('title-length', 'Título y meta', 'Longitud del título', 2,
      length >= LIMITS.titleMin && length <= LIMITS.titleMax ? 'ok' : length > LIMITS.titleMax + 10 || length < 15 ? 'fail' : 'warn',
      `${length} caracteres. Entre ${LIMITS.titleMin} y ${LIMITS.titleMax} se muestra completo en Google.`);
    if (hasKeyword) {
      check('title-keyword', 'Título y meta', 'Keyword en el título', 3,
        containsPhrase(title, keywordTokens) ? 'ok' : containsAllTerms(title, keyword) ? 'warn' : 'fail',
        'El título es la señal on-page de más peso: la keyword debería estar, mejor hacia el principio.');
    }
  } else {
    skip('title-length', 'Título y meta', 'Título SEO', 'Añade el título para evaluarlo.');
  }

  if (metaDescription.trim()) {
    const length = metaDescription.trim().length;
    check('meta-length', 'Título y meta', 'Longitud de la meta descripción', 1,
      length >= LIMITS.metaMin && length <= LIMITS.metaMax ? 'ok' : 'warn',
      `${length} caracteres. Entre ${LIMITS.metaMin} y ${LIMITS.metaMax} evita que Google la corte.`);
    if (hasKeyword) {
      check('meta-keyword', 'Título y meta', 'Keyword en la meta descripción', 1,
        containsPhrase(metaDescription, keywordTokens) || containsAllTerms(metaDescription, keyword) ? 'ok' : 'warn',
        'No influye en la posición, pero Google la resalta en negrita y mejora el porcentaje de clics.');
    }
  } else {
    skip('meta-length', 'Título y meta', 'Meta descripción', 'Añade la meta descripción para evaluarla.');
  }

  // --- Estructura ---
  if (structure.hasMarkup) {
    check('h1', 'Estructura', 'Un único H1', 1,
      h1.length === 1 ? 'ok' : 'warn',
      h1.length === 0 ? 'No hay H1. Si el título de la página va aparte, ignora este aviso.' : h1.length === 1 ? 'Hay un H1.' : `Hay ${h1.length} H1; debería haber solo uno.`);

    const expected = Math.floor(wordList.length / LIMITS.wordsPerHeading);
    check('subheadings', 'Estructura', 'Subtítulos (H2, H3)', 2,
      subheadings.length >= Math.max(1, expected) ? 'ok' : subheadings.length > 0 ? 'warn' : wordList.length > LIMITS.wordsPerHeading ? 'fail' : 'warn',
      `${subheadings.length} subtítulos. Conviene uno cada ${LIMITS.wordsPerHeading} palabras, más o menos, para que el texto se pueda escanear.`);

    if (hasKeyword && structure.headings.length > 0) {
      check('heading-keyword', 'Estructura', 'Keyword en algún encabezado', 2,
        structure.headings.some((heading) => containsPhrase(heading.text, keywordTokens)) ? 'ok'
          : structure.headings.some((heading) => containsAllTerms(heading.text, keyword)) ? 'warn' : 'fail',
        'Al menos un encabezado debería incluir la keyword o una variante.');
    }

    check('links', 'Estructura', 'Enlaces', 1,
      structure.links.length > 0 ? 'ok' : 'warn',
      structure.links.length > 0 ? `${structure.links.length} enlaces.` : 'Sin enlaces. Enlazar a otras páginas del sitio y a fuentes ayuda a Google a situar el contenido.');

    if (structure.images.length > 0) {
      const withoutAlt = structure.images.filter((image) => !image.alt && !image.decorative).length;
      const decorative = structure.images.filter((image) => image.decorative).length;
      const decorativeNote = decorative > 0 ? ` ${decorative === 1 ? 'Una lleva' : `${decorative} llevan`} alt="" (decorativas): es correcto si no aportan información; si muestran algo relevante, descríbelo.` : '';
      check('images-alt', 'Estructura', 'Texto alternativo de las imágenes', 1,
        withoutAlt === 0 ? 'ok' : 'warn',
        (withoutAlt === 0
          ? (decorative === structure.images.length ? `Las ${structure.images.length} imágenes están marcadas como decorativas.` : `Ninguna de las ${structure.images.length} imágenes carece de atributo alt.`)
          : `${withoutAlt} de ${structure.images.length} imágenes no llevan atributo alt.`) + (decorative === structure.images.length ? decorativeNote.replace(/^ \S+ \S+ alt="" \(decorativas\):/, ' alt=""') : decorativeNote));
    }
  } else {
    skip('subheadings', 'Estructura', 'Encabezados, enlaces e imágenes',
      'El texto no tiene formato. Pégalo en Markdown (# Título, ## Subtítulo) o en HTML para evaluar su estructura.');
  }

  // --- Buscadores con IA y fragmentos destacados ---
  if (subheadings.length >= 2) {
    const headingTexts = new Set(subheadings.map((heading) => heading.text.replace(/\s+/g, ' ').trim()));
    const answers = [];
    structure.paragraphs.forEach((paragraph, index) => {
      if (headingTexts.has(paragraph) && structure.paragraphs[index + 1] && !headingTexts.has(structure.paragraphs[index + 1])) {
        answers.push(words(structure.paragraphs[index + 1]).length);
      }
    });
    const direct = answers.filter((length) => length >= LIMITS.answerMinWords && length <= LIMITS.answerMaxWords).length;
    const share = answers.length ? direct / answers.length : 0;
    check('answer-first', 'IA y fragmentos', 'Respuesta directa bajo cada subtítulo', 2,
      share >= LIMITS.answerShare ? 'ok' : direct > 0 ? 'warn' : 'fail',
      `${direct} de ${answers.length} apartados empiezan con un párrafo de ${LIMITS.answerMinWords} a ${LIMITS.answerMaxWords} palabras. ` +
      'Los resúmenes con IA y los fragmentos destacados citan respuestas cortas y completas: resume primero (40-60 palabras) y desarrolla después.');

    const questionHeadings = subheadings.filter((heading) => /[?¿]/.test(heading.text) || /^(como|que|por que|cual|cuando|donde|cuanto|quien|how|what|why|when|where|which)\b/.test(normalize(heading.text)));
    check('question-headings', 'IA y fragmentos', 'Subtítulos en forma de pregunta', 1,
      questionHeadings.length > 0 ? 'ok' : 'warn',
      questionHeadings.length > 0
        ? `${questionHeadings.length} subtítulos son preguntas: bien para preguntas frecuentes y búsquedas conversacionales.`
        : 'Ningún subtítulo es una pregunta. Añadir un bloque de preguntas frecuentes ayuda a aparecer en respuestas de IA y en «Otras preguntas de los usuarios».');
  } else if (structure.hasMarkup) {
    skip('answer-first', 'IA y fragmentos', 'Respuesta directa bajo cada subtítulo', 'Hacen falta al menos dos subtítulos para evaluarlo.');
  }

  // --- Legibilidad ---
  if (readabilityScore !== null) {
    check('readability', 'Legibilidad', 'Facilidad de lectura', 2,
      readabilityScore >= LIMITS.readabilityGood ? 'ok' : readabilityScore >= LIMITS.readabilityPoor ? 'warn' : 'fail',
      `${readabilityScore}/100 (${readabilityLabel(readabilityScore)}), índice ${language === 'en' ? 'Flesch' : 'Szigriszt-Pazos'}` +
      `${['es', 'en'].includes(language) ? '' : ', aproximado para este idioma'}. Por debajo de ${LIMITS.readabilityGood} cuesta seguirlo.`);

    const share = sentences.length ? longSentences / sentences.length : 0;
    check('sentences', 'Legibilidad', 'Frases largas', 1,
      share <= LIMITS.longSentenceShare ? 'ok' : share <= LIMITS.longSentenceShare * 2 ? 'warn' : 'fail',
      `${longSentences} de ${sentences.length} frases pasan de ${LIMITS.longSentenceWords} palabras (${Math.round(share * 100)} %). Lo recomendable es no superar el ${LIMITS.longSentenceShare * 100} %.`);

    check('paragraphs', 'Legibilidad', 'Párrafos largos', 1,
      longestParagraph <= LIMITS.longParagraphWords ? 'ok' : 'warn',
      `El párrafo más largo tiene ${longestParagraph} palabras. Por encima de ${LIMITS.longParagraphWords} conviene partirlo.`);
  }

  // --- Campo semántico del estudio ---
  if (relatedTerms.length > 0) {
    const coverage = relatedUsed.length / relatedTerms.length;
    check('related', 'Campo semántico', 'Términos relacionados del estudio', 3,
      coverage >= LIMITS.relatedCoverage ? 'ok' : coverage > 0 ? 'warn' : 'fail',
      `El texto usa ${relatedUsed.length} de ${relatedTerms.length} términos que aparecen en las keywords relacionadas del estudio (${Math.round(coverage * 100)} %). ` +
      `A partir del ${LIMITS.relatedCoverage * 100} % cubre bien el tema.`);
  } else {
    skip('related', 'Campo semántico', 'Términos relacionados del estudio', 'El estudio no tiene keywords relacionadas con esta keyword.');
  }

  const scored = checks.filter((item) => item.status !== 'skip');
  const totalWeight = scored.reduce((total, item) => total + item.weight, 0);
  const earned = scored.reduce((total, item) => total + item.weight * STATUS_POINTS[item.status], 0);
  // Sin texto no hay nota: todo lo demás sería ruido
  const score = wordList.length === 0 || totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  return {
    score,
    verdict: score >= 80 ? 'Bien optimizado' : score >= 60 ? 'Aceptable, con mejoras claras' : score >= 40 ? 'Necesita trabajo' : 'Poco optimizado',
    stats: {
      words: wordList.length,
      sentences: sentences.length,
      paragraphs: structure.paragraphs.length,
      headings: structure.headings.length,
      links: structure.links.length,
      images: structure.images.length,
      keywordOccurrences: occurrences,
      keywordDensity: round(density, 2),
      readability: readabilityScore,
      avgSentenceWords: sentences.length ? round(wordList.length / sentences.length) : 0,
      readingMinutes: Math.max(1, Math.round(wordList.length / 220))
    },
    checks,
    related: { used: relatedUsed, missing: relatedMissing, keywordsUsed }
  };
}

// Keywords del estudio que forman el campo semántico de una keyword. Vale cualquier keyword del estudio:
// si no es una principal, se usa la familia de la principal de la que cuelga.
export function relatedKeywordsFor(report, keyword) {
  const key = normalize(keyword).trim();
  if (!key) return [];
  const familyOf = (item) => [
    item.keyword,
    ...(item.suggestions || []),
    ...(item.ideas || []).map((idea) => idea.keyword),
    ...(item.keywordData?.[item.keyword]?.similar_keywords || []).map((entry) => entry.keyword)
  ];
  const items = Array.isArray(report) ? report : [];
  const item = items.find((candidate) => normalize(candidate.keyword).trim() === key)
    || items.find((candidate) => familyOf(candidate).some((member) => normalize(member).trim() === key));
  if (!item) return [];
  return [...new Set(familyOf(item))].filter((related) => normalize(related).trim() !== key);
}
