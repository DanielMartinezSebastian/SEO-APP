// Estacionalidad y tendencia a partir del interés a lo largo del tiempo (Google Trends, 5 años).
// Lógica pura: la usan el servidor (plan, informes, CLI, MCP) y el navegador (pestaña «Tendencias»).
import { classifyIntent, collectKeywords } from './insights.js';
import { normalize } from './text.js';

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Con cuánta antelación se trabaja un pico: el contenido necesita tiempo para posicionar; la campaña, menos
export const CONTENT_LEAD_MONTHS = 3;
export const CAMPAIGN_LEAD_MONTHS = 1;

export const PATTERN_LABELS = {
  stable: 'Estable todo el año',
  seasonal: 'Estacional',
  'very-seasonal': 'Muy estacional',
  irregular: 'Picos que no se repiten',
  unknown: 'Sin datos suficientes'
};
export const DIRECTION_LABELS = { rising: 'En crecimiento', falling: 'En descenso', flat: 'Estable' };

const mean = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0);
const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

function correlation(a, b) {
  const meanA = mean(a);
  const meanB = mean(b);
  let top = 0;
  let squaresA = 0;
  let squaresB = 0;
  for (let index = 0; index < a.length; index++) {
    top += (a[index] - meanA) * (b[index] - meanB);
    squaresA += (a[index] - meanA) ** 2;
    squaresB += (b[index] - meanB) ** 2;
  }
  return squaresA && squaresB ? top / Math.sqrt(squaresA * squaresB) : 0;
}

/**
 * Analiza una serie mensual de interés.
 * @param {{ month: string, value: number }[]} series  meses 'AAAA-MM' en orden, valor de 0 a 100
 * @param {Date} [now]
 */
export function analyzeTrend(series, now = new Date()) {
  const current = monthKey(now);
  // el mes en curso está incompleto: no entra en el cálculo
  const points = (series || []).filter((point) => typeof point.value === 'number' && point.month < current);
  const unknown = (reason) => ({ enough: false, pattern: 'unknown', patternLabel: PATTERN_LABELS.unknown, reason, profile: [], peakMonths: [], lowMonths: [], direction: 'flat', directionLabel: DIRECTION_LABELS.flat, yearChange: null, longChange: null, next: null });
  if (points.length < 24) return unknown('Hacen falta al menos dos años de datos.');
  if (points.filter((point) => point.value > 0).length < points.length * 0.6) {
    return unknown('La búsqueda tiene tan poco volumen que Google Trends devuelve ceros la mayor parte del tiempo.');
  }

  // Años contados hacia atrás desde el último mes completo: cada tramo tiene los doce meses una vez
  const years = [];
  for (let end = points.length; end - 12 >= 0; end -= 12) years.unshift(points.slice(end - 12, end));

  // Perfil estacional: cada mes respecto a la media de su año (así el crecimiento de fondo no cuenta como temporada)
  const ratios = years.map((year) => {
    const average = mean(year.map((point) => point.value)) || 1;
    const byMonth = new Array(12).fill(1);
    year.forEach((point) => { byMonth[Number(point.month.slice(5)) - 1] = point.value / average; });
    return byMonth;
  });
  const profile = Array.from({ length: 12 }, (_, month) => Math.round(mean(ratios.map((year) => year[month])) * 100));
  const amplitude = Math.max(...profile) / Math.max(1, Math.min(...profile));
  // ¿Se repite el dibujo cada año? Sin repetición, un pico es un suceso, no una temporada
  const consistency = mean(ratios.map((year) => correlation(year, profile)));

  let pattern = 'stable';
  if (amplitude >= 1.3) pattern = consistency < 0.5 ? 'irregular' : amplitude >= 2 ? 'very-seasonal' : 'seasonal';
  const seasonal = pattern === 'seasonal' || pattern === 'very-seasonal';

  const ranked = profile.map((index, month) => ({ month, index })).sort((a, b) => b.index - a.index);
  const peakMonths = seasonal ? ranked.filter((entry) => entry.index >= 115).slice(0, 3).map((entry) => entry.month) : [];
  const lowMonths = seasonal ? ranked.filter((entry) => entry.index <= 85).slice(-3).map((entry) => entry.month).reverse() : [];

  const yearMeans = years.map((year) => mean(year.map((point) => point.value)));
  const change = (from, to) => (from > 0 ? Math.round(((to - from) / from) * 100) : null);
  const yearChange = years.length >= 2 ? change(yearMeans.at(-2), yearMeans.at(-1)) : null;
  const longChange = years.length >= 3 ? change(yearMeans[0], yearMeans.at(-1)) : null;
  const direction = yearChange === null ? 'flat' : yearChange >= 15 ? 'rising' : yearChange <= -15 ? 'falling' : 'flat';

  // Próximo pico y cuándo hay que tener el trabajo hecho
  let next = null;
  if (seasonal && peakMonths.length > 0) {
    const nowMonth = now.getUTCMonth();
    // primer mes de temporada alta contando desde hoy
    const monthsUntil = Math.min(...peakMonths.map((month) => (month - nowMonth + 12) % 12));
    const peak = (nowMonth + monthsUntil) % 12;
    const publishBy = (peak - CONTENT_LEAD_MONTHS + 12) % 12;
    const campaignFrom = (peak - CAMPAIGN_LEAD_MONTHS + 12) % 12;
    next = {
      peak,
      peakIndex: profile[peak],
      monthsUntil,
      publishBy,
      campaignFrom,
      // en temporada: ya solo cabe reforzar; urgente: no da tiempo a posicionar contenido nuevo con calma
      status: monthsUntil === 0 ? 'in-season' : monthsUntil < CONTENT_LEAD_MONTHS ? 'urgent' : monthsUntil <= CONTENT_LEAD_MONTHS + 2 ? 'now' : 'later'
    };
  }

  return {
    enough: true,
    pattern,
    patternLabel: PATTERN_LABELS[pattern],
    profile,
    amplitude: Math.round(amplitude * 10) / 10,
    consistency: Math.round(consistency * 100) / 100,
    peakMonths,
    lowMonths,
    direction,
    directionLabel: DIRECTION_LABELS[direction],
    yearChange,
    longChange,
    next
  };
}

