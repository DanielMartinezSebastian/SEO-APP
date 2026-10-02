import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';

// Carga un estudio: `report` (keywords), `study` (ficha y auditorías) y `summary` (totales).
// `report` es null mientras carga. `reload` vuelve a pedirlo; `setStudy`/`setReport` actualizan en local.
export function useStudy(filename) {
  const [state, setState] = useState({ report: null, study: null, summary: null });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.getStudy(filename);
      if (!Array.isArray(result.data)) throw new Error('El archivo no tiene el formato de un estudio.');
      setState({ report: result.data, study: result.study, summary: result.summary });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [filename]);

  useEffect(() => {
    load();
  }, [load]);

  const setStudy = useCallback((study) => setState((current) => ({ ...current, study })), []);
  const setReport = useCallback((report) => setState((current) => ({ ...current, report })), []);

  return { ...state, error, reload: load, setStudy, setReport };
}
