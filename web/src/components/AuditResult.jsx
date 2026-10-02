import { Alert, Badge, Progress } from 'trama-ui';
import { StatRow, VARIANT } from './ui.jsx';
import { formatNumber } from '../lib/format.js';

const STATUS = {
  fail: { label: 'Falla', intent: 'danger', order: 0 },
  warn: { label: 'Mejorable', intent: 'warning', order: 1 },
  skip: { label: 'Sin evaluar', intent: 'neutral', order: 2 },
  ok: { label: 'Correcto', intent: 'success', order: 3 }
};
const TERMS_SHOWN = 40;

export const scoreIntent = (score) => (score >= 80 ? 'success' : score >= 60 ? 'info' : score >= 40 ? 'warning' : 'danger');

// Comprobaciones agrupadas; dentro de cada grupo, primero lo que hay que arreglar
export function Checks({ checks }) {
  const groups = [...new Set(checks.map((check) => check.group))];
  return (
    <div className="stack">
      {groups.map((group) => (
        <div key={group} className="stack">
          <div className="label">{group}</div>
          <ul className="checks">
            {checks.filter((check) => check.group === group)
              .sort((a, b) => STATUS[a.status].order - STATUS[b.status].order)
              .map((check) => (
                <li key={check.id} className="check">
                  <Badge text={STATUS[check.status].label} intent={STATUS[check.status].intent} dot variant={VARIANT} />
                  <div>
                    <strong>{check.label}</strong>
                    <div className="muted small">{check.detail}</div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Terms({ title, terms, intent, empty }) {
  return (
    <div className="stack">
      <div className="label">{title} ({terms.length})</div>
      {terms.length === 0 ? (
        <div className="muted small">{empty}</div>
      ) : (
        <div className="actions">
          {terms.slice(0, TERMS_SHOWN).map((term) => <Badge key={term} text={term} intent={intent} variant={VARIANT} />)}
          {terms.length > TERMS_SHOWN && <span className="muted small">y {terms.length - TERMS_SHOWN} más</span>}
        </div>
      )}
    </div>
  );
}

// Resultado de una auditoría de texto o de página: nota, cifras, resumen y comprobaciones
export function AuditResult({ result, context }) {
  const count = (status) => result.checks.filter((check) => check.status === status).length;
  const stats = [
    { value: formatNumber(result.stats.words), label: 'Palabras' },
    { value: `${String(result.stats.keywordDensity).replace('.', ',')} %`, label: 'Densidad de keyword' },
    { value: result.stats.readability === null ? '—' : `${result.stats.readability}/100`, label: 'Legibilidad' }
  ];
  if (result.stats.responseMs !== undefined) stats.push({ value: `${formatNumber(result.stats.responseMs)} ms`, label: 'Respuesta del servidor' });

  return (
    <div className="stack">
      <Progress className="wide" label={`Nota: ${result.score}/100 · ${result.verdict}`} value={result.score} variant={VARIANT} />
      <StatRow stats={stats} />
      <Alert className="wide" intent={scoreIntent(result.score)} dismissible={false} variant={VARIANT}
        title={`${count('fail')} fallos y ${count('warn')} puntos mejorables`}
        message={context} />
      <Checks checks={result.checks} />
    </div>
  );
}
