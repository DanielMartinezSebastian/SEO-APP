import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Modal, SectionHeader, Select, TextField } from 'trama-ui';
import { scoreIntent } from '../components/AuditResult.jsx';
import { BarList } from '../components/charts.jsx';
import DataTable from '../components/DataTable.jsx';
import { Loading, StatRow, Surface, useNotify, VARIANT } from '../components/ui.jsx';
import * as api from '../lib/api.js';
import { cell, formatCompact, formatCurrency, formatDate, formatNumber, formatPercent } from '../lib/format.js';
import { navigate, studyUrl } from '../lib/router.js';

const NEW_STUDY = 'Crear un estudio nuevo con keywords';
const LEVEL = { success: 'success', warning: 'warning', info: 'info' };
const IMPACT_INTENT = { alto: 'accent', medio: 'neutral', bajo: 'neutral' };
const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/';

// Alta de un target: su público y, o bien las keywords para crear su estudio, o bien un estudio que ya existe
function TargetForm({ projectId, usedStudies, onSaved }) {
  const notify = useNotify();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [keywords, setKeywords] = useState('');
  const [source, setSource] = useState(NEW_STUDY);
  const [studies, setStudies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listStudies().then(setStudies).catch(() => setStudies([]));
  }, []);

  // `Select` de trama-ui separa las opciones por comas: los nombres se muestran sin ellas
  const available = new Map(studies.filter((study) => !usedStudies.includes(study.filename)).map((study) => [`${cell(study.name)} · ${formatDate(study.timestamp)}`, study.filename]));
  const list = [...new Set(keywords.split(/[\n,]/).map((keyword) => keyword.trim()).filter(Boolean))];
  const creating = source === NEW_STUDY;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Ponle nombre al target: el público o la línea de negocio.');
    if (creating && list.length === 0) return setError('Escribe las keywords que usaría ese público, o elige un estudio existente.');
    setBusy(true);
    setError('');
    try {
      const result = await api.addTarget(projectId, { name, audience, ...(creating ? { keywords: list } : { studies: [available.get(source)] }) });
      notify('success', 'Target añadido', name);
      setName('');
      setAudience('');
      setKeywords('');
      setSource(NEW_STUDY);
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`ui-surface ui-s ui-s--${VARIANT} surface`} onSubmit={submit} noValidate>
      <SectionHeader className="wide" kicker="Nuevo target" title="¿A quién más se dirige el sitio?" align="left" variant={VARIANT}
        subtitle="Un target es un público con su propia forma de buscar: un servicio, una categoría de la tienda, un tipo de cliente. Cada uno necesita su estudio y su página de aterrizaje." />
      <div className="controls controls--wide">
        <TextField label="Nombre del target" placeholder="Automatización para pymes" value={name} onChange={setName} variant={VARIANT} />
        <TextField label="Público y problema (opcional)" placeholder="Empresas que repiten tareas a mano en Excel" value={audience} onChange={setAudience} variant={VARIANT} />
      </div>
      <Select label="Keywords del target" options={[NEW_STUDY, ...available.keys()].join(', ')} value={source} onChange={setSource} variant={VARIANT} />
      {creating && (
        <TextField label="Keywords (una por línea o separadas por comas)" multiline rows={3} value={keywords} onChange={setKeywords} variant={VARIANT}
          placeholder={'Las que escribiría ESE público, no el nombre interno del servicio:\nautomatizar facturas\nsoftware a medida'}
          hint={list.length > 0 ? `${list.length} keywords · unos ${list.length * 5} segundos` : 'De 2 a 6 por target.'} />
      )}
      {busy && creating && <Alert className="wide" intent="info" title="Analizando las keywords del target…" dismissible={false} variant={VARIANT} message="Se crea su estudio; al terminar aparece en la comparación." />}
      {error && <Alert className="wide" intent="danger" title="No se pudo añadir el target" message={error} variant={VARIANT} />}
      <div className="actions">
        <Button type="submit" label={busy ? 'Añadiendo…' : 'Añadir target'} glyph="icon:plus" glyphPosition="start" loading={busy} variant={VARIANT} />
      </div>
    </form>
  );
}

