const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

const safe = (value) => (Number.isFinite(value) ? value : 0);

export const formatNumber = (value) => number.format(safe(value));
export const formatCompact = (value) => compact.format(safe(value));
export const formatCurrency = (value) => currency.format(safe(value));
export const formatPercent = (value) => percent.format(safe(value));

export function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha desconocida' : dateTime.format(date);
}

// Los componentes de trama-ui reciben las listas como texto: `Table` separa celdas por «,» y filas
// por salto de línea, y `Select`/`AsciiChart` separan por «,». Una coma dentro de un valor (p. ej.
// «0,31 €») rompería las columnas, así que se sustituye por «‚» (U+201A), que se ve igual.
export function cell(value) {
  return String(value ?? '')
    .replace(/,/g, '‚')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim() || '—';
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(cell).join(', ')).join('\n');
}

export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
