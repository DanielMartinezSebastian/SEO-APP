import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor SEO API ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Reportes disponibles en http://localhost:${PORT}/reports`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`\n📋 Endpoints disponibles:`);
  console.log(`   GET  /api/health                    - Estado del servidor`);
  console.log(`   GET  /api/seo/reports               - Listar todos los reportes`);
  console.log(`   GET  /api/seo/report/:filename      - Obtener reporte específico`);
  console.log(`   POST /api/seo/analyze               - Crear nuevo análisis`);
  console.log(`   GET  /api/seo/download/:filename    - Descargar archivo`);
  console.log(`   DELETE /api/seo/report/:filename    - Eliminar reporte`);
});
