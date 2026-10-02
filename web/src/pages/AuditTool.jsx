import { useState } from 'react';
import { Alert, Button, SectionHeader, TextField } from 'trama-ui';
import { AuditResult } from '../components/AuditResult.jsx';
import { Loading, Surface, VARIANT } from '../components/ui.jsx';
import * as api from '../lib/api.js';

// Auditoría rápida de una URL, sin estudio: para una primera llamada con un cliente o una comprobación suelta.
export default function AuditTool() {
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!url.trim()) return setError('Escribe la URL de la página.');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.auditUrl({ url: url.trim(), keyword: keyword.trim() }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <form className={`ui-surface ui-s ui-s--${VARIANT} surface`} onSubmit={run} noValidate>
          <SectionHeader className="wide" kicker="Herramienta" title="Auditar una URL" align="left" variant={VARIANT}
            subtitle="Comprobación rápida de cualquier página, publicada o en desarrollo (http://localhost:3000/pagina), sin crear un estudio. Para guardar el resultado e incluirlo en un informe, audítala desde la pestaña «Auditoría web» de un estudio." />
          <div className="controls controls--wide">
            <TextField label="URL de la página" placeholder="https://ejemplo.com/pagina o http://localhost:3000/pagina" value={url} onChange={setUrl} variant={VARIANT} />
            <TextField label="Keyword objetivo (opcional)" placeholder="la búsqueda que debería posicionar" prefix=">" value={keyword} onChange={setKeyword} variant={VARIANT} />
          </div>
          {error && <Alert className="wide" intent="danger" title="No se pudo auditar la página" message={error} variant={VARIANT} />}
          <div className="actions">
            <Button type="submit" label={busy ? 'Auditando…' : 'Auditar'} glyph="icon:search" glyphPosition="start" loading={busy} variant={VARIANT} />
            <span className="muted small">No ejecuta JavaScript ni mide Core Web Vitals o enlaces entrantes.</span>
          </div>
        </form>
      </section>

      {busy && <section className="dmx__section dmx__section--tight"><Loading label="Descargando y analizando la página…" /></section>}

      {result && (
        <section className="dmx__section dmx__section--tight">
          <Surface>
            <SectionHeader className="wide" kicker={keyword ? `Keyword: ${keyword}` : 'Sin keyword objetivo'} title={`${result.score}/100`} subtitle={result.title || result.url} align="left" variant={VARIANT} />
            <div className="muted small break"><a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></div>
            <AuditResult result={result}
              context={`${result.stats.internalLinks} enlaces internos · datos estructurados: ${result.stats.schemaTypes.join(', ') || 'ninguno'}.`} />
          </Surface>
        </section>
      )}
    </>
  );
}
