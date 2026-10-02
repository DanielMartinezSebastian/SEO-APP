import axios from 'axios';
import { getCommonHeaders } from '../utils/headers.js';
import { REQUEST_TIMEOUT_MS } from '../config.js';

export async function getKeywordData(keywords, country = 'ES') {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('Error obteniendo datos de keywords: se requiere al menos una keyword');
  }

  // Formato exacto: ["keyword1","keyword2"] -> %5B%22keyword1%22%2C%22keyword2%22%5D
  const keywordsArray = JSON.stringify(keywords);
  const encodedKeywords = encodeURIComponent(keywordsArray);

  const url = `https://db3.keywordsur.fr/api/ks/keywords?country=${encodeURIComponent(country)}&keywords=${encodedKeywords}`;

  try {
    const response = await axios.get(url, {
      headers: getCommonHeaders(),
      timeout: REQUEST_TIMEOUT_MS
    });
    return response.data && typeof response.data === 'object' ? response.data : {};
  } catch (error) {
    throw new Error(`Error obteniendo datos de keywords: ${error.message}`);
  }
}

export async function getDomainData(domain, country = 'ES') {
  // Formato exacto: ["domain.es"] -> %5B%22domain.es%22%5D
  const domainsArray = JSON.stringify([domain]);
  const encodedDomains = encodeURIComponent(domainsArray);

  const url = `https://db3.keywordsur.fr/api/ks/domains?country=${encodeURIComponent(country)}&domains=${encodedDomains}`;

  try {
    const response = await axios.get(url, {
      headers: getCommonHeaders(),
      timeout: REQUEST_TIMEOUT_MS
    });
    return response.data && typeof response.data === 'object' ? response.data : {};
  } catch (error) {
    throw new Error(`Error obteniendo datos del dominio: ${error.message}`);
  }
}
