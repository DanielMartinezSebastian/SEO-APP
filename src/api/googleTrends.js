// Google Trends: interés a lo largo del tiempo y consultas relacionadas.
// No hay API pública (la oficial está en alfa y con acceso por solicitud): se usan los mismos endpoints que la
// web de Trends. Google limita las peticiones, así que se piden pocas keywords, con pausa, y el resultado se guarda.
import { REQUEST_TIMEOUT_MS } from '../config.js';

const BASE = 'https://trends.google.com/trends';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PAUSE_MS = 1200;

let cookie = '';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Las respuestas llevan un prefijo anti-JSON-hijacking: )]}',
const parse = (body) => JSON.parse(body.replace(/^\)\]\}',?\s*/, ''));

function upstream(message) {
  const error = new Error(message);
  error.upstream = true;
  return error;
}

const cookieFrom = (response) => (response.headers.getSetCookie?.() || []).map((value) => value.split(';')[0]).join('; ');

// Un 429 suele ser la forma de Google de pedir una cookie nueva: la entrega en esa misma respuesta. Se toma,
// se espera y se reintenta; si insiste, es un límite de verdad y se avisa.
async function get(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es-ES,es;q=0.9', ...(cookie ? { Cookie: cookie } : {}) }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw upstream(`No se pudo conectar con Google Trends: ${error.message}`);
    }
    if (response.ok) return response;
    if (response.status !== 429) throw upstream(`Google Trends respondió ${response.status}`);
    if (attempt >= attempts) throw upstream('Google Trends ha limitado las peticiones (429). Espera unos minutos y vuelve a intentarlo.');
    cookie = cookieFrom(response) || cookie;
    await sleep(PAUSE_MS * attempt * 2);
  }
}

// La cookie de sesión se obtiene de la página de exploración (aunque esa página responda 429, la entrega)
async function ensureCookie(geo, keyword) {
  if (cookie) return;
  try {
    const response = await fetch(`${BASE}/explore?geo=${geo}&q=${encodeURIComponent(keyword)}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    cookie = cookieFrom(response);
  } catch {
    // sin cookie se intenta igualmente
  }
}

const widgetUrl = (path, widget, language) =>
  `${BASE}/api/widgetdata/${path}?hl=${language}&tz=-60&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${widget.token}`;

// Las series de 5 años son semanales: se promedian por mes, que es la resolución que interesa para planificar
function monthly(timeline) {
  const months = new Map();
  for (const point of timeline) {
    const date = new Date(Number(point.time) * 1000);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(point.value?.[0] ?? 0);
  }
  return [...months.entries()].map(([month, values]) => ({ month, value: Math.round(values.reduce((total, value) => total + value, 0) / values.length) }));
}

/**
 * Interés de una keyword en los últimos cinco años y sus consultas relacionadas.
 * @returns {Promise<{ keyword, series: { month, value }[], top: { query, value }[], rising: { query, value, breakout }[] }>}
 */
export async function getTrend(keyword, geo = 'ES', language = 'es', { related = true } = {}) {
  await ensureCookie(geo, keyword);
  const request = { comparisonItem: [{ keyword, geo, time: 'today 5-y' }], category: 0, property: '' };
  const explore = await get(`${BASE}/api/explore?hl=${language}&tz=-60&req=${encodeURIComponent(JSON.stringify(request))}`);
  const { widgets } = parse(await explore.text());
  const timeWidget = widgets.find((widget) => widget.id === 'TIMESERIES');
  const relatedWidget = widgets.find((widget) => widget.id === 'RELATED_QUERIES');
  if (!timeWidget) throw upstream('Google Trends no devolvió la serie temporal');

  const timeline = parse(await (await get(widgetUrl('multiline', timeWidget, language))).text()).default.timelineData || [];

  // Las consultas relacionadas son un extra: si fallan, la serie sigue valiendo
  let top = [];
  let rising = [];
  let relatedError = false;
  if (relatedWidget && related) {
    await sleep(PAUSE_MS / 2);
    try {
      const lists = parse(await (await get(widgetUrl('relatedsearches', relatedWidget, language))).text()).default.rankedList || [];
      top = (lists[0]?.rankedKeyword || []).slice(0, 20).map((entry) => ({ query: entry.query, value: entry.value }));
      // «Aumento puntual» (breakout) llega como subida superior al 5.000 %
      rising = (lists[1]?.rankedKeyword || []).slice(0, 20).map((entry) => ({ query: entry.query, value: entry.value, breakout: entry.value >= 5000 }));
    } catch {
      relatedError = true;
    }
  }

  return { keyword, series: monthly(timeline), top, rising, ...(relatedError ? { relatedError: true } : {}) };
}

/**
 * Tendencias de varias keywords ({ keyword, related }), una a una y con pausa. `related: false` ahorra la petición de
 * consultas relacionadas, que es la que Google limita antes. Un fallo en una keyword no anula las demás; si falla la
 * primera (Google ha cortado el acceso) se lanza el error.
 */
export async function getTrends(wanted, geo = 'ES', language = 'es') {
  const items = [];
  const keywords = wanted.map((entry) => (typeof entry === 'string' ? entry : entry.keyword));
  for (const [index, keyword] of keywords.entries()) {
    if (index > 0) await sleep(PAUSE_MS);
    try {
      items.push(await getTrend(keyword, geo, language, { related: wanted[index].related !== false }));
    } catch (error) {
      if (items.length === 0 && index === keywords.length - 1) throw error;
      items.push({ keyword, series: [], top: [], rising: [], error: error.message });
      // un 429 no se arregla insistiendo: las que quedan se marcan sin pedirlas
      if (/429/.test(error.message)) {
        keywords.slice(index + 1).forEach((rest) => items.push({ keyword: rest, series: [], top: [], rising: [], error: error.message }));
        break;
      }
    }
  }
  if (items.every((item) => item.error)) throw upstream(items[0].error);
  return items;
}
