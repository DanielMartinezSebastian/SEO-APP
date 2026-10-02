import { useMemo, useState } from 'react';
import { Alert, Badge, Button, SectionHeader } from 'trama-ui';
import { MONTHS, buildTrendInsights } from '../../../../shared/seasonality.js';
import DataTable from '../../components/DataTable.jsx';
import { CampaignCalendar, SeasonProfile, TrendLine } from '../../components/trendCharts.jsx';
import { Loading, Surface, useNotify, VARIANT } from '../../components/ui.jsx';
import * as api from '../../lib/api.js';
import { formatCompact, formatDate, formatPercent } from '../../lib/format.js';
import { studyUrl } from '../../lib/router.js';

const signed = (value) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value} %`);
const changeIntent = (value) => (value === null ? 'neutral' : value >= 15 ? 'success' : value <= -15 ? 'danger' : 'neutral');
const PATTERN_INTENT = { stable: 'neutral', seasonal: 'info', 'very-seasonal': 'accent', irregular: 'warning', unknown: 'neutral' };
const NEXT_TEXT = {
  'in-season': () => 'En temporada alta ahora',
  urgent: (next) => `Pico en ${MONTHS[next.peak]}: ${next.monthsUntil === 1 ? 'falta 1 mes' : `faltan ${next.monthsUntil} meses`}. Refuerza lo que ya existe`,
  now: (next) => `Pico en ${MONTHS[next.peak]}: publica el contenido en ${MONTHS[next.publishBy]}`,
  later: (next) => `Pico en ${MONTHS[next.peak]}: contenido en ${MONTHS[next.publishBy]}, campaña en ${MONTHS[next.campaignFrom]}`
};

function KeywordTrend({ item, currentMonth }) {
  const { analysis, entry } = item;
  return (
    <Surface className="trend-card">
      <div className="between">
        <h3 className="trend-card__title">{item.keyword}</h3>
        <div className="actions">
          {item.role === 'main' && <Badge text="Principal" intent="accent" variant={VARIANT} />}
          <Badge text={analysis.patternLabel} intent={PATTERN_INTENT[analysis.pattern]} variant={VARIANT} />
          {analysis.enough && <Badge text={`${signed(analysis.yearChange)} en un año`} intent={changeIntent(analysis.yearChange)} variant={VARIANT} />}
        </div>
      </div>
      {entry && (
        <div className="muted small">
          {formatCompact(entry.volume)} búsquedas al mes de media · competencia {entry.competition === null ? 'sin dato' : formatPercent(entry.competition)}
          {analysis.longChange !== null && ` · ${signed(analysis.longChange)} en cinco años`}
        </div>
      )}
      {item.error && <div className="muted small">No se pudo consultar: {item.error}</div>}
      {!item.error && !analysis.enough && <div className="muted small">{analysis.reason}</div>}
      {!item.error && item.series.length > 0 && (
        <>
          <div className="label">Interés en los últimos cinco años (0-100)</div>
          <TrendLine series={item.series} peakMonths={analysis.peakMonths} label={item.keyword} />
        </>
      )}
      {analysis.enough && (
        <>
          <div className="label">Perfil del año (100 = media)</div>
          <SeasonProfile profile={analysis.profile} peakMonths={analysis.peakMonths} currentMonth={currentMonth} />
          {analysis.next && <div className="small"><strong>{NEXT_TEXT[analysis.next.status](analysis.next)}.</strong></div>}
        </>
      )}
    </Surface>
  );
}

export default function Trends({ filename, report, study, setStudy }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const insights = useMemo(() => (study.trends ? buildTrendInsights(report, study.trends) : null), [report, study.trends]);
  const currentMonth = new Date().getUTCMonth();

  const load = async (mode) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.getTrends(filename, mode);
      setStudy({ ...study, trends: response.trends });
      notify('success', 'Tendencias actualizadas', `${response.trends.items.length} keywords consultadas en Google Trends`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!insights) {
    return (
      <section className="dmx__section dmx__section--tight">
        <Surface>
          <SectionHeader className="wide" kicker="Tendencias" title="¿Cuándo se busca y hacia dónde va?" align="left" variant={VARIANT}
            subtitle="El volumen del estudio es una media mensual: no dice si una keyword se busca sobre todo en diciembre ni si lleva dos años cayendo. Google Trends sí. Se consultan las keywords principales y las más buscadas del resto (hasta 10), con cinco años de historia." />
          <ul className="plain-list">
            <li><strong>Estacionalidad:</strong> en qué meses sube cada búsqueda y cuándo hay que tener el contenido publicado para llegar a tiempo.</li>
            <li><strong>Tendencia:</strong> qué keywords crecen y cuáles pierden interés, para reordenar prioridades.</li>
            <li><strong>Consultas en auge:</strong> lo que la gente empieza a buscar y el estudio aún no contempla.</li>
            <li><strong>Encaje con el público:</strong> si las keywords del estudio son las que de verdad se usan alrededor del tema.</li>
          </ul>
          {error && <Alert className="wide" intent="danger" title="No se pudieron consultar las tendencias" message={error} variant={VARIANT} />}
          {busy ? <Loading label="Consultando Google Trends (unos 3 s por keyword)…" /> : (
            <div className="actions">
              <Button label="Consultar Google Trends" glyph="icon:search" glyphPosition="start" variant={VARIANT} onClick={() => load('')} />
              <span className="muted small">Google limita estas consultas: el resultado se guarda en el estudio y no se vuelve a pedir hasta que lo indiques.</span>
            </div>
          )}
        </Surface>
      </section>
    );
  }

  const incomplete = insights.items.filter((item) => item.error || item.relatedError).length;
  const levelIntent = { success: 'success', warning: 'warning', info: 'info' };

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <Surface>
          <div className="between">
            <SectionHeader kicker="Lectura cruzada" title="Qué cambia en la estrategia" align="left" variant={VARIANT}
              subtitle="Cada punto cruza la tendencia con otro dato del estudio (competencia, intención, keywords recogidas). Lo accionable pasa al plan de acción y al informe." />
            <div className="actions no-print">
              {incomplete > 0 && <Button label={`Reintentar ${incomplete} incompletas`} size="sm" loading={busy} variant={VARIANT} onClick={() => load('retry')} />}
              <Button label={busy ? 'Consultando…' : 'Volver a consultar'} size="sm" emphasis="ghost" loading={busy} variant={VARIANT} onClick={() => load('refresh')} />
            </div>
          </div>
          {error && <Alert className="wide" intent="danger" title="No se pudieron consultar las tendencias" message={error} variant={VARIANT} />}
          {incomplete > 0 && !error && (
            <Alert className="wide" intent="warning" dismissible={false} variant={VARIANT} title="Google Trends cortó parte de la consulta"
              message="Faltan las consultas relacionadas o la serie de alguna keyword. Espera un par de minutos y pulsa «Reintentar»: solo se pide lo que falta." />
          )}
          {insights.findings.length === 0 && <div className="muted">Sin hallazgos: no hay datos suficientes de las keywords consultadas.</div>}
          {insights.findings.map((finding) => (
            <Alert key={finding.title} className="wide" intent={levelIntent[finding.level]} title={finding.title} message={finding.text} dismissible={false} variant={VARIANT} />
          ))}
          <div className="muted small">
            Google Trends · {insights.geo} · consultado el {formatDate(insights.fetchedAt)}. Índice relativo de 0 a 100 por keyword: no es volumen ni permite comparar keywords entre sí.
            {' '}<a href={studyUrl(filename, 'resumen')}>Ver el plan de acción</a>
          </div>
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight">
        <Surface>
          <SectionHeader className="wide" kicker="Calendario" title="Los próximos doce meses" align="left" variant={VARIANT}
            subtitle="Cuándo publicar y cuándo lanzar campañas para llegar a cada temporada alta. El contenido necesita unos tres meses para posicionar; los anuncios, el correo y las redes, uno." />
          <CampaignCalendar calendar={insights.calendar} items={insights.items} />
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <SectionHeader className="wide" kicker="Keyword a keyword" title="Interés y perfil del año" align="left" variant={VARIANT}
            subtitle="Arriba, la evolución de cinco años con los meses de temporada alta marcados. Abajo, el año tipo: cada mes frente a la media." />
          <div className="trend-grid">
            {insights.items.map((item) => <KeywordTrend key={item.keyword} item={item} currentMonth={currentMonth} />)}
          </div>
        </div>
      </section>

      {(insights.rising.length > 0 || insights.top.length > 0) && (
        <section className="dmx__section dmx__section--tight">
          <div className="dmx__grid-2 dmx__grid-2--editor">
            <Surface>
              <SectionHeader className="wide" kicker="Consultas en auge" title="Lo que empieza a buscarse" align="left" variant={VARIANT}
                subtitle="Búsquedas relacionadas con las keywords principales que más han crecido. Las que no están en el estudio son contenido nuevo en potencia y pistas de producto o servicio." />
              <DataTable
                rowKey={(query) => query.query}
                rows={insights.rising.slice(0, 20)}
                empty="Google Trends no devuelve consultas en auge para estas keywords."
                columns={[
                  { key: 'query', label: 'Consulta', render: (query) => <strong>{query.query}</strong> },
                  { key: 'value', label: 'Subida', render: (query) => (query.breakout ? <Badge text="Disparada" intent="accent" variant={VARIANT} /> : `+${formatCompact(query.value)} %`) },
                  { key: 'inStudy', label: 'En el estudio', render: (query) => (query.inStudy ? <span className="muted">Sí</span> : <Badge text="No: evaluar" intent="warning" variant={VARIANT} />) }
                ]}
              />
              {insights.newQueries.length > 0 && (
                <div className="actions no-print">
                  <Button label="Crear un estudio con las nuevas" size="sm" variant={VARIANT}
                    href={`/new?keywords=${encodeURIComponent(insights.newQueries.slice(0, 12).map((query) => query.query).join(', '))}`} />
                  <span className="muted small">Para medir su volumen, competencia y CPC.</span>
                </div>
              )}
            </Surface>

            <Surface>
              <SectionHeader className="wide" kicker="Encaje con el público" title="Cómo se busca alrededor del tema" align="left" variant={VARIANT}
                subtitle="Las consultas más relacionadas según Google. Si pocas están en el estudio, las keywords elegidas no describen cómo busca el público objetivo." />
              {insights.coverage && (
                <div className="actions">
                  <Badge text={`${insights.coverage.percent} % recogido en el estudio`} intent={insights.coverage.percent >= 40 ? 'success' : 'warning'} variant={VARIANT} />
                  <span className="muted small">{insights.coverage.covered} de {insights.coverage.total} consultas</span>
                </div>
              )}
              <DataTable
                rowKey={(query) => query.query}
                rows={insights.top.slice(0, 20)}
                empty="Google Trends no devuelve consultas relacionadas para estas keywords."
                columns={[
                  { key: 'query', label: 'Consulta', render: (query) => <strong>{query.query}</strong> },
                  { key: 'value', label: 'Afinidad', render: (query) => `${query.value}/100` },
                  { key: 'inStudy', label: 'En el estudio', render: (query) => (query.inStudy ? <span className="muted">Sí</span> : <Badge text="No" intent="warning" variant={VARIANT} />) }
                ]}
              />
            </Surface>
          </div>
        </section>
      )}
    </>
  );
}
