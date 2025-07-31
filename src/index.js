import chalk from 'chalk';
import './server/server.js';

console.log(chalk.bold.blue('\n🚀 SEO-APP - Servidor Backend y Frontend\n'));
console.log(chalk.green('✅ Servidor iniciado en http://localhost:3000'));
console.log(chalk.yellow('📊 Interfaz web disponible para crear análisis'));
console.log(chalk.cyan('🔧 API REST disponible en /api/seo/*'));
console.log(chalk.magenta('\n� Funcionalidades disponibles:'));
console.log('   - Crear nuevos análisis desde la web');
console.log('   - Ver reportes existentes');
console.log('   - Análisis gráfico detallado');
console.log('   - Exportar datos en JSON/CSV');
console.log('   - Gestión completa de reportes\n');