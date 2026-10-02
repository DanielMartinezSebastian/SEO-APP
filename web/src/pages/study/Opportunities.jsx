import { Alert, Button, SectionHeader } from 'trama-ui';
import { INTENT_HINTS } from '../../../../shared/insights.js';
import { BarList, ClusterBlocks, OpportunityMatrix } from '../../components/charts.jsx';
import { Surface, VARIANT } from '../../components/ui.jsx';
import { formatCompact, formatNumber, formatPercent } from '../../lib/format.js';
import { studyUrl } from '../../lib/router.js';

const keywordBars = (entries) => entries.map((entry) => ({
  label: entry.keyword,
  note: `${formatCompact(entry.volume)} búsquedas · competencia ${entry.competition === null ? 'sin dato' : formatPercent(entry.competition)}`,
  value: entry.score,
  display: `${entry.score}/100`,
  accent: entry.type === 'main'
}));

export default function Opportunities({ filename, insights }) {
  const withIntent = insights.intents.filter((entry) => entry.count > 0);

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <Surface>
            <SectionHeader className="wide" kicker="Ranking" title="Mejores oportunidades" align="left" variant={VARIANT}
              subtitle="Puntuación de 0 a 100: demanda (50 %), poca competencia (35 %) y valor comercial según el CPC (15 %)." />
            <BarList max={100} items={keywordBars(insights.opportunities.slice(0, 12))} empty="Ninguna keyword del estudio tiene datos de demanda." />
            <div><Button label="Ver todas las keywords" href={studyUrl(filename, 'keywords')} size="sm" emphasis="ghost" variant={VARIANT} /></div>
          </Surface>

          <Surface>
            <SectionHeader className="wide" kicker="Por dónde empezar" title={`Victorias rápidas (${insights.quickWins.length})`} align="left" variant={VARIANT}
              subtitle={`Demanda por encima de la mediana del estudio (${formatNumber(insights.totals.medianVolume)} búsquedas) y competencia inferior al 40 %.`} />
            {insights.quickWins.length > 0 ? (
              <BarList max={100} items={keywordBars(insights.quickWins.slice(0, 12))} />
            ) : (
              <Alert className="wide" intent="warning" title="No hay victorias rápidas" dismissible={false} variant={VARIANT}
                message="Todas las keywords con buena demanda están muy disputadas. La vía es la cola larga: keywords de 3 o más palabras, preguntas y temas concretos, que tienen menos búsquedas pero se posicionan antes." />
            )}
          </Surface>
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <Surface>
          <SectionHeader className="wide" kicker="Matriz de oportunidad" title="Demanda frente a competencia" align="left" variant={VARIANT}
            subtitle="Cada punto es una keyword. Cuanto más arriba, más búsquedas; cuanto más a la izquierda, menos competencia. Lo interesante está arriba a la izquierda." />
          <OpportunityMatrix keywords={insights.keywords} medianVolume={insights.totals.medianVolume} />
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <SectionHeader className="wide" kicker="Temas" title="Qué keywords van juntas" align="left" variant={VARIANT}
            subtitle="Cada bloque agrupa las keywords que comparten un término. Un bloque es candidato a una página, una categoría o una sección del sitio." />
          <ClusterBlocks clusters={insights.clusters} />
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <Surface>
            <SectionHeader className="wide" kicker="Intención" title="Qué quiere quien busca" align="left" variant={VARIANT}
              subtitle="Búsquedas al mes según la intención, deducida de las palabras de cada keyword." />
            <BarList items={insights.intents.map((entry) => ({ label: entry.label, note: `${entry.count} keywords`, value: entry.volume, display: formatCompact(entry.volume) }))} />
            <ul className="steps">
              {withIntent.map((entry) => (
                <li key={entry.intent} className="small"><strong>{entry.label}.</strong> <span className="muted">{INTENT_HINTS[entry.intent]}</span></li>
              ))}
            </ul>
          </Surface>

          <Surface>
            <SectionHeader className="wide" kicker="Cola larga" title="Longitud de las keywords" align="left" variant={VARIANT}
              subtitle="Número de keywords según cuántas palabras tienen. Las de 3 o más suelen posicionar antes y convertir mejor." />
            <BarList items={insights.lengthBuckets.map((bucket) => ({ label: bucket.label, note: `${formatCompact(bucket.volume)} búsquedas`, value: bucket.count }))} />
            {insights.questions.length > 0 && (
              <>
                <div className="label">Preguntas que hace la gente ({insights.questions.length})</div>
                <ul className="plain-list">
                  {insights.questions.slice(0, 8).map((entry) => (
                    <li key={entry.keyword}>{entry.keyword}{entry.volume ? <span className="muted"> · {formatCompact(entry.volume)}</span> : null}</li>
                  ))}
                </ul>
              </>
            )}
          </Surface>
        </div>
      </section>
    </>
  );
}
