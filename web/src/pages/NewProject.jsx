import { useState } from 'react';
import { Alert, Button, SectionHeader, TextField } from 'trama-ui';
import { VARIANT } from '../components/ui.jsx';
import * as api from '../lib/api.js';
import { navigate, projectUrl } from '../lib/router.js';

export default function NewProject() {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Ponle nombre al proyecto.');
    setBusy(true);
    setError('');
    try {
      const project = await api.createProject({ name, client, site });
      navigate(projectUrl(project.id));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="dmx__section dmx__section--tight">
      <form className={`ui-surface ui-s ui-s--${VARIANT} dmx__access`} onSubmit={submit} noValidate>
        <SectionHeader className="wide" kicker="Nuevo proyecto" title="Un sitio, varios públicos" align="left" variant={VARIANT}
          subtitle="Para una web de servicios, una tienda con varias categorías o cualquier sitio que se dirige a más de un tipo de cliente. Cada público es un target con su propio estudio; el proyecto los compara, detecta dónde se pisan y dice qué página atiende a cada uno." />
        <div className="controls">
          <TextField label="Nombre del proyecto" placeholder="Web de servicios 2026" value={name} onChange={setName} variant={VARIANT} />
          <TextField label="Cliente (opcional)" placeholder="Nombre del cliente" value={client} onChange={setClient} variant={VARIANT} />
          <TextField label="Sitio (opcional)" placeholder="ejemplo.com o localhost:3000" hint="Publicado o en desarrollo. Se puede indicar después." value={site} onChange={setSite} variant={VARIANT} />
        </div>
        {error && <Alert className="wide" intent="danger" title="No se pudo crear el proyecto" message={error} variant={VARIANT} />}
        <div className="dmx__access-actions">
          <Button label="Cancelar" href="/" emphasis="ghost" variant={VARIANT} />
          <Button type="submit" label={busy ? 'Creando…' : 'Crear proyecto'} glyph="icon:arrow-right" loading={busy} variant={VARIANT} />
        </div>
      </form>
    </section>
  );
}
