import { test } from 'node:test';
import assert from 'node:assert';
import { getGoogleSuggestions } from '../src/api/googleSuggestions.js';
import { getKeywordData, getDomainData } from '../src/api/keywordsur.js';
import { analyzeUrl } from '../src/api/urlAnalysis.js';

test('Google Suggestions API', async () => {
  const suggestions = await getGoogleSuggestions('amazon');
  assert(Array.isArray(suggestions), 'Las sugerencias deben ser un array');
  assert(suggestions.length > 0, 'Debe haber al menos una sugerencia');
  assert(suggestions.includes('amazon prime'), 'Debe incluir sugerencias relacionadas');
});

test('Keywordsur Keywords API', async () => {
  const data = await getKeywordData(['amazon']);
  assert(data.amazon, 'Debe contener datos para amazon');
  assert(typeof data.amazon.search_volume === 'number', 'search_volume debe ser número');
  assert(typeof data.amazon.competition === 'number', 'competition debe ser número');
  assert(typeof data.amazon.cpc === 'number', 'cpc debe ser número');
  assert(Array.isArray(data.amazon.similar_keywords), 'similar_keywords debe ser array');
});

test('Keywordsur Domain API', async () => {
  const data = await getDomainData('amazon.es');
  assert(data['amazon.es'], 'Debe contener datos para amazon.es');
  assert(typeof data['amazon.es'].traffic === 'number', 'traffic debe ser número');
  assert(typeof data['amazon.es'].keyword_count_top10 === 'number', 'keyword_count_top10 debe ser número');
});

test('URL Analysis API', async () => {
  const data = await analyzeUrl('https://www.amazon.es');
  assert(data['https://www.amazon.es'], 'Debe contener datos para la URL');
  assert(typeof data['https://www.amazon.es'].words === 'number', 'words debe ser número');
  assert(typeof data['https://www.amazon.es'].title === 'string', 'title debe ser string');
});

test('Manejo de errores - keyword inválido', async () => {
  try {
    await getKeywordData([]);
    assert.fail('Debería lanzar un error con array vacío');
  } catch (error) {
    assert(error.message.includes('Error'), 'Debe manejar errores correctamente');
  }
});