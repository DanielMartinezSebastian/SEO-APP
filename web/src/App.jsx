import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Button, NavBar } from 'trama-ui';
import { ToastProvider, VARIANT } from './components/ui.jsx';
import { interceptLinkClicks, navigate, studyUrl, useRoute } from './lib/router.js';
import Home from './pages/Home.jsx';
import NewStudy from './pages/NewStudy.jsx';
import Study from './pages/Study.jsx';
import AuditTool from './pages/AuditTool.jsx';
import Guide from './pages/Guide.jsx';

const Backdrop = lazy(() => import('./components/Backdrop.jsx'));

const THEME_KEY = 'seo-app-theme';

// Cada vista tiene su figura de fondo (modelos en Backdrop.jsx)
const SCENES = {
  '/': 'planet',
  '/new': 'planet',
  '/audit': 'magnifier',
  '/guia': 'page'
};
const STUDY_SCENES = { resumen: 'planet', keywords: 'bars', oportunidades: 'target', contenido: 'page', auditoria: 'magnifier', informe: 'page' };

// Rutas de versiones anteriores: siguen funcionando y llevan a la pestaña equivalente del estudio
const LEGACY_TABS = { '/report': 'resumen', '/analytics': 'keywords', '/insights': 'oportunidades', '/content': 'contenido' };

const NAV_LINKS = ['Estudios=/', 'Auditar URL=/audit', 'Guía=/guia'];
const NAV_PATHS = ['/', '/audit', '/guia'];

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    // antes de renderizar: el fondo 3D lee los tokens del tema al montarse
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Sin almacenamiento (modo privado): el tema dura lo que la pestaña
    }
  };

  return [theme, toggle];
}

function useWideScreen() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1500px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1500px)');
    const sync = () => setWide(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return wide;
}

function Notice({ intent, title, message }) {
  return (
    <section className="dmx__section">
      <div className="stack">
        <Alert className="wide" intent={intent} title={title} message={message} dismissible={false} variant={VARIANT} />
        <div><Button label="Volver a los estudios" href="/" glyph="icon:arrow-left" glyphPosition="start" variant={VARIANT} /></div>
      </div>
    </section>
  );
}

function Page({ path, params }) {
  const filename = params.get('filename');

  if (path === '/') return <Home />;
  if (path === '/new') return <NewStudy />;
  if (path === '/audit') return <AuditTool />;
  if (path === '/guia') return <Guide />;

  if (path === '/study') {
    if (!filename) return <Notice intent="danger" title="Falta el estudio" message="No se especificó qué estudio mostrar." />;
    // `key` reinicia el estado de la página al cambiar de estudio
    return <Study key={filename} filename={filename} tab={params.get('tab') || 'resumen'} />;
  }

  return <Notice intent="warning" title="Página no encontrada" message={path} />;
}

export default function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  const wide = useWideScreen();

  // Enlaces antiguos a un estudio
  const legacyTab = LEGACY_TABS[route.path];
  useEffect(() => {
    if (legacyTab && route.params.get('filename')) {
      window.history.replaceState(null, '', studyUrl(route.params.get('filename'), legacyTab));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [legacyTab, route.params]);

  const scene = route.path === '/study' ? STUDY_SCENES[route.params.get('tab') || 'resumen'] : SCENES[route.path];
  const activeLink = route.path === '/study' || route.path === '/new' ? 0 : Math.max(0, NAV_PATHS.indexOf(route.path));

  return (
    <ToastProvider>
      <div className="dmx" onClick={interceptLinkClicks}>
        {/* la figura solo cabe en el margen de las pantallas anchas; en el resto estorbaría detrás del contenido */}
        {wide && (
          <div className="dmx__bg" aria-hidden>
            <Suspense fallback={null}>
              {/* el lienzo lee los colores del tema al montarse: `key` lo repinta al cambiar de tema */}
              <Backdrop key={theme} dark={theme === 'dark'} model={scene || 'web'} ramp="dots" offset={[4.6, 0.4, 0]} />
            </Suspense>
          </div>
        )}

        <div className="dmx__nav no-print">
          <NavBar
            key={activeLink}
            brand="SEO APP"
            links={NAV_LINKS.join(', ')}
            defaultActive={activeLink}
            cta="Nuevo estudio"
            onCta={() => navigate('/new')}
            search="none"
            variant={VARIANT}
            onNavigate={(item) => item.href && navigate(item.href)}
          >
            <Button
              iconOnly
              label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              glyph={theme === 'dark' ? 'icon:sun' : 'icon:moon'}
              emphasis="ghost"
              variant={VARIANT}
              onClick={toggleTheme}
            />
          </NavBar>
        </div>

        <main className="dmx__main">
          {legacyTab ? null : <Page path={route.path} params={route.params} />}
        </main>

        <footer className="app-footer no-print">
          <span>SEO App · estudios de keywords, auditorías e informes</span>
          <span>Datos: keywordsur.fr y autocompletado de Google</span>
        </footer>
      </div>
    </ToastProvider>
  );
}
