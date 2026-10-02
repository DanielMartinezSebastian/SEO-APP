import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Modal, SectionHeader, Timeline } from 'trama-ui';
import { Loading, StatRow, Surface, useNotify, VARIANT } from '../components/ui.jsx';
import * as api from '../lib/api.js';
import { formatCompact, formatDate, formatNumber, truncate } from '../lib/format.js';
import { studyUrl } from '../lib/router.js';

function StudyCard({ study, onDelete }) {
  return (
    <Surface title={study.unreadable ? 'No se pudo leer el estudio' : truncate(study.name, 70)}>
      <div className="actions">
        {study.client && <Badge text={study.client} intent="accent" variant={VARIANT} />}
        {study.site && <Badge text={study.site} intent="neutral" variant={VARIANT} />}
        {study.country && <Badge text={`${study.country} · ${study.language}`} intent="neutral" variant={VARIANT} />}
        {study.errors > 0 && <Badge text={`${study.errors} errores`} intent="warning" dot variant={VARIANT} />}
      </div>
      <dl className="facts">
        <div><dt>Keywords</dt><dd>{formatNumber(study.totals.keywords)}</dd></div>
        <div><dt>Búsquedas/mes</dt><dd>{formatCompact(study.totals.volume)}</dd></div>
        <div><dt>Victorias rápidas</dt><dd>{study.totals.quickWins}</dd></div>
        <div><dt>Auditorías</dt><dd>{study.totals.audits}</dd></div>
      </dl>
      <div className="label">{formatDate(study.timestamp)}</div>
      <div className="actions">
        <Button label="Abrir" href={studyUrl(study.filename)} size="sm" variant={VARIANT} />
        <Button label="Informe" href={studyUrl(study.filename, 'informe')} size="sm" emphasis="secondary" variant={VARIANT} />
        <Button label="Eliminar" intent="danger" size="sm" emphasis="ghost" variant={VARIANT} onClick={() => onDelete(study)} />
      </div>
    </Surface>
  );
}

export default function Home() {
  const notify = useNotify();
  const [studies, setStudies] = useState(null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setStudies(await api.listStudies());
    } catch (err) {
      setError(err.message);
      setStudies([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    const study = pendingDelete;
    setPendingDelete(null);
    try {
      await api.deleteStudy(study.filename);
      notify('success', 'Estudio eliminado', study.name);
      load();
    } catch (err) {
      notify('danger', 'No se pudo eliminar el estudio', err.message);
    }
  };

  const total = (key) => (studies || []).reduce((sum, study) => sum + (study.totals?.[key] || 0), 0);

  return (
    <>
      <section className="dmx__section dmx__section--tight">
        <div className="stack stack--lg">
          <div className="between">
            <SectionHeader kicker="Panel" title="Estudios" subtitle="Cada estudio reúne las keywords de un proyecto, sus oportunidades, las auditorías y el informe para el cliente." align="left" variant={VARIANT} />
            <Button label="Nuevo estudio" href="/new" glyph="icon:plus" glyphPosition="start" variant={VARIANT} />
          </div>

          {error && <Alert className="wide" intent="danger" title="Error al cargar los estudios" message={error} dismissible={false} variant={VARIANT} />}
          {studies === null && <Loading label="Cargando estudios…" />}

          {studies?.length > 0 && (
            <>
              <StatRow
                stats={[
                  { value: formatNumber(studies.length), label: 'Estudios' },
                  { value: formatNumber(total('keywords')), label: 'Keywords estudiadas' },
                  { value: formatNumber(total('quickWins')), label: 'Victorias rápidas' },
                  { value: formatNumber(total('audits')), label: 'Auditorías' }
                ]}
              />
              <div className="dmx__grid-3">
                {studies.map((study) => <StudyCard key={study.filename} study={study} onDelete={setPendingDelete} />)}
              </div>
            </>
          )}

          {studies?.length === 0 && !error && (
            <Surface>
              <SectionHeader className="wide" kicker="Primeros pasos" title="Aún no hay estudios" subtitle="Un estudio se hace en tres pasos y termina en un informe que puedes entregar." align="left" variant={VARIANT} />
              <Timeline
                className="wide"
                variant={VARIANT}
                steps={[
                  'Crea el estudio|Escribe las keywords del proyecto y, si lo tienes, el dominio del cliente. La app saca sugerencias, preguntas, comparativas y los datos de demanda de todas.',
                  'Decide por dónde ir|Oportunidades ordenadas por puntuación, temas en los que se agrupan y un plan de acción priorizado.',
                  'Audita y entrega|Audita las páginas del cliente y los textos, genera el brief de cada keyword y descarga el informe en PDF.'
                ].join('\n')}
              />
              <div><Button label="Crear el primer estudio" href="/new" glyph="icon:arrow-right" variant={VARIANT} /></div>
            </Surface>
          )}
        </div>
      </section>

      <Modal
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="¿Eliminar este estudio?"
        body={`Se borrarán «${pendingDelete?.name ?? ''}», sus auditorías y sus archivos. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        intent="danger"
        variant={VARIANT}
        onConfirm={confirmDelete}
      />
    </>
  );
}