const signed = (value) => `${value > 0 ? '+' : ''}${value} %`;
const list = (months) => months.map((month) => MONTHS[month]).join(', ');
const quote = (keywords) => keywords.map((keyword) => `«${keyword}»`).join(', ');

/**
 * Lectura cruzada de las tendencias con el resto del estudio.
 * @param {object[]} report            datos del estudio
 * @param {{ fetchedAt, geo, items: { keyword, role, series, top, rising, error? }[] }} trends
 * @param {Date} [now]
 */
export function buildTrendInsights(report, trends, now = new Date()) {
  const studyKeywords = collectKeywords(report);
  const byKeyword = new Map(studyKeywords.map((entry) => [normalize(entry.keyword), entry]));
  const items = (trends?.items || []).map((item) => ({
    ...item,
    entry: byKeyword.get(normalize(item.keyword)) || null,
    analysis: item.error ? analyzeTrend([], now) : analyzeTrend(item.series, now)
  }));
  const analysed = items.filter((item) => item.analysis.enough);
  const nowMonth = now.getUTCMonth();

  // --- Calendario: los doce meses que vienen ---
  const calendar = Array.from({ length: 12 }, (_, offset) => {
    const month = (nowMonth + offset) % 12;
    const seasonal = analysed.filter((item) => item.analysis.peakMonths.length > 0);
    return {
      month,
      offset,
      year: now.getUTCFullYear() + Math.floor((nowMonth + offset) / 12),
      label: MONTHS[month],
      // temporada alta de estas keywords
      peaks: seasonal.filter((item) => item.analysis.peakMonths.includes(month)).map((item) => item.keyword),
      // contenido que debe estar publicado este mes para llegar a su pico
      publish: seasonal.filter((item) => item.analysis.peakMonths.some((peak) => (peak - CONTENT_LEAD_MONTHS + 12) % 12 === month)).map((item) => item.keyword),
      // campañas (anuncios, correo, redes) que arrancan este mes
      campaigns: seasonal.filter((item) => item.analysis.peakMonths.some((peak) => (peak - CAMPAIGN_LEAD_MONTHS + 12) % 12 === month)).map((item) => item.keyword)
    };
  });

  // --- Consultas relacionadas: ¿las cubre el estudio? ---
  const known = (query) => byKeyword.has(normalize(query));
  const dedupe = (queries) => {
    const seen = new Map();
    for (const query of queries) {
      const key = normalize(query.query);
      if (!seen.has(key) || seen.get(key).value < query.value) seen.set(key, query);
    }
    return [...seen.values()];
  };
  const related = (kind) => dedupe(items.flatMap((item) => (item[kind] || []).map((query) => ({ ...query, from: item.keyword, inStudy: known(query.query), intent: classifyIntent(query.query) }))));
  const top = related('top').sort((a, b) => b.value - a.value);
  const rising = related('rising').sort((a, b) => (b.breakout ? 1 : 0) - (a.breakout ? 1 : 0) || b.value - a.value);
  const newQueries = rising.filter((query) => !query.inStudy);
  const covered = top.filter((query) => query.inStudy).length;
  const coverage = top.length ? { covered, total: top.length, percent: Math.round((covered / top.length) * 100), missing: top.filter((query) => !query.inStudy).slice(0, 15) } : null;

  // --- Hallazgos: cada uno cruza la tendencia con otro dato del estudio ---
  const findings = [];
  const add = (level, title, text, keywords = []) => findings.push({ level, title, text, keywords });
  const mains = analysed.filter((item) => item.role === 'main');

  const urgent = analysed.filter((item) => item.analysis.next && (item.analysis.next.status === 'urgent' || item.analysis.next.status === 'now'));
  urgent.forEach((item) => {
    const { next } = item.analysis;
    add('warning', `«${item.keyword}» tiene su temporada alta en ${MONTHS[next.peak]}`,
      next.status === 'urgent'
        ? `${next.monthsUntil === 1 ? 'Falta 1 mes' : `Faltan ${next.monthsUntil} meses`} y el interés sube hasta ${next.peakIndex} (100 = media del año). Ya no hay margen para posicionar una página nueva con calma: refuerza las que existen, actualiza fechas y precios, y prepara la campaña de pago para ${MONTHS[next.campaignFrom]}.`
        : `El contenido debería estar publicado en ${MONTHS[next.publishBy]} para llegar posicionado; la campaña (anuncios, correo, redes) arranca en ${MONTHS[next.campaignFrom]}. En el pico el interés es ${next.peakIndex} sobre una media de 100.`,
      [item.keyword]);
  });
  const inSeason = analysed.filter((item) => item.analysis.next?.status === 'in-season');
  if (inSeason.length > 0) {
    add('info', `En temporada alta ahora: ${quote(inSeason.map((item) => item.keyword))}`,
      'Es el momento de máximo interés del año. No es momento de rehacer páginas: revisa disponibilidad, precios, tiempos de carga y que las páginas que ya posicionan conviertan.', inSeason.map((item) => item.keyword));
  }

  const growing = analysed.filter((item) => item.analysis.direction === 'rising');
  const easyGrowing = growing.filter((item) => item.entry && item.entry.competition !== null && item.entry.competition < 0.5);
  if (easyGrowing.length > 0) {
    add('success', `Demanda al alza y poca competencia: ${quote(easyGrowing.map((item) => item.keyword))}`,
      `${easyGrowing.map((item) => `«${item.keyword}» crece un ${signed(item.analysis.yearChange)} en el último año con una competencia del ${Math.round(item.entry.competition * 100)} %`).join('; ')}. Es la combinación más rentable del estudio: súbelas en la lista de prioridades antes de que se disputen.`,
      easyGrowing.map((item) => item.keyword));
  }
  const otherGrowing = growing.filter((item) => !easyGrowing.includes(item));
  if (otherGrowing.length > 0) {
    add('success', `Interés creciente: ${quote(otherGrowing.map((item) => item.keyword))}`,
      `${otherGrowing.map((item) => `«${item.keyword}» ${signed(item.analysis.yearChange)}`).join(', ')} respecto a los doce meses anteriores. El volumen medio del estudio se queda corto: la demanda actual es mayor.`,
      otherGrowing.map((item) => item.keyword));
  }

  const fallingMains = mains.filter((item) => item.analysis.direction === 'falling');
  if (fallingMains.length > 0) {
    add('warning', `Keywords principales que pierden interés: ${quote(fallingMains.map((item) => item.keyword))}`,
      `${fallingMains.map((item) => `«${item.keyword}» ${signed(item.analysis.yearChange)} en un año${item.analysis.longChange !== null ? ` (${signed(item.analysis.longChange)} en cinco)` : ''}`).join('; ')}. Antes de invertir más en ellas, mira en las consultas en auge cómo se busca ahora lo mismo: el público puede haber cambiado de término, no de necesidad.`,
      fallingMains.map((item) => item.keyword));
  }

  const breakout = newQueries.filter((query) => query.breakout);
  if (newQueries.length > 0) {
    add('info', `${newQueries.length} ${newQueries.length === 1 ? 'consulta en auge que el estudio no contempla' : 'consultas en auge que el estudio no contempla'}`,
      `${quote(newQueries.slice(0, 8).map((query) => query.query))}. ${breakout.length > 0 ? `${breakout.length === 1 ? 'Una está' : `${breakout.length} están`} disparadas (más de un 5.000 % de subida): demanda nueva que las herramientas de volumen aún no recogen. ` : ''}Son candidatas a contenido nuevo y pistas de producto o servicio: lo que la gente empieza a pedir.`,
      newQueries.slice(0, 8).map((query) => query.query));
  }

  if (coverage && coverage.total >= 8) {
    if (coverage.percent < 40) {
      add('warning', `El estudio solo recoge el ${coverage.percent} % de lo que más se busca alrededor de sus keywords`,
        `De las ${coverage.total} consultas más relacionadas según Google Trends, ${coverage.covered} están en el estudio. Faltan, entre otras: ${quote(coverage.missing.slice(0, 6).map((query) => query.query))}. Conviene revisar si las keywords principales describen de verdad lo que busca el público objetivo.`,
        coverage.missing.slice(0, 6).map((query) => query.query));
    } else {
      add('success', `El estudio cubre el ${coverage.percent} % de las consultas más relacionadas`,
        `${coverage.covered} de ${coverage.total} ya están entre las keywords estudiadas: el vocabulario del estudio coincide con el de quien busca.`);
    }
  }

  // ¿Lo que se busca alrededor tiene la intención que el proyecto espera?
  const mainIntents = new Set(studyKeywords.filter((entry) => entry.type === 'main').map((entry) => entry.intent));
  const informational = top.filter((query) => query.intent === 'informational').length;
  const buying = top.filter((query) => query.intent === 'transactional' || query.intent === 'commercial').length;
  if (top.length >= 8 && buying > 0 && informational / top.length >= 0.5 && (mainIntents.has('transactional') || mainIntents.has('commercial'))) {
    add('warning', 'Se busca más para informarse que para comprar',
      `${informational} de las ${top.length} consultas más relacionadas son informativas. Si el proyecto vende, hace falta contenido que acompañe esa fase (guías, comparativas) y que enlace a las páginas de venta; atacar solo las keywords de compra deja fuera a la mayoría.`);
  }

  const irregular = analysed.filter((item) => item.analysis.pattern === 'irregular');
  if (irregular.length > 0) {
    add('info', `Picos puntuales, no temporada: ${quote(irregular.map((item) => item.keyword))}`,
      'El interés tuvo subidas fuertes que no se repiten cada año (una noticia, una campaña, una moda). No planifiques un calendario sobre ellas.', irregular.map((item) => item.keyword));
  }

  const stable = analysed.filter((item) => item.analysis.pattern === 'stable' && item.analysis.direction === 'flat');
  if (stable.length > 0 && stable.length === analysed.length) {
    add('info', 'Demanda estable todo el año', 'Ninguna keyword analizada tiene temporada ni cambia de tendencia: el volumen medio del estudio es representativo y no hace falta calendario de campañas.');
  }

  return {
    fetchedAt: trends?.fetchedAt || null,
    geo: trends?.geo || null,
    items,
    calendar,
    top,
    rising,
    newQueries,
    coverage,
    findings,
    seasonalCount: analysed.filter((item) => item.analysis.peakMonths.length > 0).length
  };
}

