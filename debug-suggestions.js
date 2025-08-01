import { KeywordAnalyzer } from './src/services/keywordService.js';

async function testSuggestionsAnalysis() {
  try {
    console.log('Probando análisis de sugerencias...');
    
    const analyzer = new KeywordAnalyzer();
    
    // Probar con una sola sugerencia
    console.log('\n1. Probando analyzeSuggestionKeyword con "zomboid map":');
    const result1 = await analyzer.analyzeSuggestionKeyword('zomboid map', 'ES', 'es');
    console.log('Resultado:', JSON.stringify(result1, null, 2));
    
    // Probar con múltiples sugerencias
    console.log('\n2. Probando analyzeSuggestions con múltiples keywords:');
    const result2 = await analyzer.analyzeSuggestions(['zomboid map', 'zomboid mods', 'zomboid wiki'], 'ES', 'es');
    console.log('Resultados count:', result2.length);
    console.log('Primer resultado:', JSON.stringify(result2[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSuggestionsAnalysis();
