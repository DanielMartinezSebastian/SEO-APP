import { KeywordAnalyzer } from './src/services/keywordService.js';

// Uso: node debug-suggestions.js [PAÍS] [keyword ...]
async function testSuggestionsAnalysis() {
  const [country = 'ES', ...keywords] = process.argv.slice(2);
  const suggestions = keywords.length > 0 ? keywords : ['zomboid map', 'zomboid mods', 'zomboid wiki'];

  try {
    const analyzer = new KeywordAnalyzer();
    const { data, errors, attempted } = await analyzer.analyzeSuggestions(suggestions, country);

    console.log('Consultadas:', [...attempted]);
    console.log('Con datos:', Object.keys(data));
    console.log('Errores:', errors);
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSuggestionsAnalysis();
