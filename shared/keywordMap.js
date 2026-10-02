// Mapa de keywords: qué URL del sitio del cliente corresponde a cada keyword. Responde a dos preguntas
// clásicas: «¿tengo ya una página para esto?» (hueco de contenido) y «¿compiten varias páginas por lo
// mismo?» (canibalización). Se decide por las palabras de la URL, que es lo único que se conoce sin
// descargar cada página.
import { stem } from './insights.js';
import { contentTokens, tokenize } from './text.js';

const MIN_COVERAGE = 0.6;

function urlTokens(url) {
  try {
    const { pathname } = new URL(url);
    return new Set(tokenize(decodeURIComponent(pathname).replace(/\.(html?|php|aspx?)$/i, '')).map(stem));
  } catch {
    return new Set();
  }
}

const depth = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 99;
  }
};

/**
 * @param {string[]} keywords
 * @param {string[]} urls  URLs del sitio (del sitemap)
 * @returns {{ keyword: string, url: string|null, coverage: number, alternatives: string[] }[]}
 */
export function mapKeywords(keywords, urls) {
  const indexed = urls.map((url) => ({ url, tokens: urlTokens(url), depth: depth(url) }));

  return keywords.map((keyword) => {
    const terms = [...new Set(contentTokens(keyword).map(stem))];
    if (terms.length === 0) return { keyword, url: null, coverage: 0, alternatives: [] };

    const candidates = indexed
      .map((entry) => ({ ...entry, coverage: terms.filter((term) => entry.tokens.has(term)).length / terms.length }))
      .filter((entry) => entry.coverage >= MIN_COVERAGE)
      // mejor cobertura; a igualdad, la URL con menos palabras de más (la más específica para esta keyword) y menos profunda
      .sort((a, b) => b.coverage - a.coverage || a.tokens.size - b.tokens.size || a.depth - b.depth);

    const [best] = candidates;
    return {
      keyword,
      url: best?.url || null,
      coverage: best ? Math.round(best.coverage * 100) / 100 : 0,
      // otras páginas igual de específicas para la keyword (una más concreta, como /zapatos-mujer frente a /zapatos, no
      // compite): posible canibalización
      alternatives: candidates.slice(1).filter((entry) => best.coverage === 1 && entry.coverage === 1 && entry.tokens.size === best.tokens.size).slice(0, 3).map((entry) => entry.url)
    };
  });
}
