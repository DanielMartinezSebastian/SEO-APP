import fs from 'fs/promises';
import path from 'path';
import { KeywordAnalyzer } from './src/services/keywordService.js';

async function testEndpointLogic() {
  try {
    console.log('Probando la lógica del endpoint analyze-suggestions...');
    
    // Leer el reporte existente (igual que el endpoint)
    const filename = 'seo_report_full_2025-08-01T16-49-58-900.json';
    const RESULTS_DIR = './data/results';
    const filePath = path.join(RESULTS_DIR, filename);
    
    const data = await fs.readFile(filePath, 'utf8');
    const reportData = JSON.parse(data);
    
    console.log('Reporte cargado, número de elementos:', reportData.length);
    
    // Extraer todas las sugerencias que no tienen datos SEO (igual que el endpoint)
    const suggestionsToAnalyze = new Set();
    
    for (const report of reportData) {
      if (report.suggestions && Array.isArray(report.suggestions)) {
        for (const suggestion of report.suggestions) {
          // Solo analizar sugerencias que no tengan datos SEO completos
          if (!report.keywordData[suggestion] || !report.keywordData[suggestion].search_volume) {
            suggestionsToAnalyze.add(suggestion);
          }
        }
      }
    }
    
    console.log('Sugerencias a analizar:', Array.from(suggestionsToAnalyze));
    console.log('Total sugerencias a analizar:', suggestionsToAnalyze.size);
    
    if (suggestionsToAnalyze.size === 0) {
      console.log('No hay sugerencias para analizar');
      return;
    }
    
    // Analizar sugerencias (igual que el endpoint)
    const analyzer = new KeywordAnalyzer();
    const suggestionsArray = Array.from(suggestionsToAnalyze);
    console.log('Analizando:', suggestionsArray);
    
    await analyzer.analyzeSuggestions(suggestionsArray, 'ES', 'es');
    
    // Verificar resultados (igual que el endpoint)
    const newSuggestionsData = analyzer.getResults();
    console.log('Datos obtenidos, número de resultados:', newSuggestionsData.length);
    
    let successfullyAnalyzed = 0;
    
    // Contar cuántas sugerencias realmente obtuvieron datos SEO
    for (const result of newSuggestionsData) {
      console.log(`\nVerificando resultado para: ${result.keyword}`);
      console.log('Tiene keywordData:', !!result.keywordData);
      
      if (result.keywordData) {
        console.log('Keywords en keywordData:', Object.keys(result.keywordData));
        
        for (const [keyword, data] of Object.entries(result.keywordData)) {
          console.log(`  - ${keyword}: suggestionsToAnalyze.has(${keyword}) = ${suggestionsToAnalyze.has(keyword)}`);
          console.log(`  - ${keyword}: data exists = ${!!data}`);
          console.log(`  - ${keyword}: search_volume = ${data?.search_volume} (type: ${typeof data?.search_volume})`);
          
          if (suggestionsToAnalyze.has(keyword) && 
              data && 
              typeof data.search_volume === 'number') {
            successfullyAnalyzed++;
            console.log(`  ✅ ${keyword} contado como exitoso`);
          } else {
            console.log(`  ❌ ${keyword} NO contado como exitoso`);
          }
        }
      }
    }
    
    console.log(`\nTotal analizadas exitosamente: ${successfullyAnalyzed}`);
    console.log(`Total intentadas: ${suggestionsArray.length}`);
    
    if (successfullyAnalyzed === 0) {
      console.log('❌ El endpoint devolvería error 500');
    } else {
      console.log('✅ El endpoint funcionaría correctamente');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEndpointLogic();
