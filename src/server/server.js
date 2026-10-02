import app from './app.js';

const PORT = process.env.PORT || 3000;
// Por defecto escucha en todas las interfaces; HOST=127.0.0.1 lo limita a este equipo
const HOST = process.env.HOST;

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 SEO App en http://localhost:${PORT}`);
  console.log(`   Interfaz web      http://localhost:${PORT}/`);
  console.log(`   API REST          http://localhost:${PORT}/api/seo/  (referencia en API_DOCS.md)`);
  console.log(`   Estado            http://localhost:${PORT}/api/health`);
  console.log(`   Acceso            ${process.env.SEO_AUTH ? 'restringido con SEO_AUTH' : 'abierto (define SEO_AUTH=usuario:contraseña para restringirlo)'}`);
  console.log('   CLI y agentes     node bin/seo.js help  ·  node bin/seo.js mcp');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PORT} ya está en uso. Cierra el otro proceso o arranca con otro puerto: PORT=3001 npm start`);
  } else {
    console.error(`❌ No se pudo iniciar el servidor: ${error.message}`);
  }
  process.exit(1);
});
