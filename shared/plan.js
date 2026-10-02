// Plan de acción priorizado: convierte los hallazgos del estudio en tareas concretas, ordenadas por
// impacto y esfuerzo. Es lo que el cliente necesita para saber qué hacer el lunes.
import { buildInsights } from './insights.js';
import { MONTHS, buildTrendInsights } from './seasonality.js';

const IMPACT = { alto: 3, medio: 2, bajo: 1 };
const EFFORT = { bajo: 1, medio: 2, alto: 3 };
const quote = (keywords) => keywords.map((keyword) => `«${keyword}»`).join(', ');

// Las comprobaciones de auditoría con más peso son las que más mueven el resultado
const impactOfCheck = (check) => (check.status === 'fail' && check.weight >= 3 ? 'alto' : check.status === 'fail' ? 'medio' : 'bajo');

/**
 * @param {object[]} report
 * @param {{ audits?: object[], pageAudits?: object[], site?: string }} [study]
 * @returns {{ priority: number, area: string, impact: string, effort: string, title: string, why: string, how: string, keywords: string[] }[]}
 */
export function buildActionPlan(report, study = {}) {
  const insights = buildInsights(report);
  const audits = study.audits || [];
  const pageAudits = study.pageAudits || [];
  const tasks = [];
  const add = (task) => tasks.push({ keywords: [], ...task });

  // --- Técnico y on-page: lo que bloquea va primero ---
  for (const audit of pageAudits) {
    const failing = audit.result.checks.filter((check) => check.status === 'fail' || check.status === 'warn');
    const technical = failing.filter((check) => check.group === 'Técnico' || check.group === 'Sitio');
    const onPage = failing.filter((check) => check.group !== 'Técnico' && check.group !== 'Sitio');
    const blocking = technical.filter((check) => check.status === 'fail');

    if (blocking.length > 0) {
      add({
        area: 'Técnico', impact: 'alto', effort: 'bajo',
        title: `Corregir los bloqueos técnicos de ${audit.url}`,
        why: 'Un fallo técnico impide que la página se rastree o se muestre bien, y anula el resto del trabajo.',
        how: blocking.map((check) => `${check.label}: ${check.detail}`).join(' '),
        keywords: audit.keyword ? [audit.keyword] : []
      });
    }
    const fixes = onPage.filter((check) => check.status === 'fail');
    if (fixes.length > 0) {
      add({
        area: 'On-page', impact: fixes.some((check) => impactOfCheck(check) === 'alto') ? 'alto' : 'medio', effort: 'bajo',
        title: `Optimizar ${audit.url}${audit.keyword ? ` para «${audit.keyword}»` : ''}`,
        why: `La página saca ${audit.result.score}/100 y falla en ${fixes.length} comprobaciones on-page.`,
        how: fixes.map((check) => `${check.label}: ${check.detail}`).join(' '),
        keywords: audit.keyword ? [audit.keyword] : []
      });
    }
    const minor = [...technical, ...onPage].filter((check) => check.status === 'warn');
    if (minor.length > 0) {
      add({
        area: 'On-page', impact: 'bajo', effort: 'bajo',
        title: `Pulir ${audit.url}`,
        why: `${minor.length} puntos mejorables que no bloquean, pero suman.`,
        how: minor.map((check) => check.label).join('; ') + '.',
        keywords: audit.keyword ? [audit.keyword] : []
      });
    }
  }

  // --- Auditoría de sitio (sitemap): problemas que se repiten en varias páginas ---
  const siteAudit = study.siteAudit;
  if (siteAudit) {
    const where = siteAudit.environment === 'local' ? `${siteAudit.site} (desarrollo)` : siteAudit.site;
    const sample = (issue) => `${issue.urls.slice(0, 4).join(', ')}${issue.count > 4 ? ` y ${issue.count - 4} más` : ''}`;
    for (const issue of siteAudit.issues.filter((item) => item.severity !== 'baja')) {
      add({
        area: 'Técnico', impact: issue.severity === 'alta' ? 'alto' : 'medio', effort: issue.count > 10 ? 'medio' : 'bajo',
        title: `${issue.title.replace(/ \(\d+\)$/, '')} en ${where}: ${issue.count}`,
        why: issue.why,
        how: `${issue.fix} Afecta a: ${sample(issue)}.`
      });
    }
    const minor = siteAudit.issues.filter((item) => item.severity === 'baja');
    if (minor.length + siteAudit.sitemap.issues.length > 0) {
      add({
        area: 'Técnico', impact: 'bajo', effort: 'bajo',
        title: `Higiene del sitemap y de las páginas de ${where}`,
        why: 'No bloquean, pero ensucian lo que Google lee del sitio.',
        how: [...siteAudit.sitemap.issues, ...minor.map((issue) => `${issue.title}: ${issue.fix}`)].join(' ')
      });
    }
  }

  // --- Tendencias: temporadas, demanda que crece y consultas nuevas ---
  const trends = study.trendInsights || (study.trends ? buildTrendInsights(report, study.trends) : null);
  if (trends) {
    const seasonal = trends.items.filter((item) => item.analysis.next);
    // una tarea por temporada: las keywords que comparten pico se trabajan juntas
    const seasons = new Map();
    for (const item of seasonal.filter((entry) => entry.analysis.next.status === 'urgent' || entry.analysis.next.status === 'now')) {
      const key = `${item.analysis.next.status}-${item.analysis.next.peak}`;
      seasons.set(key, [...(seasons.get(key) || []), item]);
    }
    for (const group of seasons.values()) {
      const { next } = group[0].analysis;
      const urgent = next.status === 'urgent';
      const names = quote(group.map((item) => item.keyword));
      add({
        area: 'Calendario', impact: 'alto', effort: urgent ? 'bajo' : 'medio',
        title: urgent ? `Reforzar ${names} antes de ${MONTHS[next.peak]}` : `Publicar el contenido de ${names} en ${MONTHS[next.publishBy]}`,
        why: `Su temporada alta empieza en ${MONTHS[next.peak]} (interés ${group.map((item) => item.analysis.next.peakIndex).join(', ')} sobre una media de 100) y ${next.monthsUntil === 1 ? 'falta 1 mes' : `faltan ${next.monthsUntil} meses`}.`,
        how: urgent
          ? `No da tiempo a posicionar páginas nuevas: actualiza las que existen (fecha, precios, disponibilidad, enlaces internos desde la portada) y arranca la campaña de pago, correo y redes en ${MONTHS[next.campaignFrom]}.`
          : `Páginas publicadas y enlazadas en ${MONTHS[next.publishBy]} para que lleguen posicionadas; campaña de pago, correo y redes desde ${MONTHS[next.campaignFrom]}.`,
        keywords: group.map((item) => item.keyword)
      });
    }
    const rising = trends.items.filter((item) => item.analysis.direction === 'rising' && item.role !== 'main');
    if (rising.length > 0) {
      add({
        area: 'Estrategia', impact: 'alto', effort: 'medio',
        title: `Adelantar las keywords que crecen: ${quote(rising.map((item) => item.keyword))}`,
        why: `${rising.map((item) => `«${item.keyword}» +${item.analysis.yearChange} %`).join(', ')} en el último año: su demanda real ya es mayor que el volumen medio que muestra el estudio.`,
        how: 'Dales página propia antes que a keywords de volumen parecido pero estables: posicionar mientras crece es más barato que hacerlo cuando ya se disputa.',
        keywords: rising.map((item) => item.keyword)
      });
    }
    if (trends.newQueries.length > 0) {
      const queries = trends.newQueries.slice(0, 8).map((query) => query.query);
      add({
        area: 'Estrategia', impact: 'medio', effort: 'bajo',
        title: 'Evaluar las consultas en auge que el estudio no contempla',
        why: 'Google Trends las marca como las que más crecen alrededor de las keywords del estudio; las herramientas de volumen tardan meses en recogerlas.',
        how: `Crea un estudio con ellas para medir su demanda y decide si son contenido nuevo, una línea de producto o ruido: ${quote(queries)}.`,
        keywords: queries
      });
    }
    const falling = trends.items.filter((item) => item.role === 'main' && item.analysis.direction === 'falling');
    if (falling.length > 0) {
      add({
        area: 'Estrategia', impact: 'medio', effort: 'bajo',
        title: `Replantear ${quote(falling.map((item) => item.keyword))}: pierden interés`,
        why: `${falling.map((item) => `«${item.keyword}» ${item.analysis.yearChange} %`).join(', ')} en el último año.`,
        how: 'Comprueba en las consultas relacionadas si el público ha cambiado de palabra. Si es así, cambia la keyword objetivo de la página; si la demanda cae de verdad, no amplíes la inversión ahí.',
        keywords: falling.map((item) => item.keyword)
      });
    }
  }

  // --- Textos auditados que no llegan ---
  for (const audit of audits.filter((item) => item.result.score < 70)) {
    const failing = audit.result.checks.filter((check) => check.status === 'fail');
    add({
      area: 'Contenido', impact: audit.result.score < 50 ? 'alto' : 'medio', effort: 'medio',
      title: `Reescribir «${audit.name}»`,
      why: `El texto saca ${audit.result.score}/100${audit.keyword ? ` para «${audit.keyword}»` : ''}.`,
      how: failing.length ? failing.map((check) => `${check.label}: ${check.detail}`).join(' ') : 'Revisar los puntos mejorables de la auditoría.',
      keywords: audit.keyword ? [audit.keyword] : []
    });
  }

  // --- Mapa de keywords: huecos y páginas que compiten entre sí ---
  const keywordMap = study.keywordMap || [];
  const mainSet = new Set(insights.keywords.filter((entry) => entry.type === 'main').map((entry) => entry.keyword));
  const gaps = keywordMap.filter((entry) => !entry.url);
  const mainGaps = gaps.filter((entry) => mainSet.has(entry.keyword));
  if (mainGaps.length > 0) {
    add({
      area: 'Contenido', impact: 'alto', effort: 'medio',
      title: `Crear la página de ${quote(mainGaps.map((entry) => entry.keyword))}`,
      why: 'Ninguna URL del sitemap del sitio trata estas keywords principales: hoy no hay página que pueda posicionarlas.',
      how: 'Una página propia por keyword, con la keyword en la URL, el título y el H1. Parte del brief de contenido de cada una.',
      keywords: mainGaps.map((entry) => entry.keyword)
    });
  }
  const otherGaps = gaps.filter((entry) => !mainSet.has(entry.keyword)).slice(0, 6);
  if (otherGaps.length > 0) {
    add({
      area: 'Contenido', impact: 'medio', effort: 'medio',
      title: 'Cubrir las oportunidades que el sitio no trata',
      why: `${otherGaps.length === 1 ? 'Una de las mejores oportunidades del estudio no tiene' : `${otherGaps.length} de las mejores oportunidades del estudio no tienen`} página en el sitemap.`,
      how: `Página o apartado propio para: ${quote(otherGaps.map((entry) => entry.keyword))}.`,
      keywords: otherGaps.map((entry) => entry.keyword)
    });
  }
  const competing = keywordMap.filter((entry) => entry.alternatives.length > 0).slice(0, 4);
  if (competing.length > 0) {
    add({
      area: 'On-page', impact: 'medio', effort: 'medio',
      title: 'Revisar páginas que compiten por la misma keyword',
      why: 'Varias URLs del sitio apuntan a la misma búsqueda; Google tiene que elegir una y puede no ser la que interesa.',
      how: competing.map((entry) => `«${entry.keyword}»: ${[entry.url, ...entry.alternatives].join(' · ')}`).join(' | ') +
        '. Decide la página principal de cada keyword y enlaza las demás hacia ella (o unifícalas).',
      keywords: competing.map((entry) => entry.keyword)
    });
  }

  // --- Estrategia de contenido ---
  const wins = insights.quickWins.slice(0, 5);
  if (wins.length > 0) {
    add({
      area: 'Contenido', impact: 'alto', effort: 'medio',
      title: wins.length === 1 ? "Crear o reforzar contenido para la victoria rápida del estudio" : `Crear o reforzar contenido para ${wins.length} victorias rápidas`,
      why: 'Tienen demanda por encima de la mediana del estudio y poca competencia: es donde antes se verán resultados.',
      how: `Una página o apartado propio para cada una: ${quote(wins.map((entry) => entry.keyword))}. Usa el brief de contenido de cada keyword.`,
      keywords: wins.map((entry) => entry.keyword)
    });
  }

  const mains = insights.keywords.filter((entry) => entry.type === 'main');
  const hard = mains.filter((entry) => entry.competition !== null && entry.competition > 0.7);
  if (hard.length > 0) {
    add({
      area: 'Estrategia', impact: 'alto', effort: 'alto',
      title: `Página pilar para ${quote(hard.map((entry) => entry.keyword))}`,
      why: 'Son keywords muy disputadas: no se ganan con una página suelta, sino con un tema bien cubierto y enlazado.',
      how: 'Una página pilar por keyword que resuma el tema y enlace a un contenido propio por cada subtema; los subtemas enlazan de vuelta.',
      keywords: hard.map((entry) => entry.keyword)
    });
  }

  const clusters = insights.clusters.filter((cluster) => cluster.totalVolume > 0).slice(0, 4);
  if (clusters.length > 0) {
    add({
      area: 'Estrategia', impact: 'medio', effort: 'medio',
      title: `Estructurar el sitio por temas: ${quote(clusters.map((cluster) => cluster.term))}`,
      why: 'Las keywords del estudio se agrupan de forma natural en estos temas; cada uno concentra varias búsquedas.',
      how: clusters.map((cluster) => `«${cluster.term}»: ${cluster.keywords.slice(0, 3).map((entry) => entry.keyword).join(', ')}`).join(' · ') +
        '. Una página o categoría por tema, enlazadas desde la página pilar.',
      keywords: clusters.flatMap((cluster) => cluster.keywords.slice(0, 3).map((entry) => entry.keyword))
    });
  }

  const questions = insights.questions.slice(0, 6);
  if (questions.length > 0) {
    add({
      area: 'Contenido', impact: 'medio', effort: 'bajo',
      title: 'Responder las preguntas que hace la gente',
      why: 'Las respuestas directas son lo que citan los resultados enriquecidos y los buscadores con IA.',
      how: `Bloque de preguntas frecuentes (con marcado FAQPage) o artículos propios para: ${quote(questions.map((entry) => entry.keyword))}. ` +
        'Cada respuesta, de 40 a 60 palabras antes de desarrollar.',
      keywords: questions.map((entry) => entry.keyword)
    });
  }

  const transactional = insights.keywords.filter((entry) => entry.intent === 'transactional' && entry.volume > 0).slice(0, 5);
  if (transactional.length > 0) {
    add({
      area: 'On-page', impact: 'medio', effort: 'medio',
      title: 'Páginas de producto o servicio para las búsquedas de compra',
      why: 'Quien busca con intención de compra espera una página donde pueda comprar o contratar, no un artículo.',
      how: `Revisar que existe una página comercial para: ${quote(transactional.map((entry) => entry.keyword))}, con precio, disponibilidad y llamada a la acción visibles.`,
      keywords: transactional.map((entry) => entry.keyword)
    });
  }

  const local = insights.keywords.filter((entry) => entry.intent === 'local');
  // una keyword suelta con nombre de lugar no convierte el proyecto en local
  if (local.length >= 3 || local.length / insights.keywords.length >= 0.15) {
    add({
      area: 'Local', impact: 'medio', effort: 'bajo',
      title: 'Completar la ficha de Google Business y las páginas por zona',
      why: `${local.length === 1 ? "1 búsqueda del estudio tiene" : `${local.length} búsquedas del estudio tienen`} intención local: nombran una ciudad o piden cercanía.`,
      how: 'Ficha de Google Business completa, nombre-dirección-teléfono idénticos en todo el sitio, marcado LocalBusiness y una página por zona de servicio.',
      keywords: local.slice(0, 5).map((entry) => entry.keyword)
    });
  }

  if (study.site && pageAudits.length === 0 && !siteAudit) {
    add({
      area: 'Técnico', impact: 'medio', effort: 'bajo',
      title: `Auditar las páginas clave de ${study.site}`,
      why: 'Sin auditar las páginas reales no se sabe si el sitio está en condiciones de posicionar lo que se escriba.',
      how: 'Auditar la portada y las páginas que deben posicionar cada keyword principal desde «Auditoría web».',
      keywords: []
    });
  }

  return tasks
    .sort((a, b) => IMPACT[b.impact] - IMPACT[a.impact] || EFFORT[a.effort] - EFFORT[b.effort])
    .map((task, index) => ({ priority: index + 1, ...task }));
}

export function planToMarkdown(tasks) {
  if (tasks.length === 0) return 'Sin tareas: el estudio no tiene datos suficientes.\n';
  return tasks.map((task) => [
    `### ${task.priority}. ${task.title}`,
    `*${task.area} · impacto ${task.impact} · esfuerzo ${task.effort}*`,
    '',
    `**Por qué:** ${task.why}`,
    '',
    `**Cómo:** ${task.how}`,
    ''
  ].join('\n')).join('\n');
}
