import { useSyncExternalStore } from 'react';

// Router mínimo sobre la History API: pocas rutas no justifican una dependencia.
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener) => {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
};

const snapshot = () => window.location.pathname + window.location.search;

export function navigate(to, { scroll = true } = {}) {
  if (to !== snapshot()) {
    window.history.pushState(null, '', to);
    notify();
  }
  if (scroll) window.scrollTo(0, 0);
}

export function useRoute() {
  const current = useSyncExternalStore(subscribe, snapshot);
  const url = new URL(current, window.location.origin);
  return { path: url.pathname, params: url.searchParams };
}

export const studyUrl = (filename, tab = 'resumen') =>
  `/study?filename=${encodeURIComponent(filename)}${tab === 'resumen' ? '' : `&tab=${tab}`}`;

// Los botones con `href` de trama-ui son enlaces reales: se interceptan los clics normales para
// navegar sin recargar, y se deja al navegador el clic central, Ctrl+clic y las descargas.
export function interceptLinkClicks(event) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = event.target.closest?.('a[href]');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.preventDefault();
  // cambiar de pestaña dentro del mismo estudio no devuelve al principio de la página
  const sameStudy = url.pathname === '/study' && window.location.pathname === '/study' &&
    url.searchParams.get('filename') === new URLSearchParams(window.location.search).get('filename');
  navigate(url.pathname + url.search, { scroll: !sameStudy });
}
