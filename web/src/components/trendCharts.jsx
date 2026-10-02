// Gráficos de tendencias: interés de cinco años, perfil del año y calendario de campañas.
// Como el resto de gráficos de la app, son HTML y SVG propios con los tokens del tema y los valores escritos.
import { MONTHS, MONTHS_SHORT } from '../../../shared/seasonality.js';

const monthLabel = (key) => `${MONTHS[Number(key.slice(5)) - 1]} de ${key.slice(0, 4)}`;

/**
 * Interés a lo largo de cinco años (serie mensual, 0-100 relativo al máximo de la keyword).
 * Una sola serie: no lleva leyenda. Cada mes tiene su zona sensible con el valor.
 */
export function TrendLine({ series, peakMonths = [], label }) {
  if (!series || series.length < 2) return <div className="muted small">Sin serie temporal.</div>;
  const width = 560;
  const height = 150;
  const pad = { top: 10, right: 8, bottom: 22, left: 30 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const step = innerWidth / (series.length - 1);
  const x = (index) => pad.left + index * step;
  const y = (value) => pad.top + innerHeight - (value / 100) * innerHeight;
  const line = series.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const years = series.map((point, index) => ({ point, index })).filter(({ point }) => point.month.endsWith('-01'));

  return (
    <div className="chart-scroll">
      <svg className="svg-chart svg-chart--trend" viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Interés en Google de «${label}» durante cinco años, de 0 a 100`}>
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="svg-chart__grid" />
            <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" className="svg-chart__tick">{tick}</text>
          </g>
        ))}
        {years.map(({ point, index }) => (
          <g key={point.month}>
            <line x1={x(index)} x2={x(index)} y1={pad.top} y2={pad.top + innerHeight} className="svg-chart__grid" />
            <text x={x(index) + 3} y={height - 6} className="svg-chart__tick">{point.month.slice(0, 4)}</text>
          </g>
        ))}
        <path d={area} className="svg-chart__area" />
        <path d={line} className="svg-chart__line" />
        {series.map((point, index) => (peakMonths.includes(Number(point.month.slice(5)) - 1)
          ? <circle key={point.month} cx={x(index)} cy={y(point.value)} r="3" className="svg-chart__peak" />
          : null))}
        {series.map((point, index) => (
          <rect key={point.month} x={x(index) - step / 2} y={pad.top} width={step} height={innerHeight} className="svg-chart__hit">
            <title>{`${monthLabel(point.month)}: ${point.value}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

/**
 * Perfil del año: una barra por mes, 100 = media del año. En color de acento, la temporada alta.
 */
export function SeasonProfile({ profile, peakMonths = [], currentMonth }) {
  const max = Math.max(130, ...profile);
  return (
    <div className="season" role="img" aria-label={`Perfil del año. ${profile.map((value, month) => `${MONTHS[month]} ${value}`).join(', ')}. 100 es la media.`}>
      <div className="season__plot">
        <span className="season__mean" style={{ bottom: `${(100 / max) * 100}%` }} aria-hidden />
        {profile.map((value, month) => (
          <div key={month} className="season__col" title={`${MONTHS[month]}: ${value} (100 = media del año)`}>
            <span className="season__value">{value}</span>
            <span className={`season__bar ${peakMonths.includes(month) ? 'season__bar--peak' : ''}`} style={{ height: `${Math.max(2, (value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="season__axis" aria-hidden>
        {MONTHS_SHORT.map((name, month) => <span key={name} className={month === currentMonth ? 'season__now' : ''}>{name}</span>)}
      </div>
    </div>
  );
}

/**
 * Calendario de los doce meses que vienen: una fila por keyword con temporada. El fondo de cada celda es el
 * interés de ese mes (más intenso, más búsquedas) y las letras dicen qué toca hacer.
 */
export function CampaignCalendar({ calendar, items }) {
  const seasonal = items.filter((item) => item.analysis.peakMonths.length > 0);
  if (seasonal.length === 0) return <div className="muted">Ninguna keyword analizada tiene temporada: no hace falta calendario.</div>;

  return (
    <div className="stack stack--sm">
      <div className="chart-scroll">
        <table className="calendar">
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              {calendar.map((month) => (
                <th key={month.offset} scope="col" className={month.offset === 0 ? 'calendar__now' : ''}>
                  {MONTHS_SHORT[month.month]}<span className="calendar__year">{String(month.year).slice(2)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasonal.map((item) => (
              <tr key={item.keyword}>
                <th scope="row">{item.keyword}</th>
                {calendar.map((month) => {
                  const index = item.analysis.profile[month.month];
                  const marks = [
                    month.publish.includes(item.keyword) && 'P',
                    month.campaigns.includes(item.keyword) && 'C',
                    month.peaks.includes(item.keyword) && '▲'
                  ].filter(Boolean);
                  // de 60 (valle) a 160 (pico) → de 0 a 1
                  const heat = Math.min(1, Math.max(0, (index - 60) / 100));
                  return (
                    <td key={month.offset} style={{ '--heat': heat }} className={month.peaks.includes(item.keyword) ? 'calendar__peak' : ''}
                      title={`${item.keyword} · ${MONTHS[month.month]} ${month.year}: interés ${index} (100 = media)${marks.includes('P') ? ' · publicar el contenido' : ''}${marks.includes('C') ? ' · arrancar la campaña' : ''}${marks.includes('▲') ? ' · temporada alta' : ''}`}>
                      <span className="calendar__marks">{marks.join(' ')}</span>
                      <span className="calendar__index">{index}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted small">
        <strong>P</strong> publicar el contenido (tres meses antes del pico) · <strong>C</strong> arrancar la campaña de pago, correo y redes (un mes antes) ·{' '}
        <strong>▲</strong> temporada alta. El número es el interés del mes (100 = media del año); cuanto más intenso el fondo, más se busca.
      </div>
    </div>
  );
}
