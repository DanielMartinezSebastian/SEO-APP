import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { KeywordAnalyzer } from '../../services/keywordService.js';
import { ExportService } from '../../services/exportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// Directorio de resultados
const RESULTS_DIR = path.join(__dirname, '../../../data/results');

// GET /api/seo/reports - Listar todos los reportes disponibles
router.get('/reports', async (req, res) => {
  try {
    const files = await fs.readdir(RESULTS_DIR);
    const reports = files
      .filter(file => file.endsWith('.json') && file.includes('seo_report_full_'))
      .map(file => {
        const timestamp = file.match(/seo_report_full_(.+)\.json/)?.[1];
        return {
          filename: file,
          timestamp: timestamp ? timestamp.replace(/-/g, ':').replace('T', ' ').slice(0, -1) : 'Unknown',
          url: `/reports/${file}`,
          downloadUrl: `/api/seo/download/${file}`
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al listar reportes',
      message: error.message
    });
  }
});

// GET /api/seo/report/:filename - Obtener un reporte específico
router.get('/report/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(RESULTS_DIR, filename);
    
    // Verificar que el archivo existe y es un JSON de reporte
    if (!filename.endsWith('.json') || !filename.includes('seo_report_full_')) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo inválido'
      });
    }

    const data = await fs.readFile(filePath, 'utf8');
    const report = JSON.parse(data);

    res.json({
      success: true,
      filename,
      data: report
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al leer el reporte',
        message: error.message
      });
    }
  }
});

// POST /api/seo/analyze - Crear nuevo análisis de keywords
router.post('/analyze', async (req, res) => {
  try {
    const { keywords, country = 'ES', language = 'es' } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de keywords'
      });
    }

    const analyzer = new KeywordAnalyzer();
    const exporter = new ExportService();

    // Analizar keywords
    await analyzer.analyzeMultipleKeywords(keywords, country, language);
    
    // Exportar resultados
    const { jsonPath, csvPath } = await exporter.exportFullReport(analyzer);
    
    const results = analyzer.getResults();
    const summary = analyzer.getSummary();

    res.json({
      success: true,
      message: 'Análisis completado exitosamente',
      summary,
      files: {
        json: jsonPath.replace(process.cwd(), ''),
        csv: csvPath.replace(process.cwd(), '')
      },
      downloadUrls: {
        json: `/api/seo/download/${path.basename(jsonPath)}`,
        csv: `/api/seo/download/${path.basename(csvPath)}`
      },
      data: results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error durante el análisis',
      message: error.message
    });
  }
});

// GET /api/seo/download/:filename - Descargar archivo
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(RESULTS_DIR, filename);

    // Verificar que el archivo existe
    await fs.access(filePath);

    // Configurar headers para descarga
    const ext = path.extname(filename);
    let contentType = 'application/octet-stream';
    
    if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.csv') {
      contentType = 'text/csv';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const data = await fs.readFile(filePath);
    res.send(data);

  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: 'Archivo no encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al descargar archivo',
        message: error.message
      });
    }
  }
});