// Resumen en texto de una keyword: lo usan la CLI, MCP y los informes
export function describeTrend(item) {
  const { analysis } = item;
  if (item.error) return `sin datos (${item.error})`;
  if (!analysis.enough) return analysis.reason;
  return [
    analysis.patternLabel.toLowerCase(),
    analysis.peakMonths.length ? `pico en ${list(analysis.peakMonths)}` : '',
    analysis.lowMonths.length ? `valle en ${list(analysis.lowMonths)}` : '',
    analysis.yearChange !== null ? `${signed(analysis.yearChange)} en el último año` : ''
  ].filter(Boolean).join(' · ');
}

export function trendsToMarkdown(insights) {
  if (!insights.items.length) return 'Sin datos de tendencias.\n';
  const lines = [
    '| Keyword | Patrón | Temporada alta | Último año | Cinco años | Próximo pico |',
    '|---|---|---|---:|---:|---|',
    ...insights.items.map((item) => {
      const a = item.analysis;
      if (!a.enough) return `| ${item.keyword} | ${item.error ? 'Sin datos' : a.patternLabel} | — | — | — | — |`;
      return `| ${item.keyword} | ${a.patternLabel} | ${a.peakMonths.length ? list(a.peakMonths) : '—'} | ${a.yearChange === null ? '—' : signed(a.yearChange)} | ${a.longChange === null ? '—' : signed(a.longChange)} | ${a.next ? `${MONTHS[a.next.peak]} (publicar en ${MONTHS[a.next.publishBy]})` : '—'} |`;
    }),
    ''
  ];
  if (insights.findings.length) lines.push(...insights.findings.map((finding) => `- **${finding.title}.** ${finding.text}`), '');
  const busy = insights.calendar.filter((month) => month.peaks.length || month.publish.length || month.campaigns.length);
  if (busy.length) {
    lines.push('| Mes | Publicar contenido para | Arrancar campaña de | En temporada alta |', '|---|---|---|---|',
      ...busy.map((month) => `| ${month.label} ${month.year} | ${month.publish.join(', ') || '—'} | ${month.campaigns.join(', ') || '—'} | ${month.peaks.join(', ') || '—'} |`), '');
  }
  if (insights.newQueries.length) {
    lines.push(`Consultas en auge que no están en el estudio: ${insights.newQueries.slice(0, 15).map((query) => `${query.query} (${query.breakout ? 'disparada' : `+${query.value} %`})`).join(', ')}.`, '');
  }
  return lines.join('\n');
}
