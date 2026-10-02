// Gráficos de la app. Son HTML y SVG propios (trama-ui solo trae barras de caracteres): una barra por dato, con
// su etiqueta y su valor escritos, para que se lean sin leyenda. Usan los tokens del tema.
import { formatCompact, formatCurrency, formatNumber, formatPercent, truncate } from '../lib/format.js';

const TYPE_NAMES = { main: 'principal', suggestion: 'sugerencia', similar: 'similar', idea: 'idea' };

const tooltip = (entry) =>
  `${entry.keyword} (${TYPE_NAMES[entry.type]})\n` +
  `${formatNumber(entry.volume)} búsquedas al mes · competencia ${entry.competition === null ? 'sin dato' : formatPercent(entry.competition)} · ` +
  `CPC ${entry.cpc === null ? 'sin dato' : formatCurrency(entry.cpc)}\npuntuación ${entry.score}/100`;

/**
 * Lista de barras horizontales: etiqueta a la izquierda, barra proporcional y valor a la derecha.
 * items: [{ label, value, display?, note?, accent?, title? }]
 */
export function BarList({ items, empty = 'Sin datos.', max }) {
  if (items.length === 0) return <div className="muted">{empty}</div>;
  const top = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="bars">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="bars__row" title={item.title}>
          <span className="bars__label">
            {item.label}
            {item.note && <span className="bars__note">{item.note}</span>}
          </span>
          <span className="bars__track" aria-hidden>
            <span className={`bars__fill ${item.accent ? 'bars__fill--acc' : ''}`} style={{ width: `${Math.max(item.value > 0 ? 1 : 0, (item.value / top) * 100)}%` }} />
          </span>
          <span className="bars__value">{item.display ?? formatNumber(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Matriz de oportunidad: competencia (eje X) frente a búsquedas al mes (eje Y, logarítmico).
 * Arriba a la izquierda quedan las keywords con mucha demanda y poca competencia. Los diez mejores
 * puntos llevan número y se listan debajo, para no depender de etiquetas que se pisan.
 */
export function OpportunityMatrix({ keywords, medianVolume }) {
  const points = keywords.filter((entry) => entry.volume > 0 && entry.competition !== null);
  if (points.length === 0) {
    return <div className="muted">No hay keywords con datos de demanda y competencia para dibujar la matriz.</div>;
  }

  const width = 760;
  const height = 400;
  const pad = { top: 28, right: 24, bottom: 46, left: 64 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const logs = points.map((entry) => Math.log10(entry.volume));
  const minLog = Math.floor(Math.min(...logs));
  const maxLog = Math.max(minLog + 1, Math.ceil(Math.max(...logs)));
  const y = (volume) => pad.top + innerHeight - ((Math.log10(volume) - minLog) / (maxLog - minLog)) * innerHeight;
  // Muchas keywords comparten competencia exacta (p. ej. 100 %): se abren en abanico para que no se tapen
  const sameSpot = new Map();
  const x = (entry) => {
    const key = `${entry.competition.toFixed(2)}|${Math.round(y(entry.volume) / 18)}`;
    const count = sameSpot.get(key) || 0;
    sameSpot.set(key, count + 1);
    const base = pad.left + entry.competition * innerWidth;
    return Math.min(width - pad.right - 5, Math.max(pad.left + 5, base + (entry.competition > 0.5 ? -1 : 1) * count * 19));
  };

  const splitX = pad.left + 0.4 * innerWidth;
  const splitY = y(Math.min(Math.max(medianVolume || 1, 10 ** minLog), 10 ** maxLog));
  const best = [...points].sort((a, b) => b.score - a.score).slice(0, 10);
  const rank = new Map(best.map((entry, index) => [entry, index + 1]));
  const ticks = Array.from({ length: maxLog - minLog + 1 }, (_, index) => 10 ** (minLog + index));
  // los principales y los numerados se pintan al final para que queden encima
  const ordered = [...points].sort((a, b) => (rank.has(a) ? 1 : 0) - (rank.has(b) ? 1 : 0) || (a.type === 'main' ? 1 : 0) - (b.type === 'main' ? 1 : 0));
  const placed = ordered.map((entry) => ({ entry, cx: x(entry), cy: y(entry.volume) }));

  const wins = points.filter((entry) => entry.competition < 0.4 && entry.volume >= (medianVolume || 0)).length;

  return (
    <div className="stack">
      <div className="chart-scroll">
        <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={`Matriz de oportunidad con ${points.length} keywords: competencia frente a búsquedas al mes. ${wins} en la zona de victorias rápidas.`}>
          <rect x={pad.left} y={pad.top} width={splitX - pad.left} height={splitY - pad.top} className="svg-chart__zone" />
          <text x={pad.left + 10} y={pad.top + 18} className="svg-chart__quadrant svg-chart__quadrant--acc">VICTORIAS RÁPIDAS · mucha demanda, poca competencia</text>
          <text x={width - pad.right - 10} y={pad.top + 18} textAnchor="end" className="svg-chart__quadrant">A LARGO PLAZO</text>
          <text x={pad.left + 10} y={pad.top + innerHeight - 10} className="svg-chart__quadrant">NICHO · fácil, poca demanda</text>
          <text x={width - pad.right - 10} y={pad.top + innerHeight - 10} textAnchor="end" className="svg-chart__quadrant">POCO INTERÉS</text>

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="svg-chart__grid" />
              <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="svg-chart__tick">{formatCompact(tick)}</text>
            </g>
          ))}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
            <text key={tick} x={pad.left + tick * innerWidth} y={height - pad.bottom + 18} textAnchor="middle" className="svg-chart__tick">{Math.round(tick * 100)} %</text>
          ))}
          <line x1={splitX} x2={splitX} y1={pad.top} y2={pad.top + innerHeight} className="svg-chart__split" />
          <line x1={pad.left} x2={width - pad.right} y1={splitY} y2={splitY} className="svg-chart__split" />
          <rect x={pad.left} y={pad.top} width={innerWidth} height={innerHeight} className="svg-chart__frame" />

          <text x={pad.left + innerWidth / 2} y={height - 8} textAnchor="middle" className="svg-chart__axis">Competencia (más a la derecha, más disputada)</text>
          <text transform={`translate(16 ${pad.top + innerHeight / 2}) rotate(-90)`} textAnchor="middle" className="svg-chart__axis">Búsquedas al mes</text>

          {placed.map(({ entry, cx, cy }) => (
            <g key={`${entry.type}-${entry.keyword}`}>
              <circle cx={cx} cy={cy} r={rank.has(entry) ? 9 : 5}
                className={`svg-chart__point ${entry.type === 'main' ? 'svg-chart__point--main' : ''} ${rank.has(entry) ? 'svg-chart__point--ranked' : ''}`}>
                <title>{tooltip(entry)}</title>
              </circle>
              {rank.has(entry) && <text x={cx} y={cy + 3.5} textAnchor="middle" className="svg-chart__rank">{rank.get(entry)}</text>}
            </g>
          ))}
        </svg>
      </div>

      <ol className="matrix-key">
        {best.map((entry) => (
          <li key={entry.keyword}>
            <strong>{truncate(entry.keyword, 44)}</strong>
            <span className="muted"> · {formatCompact(entry.volume)} búsquedas · {formatPercent(entry.competition)} · {entry.score}/100</span>
          </li>
        ))}
      </ol>
      <div className="muted small">
        Los números del gráfico son las diez mejores oportunidades, listadas arriba. En color de acento, las keywords principales del estudio.
        Las keywords similares no aparecen: la fuente no da su competencia.
      </div>
    </div>
  );
}

