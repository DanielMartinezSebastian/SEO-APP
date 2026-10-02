// Contenido del informe para el cliente, independiente del formato. Lo pintan el PDF y el Markdown, así
// los dos dicen siempre lo mismo.
import { buildBrief } from '../../shared/brief.js';
import { buildInsights } from '../../shared/insights.js';
import { buildActionPlan } from '../../shared/plan.js';
import { buildTrendInsights } from '../../shared/seasonality.js';

export const METHODOLOGY = [
  ['Fuentes', 'El volumen de búsqueda, la competencia, el CPC, las keywords similares y los datos de dominio proceden de keywordsur.fr. Las sugerencias y las ideas (preguntas, comparativas y modificadores) proceden del autocompletado de Google para el país y el idioma del estudio. Las auditorías web descargan y analizan el HTML público de cada página.'],
  ['Búsquedas', 'Media mensual estimada de búsquedas de la keyword exacta en el país del estudio. Es una estimación: sirve para comparar keywords entre sí, no como cifra de tráfico esperable.'],
  ['Competencia', 'Índice de 0 a 100 % que da la fuente de datos. Refleja cuánto se disputa la keyword, sobre todo entre anunciantes; no es una medida directa de la dificultad para posicionar en resultados orgánicos. Las keywords similares no traen este dato.'],
  ['CPC', 'Coste por clic medio en Google Ads. Un CPC alto indica que la búsqueda tiene valor comercial.'],
  ['Puntuación de oportunidad', 'De 0 a 100. Pondera la demanda (50 %), la falta de competencia (35 %) y el valor comercial según el CPC (15 %). Volumen y CPC se miden en escala logarítmica. Cuando una keyword no trae dato de competencia se usa el de su keyword principal.'],
  ['Intención de búsqueda', 'Se deduce de las palabras de la keyword (comprar, precio, mejor, cómo, cerca…). Las keywords sin ninguna de esas palabras se clasifican como generales.'],
  ['Mapa de keywords', 'Cruza las keywords principales y las mejores oportunidades con las URLs del sitemap del sitio, por las palabras de cada URL. «Sin página» indica un hueco de contenido; no se descarga cada página para comprobar su texto.'],
  ['Auditoría de sitio', 'Lee el sitemap del sitio (el declarado en robots.txt o /sitemap.xml), descarga una muestra de sus URLs y agrupa los problemas que se repiten. La nota es el porcentaje de URLs comprobadas sin problemas graves o medios. No ejecuta JavaScript.'],
  ['Tendencias', 'El interés a lo largo del tiempo procede de Google Trends (cinco años, país del estudio). Es un índice de 0 a 100 relativo al máximo de cada keyword: sirve para ver cuándo y hacia dónde se mueve la demanda, no cuánta hay. El perfil estacional compara cada mes con la media de su año (100 = media); una keyword se considera estacional si su mejor mes supera en un 30 % al peor y el dibujo se repite cada año. La tendencia compara los últimos doce meses completos con los doce anteriores. El calendario sitúa el contenido tres meses antes del pico y las campañas uno antes: son plazos orientativos.'],
  ['Plan de acción', 'Las tareas se ordenan por impacto estimado y, a igual impacto, por menor esfuerzo. Impacto y esfuerzo son una valoración orientativa a partir de los datos del estudio.'],
  ['Auditorías', 'Comprueban extensión, uso de la keyword, título, meta descripción, encabezados, legibilidad (índice Szigriszt-Pazos en español, Flesch en inglés), respuestas directas para buscadores con IA y cobertura de los términos del estudio. En páginas web se añaden estado del servidor, indexabilidad, canónica, datos estructurados, enlaces internos, robots.txt y sitemap. No miden Core Web Vitals ni enlaces entrantes. Son buenas prácticas habituales, no reglas publicadas por Google.']
];

export function buildDeliverable(report, study = {}) {
  const insights = buildInsights(report);
  const mains = insights.keywords.filter((entry) => entry.type === 'main');
  const average = (key) => {
    const values = mains.map((entry) => entry[key]).filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  };

  return {
    meta: {
      // sin nombre, el estudio se titula con sus keywords
      title: study.name || report.map((item) => item.keyword).join(' · ') || 'Estudio de keywords',
      client: study.client || '',
      site: study.site || '',
      author: study.author || '',
      notes: study.notes || '',
      accent: study.accent || '',
      date: report[0]?.timestamp || new Date().toISOString(),
      country: report[0]?.country || null,
      language: report[0]?.language || null,
      keywords: report.map((item) => item.keyword)
    },
    insights,
    mains,
    averages: { cpc: average('cpc'), competition: average('competition') },
    plan: buildActionPlan(report, study),
    briefs: report.map((item) => buildBrief(report, item.keyword)).filter(Boolean),
    siteData: study.siteData || null,
    // qué URL del sitio cubre cada keyword (solo si se leyó el sitemap del cliente)
    keywordMap: study.keywordMap || [],
    // auditoría del sitio por su sitemap y lectura de Google Trends, si se han hecho
    siteAudit: study.siteAudit || null,
    trends: study.trendInsights || (study.trends ? buildTrendInsights(report, study.trends) : null),
    audits: study.audits || [],
    pageAudits: study.pageAudits || []
  };
}
