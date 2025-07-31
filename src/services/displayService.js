import Table from 'cli-table3';
import chalk from 'chalk';

export function displaySummaryTable(summary) {
  const table = new Table({
    head: [
      chalk.cyan('Keyword'),
      chalk.cyan('Volumen'),
      chalk.cyan('Competencia'),
      chalk.cyan('CPC'),
      chalk.cyan('Sugerencias'),
      chalk.cyan('Tráfico Dom.'),
      chalk.cyan('Keywords Dom.'),
      chalk.cyan('Palabras'),
      chalk.cyan('Errores')
    ],
    colWidths: [15, 12, 12, 8, 12, 15, 15, 10, 8]
  });

  summary.forEach(item => {
    table.push([
      item.keyword,
      formatNumber(item.searchVolume),
      formatPercent(item.competition),
      formatCurrency(item.cpc),
      item.suggestionsCount,
      formatNumber(item.domainTraffic),
      formatNumber(item.domainKeywords),
      item.pageWords,
      item.errors > 0 ? chalk.red(item.errors) : chalk.green('0')
    ]);
  });

  console.log('\n' + table.toString());
}

function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString('es-ES');
}

function formatPercent(num) {
  if (!num) return '0%';
  return (num * 100).toFixed(2) + '%';
}

function formatCurrency(num) {
  if (!num) return '0€';
  return num.toFixed(2) + '€';
}