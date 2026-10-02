import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Modal, SectionHeader, Select, TextField } from 'trama-ui';
import { AuditResult, scoreIntent } from '../../components/AuditResult.jsx';
import DataTable from '../../components/DataTable.jsx';
import { Loading, Surface, useNotify, VARIANT } from '../../components/ui.jsx';
import * as api from '../../lib/api.js';
import { cell, formatDate } from '../../lib/format.js';
import { isLocalSite, siteOrigin } from '../../../../shared/site.js';

const NO_KEYWORD = 'Sin keyword (solo técnica y estructura)';

// Mapa de keywords: qué URL del sitemap del cliente corresponde a cada keyword del estudio
function KeywordMap({ filename, study, onAudit }) {
  const [state, setState] = useState({ loading: false, error: '', result: null });

  const load = async (refresh) => {
    setState({ loading: true, error: '', result: state.result });
    try {
      setState({ loading: false, error: '', result: await api.getKeywordMap(filename, refresh) });
    } catch (err) {
      setState({ loading: false, error: err.message, result: null });
    }
  };

  // si el sitemap ya se leyó en otra sesión, el mapa se muestra sin pedirlo
  useEffect(() => {
    if (study.siteUrls) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);

  const result = state.result;
  const gaps = result ? result.map.filter((entry) => !entry.url).length : 0;

  return (
    <section className="dmx__section dmx__section--tight">
      <Surface>
        <div className="between">
          <SectionHeader kicker="Mapa de keywords" title="¿Qué página cubre cada keyword?" align="left" variant={VARIANT}
            subtitle="Cruza las keywords principales y las mejores oportunidades con las URLs del sitemap del cliente. Sin página es un hueco de contenido; varias páginas iguales, una posible canibalización." />
          {study.site && (
            <Button className="no-print" label={state.loading ? 'Leyendo sitemap…' : result ? 'Volver a leer el sitemap' : `Leer el sitemap de ${study.site}`}
              size="sm" emphasis={result ? 'ghost' : 'primary'} loading={state.loading} variant={VARIANT} onClick={() => load(true)} />
          )}
        </div>

        {!study.site && <div className="muted">Indica el sitio web del cliente en la pestaña «Informe» para poder leer su sitemap.</div>}
        {state.error && <Alert className="wide" intent="danger" title="No se pudo leer el sitemap" message={state.error} variant={VARIANT} />}

        {result && (
          <>
            <div className="actions">
              <Badge text={`${result.urlCount} URLs en el sitemap`} intent="neutral" variant={VARIANT} />
              <Badge text={`${result.map.length - gaps} keywords con página`} intent="success" variant={VARIANT} />
              <Badge text={`${gaps} sin página`} intent={gaps > 0 ? 'warning' : 'neutral'} variant={VARIANT} />
            </div>
            <DataTable
              rowKey={(entry) => entry.keyword}
              rows={result.map}
              columns={[
                { key: 'keyword', label: 'Keyword', render: (entry) => <strong>{entry.keyword}</strong> },
                {
                  key: 'url', label: 'Página del sitio',
                  render: (entry) => (entry.url
                    ? <a className="break" href={entry.url} target="_blank" rel="noreferrer">{entry.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</a>
                    : <Badge text="Sin página: crear" intent="warning" variant={VARIANT} />)
                },
                {
                  key: 'notes', label: 'Observación',
                  render: (entry) => (!entry.url ? 'Hueco de contenido'
                    : entry.alternatives.length > 0 ? `Compite con ${entry.alternatives.length} más`
                      : entry.coverage < 1 ? 'Coincidencia parcial' : 'Página propia')
                },
                {
                  key: 'action', label: '',
                  render: (entry) => entry.url && <Button label="Auditar" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => onAudit(entry.url, entry.keyword)} />
                }
              ]}
            />
            <div className="muted small">
              La correspondencia se hace por las palabras de la URL. Leído el {formatDate(result.fetchedAt)}; se usan como mucho 500 URLs del sitemap.
            </div>
          </>
        )}
      </Surface>
    </section>
  );
}

const SEVERITY_INTENT = { alta: 'danger', media: 'warning', baja: 'neutral' };
const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/';

// Auditoría del sitio entero por su sitemap: qué se repite en muchas páginas. Vale para un sitio en desarrollo.
function SiteAudit({ filename, study, setStudy, onAudit }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openIssue, setOpenIssue] = useState(null);
  const audit = study.siteAudit;
  const local = isLocalSite(study.site);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.runSiteAudit(filename);
      setStudy(next);
      notify(scoreIntent(next.siteAudit.score), `Sitio auditado: ${next.siteAudit.score}/100`, `${next.siteAudit.checked} URLs del sitemap comprobadas`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dmx__section dmx__section--tight">
      <Surface>
        <div className="between">
          <SectionHeader kicker="Auditoría de sitio" title="¿Qué se repite en todo el sitio?" align="left" variant={VARIANT}
            subtitle="Lee el sitemap (el de robots.txt o /sitemap.xml), descarga hasta 40 de sus URLs y agrupa los problemas: páginas rotas, redirecciones, noindex, canónicas, títulos y descripciones repetidos, H1, contenido escaso y páginas vacías sin JavaScript." />
          {study.site && (
            <Button className="no-print" label={busy ? 'Auditando el sitio…' : audit ? 'Volver a auditar el sitio' : `Auditar ${study.site}`}
              size="sm" emphasis={audit ? 'ghost' : 'primary'} loading={busy} variant={VARIANT} onClick={run} />
          )}
        </div>

        {!study.site && <div className="muted">Indica el sitio en la pestaña «Informe»: un dominio (ejemplo.com) o un sitio en desarrollo (localhost:3000, 192.168.1.20:8080).</div>}
        {study.site && local && !audit && (
          <div className="muted small">Sitio en desarrollo: se audita desde el equipo donde corre SEO App, así que «localhost» es ese equipo. Las URLs del sitemap con el dominio de producción se comprueban en local por la misma ruta.</div>
        )}
        {busy && <Loading label="Leyendo el sitemap y comprobando las páginas…" />}
        {error && <Alert className="wide" intent="danger" title="No se pudo auditar el sitio" message={error} variant={VARIANT} />}

        {audit && !busy && (
          <>
            <div className="actions">
              <Badge text={`${audit.score}/100`} intent={scoreIntent(audit.score)} variant={VARIANT} />
              {audit.changes && audit.changes.scoreDelta !== 0 && (
                <Badge text={`${audit.changes.scoreDelta > 0 ? '+' : ''}${audit.changes.scoreDelta}`} intent={audit.changes.scoreDelta > 0 ? 'success' : 'danger'} variant={VARIANT} />
              )}
              {audit.environment === 'local' && <Badge text="Local" intent="info" variant={VARIANT} />}
              <Badge text={`${audit.sitemap.total} URLs en el sitemap`} intent="neutral" variant={VARIANT} />
              <Badge text={`${audit.checked} comprobadas`} intent="neutral" variant={VARIANT} />
              <span className="muted small">{formatDate(audit.fetchedAt)}</span>
            </div>
            <div className="muted small break">
              {audit.sitemap.sources.map((source) => `${source.url} (${source.type === 'urls' ? `${source.entries} URLs` : `índice de ${source.entries}`})`).join(' · ')}
              . La nota es el porcentaje de páginas comprobadas sin problemas graves o medios.
            </div>

            {audit.changes && (
              <Alert className="wide" dismissible={false} variant={VARIANT}
                intent={audit.changes.appeared.length + audit.changes.grown.length > 0 ? 'warning' : audit.changes.fixed.length + audit.changes.reduced.length > 0 ? 'success' : 'neutral'}
                title={`Respecto a la pasada anterior: ${audit.changes.previousScore} → ${audit.score}`}
                message={[
                  audit.changes.fixed.length > 0 ? `Resuelto: ${audit.changes.fixed.join('; ')}.` : '',
                  audit.changes.reduced.length > 0 ? `Mejora: ${audit.changes.reduced.join('; ')}.` : '',
                  audit.changes.appeared.length > 0 ? `Nuevo: ${audit.changes.appeared.join('; ')}.` : '',
                  audit.changes.grown.length > 0 ? `Empeora: ${audit.changes.grown.join('; ')}.` : '',
                  audit.changes.fixed.length + audit.changes.reduced.length + audit.changes.appeared.length + audit.changes.grown.length === 0 ? 'Los mismos problemas que antes.' : ''
                ].filter(Boolean).join(' ')} />
            )}
            {audit.sitemap.issues.length > 0 && (
              <Alert className="wide" intent="info" dismissible={false} variant={VARIANT} title="Sobre el sitemap" message={audit.sitemap.issues.join(' ')} />
            )}

            {audit.issues.length === 0 ? (
              <Alert className="wide" intent="success" dismissible={false} variant={VARIANT} title="Sin problemas" message="Ninguna de las páginas comprobadas tiene los problemas que busca esta auditoría." />
            ) : (
              <ul className="issues">
                {audit.issues.map((issue) => (
                  <li key={issue.id} className="issue">
                    <div className="between">
                      <strong>{issue.title}</strong>
                      <Badge text={`Gravedad ${issue.severity}`} intent={SEVERITY_INTENT[issue.severity]} variant={VARIANT} />
                    </div>
                    <div className="small">{issue.why}</div>
                    <div className="small"><strong>Cómo:</strong> {issue.fix}</div>
                    <ul className="plain-list small">
                      {(openIssue === issue.id ? issue.urls : issue.urls.slice(0, 4)).map((url) => (
                        <li key={url} className="issue__url">
                          <a className="break" href={url} target="_blank" rel="noreferrer">{pathOf(url)}</a>
                          <button type="button" className="link-button no-print" onClick={() => onAudit(url)}>auditar</button>
                        </li>
                      ))}
                    </ul>
                    {issue.urls.length > 4 && openIssue !== issue.id && (
                      <div><button type="button" className="link-button no-print" onClick={() => setOpenIssue(issue.id)}>ver {issue.count > issue.urls.length ? `${issue.urls.length} de las ${issue.count}` : `las ${issue.count}`}</button></div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <details className="details">
              <summary>Las {audit.pages.length} páginas comprobadas</summary>
              <DataTable
                rowKey={(page) => page.url}
                rows={audit.pages}
                columns={[
                  { key: 'url', label: 'Página', render: (page) => <a className="break" href={page.url} target="_blank" rel="noreferrer">{pathOf(page.url)}</a> },
                  { key: 'status', label: 'Estado', render: (page) => (page.status === 200 ? '200' : <Badge text={String(page.status || 'sin respuesta')} intent="danger" variant={VARIANT} />) },
                  { key: 'title', label: 'Título', render: (page) => page.title || <span className="muted">—</span> },
                  { key: 'words', label: 'Palabras', render: (page) => page.words ?? '—' },
                  { key: 'h1', label: 'H1', render: (page) => page.h1 ?? '—' },
                  { key: 'ms', label: 'ms', render: (page) => page.ms ?? '—' }
                ]}
              />
            </details>
          </>
        )}
      </Surface>
    </section>
  );
}

export default function PageAudits({ filename, report, study, setStudy }) {
  const notify = useNotify();
  const [url, setUrl] = useState(study.site ? `${siteOrigin(study.site)}/` : '');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(study.pageAudits[0]?.id || null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // `Select` de trama-ui separa las opciones por comas: las keywords se muestran sin ellas
  const options = useMemo(() => new Map([...report.map((item) => [cell(item.keyword), item.keyword]), [NO_KEYWORD, '']]), [report]);
  const choice = selected || [...options.keys()][0];
  const open = study.pageAudits.find((audit) => audit.id === openId) || null;

  const audit = async (target, keyword) => {
    if (busy) return;
    if (!target.trim()) return setError('Escribe la URL de la página.');
    setBusy(true);
    setError('');
    try {
      const response = await api.savePageAudit(filename, { url: target.trim(), keyword });
      setStudy({ ...study, pageAudits: response.pageAudits });
      setOpenId(response.audit.id);
      notify(scoreIntent(response.audit.result.score), `Página auditada: ${response.audit.result.score}/100`, response.audit.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const run = (event) => {
    event.preventDefault();
    audit(url, options.get(choice));
  };
  const reaudit = (saved) => audit(saved.url, saved.keyword);

  const confirmDelete = async () => {
    const audit = pendingDelete;
    setPendingDelete(null);
    try {
      const response = await api.deleteAudit(filename, audit.id);
      setStudy({ ...study, audits: response.audits, pageAudits: response.pageAudits });
      if (openId === audit.id) setOpenId(response.pageAudits[0]?.id || null);
    } catch (err) {
      notify('danger', 'No se pudo eliminar la auditoría', err.message);
    }
  };

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <form className={`ui-surface ui-s ui-s--${VARIANT} surface`} onSubmit={run} noValidate>
          <SectionHeader className="wide" kicker="Auditoría web" title="¿Está la página lista para posicionar?" align="left" variant={VARIANT}
            subtitle="Descarga una página y revisa lo que se puede comprobar desde fuera: respuesta del servidor, indexabilidad, título y meta, encabezados, contenido frente a la keyword, datos estructurados, enlaces internos, robots.txt, sitemap y acceso de los rastreadores de IA. Vale una web publicada o una en desarrollo (http://localhost:3000/pagina)." />
          <div className="controls controls--wide">
            <TextField label="URL de la página" placeholder="https://ejemplo.com/pagina o http://localhost:3000/pagina" value={url} onChange={setUrl} variant={VARIANT} />
            <Select label="Keyword que debería posicionar" options={[...options.keys()].join(', ')} value={choice} onChange={setSelected} variant={VARIANT} />
          </div>
          {error && <Alert className="wide" intent="danger" title="No se pudo auditar la página" message={error} variant={VARIANT} />}
          <div className="actions">
            <Button type="submit" label={busy ? 'Auditando…' : 'Auditar página'} glyph="icon:search" glyphPosition="start" loading={busy} variant={VARIANT} />
            <span className="muted small">No mide Core Web Vitals ni enlaces entrantes: para eso, PageSpeed Insights y Search Console.</span>
          </div>
        </form>
      </section>

      {busy && <section className="dmx__section dmx__section--tight"><Loading label="Descargando y analizando la página…" /></section>}

      {study.pageAudits.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <div className="dmx__grid-2 dmx__grid-2--side">
            <div className="stack">
              <div className="label">Páginas auditadas ({study.pageAudits.length})</div>
              {study.pageAudits.map((audit) => (
                <div key={audit.id} className={`ui-surface ui-s ui-s--${VARIANT} surface page-item ${audit.id === openId ? 'is-open' : ''}`}>
                  <button type="button" className="page-item__open" onClick={() => setOpenId(audit.id)} aria-pressed={audit.id === openId}>
                    <span className="break">{audit.url.replace(/^https?:\/\//, '')}</span>
                  </button>
                  <div className="actions">
                    <Badge text={`${audit.result.score}/100`} intent={scoreIntent(audit.result.score)} variant={VARIANT} />
                    {audit.changes && audit.changes.scoreDelta !== 0 && (
                      <Badge text={`${audit.changes.scoreDelta > 0 ? '+' : ''}${audit.changes.scoreDelta}`} intent={audit.changes.scoreDelta > 0 ? 'success' : 'danger'} variant={VARIANT} />
                    )}
                    {audit.result.environment === 'local' && <Badge text="Local" intent="info" variant={VARIANT} />}
                    {audit.keyword && <Badge text={audit.keyword} intent="neutral" variant={VARIANT} />}
                  </div>
                  <div className="label">{formatDate(audit.createdAt)}</div>
                  <div className="actions">
                    <Button label="Volver a auditar" size="sm" emphasis="secondary" disabled={busy} variant={VARIANT} onClick={() => reaudit(audit)} />
                    <Button label="Eliminar" intent="danger" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => setPendingDelete(audit)} />
                  </div>
                </div>
              ))}
            </div>

            {open && (
              <Surface>
                <SectionHeader className="wide" kicker={open.keyword ? `Keyword: ${open.keyword}` : 'Sin keyword objetivo'} title={`${open.result.score}/100`} subtitle={open.result.title || open.url} align="left" variant={VARIANT} />
                <div className="muted small break"><a href={open.url} target="_blank" rel="noreferrer">{open.url}</a></div>
                {open.result.environment === 'local' && (
                  <Alert className="wide" intent="info" dismissible={false} variant={VARIANT} title="Entorno de desarrollo"
                    message="No se evalúan HTTPS ni el tiempo de respuesta, y una canónica que apunte a la misma ruta en producción se da por buena. Vuelve a auditar la URL pública cuando se despliegue." />
                )}
                {open.changes && (
                  <Alert className="wide" dismissible={false} variant={VARIANT}
                    intent={open.changes.worsened.length > 0 ? 'warning' : open.changes.improved.length > 0 ? 'success' : 'neutral'}
                    title={`Respecto a la auditoría anterior: ${open.changes.previousScore} → ${open.result.score} (${open.changes.scoreDelta >= 0 ? '+' : ''}${open.changes.scoreDelta})`}
                    message={[
                      open.changes.improved.length > 0 ? `Mejora: ${open.changes.improved.join(', ')}.` : '',
                      open.changes.worsened.length > 0 ? `Empeora: ${open.changes.worsened.join(', ')}.` : '',
                      open.changes.improved.length + open.changes.worsened.length === 0 ? 'Ninguna comprobación ha cambiado de estado.' : ''
                    ].filter(Boolean).join(' ')} />
                )}
                <AuditResult result={open.result}
                  context={`${open.result.stats.internalLinks} enlaces internos · datos estructurados: ${open.result.stats.schemaTypes.join(', ') || 'ninguno'}. Lo que falla aquí genera tareas en el plan de acción.`} />
              </Surface>
            )}
          </div>
        </section>
      )}

      <SiteAudit filename={filename} study={study} setStudy={setStudy} onAudit={(pageUrl) => {
        setUrl(pageUrl);
        setSelected(NO_KEYWORD);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />

      <KeywordMap filename={filename} study={study} onAudit={(pageUrl, keyword) => {
        setUrl(pageUrl);
        const label = [...options.entries()].find(([, value]) => value === keyword)?.[0];
        setSelected(label || NO_KEYWORD);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />

      {study.pageAudits.length === 0 && !busy && (
        <section className="dmx__section dmx__section--tight">
          <div className="muted">Aún no se ha auditado ninguna página. Empieza por la portada y por la página que debería posicionar cada keyword principal.</div>
        </section>
      )}

      <Modal
        open={pendingDelete !== null}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title="¿Eliminar esta auditoría?"
        body={`${pendingDelete?.url ?? ''} dejará de aparecer en el estudio y en el informe.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        intent="danger"
        variant={VARIANT}
        onConfirm={confirmDelete}
      />
    </>
  );
}
