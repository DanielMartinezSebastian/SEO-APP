// Utilidades de texto compartidas por el servidor (PDF) y el frontend. Sin dependencias ni DOM.

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function tokenize(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

const STOPWORDS = new Set([
  // español
  'a', 'al', 'ante', 'con', 'de', 'del', 'desde', 'el', 'en', 'entre', 'la', 'las', 'lo', 'los', 'mi', 'mas', 'o', 'para',
  'por', 'que', 'se', 'sin', 'su', 'sus', 'un', 'una', 'unas', 'unos', 'y', 'es', 'son', 'como', 'cual', 'donde', 'cuanto',
  // inglés
  'the', 'of', 'and', 'for', 'in', 'on', 'to', 'with', 'is', 'are', 'an', 'at', 'by', 'or', 'how', 'what', 'vs',
  // francés, alemán, italiano
  'le', 'les', 'des', 'du', 'et', 'pour', 'avec', 'sans', 'une', 'der', 'die', 'das', 'und', 'fur', 'mit', 'ohne',
  'il', 'gli', 'di', 'per', 'senza', 'uno'
]);

export const isStopword = (token) => STOPWORDS.has(token);

export const contentTokens = (text) => tokenize(text).filter((token) => token.length > 1 && !isStopword(token));
