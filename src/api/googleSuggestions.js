import axios from 'axios';

export async function getGoogleSuggestions(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodedQuery}`;
  
  try {
    const response = await axios.get(url);
    // La respuesta es un array: [query, [suggestions], [], {metadata}]
    const suggestions = response.data[1];
    return suggestions;
  } catch (error) {
    throw new Error(`Error obteniendo sugerencias: ${error.message}`);
  }
}