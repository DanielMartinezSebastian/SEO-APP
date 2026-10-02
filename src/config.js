import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = join(__dirname, '..');

// Ruta absoluta: los reportes se guardan y se leen en el mismo sitio sea cual sea el directorio de trabajo.
// SEO_RESULTS_DIR permite apuntar a otra carpeta (los tests usan una temporal).
export const RESULTS_DIR = resolve(process.env.SEO_RESULTS_DIR || join(ROOT_DIR, 'data/results'));
export const WEB_DIST = join(ROOT_DIR, 'web/dist');

export const DEFAULT_COUNTRY = 'ES';
export const DEFAULT_LANGUAGE = 'es';

export const MAX_KEYWORDS = 25;
export const MAX_KEYWORD_LENGTH = 100;

export const REQUEST_TIMEOUT_MS = 15000;

// Dominio de primer nivel con el que se busca el sitio «de marca» de una keyword en cada país
const COUNTRY_TLDS = { ES: 'es', US: 'com', FR: 'fr', DE: 'de', IT: 'it', GB: 'co.uk', PT: 'pt', MX: 'com.mx' };

export function tldForCountry(country) {
  return COUNTRY_TLDS[country] || 'com';
}