function TargetCard({ target, onRemove }) {
  return (
    <Surface className="trend-card">
      <div className="between">
        <h3 className="trend-card__title"><span className="task__number">{target.priority}</span> {target.name}</h3>
        <Badge text={`Prioridad ${target.priorityScore}/100`} intent={target.priority === 1 ? 'accent' : 'neutral'} variant={VARIANT} />
      </div>
      {target.audience && <div className="muted small">{target.audience}</div>}
      {target.studies.length === 0 ? (
        <Alert className="wide" intent="warning" dismissible={false} variant={VARIANT} title="Sin estudio" message="Este target no tiene keywords estudiadas: no se puede comparar con los demás." />
      ) : (
        <>
          <dl className="facts">
            <div><dt>Búsquedas/mes</dt><dd>{formatCompact(target.totals.volume)}</dd></div>
            <div><dt>Victorias rápidas</dt><dd>{target.quickWins}</dd></div>
            <div><dt>Competencia</dt><dd>{target.avgCompetition === null ? '—' : formatPercent(target.avgCompetition)}</dd></div>
            <div><dt>CPC medio</dt><dd>{target.avgCpc === null ? '—' : formatCurrency(target.avgCpc)}</dd></div>
          </dl>
          <BarList max={100} items={[
            { label: 'Demanda', note: 'frente al mayor target', value: target.priorityParts.demand, display: `${target.priorityParts.demand}/100` },
            { label: 'Facilidad', note: 'sus 10 mejores oportunidades', value: target.priorityParts.ease, display: `${target.priorityParts.ease}/100` },
            { label: 'Valor comercial', note: 'CPC frente al mayor', value: target.priorityParts.value, display: `${target.priorityParts.value}/100` }
          ]} />
          <div className="small">
            <strong>Página de aterrizaje: </strong>
            {target.page
              ? <><a className="break" href={target.page} target="_blank" rel="noreferrer">{pathOf(target.page)}</a>{target.pageSource === 'detected' && <span className="muted"> (detectada por la URL)</span>}</>
              : target.coverage === null ? <span className="muted">audita el sitio para saberlo</span> : <Badge text="Sin página: crear" intent="warning" variant={VARIANT} />}
            {target.coverage !== null && <span className="muted"> · {target.coverage} % de sus keywords con página</span>}
          </div>
          {target.intents[0] && <div className="small"><strong>Intención dominante:</strong> {target.intents[0].label.toLowerCase()}</div>}
          <div className="label">Mejores oportunidades</div>
          <ul className="plain-list">
            {target.topOpportunities.map((entry) => <li key={entry.keyword}>{entry.keyword} <span className="muted">· {formatCompact(entry.volume)} · {entry.score}/100</span></li>)}
          </ul>
          {target.trends?.findings[0] && <div className="small muted">Tendencias: {target.trends.findings[0].title}</div>}
        </>
      )}
      <div className="actions no-print">
        {target.studies.map((study) => <Button key={study.filename} label={target.studies.length > 1 ? `Estudio: ${study.name.slice(0, 24)}` : 'Abrir su estudio'} href={studyUrl(study.filename)} size="sm" variant={VARIANT} />)}
        {target.studies[0] && !target.trends && <Button label="Consultar tendencias" href={studyUrl(target.studies[0].filename, 'tendencias')} size="sm" emphasis="secondary" variant={VARIANT} />}
        <Button label="Quitar" intent="danger" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => onRemove(target)} />
      </div>
    </Surface>
  );
}

