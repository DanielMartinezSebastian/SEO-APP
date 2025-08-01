import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

export class ExportService {
  constructor(baseDir = './data/results') {
    this.baseDir = baseDir;
  }

  async ensureDirectory() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async exportToJSON(data, filename) {
    await this.ensureDirectory();
    const filepath = path.join(this.baseDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  async exportToCSV(summary, filename) {
    await this.ensureDirectory();
    const filepath = path.join(this.baseDir, `${filename}.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'keyword', title: 'Keyword' },
        { id: 'searchVolume', title: 'Volumen de Búsqueda' },
        { id: 'competition', title: 'Competencia' },
        { id: 'cpc', title: 'CPC' },
        { id: 'suggestionsCount', title: 'Sugerencias' },
        { id: 'domainTraffic', title: 'Tráfico Dominio' },
        { id: 'domainKeywords', title: 'Keywords Dominio' },
        { id: 'pageWords', title: 'Palabras Página' },
        { id: 'errors', title: 'Errores' }
      ]
    });
    
    await csvWriter.writeRecords(summary);
    return filepath;
  }

  async exportFullReport(analyzer, customTimestamp = null) {
    const timestamp = customTimestamp || new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
    const results = analyzer.getResults();
    const summary = analyzer.getSummary();
    
    const jsonPath = await this.exportToJSON(results, `seo_report_full_${timestamp}`);
    const csvPath = await this.exportToCSV(summary, `seo_report_summary_${timestamp}`);
    
    return { jsonPath, csvPath };
  }
}