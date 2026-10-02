import axios from 'axios';
import { getJsonHeaders } from '../utils/headers.js';
import { REQUEST_TIMEOUT_MS } from '../config.js';

export async function analyzeUrl(url, country = 'ES', language = 'es') {
  const apiUrl = `https://db.keywordsur.fr/urlsOnPage?country=${encodeURIComponent(country)}&language=${encodeURIComponent(language)}`;

  try {
    const response = await axios.post(apiUrl, [url], {
      headers: getJsonHeaders(),
      timeout: REQUEST_TIMEOUT_MS
    });
    return response.data && typeof response.data === 'object' ? response.data : {};
  } catch (error) {
    throw new Error(`Error analizando URL: ${error.message}`);
  }
}
