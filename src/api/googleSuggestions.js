import axios from 'axios';
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE, REQUEST_TIMEOUT_MS } from '../config.js';

export async function getGoogleSuggestions(query, country = DEFAULT_COUNTRY, language = DEFAULT_LANGUAGE) {
  const url = 'https://suggestqueries.google.com/complete/search';

  try {
    const response = await axios.get(url, {
      params: { client: 'firefox', q: query, hl: language, gl: country },
      timeout: REQUEST_TIMEOUT_MS
    });
    // La respuesta es un array: [query, [suggestions], [], {metadata}]
    const suggestions = response.data?.[1];
    return Array.isArray(suggestions) ? suggestions.filter(s => typeof s === 'string') : [];
  } catch (error) {
    throw new Error(`Error obteniendo sugerencias: ${error.message}`);
  }
}
