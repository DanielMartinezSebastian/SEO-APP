import fs from 'fs/promises';
import path from 'path';
import { KeywordAnalyzer, mergeSuggestionsIntoReport, pendingSuggestions } from './src/services/keywordService.js';
import { RESULTS_DIR, DEFAULT_COUNTRY } from './src/config.js';
import { isReportJson } from './src/utils/validation.js';

// Ejecuta la lógica de POST /api/seo/analyze-suggestions sobre un reporte sin modificarlo.
// Uso: node debug-endpoint.js <seo_report_full_...json>   (sin argumento usa el reporte más reciente)
async function testEndpointLogic() {
  try {
    let filename = process.argv[2];
    if (!filename) {
      const files = (await fs.readdir(RESULTS_DIR)).filter(isReportJson).sort();
      filename = files.at(-1);
    }
    if (!isReportJson(filename)) {
      console.log('No hay reportes en data/results o el nombre indicado no es válido');
      return;
    }

    const reportData = JSON.parse(await fs.readFile(path.join(RESULTS_DIR, filename), 'utf8'));
    console.log(`Reporte ${filename}: ${reportData.length} keywords`);

    const suggestionsToAnalyze = [...pendingSuggestions(reportData)];
    console.log(`Sugerencias pendientes (${suggestionsToAnalyze.length}):`, suggestionsToAnalyze);
    if (suggestionsToAnalyze.length === 0) return;

    const country = reportData[0]?.country || DEFAULT_COUNTRY;
    const { data, errors, attempted } = await new KeywordAnalyzer().analyzeSuggestions(suggestionsToAnalyze, country);

    const withData = suggestionsToAnalyze.filter(s => typeof data[s]?.search_volume === 'number');
    console.log(`Consultadas: ${attempted.size} · con datos: ${withData.length} · errores: ${errors.length}`);
    errors.forEach(error => console.log('  ❌', error));

    const merged = mergeSuggestionsIntoReport(reportData, data, attempted);
    console.log(`Tras combinar quedarían ${pendingSuggestions(merged).size} sugerencias pendientes (no se ha escrito nada)`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEndpointLogic();