export default function Project({ id }) {
  const notify = useNotify();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [site, setSite] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.getProject(id);
      setData(result);
      setSite(result.project.site || '');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <section className="dmx__section">
        {error ? <Alert className="wide" intent="danger" title="Error al cargar el proyecto" message={error} dismissible={false} variant={VARIANT} /> : <Loading label="Cargando el proyecto…" />}
      </section>
    );
  }

  const { project, view } = data;
  const busyMonths = view.calendar.filter((month) => month.publish.length || month.campaigns.length || month.peaks.length);
  const calendarCell = (entries) => (entries.length ? entries.map((entry) => `${entry.keyword} (${entry.target})`).join(', ') : '—');

  const auditSite = async () => {
    if (auditing) return;
    setAuditing(true);
    setError('');
    try {
      const saved = site.trim() !== (project.site || '') ? await api.updateProject(id, { site }) : data;
      setData(saved);
      const result = await api.runProjectSiteAudit(id);
      setData(result);
      notify(scoreIntent(result.project.siteAudit.score), `Sitio auditado: ${result.project.siteAudit.score}/100`, `${result.project.siteAudit.checked} URLs comprobadas`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAuditing(false);
    }
  };

  const removeTarget = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    try {
      setData(await api.removeTarget(id, target.id));
    } catch (err) {
      notify('danger', 'No se pudo quitar el target', err.message);
    }
  };

  const deleteProject = async () => {
    setPendingDelete(false);
    try {
      await api.deleteProject(id);
      notify('success', 'Proyecto eliminado', project.name);
      navigate('/');
    } catch (err) {
      notify('danger', 'No se pudo eliminar el proyecto', err.message);
    }
  };

  return (
    <>
      <section className="dmx__section dmx__section--tight study-head">
        <header className="stack">
          <div className="label"><a href="/">Proyectos</a> / {formatDate(project.createdAt)}</div>
          <h1 className="page-title">{project.name}</h1>
          <div className="actions">
            {project.client && <Badge text={project.client} intent="accent" variant={VARIANT} />}
            {project.site && <Badge text={project.site} intent="neutral" variant={VARIANT} />}
            {project.siteAudit && <Badge text={`Sitio ${project.siteAudit.score}/100`} intent={scoreIntent(project.siteAudit.score)} variant={VARIANT} />}
            <span className="no-print actions">
              <Button label="Informe (Markdown)" href={api.projectMarkdownUrl(id)} size="sm" emphasis="secondary" variant={VARIANT} />
              <Button label="Eliminar proyecto" intent="danger" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => setPendingDelete(true)} />
            </span>
          </div>
        </header>
      </section>

      {error && <section className="dmx__section dmx__section--tight"><Alert className="wide" intent="danger" title="Error" message={error} variant={VARIANT} /></section>}

      {view.targets.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <div className="stack stack--lg">
            <StatRow stats={[
              { value: formatNumber(view.totals.targets), label: 'Targets' },
              { value: formatNumber(view.totals.keywords), label: 'Keywords distintas' },
              { value: formatCompact(view.totals.volume), label: 'Búsquedas al mes' },
              { value: view.overlaps.length, label: 'Keywords repetidas' }
            ]} />
            <Surface>
              <SectionHeader className="wide" kicker="Conclusiones" title="Qué dice el conjunto" align="left" variant={VARIANT}
                subtitle="Lo que solo se ve al poner los targets uno al lado del otro: por cuál empezar, cuáles se pisan y a cuál le falta página." />
              {view.findings.map((finding) => (
                <Alert key={finding.title} className="wide" intent={LEVEL[finding.level]} title={finding.title} message={finding.text} dismissible={false} variant={VARIANT} />
              ))}
            </Surface>
          </div>
        </section>
      )}

      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <SectionHeader className="wide" kicker="Targets" title="Por orden de prioridad" align="left" variant={VARIANT}
            subtitle="Prioridad de 0 a 100: demanda (40 %), facilidad (40 %) y valor comercial (20 %), cada una relativa al mejor target del proyecto. Es una ayuda para ordenar, no una predicción." />
          {view.targets.length === 0 && <div className="muted">El proyecto aún no tiene targets. Añade el primero aquí abajo.</div>}
          <div className="trend-grid">
            {view.targets.map((target) => <TargetCard key={target.id} target={target} onRemove={setPendingRemove} />)}
          </div>
          <TargetForm projectId={id} usedStudies={view.targets.flatMap((target) => target.studies.map((study) => study.filename))} onSaved={setData} />
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <Surface>
          <SectionHeader className="wide" kicker="Sitio" title="¿Qué página atiende a cada target?" align="left" variant={VARIANT}
            subtitle="Se lee el sitemap del sitio (publicado o en desarrollo) y se cruza con las keywords de cada target. Una página compartida por dos targets no puede responder bien a los dos." />
          <div className="controls controls--wide no-print">
            <TextField label="Sitio del proyecto" placeholder="ejemplo.com o localhost:3000" value={site} onChange={setSite} variant={VARIANT} />
            <div className="actions">
              <Button label={auditing ? 'Auditando el sitio…' : project.siteAudit ? 'Volver a auditar el sitio' : 'Auditar el sitio'} loading={auditing} variant={VARIANT} onClick={auditSite} />
            </div>
          </div>
          {auditing && <Loading label="Leyendo el sitemap y comprobando las páginas…" />}
          {project.siteAudit && !auditing && (
            <div className="muted small">
              {project.siteAudit.checked} de {project.siteAudit.sitemap.total} URLs comprobadas el {formatDate(project.siteAudit.fetchedAt)} ·{' '}
              {project.siteAudit.issues.length === 0 ? 'sin problemas' : project.siteAudit.issues.map((issue) => issue.title).join(' · ')}
            </div>
          )}
          {view.pages.length > 0 && (
            <DataTable
              rowKey={(page) => page.url}
              rows={view.pages.slice(0, 40)}
              columns={[
                { key: 'path', label: 'Página', render: (page) => <a className="break" href={page.url} target="_blank" rel="noreferrer">{page.path}</a> },
                { key: 'targets', label: 'Target', render: (page) => (page.shared ? <Badge text={`Compartida: ${page.targets.map((target) => target.name).join(' + ')}`} intent="warning" variant={VARIANT} /> : page.targets[0].name) },
                { key: 'keywords', label: 'Keywords que recibe', render: (page) => page.targets.flatMap((target) => target.keywords).join(', ') }
              ]}
            />
          )}
        </Surface>
      </section>

      {view.overlaps.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <Surface>
            <SectionHeader className="wide" kicker="Solapes" title="Keywords en más de un target" align="left" variant={VARIANT}
              subtitle="Solo una página puede posicionar cada búsqueda. Se propone el target donde es keyword principal o, si no, el de mayor prioridad." />
            <DataTable
              rowKey={(entry) => entry.keyword}
              rows={view.overlaps.slice(0, 30)}
              columns={[
                { key: 'keyword', label: 'Keyword', render: (entry) => <strong>{entry.keyword}</strong> },
                { key: 'volume', label: 'Búsquedas', render: (entry) => formatNumber(entry.volume) },
                { key: 'targets', label: 'Targets', render: (entry) => entry.targets.join(', ') },
                { key: 'owner', label: 'Asignar a', render: (entry) => <Badge text={entry.suggestedOwner} intent="accent" variant={VARIANT} /> }
              ]}
            />
          </Surface>
        </section>
      )}

      {busyMonths.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <Surface>
            <SectionHeader className="wide" kicker="Calendario" title="Temporadas de todos los targets" align="left" variant={VARIANT}
              subtitle="Contenido tres meses antes del pico; campañas, uno antes. Sale de las tendencias consultadas en cada estudio." />
            <DataTable
              rowKey={(month) => month.offset}
              rows={busyMonths}
              columns={[
                { key: 'label', label: 'Mes', render: (month) => <strong>{month.label} {month.year}</strong> },
                { key: 'publish', label: 'Publicar contenido para', render: (month) => calendarCell(month.publish) },
                { key: 'campaigns', label: 'Arrancar campaña de', render: (month) => calendarCell(month.campaigns) },
                { key: 'peaks', label: 'En temporada alta', render: (month) => calendarCell(month.peaks) }
              ]}
            />
          </Surface>
        </section>
      )}

      {view.plan.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <Surface>
            <SectionHeader className="wide" kicker="Plan de acción" title="Qué hacer y en qué orden" align="left" variant={VARIANT}
              subtitle="Primero lo que afecta a todo el sitio y a la estructura entre targets; después, lo de más impacto de cada target, empezando por el prioritario." />
            <ol className="issues">
              {view.plan.map((task) => (
                <li key={`${task.priority}-${task.title}`} className="issue">
                  <div className="between">
                    <strong>{task.priority}. {task.title}</strong>
                    <span className="actions">
                      {task.target && <Badge text={task.target} intent="neutral" variant={VARIANT} />}
                      <Badge text={`${task.area} · impacto ${task.impact}`} intent={IMPACT_INTENT[task.impact]} variant={VARIANT} />
                    </span>
                  </div>
                  <div className="small"><strong>Por qué:</strong> {task.why}</div>
                  <div className="small"><strong>Cómo:</strong> {task.how}</div>
                </li>
              ))}
            </ol>
          </Surface>
        </section>
      )}

      <Modal open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)} title="¿Quitar este target?"
        body={`«${pendingRemove?.name ?? ''}» saldrá del proyecto. Sus estudios se conservan.`} confirmLabel="Sí, quitar" cancelLabel="Cancelar" intent="danger" variant={VARIANT} onConfirm={removeTarget} />
      <Modal open={pendingDelete} onOpenChange={(open) => !open && setPendingDelete(false)} title="¿Eliminar el proyecto?"
        body={`Se borrará «${project.name}». Los estudios de sus targets se conservan.`} confirmLabel="Sí, eliminar" cancelLabel="Cancelar" intent="danger" variant={VARIANT} onConfirm={deleteProject} />
    </>
  );
}
