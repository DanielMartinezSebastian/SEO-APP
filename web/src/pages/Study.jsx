import { useMemo } from 'react';
import { Alert, Badge, Button } from 'trama-ui';
import { buildInsights } from '../../../shared/insights.js';
import { buildActionPlan } from '../../../shared/plan.js';
import { Loading, VARIANT } from '../components/ui.jsx';
import { formatDate, truncate } from '../lib/format.js';
import { studyUrl } from '../lib/router.js';
import { useStudy } from '../lib/useStudy.js';
import Overview from './study/Overview.jsx';
import Keywords from './study/Keywords.jsx';
import Opportunities from './study/Opportunities.jsx';
import ContentTab from './study/ContentTab.jsx';
import PageAudits from './study/PageAudits.jsx';
import Trends from './study/Trends.jsx';
import ReportTab from './study/ReportTab.jsx';

// El orden de las pestañas es el orden de trabajo: entender, decidir, producir, comprobar y entregar
const TABS = [
  { id: 'resumen', label: 'Resumen', view: Overview },
  { id: 'keywords', label: 'Keywords', view: Keywords },
  { id: 'oportunidades', label: 'Oportunidades', view: Opportunities },
  { id: 'tendencias', label: 'Tendencias', view: Trends },
  { id: 'contenido', label: 'Contenido', view: ContentTab },
  { id: 'auditoria', label: 'Auditoría web', view: PageAudits },
  { id: 'informe', label: 'Informe', view: ReportTab }
];

export default function Study({ filename, tab }) {
  const data = useStudy(filename);
  const { report, study, error } = data;
  const insights = useMemo(() => (report ? buildInsights(report) : null), [report]);
  const plan = useMemo(() => (report ? buildActionPlan(report, study) : []), [report, study]);

  if (!report) {
    return (
      <section className="dmx__section">
        {error ? (
          <div className="stack">
            <Alert className="wide" intent="danger" title="Error al cargar el estudio" message={error} dismissible={false} variant={VARIANT} />
            <div><Button label="Volver a los estudios" href="/" glyph="icon:arrow-left" glyphPosition="start" variant={VARIANT} /></div>
          </div>
        ) : (
          <Loading label="Cargando el estudio…" />
        )}
      </section>
    );
  }

  const current = TABS.find((item) => item.id === tab) || TABS[0];
  const View = current.view;
  const name = study.name || report.map((item) => item.keyword).join(' · ');
  const auditCount = study.audits.length + study.pageAudits.length;

  return (
    <>
      <section className="dmx__section dmx__section--tight study-head">
        <header className="stack">
          <div className="label">
            <a href="/">Estudios</a> / {formatDate(report[0]?.timestamp)}
          </div>
          <h1 className="page-title">{truncate(name, 90)}</h1>
          <div className="actions">
            {study.client && <Badge text={study.client} intent="accent" variant={VARIANT} />}
            {study.site && <Badge text={study.site} intent="neutral" variant={VARIANT} />}
            {report[0]?.country && <Badge text={`${report[0].country} · ${report[0].language}`} intent="neutral" variant={VARIANT} />}
            <Badge text={`${insights.totals.keywords} keywords`} intent="neutral" variant={VARIANT} />
            {auditCount > 0 && <Badge text={`${auditCount} auditorías`} intent="neutral" variant={VARIANT} />}
          </div>
          <nav className="tabs no-print" aria-label="Secciones del estudio">
            {TABS.map((item) => (
              <a key={item.id} href={studyUrl(filename, item.id)} className={`tabs__tab ${item.id === current.id ? 'is-active' : ''}`}
                aria-current={item.id === current.id ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>
      </section>

      <View filename={filename} {...data} insights={insights} plan={plan} />
    </>
  );
}
