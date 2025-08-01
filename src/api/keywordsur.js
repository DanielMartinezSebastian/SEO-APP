import axios from 'axios';
import { getCommonHeaders } from '../utils/headers.js';

// Función para sanitizar keywords multi-palabra para las APIs externas
function sanitizeKeywordForApi(keyword) {
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

export async function getKeywordData(keywords, country = 'ES') {
  // Sanitizar keywords multi-palabra reemplazando espacios con guiones
  // Esto es necesario porque la API externa no maneja correctamente espacios en keywords
  const sanitizedKeywords = keywords.map(keyword => sanitizeKeywordForApi(keyword));
  
  // Formato exacto: ["keyword1","keyword2"] -> %5B%22keyword1%22%2C%22keyword2%22%5D
  const keywordsArray = JSON.stringify(sanitizedKeywords);
  const encodedKeywords = encodeURIComponent(keywordsArray);
  
  const url = `https://db3.keywordsur.fr/api/ks/keywords?country=${country}&keywords=${encodedKeywords}`;
  
  try {
    const response = await axios.get(url, {
      headers: getCommonHeaders()
    });
    
    // Mapear los resultados de vuelta a los keywords originales
    // La API devuelve datos con las claves sanitizadas, pero queremos 
    // guardar los datos con los keywords originales
    const originalData = {};
    if (response.data && typeof response.data === 'object') {
      keywords.forEach((originalKeyword, index) => {
        const sanitizedKeyword = sanitizedKeywords[index];
        if (response.data[sanitizedKeyword]) {
          originalData[originalKeyword] = response.data[sanitizedKeyword];
        }
      });
    }
    
    return originalData;
  } catch (error) {
    throw new Error(`Error obteniendo datos de keywords: ${error.message}`);
  }
}

export async function getDomainData(domain, country = 'ES') {
  // Formato exacto: ["domain.es"] -> %5B%22domain.es%22%5D
  const domainsArray = JSON.stringify([domain]);
  const encodedDomains = encodeURIComponent(domainsArray);
  
  const url = `https://db3.keywordsur.fr/api/ks/domains?country=${country}&domains=${encodedDomains}`;
  
  try {
    const response = await axios.get(url, {
      headers: getCommonHeaders()
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error obteniendo datos del dominio: ${error.message}`);
  }
}