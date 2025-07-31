import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import seoRoutes from './routes/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(join(__dirname, '../../public')));

// Servir archivos estáticos de la carpeta data/results
app.use('/reports', express.static(join(__dirname, '../../data/results')));

// Rutas
app.use('/api/seo', seoRoutes);

// Ruta principal que sirve el frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../../public/index.html'));
});

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SEO API Server running',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

export default app;

// Solo iniciar el servidor si este archivo es ejecutado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor SEO API ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Reportes disponibles en http://localhost:${PORT}/reports`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  });
}
