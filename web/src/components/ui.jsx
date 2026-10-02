import { createContext, useCallback, useContext, useState } from 'react';
import { Spinner, Toast } from 'trama-ui';

// Estilo visual de trama-ui que usa toda la app: el de la landing de referencia «SIGNAL · dot matrix»
export const VARIANT = 'dotmatrix';

// `Panel` de trama-ui solo admite texto; esta superficie usa las clases del kit para envolver contenido propio.
export function Surface({ title, actions, children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`ui-surface ui-s ui-s--${VARIANT} surface ${className}`} {...rest}>
      {(title || actions) && (
        <div className="surface__head">
          {title && <h3 className="surface__title">{title}</h3>}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Loading({ label }) {
  return (
    <div className="center">
      <Spinner kind="braille" label={label} variant={VARIANT} />
    </div>
  );
}

// Cifras de resumen. `StatsSection` de trama-ui las dibuja en una fuente bitmap de caracteres que cuesta
// leer con decimales y unidades, así que aquí van en la tipografía del cuerpo, grandes.
export function StatRow({ stats }) {
  return (
    <dl className="stat-row">
      {stats.map((stat) => (
        <div key={stat.label} className={`ui-surface ui-s ui-s--${VARIANT} stat`}>
          <dd className="stat__value">{stat.value}</dd>
          <dt className="label">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const ToastContext = createContext(() => {});

// Un único `Toast` de trama-ui para toda la app; se dispara cambiando su `playKey`.
export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ key: 0, intent: 'success', title: '', description: '' });

  const notify = useCallback((intent, title, description = '') => {
    setToast((previous) => ({ key: previous.key + 1, intent, title, description }));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Toast
        id="seo-app"
        showTrigger={false}
        playKey={toast.key}
        intent={toast.intent}
        title={toast.title}
        description={toast.description}
        variant={VARIANT}
        intentStyle="mono"
        duration={6}
        closeButton
      />
    </ToastContext.Provider>
  );
}

export const useNotify = () => useContext(ToastContext);
