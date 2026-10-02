import { VARIANT } from './ui.jsx';

// `Table` de trama-ui se alimenta de texto CSV y no admite celdas con botones ni cabeceras
// ordenables; esta tabla reutiliza sus clases para los casos que necesitan interacción.
export default function DataTable({ columns, rows, rowKey, sort, onSort, empty = 'Sin datos' }) {
  return (
    <div className={`ui-table-wrap ui-table-wrap--full ui-surface ui-s ui-s--${VARIANT}`} style={{ padding: 4 }}>
      <table className="ui-table ui-table--striped">
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = sort?.metric === column.key;
              return (
                <th key={column.key} aria-sort={sorted ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {column.sortable && onSort ? (
                    <button type="button" className="th-sort" onClick={() => onSort(column.key)}>
                      {column.label} <span aria-hidden>{sorted ? (sort.order === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted">{empty}</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