/**
 * Temas del estudio: cada bloque es un grupo de keywords que comparten un término, con sus keywords
 * como barras según sus búsquedas. Es la vista de «qué va con qué».
 */
export function ClusterBlocks({ clusters, limit = 8, perCluster = 5 }) {
  if (clusters.length === 0) {
    return <div className="muted">Las keywords del estudio no comparten términos suficientes para formar grupos.</div>;
  }
  const shown = clusters.slice(0, limit);
  const max = Math.max(1, ...shown.flatMap((cluster) => cluster.keywords.map((entry) => entry.volume || 0)));

  return (
    <div className="clusters">
      {shown.map((cluster) => (
        <section key={cluster.term} className="cluster">
          <header className="cluster__head">
            <h4 className="cluster__term">{cluster.term}</h4>
            <span className="muted small">{cluster.keywords.length} keywords · {formatNumber(cluster.totalVolume)} búsquedas</span>
          </header>
          <BarList
            max={max}
            items={cluster.keywords.slice(0, perCluster).map((entry) => ({
              label: entry.keyword,
              value: entry.volume || 0,
              display: entry.volume ? formatCompact(entry.volume) : 'sin dato',
              title: tooltip(entry)
            }))}
          />
          {cluster.keywords.length > perCluster && <div className="muted small">y {cluster.keywords.length - perCluster} más</div>}
        </section>
      ))}
    </div>
  );
}
