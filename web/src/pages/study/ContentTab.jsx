import { useDeferredValue, useMemo, useState } from 'react';
import { Badge, Button, Modal, Prose, SectionHeader, Select, TextField } from 'trama-ui';
import { buildBrief, briefToMarkdown } from '../../../../shared/brief.js';
import { analyzeContent, LIMITS, relatedKeywordsFor } from '../../../../shared/contentAnalysis.js';
import { AuditResult, scoreIntent, Terms } from '../../components/AuditResult.jsx';
import { Surface, useNotify, VARIANT } from '../../components/ui.jsx';
import * as api from '../../lib/api.js';
import { cell, formatDate, formatNumber } from '../../lib/format.js';

const OTHER_KEYWORD = 'Otra keyword…';

async function copy(text, notify, label) {
  try {
    await navigator.clipboard.writeText(text);
    notify('success', `${label} copiado al portapapeles`);
  } catch {
    notify('danger', 'No se pudo copiar', 'El navegador no permite escribir en el portapapeles.');
  }
}

export default function ContentTab({ filename, report, study, setStudy }) {
  const notify = useNotify();
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  // `Select` de trama-ui separa las opciones por comas: las keywords se muestran sin ellas
  const options = useMemo(() => {
    const byLabel = new Map(report.map((item) => [cell(item.keyword), item.keyword]));
    byLabel.set(OTHER_KEYWORD, null);
    return byLabel;
  }, [report]);

  const choice = selected || [...options.keys()][0];
  const keyword = ((choice === OTHER_KEYWORD ? custom : options.get(choice)) || '').trim();
  const related = useMemo(() => relatedKeywordsFor(report, keyword), [report, keyword]);
  const language = report[0]?.language || 'es';
  const brief = useMemo(() => (keyword ? buildBrief(report, keyword) : null), [report, keyword]);
  const briefMarkdown = useMemo(() => briefToMarkdown(brief), [brief]);

  // El análisis corre con cada pulsación; diferirlo mantiene fluida la escritura en textos largos
  const deferredText = useDeferredValue(text);
  const result = useMemo(
    () => analyzeContent({ text: deferredText, keyword, title, metaDescription, relatedKeywords: related, language }),
    [deferredText, keyword, title, metaDescription, related, language]
  );
  const hasText = text.trim().length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.saveTextAudit(filename, { name, keyword, title, metaDescription, text });
      setStudy({ ...study, audits: response.audits });
      notify('success', 'Auditoría guardada en el estudio', `«${response.audit.name}» · ${response.audit.result.score}/100. Saldrá en el informe y en el plan de acción.`);
    } catch (err) {
      notify('danger', 'No se pudo guardar la auditoría', err.message);
    } finally {
      setSaving(false);
    }
  };

  const load = (audit) => {
    const label = [...options.entries()].find(([, value]) => value === audit.keyword)?.[0];
    setSelected(label || OTHER_KEYWORD);
    setCustom(label ? '' : audit.keyword);
    setName(audit.name);
    setTitle(audit.title);
    setMetaDescription(audit.metaDescription);
    setText(audit.text);
    document.getElementById('auditar-texto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const confirmDelete = async () => {
    const audit = pendingDelete;
    setPendingDelete(null);
    try {
      const response = await api.deleteAudit(filename, audit.id);
      setStudy({ ...study, audits: response.audits, pageAudits: response.pageAudits });
      notify('success', 'Auditoría eliminada', audit.name);
    } catch (err) {
      notify('danger', 'No se pudo eliminar la auditoría', err.message);
    }
  };

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <Surface>
          <SectionHeader className="wide" kicker="Paso 1 · Qué escribir" title="Brief de contenido" align="left" variant={VARIANT}
            subtitle="Elige la keyword de la página. El brief sale de los datos del estudio: intención, estructura, keywords secundarias y preguntas. Pásaselo a quien vaya a escribir, persona o agente." />
          <div className="controls">
            <Select label="Keyword objetivo" options={[...options.keys()].join(', ')} value={choice} onChange={setSelected} variant={VARIANT} />
            {choice === OTHER_KEYWORD && (
              <TextField label="Keyword" placeholder="cualquier keyword, esté o no en el estudio" prefix=">" value={custom} onChange={setCustom} variant={VARIANT} />
            )}
          </div>
          {brief ? (
            <>
              <div className="actions no-print">
                <Button label="Copiar brief (Markdown)" glyph="icon:copy" glyphPosition="start" size="sm" variant={VARIANT} onClick={() => copy(briefMarkdown, notify, 'Brief')} />
                <Badge text={`Intención ${brief.intentLabel.toLowerCase()}`} intent="accent" variant={VARIANT} />
                <Badge text={`${brief.wordCount.min}-${brief.wordCount.max} palabras`} intent="neutral" variant={VARIANT} />
                {!brief.inStudy && <Badge text="Keyword fuera del estudio: sin datos propios" intent="warning" variant={VARIANT} />}
              </div>
              <Prose className="brief" markdown={briefMarkdown} size="sm" measure="full" anchors={false} variant={VARIANT} codeVariant={VARIANT} />
            </>
          ) : (
            <div className="muted">Escribe una keyword para generar su brief.</div>
          )}
        </Surface>
      </section>

      <section className="dmx__section dmx__section--tight" id="auditar-texto">
        <div className="dmx__grid-2 dmx__grid-2--editor">
          <Surface>
            <SectionHeader className="wide" kicker="Paso 2 · Comprobar lo escrito" title="Auditar un texto" align="left" variant={VARIANT}
              subtitle={`Pega el texto en plano, Markdown o HTML. Se evalúa para «${keyword || '…'}»; con Markdown o HTML se comprueban también encabezados, enlaces e imágenes.`} />
            <TextField label="Título SEO (opcional)" placeholder="El título que verá Google" hint={title ? `${title.trim().length} caracteres · ideal ${LIMITS.titleMin}-${LIMITS.titleMax}` : ''} value={title} onChange={setTitle} variant={VARIANT} />
            <TextField label="Meta descripción (opcional)" placeholder="El resumen que aparece bajo el título en Google" multiline rows={2}
              hint={metaDescription ? `${metaDescription.trim().length} caracteres · ideal ${LIMITS.metaMin}-${LIMITS.metaMax}` : ''}
              value={metaDescription} onChange={setMetaDescription} variant={VARIANT} />
            <TextField label="Texto" placeholder={'# Título\n\nPega aquí el texto…'} multiline rows={16}
              hint={hasText ? `${formatNumber(result.stats.words)} palabras · ${result.stats.readingMinutes} min de lectura` : ''}
              value={text} onChange={setText} variant={VARIANT} />
            <TextField label="Nombre para guardarlo (opcional)" placeholder="Página de categoría, artículo…" value={name} onChange={setName} variant={VARIANT} />
            <div className="actions">
              <Button label={saving ? 'Guardando…' : 'Guardar en el estudio'} glyph="icon:save" glyphPosition="start" loading={saving} disabled={!hasText} variant={VARIANT} onClick={save} />
              <Button label="Vaciar" emphasis="ghost" disabled={!hasText && !title && !metaDescription} variant={VARIANT}
                onClick={() => { setText(''); setTitle(''); setMetaDescription(''); setName(''); }} />
            </div>
          </Surface>

          <Surface>
            <SectionHeader className="wide" kicker="Resultado" title={hasText ? `${result.score}/100` : 'Sin texto'} align="left" variant={VARIANT}
              subtitle={hasText ? result.verdict : 'La nota se calcula mientras escribes.'} />
            {hasText ? (
              <AuditResult result={result}
                context={keyword ? `Evaluado para «${keyword}» con ${related.length} keywords relacionadas del estudio.` : 'Indica una keyword objetivo para evaluar su uso en el texto.'} />
            ) : (
              <div className="muted">
                Se comprueban la extensión, el uso de la keyword, el título, la meta descripción, la estructura, las respuestas directas que citan los buscadores con IA, la legibilidad y los términos del estudio que cubre el texto.
              </div>
            )}
          </Surface>
        </div>
      </section>

      {hasText && related.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <Surface>
            <SectionHeader className="wide" kicker="Campo semántico" title="Términos del estudio" align="left" variant={VARIANT}
              subtitle={`Palabras de las ${related.length} keywords relacionadas con «${keyword}». Usar las que encajen ayuda a cubrir el tema; no hace falta meterlas todas.`} />
            <Terms title="Faltan en el texto" terms={result.related.missing} intent="warning" empty="El texto usa todos los términos relacionados." />
            <Terms title="Ya los usa" terms={result.related.used} intent="success" empty="Todavía no usa ninguno." />
          </Surface>
        </section>
      )}

      {study.audits.length > 0 && (
        <section className="dmx__section dmx__section--tight">
          <div className="stack stack--lg">
            <SectionHeader className="wide" kicker="Estudio" title="Textos guardados" subtitle="Salen en el informe y, si su nota es baja, generan tareas en el plan de acción." align="left" variant={VARIANT} />
            <div className="dmx__grid-3">
              {study.audits.map((audit) => (
                <Surface key={audit.id} title={audit.name}>
                  <div className="actions">
                    <Badge text={`${audit.result.score}/100`} intent={scoreIntent(audit.result.score)} variant={VARIANT} />
                    {audit.keyword && <Badge text={audit.keyword} intent="neutral" variant={VARIANT} />}
                    <Badge text={`${formatNumber(audit.result.stats.words)} palabras`} intent="neutral" variant={VARIANT} />
                  </div>
                  <div className="label">{formatDate(audit.createdAt)}</div>
                  <div className="actions">
                    <Button label="Abrir" size="sm" emphasis="secondary" variant={VARIANT} onClick={() => load(audit)} />
                    <Button label="Eliminar" intent="danger" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => setPendingDelete(audit)} />
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="¿Eliminar esta auditoría?"
        body={`«${pendingDelete?.name ?? ''}» dejará de aparecer en el estudio y en el informe.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        intent="danger"
        variant={VARIANT}
        onConfirm={confirmDelete}
      />
    </>
  );
}
