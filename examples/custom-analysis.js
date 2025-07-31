import { KeywordAnalyzer } from '../src/services/keywordService.js';

async function customAnalysis() {
  const analyzer = new KeywordAnalyzer();
  
  // Analizar una sola keyword
  const result = await analyzer.analyzeKeyword('zapatos', 'ES', 'es');
  console.log(result);
  
  // Analizar múltiples keywords de diferentes países
  await analyzer.analyzeKeyword('shoes', 'US', 'en');
  await analyzer.analyzeKeyword('chaussures', 'FR', 'fr');
  
  // Obtener resumen
  const summary = analyzer.getSummary();
  console.log(summary);
}
