import express from 'express';
import { timingSafeEqual } from 'crypto';
import { join } from 'path';
import seoRoutes from './routes/seo.js';
import { WEB_DIST } from '../config.js';

const app = express();

// Acceso privado: con SEO_AUTH=usuario:contraseña toda la app (interfaz y API) pide esas credenciales.
// Pensado para desplegarla en un servidor de la agencia; sin la variable, no hay control de acceso.
const AUTH = process.env.SEO_AUTH;
if (AUTH) {
  const expected = Buffer.from(AUTH);
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    const given = Buffer.from(scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString() : '');
    // comparación en tiempo constante del contenido (solo la longitud puede deducirse)
    const matches = given.length === expected.length && timingSafeEqual(given, expected);
    if (matches) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="SEO App", charset="UTF-8"');
    res.status(401).json({ success: false, error: 'Acceso restringido: indica usuario y contraseña' });
  });
}

// Middleware
// Sin CORS: el frontend se sirve desde este mismo origen (y Vite usa proxy en desarrollo), así que
// ninguna otra web puede llamar a la API desde el navegador del usuario.
app.use(express.json({ limit: '1mb' }));

// Servir archivos estáticos del frontend (npm run build)
app.use(express.static(WEB_DIST));

// Rutas
app.use('/api/seo', seoRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SEO API Server running',
    timestamp: new Date().toISOString()
  });
});

// Ruta 404 de la API
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// URLs de la interfaz anterior
app.get('/report-details.html', (req, res) => {
  res.redirect(`/report?filename=${encodeURIComponent(req.query.filename || '')}`);
});
app.get('/analytics.html', (req, res) => {
  res.redirect(`/analytics?filename=${encodeURIComponent(req.query.filename || '')}`);
});

// El frontend es una SPA: cualquier otra ruta sirve index.html
app.get('*', (req, res) => {
  res.sendFile(join(WEB_DIST, 'index.html'), (err) => {
    if (err) {
      res.status(503).type('text/plain').send('Frontend sin compilar. Ejecuta "npm run build" y recarga la página.');
    }
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  // Cuerpo JSON mal formado o demasiado grande: es un error del cliente
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status).json({
      success: false,
      error: err.type === 'entity.parse.failed' ? 'El cuerpo de la petición no es JSON válido' : 'Petición demasiado grande'
    });
  }

  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: err.message
  });
});

export default app;
