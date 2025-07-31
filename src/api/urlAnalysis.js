import axios from 'axios';
import { getJsonHeaders } from '../utils/headers.js';

export async function analyzeUrl(url, country = 'ES', language = 'es') {
  const apiUrl = `https://db.keywordsur.fr/urlsOnPage?country=${country}&language=${language}`;
  
  try {
    const response = await axios.post(apiUrl, [url], {
      headers: getJsonHeaders()
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error analizando URL: ${error.message}`);
  }
}