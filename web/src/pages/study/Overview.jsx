import { Alert, Badge, Button, SectionHeader } from 'trama-ui';
import { BarList } from '../../components/charts.jsx';
import { StatRow, Surface, VARIANT } from '../../components/ui.jsx';
import { formatCompact, formatNumber } from '../../lib/format.js';
import { studyUrl } from '../../lib/router.js';

const LEVEL_INTENTS = { success: 'success', warning: 'warning', info: 'info' };
const IMPACT_INTENTS = { alto: 'accent', medio: 'neutral', bajo: 'neutral' };

// Tarea del plan: título, por qué y cómo. Se reutiliza en la pestaña de informe.
export function PlanTask({ task }) {
  return (
    <li className="task">
      <span className="task__number">{task.priority}</span>
      <div className="stack stack--sm">
        <strong>{task.title}</strong>
        <div className="actions">
          <Badge text={task.area} intent="neutral" variant={VARIANT} />
          <Badge text={`Impacto ${task.impact}`} intent={IMPACT_INTENTS[task.impact]} variant={VARIANT} />
          <Badge text={`Esfuerzo ${task.effort}`} intent="neutral" variant={VARIANT} />
        </div>
        <div className="small"><span className="muted">Por qué. </span>{task.why}</div>
        <div className="small"><span className="muted">Cómo. </span>{task.how}</div>
      </div>
    </li>
  );
}

export default function Overview({ filename, report, study, insights, plan }) {
  const mains = insights.keywords.filter((entry) => entry.type === 'main');
  const site = study.siteData;

  // Lo siguiente que conviene hacer, según lo que le falte al estudio
  const next = [];
  if (!study.client && !study.site) next.push({ label: 'Completar la ficha del cliente', tab: 'informe', why: 'El nombre del cliente y su dominio salen en el informe y permiten auditar su web.' });
  if (study.pageAudits.length === 0) next.push({ label: 'Auditar una página del cliente', tab: 'auditoria', why: 'Comprueba si las páginas reales están en condiciones de posicionar.' });
  if (study.audits.length === 0) next.push({ label: 'Generar un brief o auditar un texto', tab: 'contenido', why: 'El brief dice qué escribir; la auditoría, si lo escrito cumple.' });
  next.push({ label: 'Descargar el informe', tab: 'informe', why: 'PDF para el cliente con conclusiones, plan de acción y auditorías.' });

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <StatRow
            stats={[
              { value: formatNumber(insights.totals.keywords), label: 'Keywords estudiadas' },
              { value: formatCompact(insights.totals.volume), label: 'Búsquedas al mes' },
              { value: formatNumber(insights.quickWins.length), label: 'Victorias rápidas' },
              { value: formatNumber(insights.clusters.length), label: 'Temas' }
            ]}
          />
          {site && (
            <Alert className="wide" intent="neutral" dismissible={false} variant={VARIANT}
              title={`Punto de partida de ${study.site}`}
              message={`Tráfico orgánico estimado: ${formatNumber(site.traffic)} visitas al mes · keywords en el top 10: ${formatNumber(site.keyword_count_top10)} · en el top 100: ${formatNumber(site.keyword_count_top100)}.`} />
          )}
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <div className="stack">
            <SectionHeader className="wide" kicker="Conclusiones" title="Qué dice el estudio" subtitle="" align="left" variant={VARIANT} />
            {insights.recommendations.map((item) => (
              <Alert key={item.title} className="wide" intent={LEVEL_INTENTS[item.level]} title={item.title} message={item.text} dismissible={false} variant={VARIANT} />
            ))}
          </div>

          <div className="stack">
            <Surface title="Keywords principales">
              <BarList
                items={mains.map((entry) => ({
                  label: entry.keyword,
                  value: entry.volume || 0,
                  display: entry.volume ? `${formatCompact(entry.volume)} búsquedas` : 'sin dato',
                  note: `puntuación ${entry.score}/100`,
                  accent: true
                }))}
              />
            </Surface>
            <Surface title="Siguiente paso">
              <ul className="steps">
                {next.slice(0, 3).map((step) => (
                  <li key={step.label}>
                    <Button label={step.label} href={studyUrl(filename, step.tab)} glyph="icon:arrow-right" size="sm" emphasis="secondary" variant={VARIANT} />
                    <div className="muted small">{step.why}</div>
                  </li>
                ))}
              </ul>
            </Surface>
          </div>
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <div className="between">
            <SectionHeader kicker="Plan de acción" title="Qué hacer y en qué orden" subtitle="Tareas ordenadas por impacto y, a igual impacto, por menor esfuerzo. Cambian al añadir auditorías." align="left" variant={VARIANT} />
            <Button className="no-print" label="Ver en el informe" href={studyUrl(filename, 'informe')} size="sm" emphasis="ghost" variant={VARIANT} />
          </div>
          {plan.length === 0
            ? <div className="muted">El estudio no tiene datos suficientes para proponer tareas.</div>
            : <ol className="tasks">{plan.map((task) => <PlanTask key={task.priority} task={task} />)}</ol>}
        </div>
      </section>

      {report.some((item) => item.errors?.length > 0) && (
        <section className="dmx__section dmx__section--tight">
          <Alert className="wide" intent="warning" title="Datos incompletos" dismissible={false} variant={VARIANT}
            message={`Algunas consultas fallaron durante el análisis: ${[...new Set(report.flatMap((item) => item.errors || []))].join(' | ')}`} />
        </section>
      )}
    </>
  );
}
