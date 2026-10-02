import { useState } from 'react';
import { Alert, Button, CodeBlock, SectionHeader, TextField } from 'trama-ui';
import { Surface, useNotify, VARIANT } from '../../components/ui.jsx';
import * as api from '../../lib/api.js';

const SECTIONS = [
  ['Resumen ejecutivo', 'Cifras del estudio, punto de partida del sitio y conclusiones con su dato.'],
  ['Plan de acción', 'Tareas priorizadas por impacto y esfuerzo, con el porqué y el cómo de cada una.'],
  ['Oportunidades', 'Matriz de demanda frente a competencia, ranking y victorias rápidas.'],
  ['Intención y temas', 'Qué quiere quien busca y en qué temas se agrupan las keywords.'],
  ['Briefs de contenido', 'Enfoque, estructura y keywords de la página de cada keyword principal.'],
  ['Auditorías', 'Cada página y texto revisado, con su nota y lo que hay que corregir.'],
  ['Metodología', 'De dónde salen los datos y cómo leer cada cifra.']
];

export default function ReportTab({ filename, study, setStudy, plan }) {
  const notify = useNotify();
  const [form, setForm] = useState({
    name: study.name, client: study.client, site: study.site, author: study.author, accent: study.accent || '', notes: study.notes
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = Object.keys(form).some((key) => (form[key] || '') !== (study[key] || ''));
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await api.updateStudy(filename, form);
      setStudy(saved);
      setForm({ name: saved.name, client: saved.client, site: saved.site, author: saved.author, accent: saved.accent || '', notes: saved.notes });
      notify('success', 'Ficha guardada', 'Los cambios salen en el informe.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const auditCount = study.audits.length + study.pageAudits.length;

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <form className={`ui-surface ui-s ui-s--${VARIANT} surface`} onSubmit={save} noValidate>
            <SectionHeader className="wide" kicker="Ficha del estudio" title="Datos del informe" subtitle="Salen en la portada y el pie del informe. El dominio permite además consultar el tráfico del sitio." align="left" variant={VARIANT} />
            <TextField label="Nombre del estudio" placeholder="Estudio SEO tienda online" value={form.name} onChange={set('name')} variant={VARIANT} />
            <div className="controls">
              <TextField label="Cliente" placeholder="Nombre del cliente" value={form.client} onChange={set('client')} variant={VARIANT} />
              <TextField label="Sitio web" placeholder="ejemplo.com o localhost:3000" value={form.site} onChange={set('site')} variant={VARIANT} />
            </div>
            <div className="controls">
              <TextField label="Elaborado por" placeholder="Tu nombre o agencia" value={form.author} onChange={set('author')} variant={VARIANT} />
              <TextField label="Color de marca del PDF" placeholder="#d0201c" hint="Opcional, en formato #rrggbb." value={form.accent} onChange={set('accent')} variant={VARIANT} />
            </div>
            <TextField label="Notas para el cliente (opcional)" placeholder="Contexto, alcance o advertencias que deban constar en el resumen" multiline rows={3} value={form.notes} onChange={set('notes')} variant={VARIANT} />
            {error && <Alert className="wide" intent="danger" title="No se pudo guardar" message={error} variant={VARIANT} />}
            <div className="actions">
              <Button type="submit" label={saving ? 'Guardando…' : 'Guardar ficha'} loading={saving} disabled={!dirty} variant={VARIANT} />
              {dirty && <span className="muted small">Hay cambios sin guardar: el informe usa lo guardado.</span>}
            </div>
          </form>

          <Surface>
            <SectionHeader className="wide" kicker="Entregables" title="Descargar" subtitle="El informe se genera con los datos guardados en este momento." align="left" variant={VARIANT} />
            <div className="downloads">
              <div>
                <Button label="Informe PDF" href={api.pdfUrl(filename)} glyph="icon:download" glyphPosition="start" variant={VARIANT} />
                <div className="muted small">Para el cliente: maquetado, con portada, gráficos y plan de acción.</div>
              </div>
              <div>
                <Button label="Informe Markdown" href={api.markdownUrl(filename)} glyph="icon:download" glyphPosition="start" emphasis="secondary" variant={VARIANT} />
                <div className="muted small">El mismo contenido en texto: para Notion, un gestor de tareas o un agente de IA.</div>
              </div>
              <div>
                <Button label="Keywords CSV" href={api.keywordsCsvUrl(filename)} glyph="icon:download" glyphPosition="start" emphasis="secondary" variant={VARIANT} />
                <div className="muted small">Todas las keywords con tipo, intención y puntuación, para hoja de cálculo.</div>
              </div>
              <div>
                <Button label="Datos JSON" href={api.jsonUrl(filename)} glyph="icon:download" glyphPosition="start" emphasis="ghost" variant={VARIANT} />
                <div className="muted small">Los datos en crudo del estudio.</div>
              </div>
            </div>
          </Surface>
        </div>
      </section>

      <section className="dmx__section dmx__section--tight">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <Surface title="Qué incluye el informe">
            <ol className="steps steps--numbered">
              {SECTIONS.map(([title, text]) => (
                <li key={title} className="small"><strong>{title}.</strong> <span className="muted">{text}</span></li>
              ))}
            </ol>
            <div className="muted small">
              Ahora mismo: {plan.length} tareas en el plan y {auditCount} auditorías guardadas
              {auditCount === 0 ? ' (la sección de auditorías no saldrá hasta que guardes alguna).' : '.'}
            </div>
          </Surface>

          <Surface title="Desde terminal o un agente">
            <div className="muted small">Lo mismo que hace esta pantalla, sin interfaz. Sirve para automatizar entregas o para que un agente de IA trabaje el estudio.</div>
            <CodeBlock className="wide" language="bash" filename="terminal" showLineNumbers={false} variant={VARIANT}
              code={[`seo report ${filename} --format pdf --out informe.pdf`, `seo plan ${filename}`, `seo brief ${filename} "keyword"`, 'seo mcp   # servidor MCP para agentes'].join('\n')} />
            <div><Button label="Guía de uso" href="/guia" size="sm" emphasis="ghost" glyph="icon:arrow-right" variant={VARIANT} /></div>
          </Surface>
        </div>
      </section>
    </>
  );
}
