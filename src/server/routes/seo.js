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

    if (keywords.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 10 keywords por análisis'
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
    await fs.unlink(filePath);

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente'
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
