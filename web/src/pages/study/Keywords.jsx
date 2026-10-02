import { useMemo, useState } from 'react';
import { Badge, Button, SectionHeader, Select, TextField } from 'trama-ui';
import { INTENT_LABELS, TYPE_LABELS } from '../../../../shared/insights.js';
import { normalize } from '../../../../shared/text.js';
import { BarList } from '../../components/charts.jsx';
import DataTable from '../../components/DataTable.jsx';
import { Surface, useNotify, VARIANT } from '../../components/ui.jsx';
import * as api from '../../lib/api.js';
import { formatCompact, formatCurrency, formatNumber, formatPercent } from '../../lib/format.js';
import { countMissingSuggestions, sortKeywords } from '../../lib/report.js';

const METRICS = {
  'Puntuación': { key: 'score', format: (value) => `${value}/100` },
  'Búsquedas al mes': { key: 'volume', format: formatCompact },
  'CPC': { key: 'cpc', format: formatCurrency },
  'Competencia': { key: 'competition', format: formatPercent }
};
const TYPES = { 'Todos los tipos': 'all', 'Principales': 'main', 'Sugerencias': 'suggestion', 'Ideas': 'idea', 'Similares': 'similar' };
const INTENTS = { 'Toda intención': 'all', ...Object.fromEntries(Object.entries(INTENT_LABELS).map(([key, label]) => [label, key])) };
const STEP = 25;
const CHART_ROWS = 12;

const labelOf = (options, value) => Object.keys(options).find((label) => options[label] === value);
const orDash = (value, format) => (value === null ? '—' : format(value));

export default function Keywords({ filename, report, insights, setReport }) {
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [intent, setIntent] = useState('all');
  const [metric, setMetric] = useState('Puntuación');
  const [sort, setSort] = useState({ metric: 'score', order: 'desc' });
  const [rows, setRows] = useState(STEP);
  const [completing, setCompleting] = useState(false);

  const missing = useMemo(() => countMissingSuggestions(report), [report]);

  const filtered = useMemo(() => {
    const needle = normalize(query).trim();
    return insights.keywords.filter((entry) =>
      (type === 'all' || entry.type === type) &&
      (intent === 'all' || entry.intent === intent) &&
      (!needle || normalize(entry.keyword).includes(needle)));
  }, [insights, query, type, intent]);

  const sorted = useMemo(() => sortKeywords(filtered, sort.metric, sort.order), [filtered, sort]);
  const chartMetric = METRICS[metric];
  const chartRows = useMemo(() =>
    sortKeywords(filtered.filter((entry) => entry[chartMetric.key] !== null && entry.volume > 0), chartMetric.key, 'desc').slice(0, CHART_ROWS),
  [filtered, chartMetric]);

  const toggleSort = (key) => setSort((current) => ({ metric: key, order: current.metric === key && current.order === 'desc' ? 'asc' : 'desc' }));

  const complete = async () => {
    setCompleting(true);
    try {
      const result = await api.completeSuggestions(filename);
      setReport(result.data);
      notify(result.suggestionsAnalyzed > 0 ? 'success' : 'info', 'Datos completados', result.message);
    } catch (err) {
      notify('danger', 'No se pudieron completar los datos', err.message);
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    {
      key: 'keyword', label: 'Keyword', sortable: true,
      render: (entry) => (
        <div>
          <span className={`dot ${entry.type === 'main' ? 'dot--main' : ''}`} />
          <strong>{entry.keyword}</strong>
          {entry.parent !== entry.keyword && <div className="muted small">de: {entry.parent}</div>}
        </div>
      )
    },
    { key: 'type', label: 'Tipo', sortable: true, render: (entry) => TYPE_LABELS[entry.type] },
    { key: 'intent', label: 'Intención', sortable: true, render: (entry) => INTENT_LABELS[entry.intent] },
    { key: 'volume', label: 'Búsquedas', sortable: true, render: (entry) => orDash(entry.volume, formatNumber) },
    { key: 'competition', label: 'Competencia', sortable: true, render: (entry) => orDash(entry.competition, formatPercent) },
    { key: 'cpc', label: 'CPC', sortable: true, render: (entry) => orDash(entry.cpc, formatCurrency) },
    { key: 'score', label: 'Puntuación', sortable: true, render: (entry) => <strong className="score">{entry.score}</strong> }
  ];

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <Surface>
          <div className="between">
            <SectionHeader kicker="Explorador" title="Todas las keywords" align="left" variant={VARIANT}
              subtitle="Las principales, las sugerencias de Google, las ideas ampliadas (preguntas, comparativas, modificadores) y las similares." />
            <div className="actions no-print">
              {missing > 0 && (
                <Button label={completing ? 'Consultando…' : `Completar datos de ${missing} keywords`} size="sm" loading={completing} variant={VARIANT} onClick={complete} />
              )}
              <Button label="Exportar CSV" href={api.keywordsCsvUrl(filename)} glyph="icon:download" glyphPosition="start" size="sm" emphasis="ghost" variant={VARIANT} />
            </div>
          </div>

          <div className="controls no-print">
            <TextField label="Buscar" placeholder="filtrar por texto" type="search" size="sm" value={query} onChange={(value) => { setQuery(value); setRows(STEP); }} variant={VARIANT} />
            <Select label="Tipo" options={Object.keys(TYPES).join(', ')} value={labelOf(TYPES, type)} onChange={(label) => { setType(TYPES[label]); setRows(STEP); }} size="sm" variant={VARIANT} />
            <Select label="Intención" options={Object.keys(INTENTS).join(', ')} value={labelOf(INTENTS, intent)} onChange={(label) => { setIntent(INTENTS[label]); setRows(STEP); }} size="sm" variant={VARIANT} />
            <Select label="Gráfico por" options={Object.keys(METRICS).join(', ')} value={metric} onChange={setMetric} size="sm" variant={VARIANT} />
          </div>

          <div className="actions">
            <Badge text={`${filtered.length} de ${insights.keywords.length} keywords`} intent="accent" variant={VARIANT} />
            <Badge text={`${filtered.filter((entry) => entry.volume > 0).length} con datos de demanda`} intent="neutral" variant={VARIANT} />
          </div>
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight">
        <Surface title={`Las ${Math.min(CHART_ROWS, chartRows.length)} primeras por ${metric.toLowerCase()}`}>
          <BarList
            empty="Ninguna keyword del filtro tiene este dato."
            max={chartMetric.key === 'score' ? 100 : chartMetric.key === 'competition' ? 1 : undefined}
            items={chartRows.map((entry) => ({
              label: entry.keyword,
              note: TYPE_LABELS[entry.type].toLowerCase(),
              value: entry[chartMetric.key],
              display: chartMetric.format(entry[chartMetric.key]),
              accent: entry.type === 'main'
            }))}
          />
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="stack">
          <DataTable columns={columns} rows={sorted.slice(0, rows)} rowKey={(entry) => `${entry.type}|${entry.keyword}`} sort={sort} onSort={toggleSort}
            empty="Ninguna keyword coincide con el filtro." />
          {sorted.length > rows && (
            <div className="no-print">
              <Button label={`Ver ${Math.min(STEP, sorted.length - rows)} más (${sorted.length - rows} restantes)`} size="sm" emphasis="secondary" variant={VARIANT} onClick={() => setRows(rows + STEP)} />
            </div>
          )}
          <div className="muted small">
            La competencia es el índice de la fuente de datos (refleja sobre todo la disputa entre anunciantes); no mide la dificultad orgánica.
            «—» significa que la fuente no tiene ese dato.
          </div>
        </div>
      </section>
    </>
  );
}
