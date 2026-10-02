import { useState } from 'react';
import { Alert, Button, SectionHeader, Select, TextField } from 'trama-ui';
import { useNotify, VARIANT } from '../components/ui.jsx';
import * as api from '../lib/api.js';
import { navigate, studyUrl } from '../lib/router.js';

// `Select` de trama-ui trabaja con las etiquetas visibles: aquí se traducen al código que espera la API
const COUNTRIES = { 'España': 'ES', 'Estados Unidos': 'US', 'México': 'MX', 'Francia': 'FR', 'Alemania': 'DE', 'Italia': 'IT', 'Reino Unido': 'GB', 'Portugal': 'PT' };
const LANGUAGES = { 'Español': 'es', 'Inglés': 'en', 'Francés': 'fr', 'Alemán': 'de', 'Italiano': 'it', 'Portugués': 'pt' };
const MAX_KEYWORDS = 25;
const SECONDS_PER_KEYWORD = 5;

export default function NewStudy() {
  const notify = useNotify();
  // /new?keywords=a, b llega desde «Tendencias» con las consultas en auge
  const [keywords, setKeywords] = useState(() => (new URLSearchParams(window.location.search).get('keywords') || '').split(',').map((keyword) => keyword.trim()).filter(Boolean).join('\n'));
  const [country, setCountry] = useState('España');
  const [language, setLanguage] = useState('Español');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // una keyword por línea o separadas por comas
  const list = [...new Set(keywords.split(/[\n,]/).map((keyword) => keyword.trim()).filter(Boolean))];
  const tooMany = list.length > MAX_KEYWORDS;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (list.length === 0) return setError('Escribe al menos una keyword.');
    if (tooMany) return setError(`Un estudio admite como máximo ${MAX_KEYWORDS} keywords.`);

    setBusy(true);
    setError('');
    try {
      const created = await api.createStudy({ keywords: list, country: COUNTRIES[country], language: LANGUAGES[language], name, client, site });
      notify('success', 'Estudio creado', `${created.study.totals.keywords} keywords estudiadas.`);
      navigate(studyUrl(created.files.json));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="dmx__section dmx__section--tight">
      <form className={`ui-surface ui-s ui-s--${VARIANT} dmx__access`} onSubmit={submit} noValidate>
        <SectionHeader
          className="wide"
          kicker="Nuevo estudio"
          title="¿Qué quieres posicionar?"
          subtitle="Escribe las keywords principales del proyecto: los productos, servicios o temas por los que el cliente quiere que lo encuentren. De cada una se sacan sugerencias de Google, preguntas, comparativas y sus datos de demanda."
          align="left"
          variant={VARIANT}
        />

        <TextField
          label="Keywords (una por línea o separadas por comas)"
          placeholder={'Ejemplo:\nzapatillas running\nzapatillas trail'}
          multiline
          rows={5}
          intent={tooMany ? 'danger' : undefined}
          hint={list.length > 0
            ? `${list.length} de ${MAX_KEYWORDS} keywords · el análisis tardará unos ${list.length * SECONDS_PER_KEYWORD} segundos`
            : `Hasta ${MAX_KEYWORDS} keywords. Mejor pocas y bien elegidas: de 2 a 6 por estudio.`}
          value={keywords}
          onChange={setKeywords}
          variant={VARIANT}
        />

        <div className="controls">
          <Select label="País" options={Object.keys(COUNTRIES).join(', ')} value={country} onChange={setCountry} variant={VARIANT} />
          <Select label="Idioma" options={Object.keys(LANGUAGES).join(', ')} value={language} onChange={setLanguage} variant={VARIANT} />
        </div>

        <div className="stack">
          <div className="label">Proyecto (opcional, se puede completar después)</div>
          <div className="controls">
            <TextField label="Nombre del estudio" placeholder="Estudio SEO tienda online" value={name} onChange={setName} variant={VARIANT} />
            <TextField label="Cliente" placeholder="Nombre del cliente" value={client} onChange={setClient} variant={VARIANT} />
            <TextField label="Sitio web del cliente" placeholder="ejemplo.com o localhost:3000" hint="Con el dominio se consulta su tráfico orgánico y se audita su sitemap. Vale un sitio en desarrollo (localhost:3000, 192.168.1.20:8080)." value={site} onChange={setSite} variant={VARIANT} />
          </div>
        </div>

        {busy && (
          <Alert className="wide" intent="info" title="Analizando…" dismissible={false} variant={VARIANT}
            message={`Se consultan las fuentes de cada keyword (unos ${list.length * SECONDS_PER_KEYWORD} segundos en total). Al terminar se abre el estudio.`} />
        )}
        {error && <Alert className="wide" intent="danger" title="No se pudo crear el estudio" message={error} variant={VARIANT} />}

        <div className="dmx__access-actions">
          <Button label="Cancelar" href="/" emphasis="ghost" variant={VARIANT} />
          <Button type="submit" label={busy ? 'Analizando…' : 'Crear estudio'} glyph="icon:arrow-right" loading={busy} variant={VARIANT} />
        </div>
      </form>
    </section>
  );
}