// POST /api/seo/analyze-suggestions - Analizar sugerencias de un reporte existente
router.post('/analyze-suggestions', async (req, res) => {
  try {
    const { filename, country = 'ES', language = 'es' } = req.body;

    if (!filename || !filename.endsWith('.json') || !filename.includes('seo_report_full_')) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un nombre de archivo de reporte válido'
      });
    }

    const filePath = path.join(RESULTS_DIR, filename);
    
    // Leer el reporte existente
    const data = await fs.readFile(filePath, 'utf8');
    const reportData = JSON.parse(data);

    // Extraer todas las sugerencias que no tienen datos SEO
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

    if (suggestionsToAnalyze.size === 0) {
      return res.json({
        success: true,
        message: 'No hay sugerencias nuevas para analizar',
        suggestionsAnalyzed: 0,
        data: reportData
      });
    }

    const analyzer = new KeywordAnalyzer();
    const exporter = new ExportService();

    // Analizar todas las sugerencias como un lote
    const suggestionsArray = Array.from(suggestionsToAnalyze);
    await analyzer.analyzeSuggestions(suggestionsArray, country, language);
    
    // Verificar si realmente se obtuvieron nuevos datos antes de combinar
    const newSuggestionsData = analyzer.getResults();
    let successfullyAnalyzed = 0;
    
    // Contar cuántas sugerencias realmente obtuvieron datos SEO
    for (const result of newSuggestionsData) {
      if (result.keywordData) {
        for (const [keyword, data] of Object.entries(result.keywordData)) {
          if (suggestionsToAnalyze.has(keyword) && 
              data && 
              typeof data.search_volume === 'number') {
            successfullyAnalyzed++;
          }
        }
      }
    }
    
    // Si no se analizó ninguna sugerencia con éxito, devolver un error
    if (successfullyAnalyzed === 0) {
      return res.status(500).json({
        success: false,
        error: 'No se pudieron obtener datos SEO para ninguna sugerencia',
        message: 'Todas las consultas a la API de keywords fallaron. Por favor, verifica la conectividad de red o intenta más tarde.',
        suggestionsAttempted: suggestionsArray.length,
        suggestionsAnalyzed: 0,
        data: reportData // Devolver los datos originales
      });
    }
    
    // Combinar los datos existentes con los nuevos datos de sugerencias
    const mergedData = await mergeSuggestionsIntoReport(reportData, newSuggestionsData);

    // Guardar el reporte actualizado con timestamp actualizado
    const updatedTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
    const newFilename = `seo_report_full_${updatedTimestamp}.json`;
    const newFilePath = path.join(RESULTS_DIR, newFilename);
    
    await fs.writeFile(newFilePath, JSON.stringify(mergedData, null, 2));

    // Exportar también el CSV actualizado
    analyzer.results = new Map();
    mergedData.forEach(report => {
      analyzer.results.set(report.keyword, report);
    });
    
    const { csvPath } = await exporter.exportFullReport(analyzer, updatedTimestamp);

    res.json({
      success: true,
      message: `Se analizaron ${successfullyAnalyzed} de ${suggestionsArray.length} sugerencias exitosamente`,
      suggestionsAnalyzed: successfullyAnalyzed,
      suggestionsAttempted: suggestionsArray.length,
      originalFile: filename,
      newFiles: {
        json: newFilename,
        csv: path.basename(csvPath)
      },
      downloadUrls: {
        json: `/api/seo/download/${newFilename}`,
        csv: `/api/seo/download/${path.basename(csvPath)}`
      },
      data: mergedData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error analizando sugerencias',
      message: error.message
    });
  }
});

// Función auxiliar para combinar datos de sugerencias en el reporte
async function mergeSuggestionsIntoReport(originalData, suggestionsData) {
  const mergedData = JSON.parse(JSON.stringify(originalData)); // Deep copy
  
  // Crear un mapa de los nuevos datos de sugerencias
  const suggestionsMap = new Map();
  suggestionsData.forEach(item => {
    if (item.keywordData) {
      Object.keys(item.keywordData).forEach(keyword => {
        suggestionsMap.set(keyword, item.keywordData[keyword]);
      });
    }
  });

  // Integrar los datos de sugerencias en cada reporte
  mergedData.forEach(report => {
    if (report.suggestions && Array.isArray(report.suggestions)) {
      report.suggestions.forEach(suggestion => {
        if (suggestionsMap.has(suggestion) && !report.keywordData[suggestion]) {
          report.keywordData[suggestion] = suggestionsMap.get(suggestion);
        }
      });
    }
  });

  return mergedData;
}

// DELETE /api/seo/report/:filename - Eliminar un reporte
router.delete('/report/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename.includes('seo_report_')) {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden eliminar reportes SEO'
      });
    }

    const filePath = path.join(RESULTS_DIR, filename);

    // Construir el nombre del CSV asociado
    let csvFilename = null;
    if (filename.startsWith('seo_report_full_') && filename.endsWith('.json')) {
      const timestamp = filename.replace('seo_report_full_', '').replace('.json', '');
      csvFilename = `seo_report_summary_${timestamp}.csv`;
    }

    // Eliminar el JSON
    await fs.unlink(filePath);

    // Intentar eliminar el CSV si existe
    let csvDeleted = false;
    if (csvFilename) {
      const csvPath = path.join(RESULTS_DIR, csvFilename);
      try {
        await fs.unlink(csvPath);
        csvDeleted = true;
      } catch (err) {
        // Si el CSV no existe, no es un error fatal
        if (err.code !== 'ENOENT') throw err;
      }
    }

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente',
      filesDeleted: {
        json: filename,
        csv: csvDeleted ? csvFilename : null
      }
    });

  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al eliminar reporte',
        message: error.message
      });
    }
  }
});

export default router;
