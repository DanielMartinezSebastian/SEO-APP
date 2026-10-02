// Proyecto: un sitio con varios targets (públicos o líneas de negocio), cada uno con sus estudios.
// Aquí se combinan: qué target conviene atacar primero, qué página del sitio corresponde a cada uno, dónde se
// pisan entre sí y qué tareas salen del conjunto. Lógica pura, usada por el servidor y el navegador.
import { buildInsights } from './insights.js';
import { mapKeywords } from './keywordMap.js';
import { buildActionPlan } from './plan.js';
import { MONTHS, buildTrendInsights } from './seasonality.js';
import { normalize } from './text.js';

const mean = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);
const quote = (items) => items.map((item) => `«${item}»`).join(', ');
const pathOf = (url) => {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
};

// Keywords que definen un target ante el sitio: sus principales y sus mejores oportunidades
function keywordsToPlace(insights) {
  return [...new Set([
    ...insights.keywords.filter((entry) => entry.type === 'main').map((entry) => entry.keyword),
    ...insights.quickWins.slice(0, 8).map((entry) => entry.keyword),
    ...insights.opportunities.slice(0, 10).map((entry) => entry.keyword)
  ])];
}

// Un target puede tener varios estudios: sus keywords se juntan y sus tendencias también
function mergeTrends(studies) {
  const items = studies.flatMap(({ study }) => study.trends?.items || []);
  if (items.length === 0) return null;
  const seen = new Set();
  return {
    fetchedAt: studies.map(({ study }) => study.trends?.fetchedAt).filter(Boolean).sort().at(-1),
    geo: studies.find(({ study }) => study.trends)?.study.trends.geo || null,
    items: items.filter((item) => !seen.has(item.keyword) && seen.add(item.keyword))
  };
}

/**
 * Vista combinada de un proyecto.
 * @param {object} project   { name, site, targets: [{ id, name, audience, page, studies: [filename] }], siteUrls, siteAudit }
 * @param {{ filename: string, report: object[], study: object }[]} studies  los estudios de sus targets, ya leídos
 * @param {Date} [now]
 */
export function buildProjectView(project, studies, now = new Date()) {
  const byFilename = new Map(studies.map((entry) => [entry.filename, entry]));
  const urls = project.siteUrls?.urls || [];

  const targets = (project.targets || []).map((target) => {
    const own = target.studies.map((filename) => byFilename.get(filename)).filter(Boolean);
    const report = own.flatMap((entry) => entry.report);
    const insights = buildInsights(report);
    const mains = insights.keywords.filter((entry) => entry.type === 'main');
    const top = insights.opportunities.slice(0, 10);
    const trends = mergeTrends(own);
    const trendInsights = trends ? buildTrendInsights(report, trends, now) : null;
    const map = urls.length ? mapKeywords(keywordsToPlace(insights), urls) : [];
    const mainMap = map.filter((entry) => mains.some((main) => main.keyword === entry.keyword));

    // Página de aterrizaje: la que se indicó a mano o, si no, la que cubre más keywords principales
    const counts = new Map();
    mainMap.filter((entry) => entry.url).forEach((entry) => counts.set(entry.url, (counts.get(entry.url) || 0) + 1));
    const detected = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const assigned = target.page ? urls.find((url) => pathOf(url).replace(/\/$/, '') === pathOf(target.page).replace(/\/$/, '')) || target.page : null;

    return {
      id: target.id,
      name: target.name,
      audience: target.audience || '',
      studies: own.map((entry) => ({ filename: entry.filename, name: entry.study.name || entry.report.map((item) => item.keyword).join(', ') })),
      missingStudies: target.studies.filter((filename) => !byFilename.has(filename)),
      mainKeywords: mains.map((entry) => entry.keyword),
      totals: insights.totals,
      quickWins: insights.quickWins.length,
      avgCompetition: mean(mains.map((entry) => entry.competition).filter((value) => value !== null)),
      avgCpc: mean(mains.map((entry) => entry.cpc).filter((value) => value !== null)),
      // facilidad: puntuación media de sus diez mejores oportunidades
      ease: top.length ? Math.round(mean(top.map((entry) => entry.score))) : 0,
      topOpportunities: top.slice(0, 5).map(({ keyword, volume, competition, cpc, score, intent }) => ({ keyword, volume, competition, cpc, score, intent })),
      intents: insights.intents.filter((entry) => entry.count > 0).sort((a, b) => b.volume - a.volume).map(({ intent, label, count, volume }) => ({ intent, label, count, volume })),
      keywordSet: new Set(insights.keywords.map((entry) => normalize(entry.keyword))),
      keywordVolumes: new Map(insights.keywords.map((entry) => [normalize(entry.keyword), entry])),
      map,
      page: assigned || detected,
      pageSource: assigned ? 'assigned' : detected ? 'detected' : null,
      coverage: map.length ? Math.round((map.filter((entry) => entry.url).length / map.length) * 100) : null,
      gaps: map.filter((entry) => !entry.url).map((entry) => entry.keyword),
      trends: trendInsights,
      report,
      audits: own.flatMap((entry) => entry.study.audits || []),
      pageAudits: own.flatMap((entry) => entry.study.pageAudits || [])
    };
  });

  // --- Prioridad: demanda, facilidad y valor comercial, cada una relativa al mejor target del proyecto ---
  const maxVolume = Math.max(1, ...targets.map((target) => target.totals.volume));
  const maxCpc = Math.max(0.01, ...targets.map((target) => target.avgCpc || 0));
  targets.forEach((target) => {
    const demand = Math.log10(1 + target.totals.volume) / Math.log10(1 + maxVolume);
    const value = (target.avgCpc || 0) / maxCpc;
    target.priorityScore = target.totals.volume > 0 ? Math.round((demand * 0.4 + (target.ease / 100) * 0.4 + value * 0.2) * 100) : 0;
    target.priorityParts = { demand: Math.round(demand * 100), ease: target.ease, value: Math.round(value * 100) };
  });
  const ranked = [...targets].sort((a, b) => b.priorityScore - a.priorityScore || b.totals.volume - a.totals.volume);
  ranked.forEach((target, index) => { target.priority = index + 1; });

  // --- Solapes: la misma keyword en dos targets. Solo una página puede posicionarla ---
  const owners = new Map();
  targets.forEach((target) => target.keywordSet.forEach((keyword) => owners.set(keyword, [...(owners.get(keyword) || []), target])));
  const overlaps = [...owners.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([keyword, list]) => {
      const entry = list[0].keywordVolumes.get(keyword);
      // candidato a quedársela: el target donde es keyword principal; si no, el de mayor prioridad
      const owner = list.find((target) => target.mainKeywords.some((main) => normalize(main) === keyword)) || [...list].sort((a, b) => a.priority - b.priority)[0];
      return { keyword: entry.keyword, volume: entry.volume, targets: list.map((target) => target.name), suggestedOwner: owner.name };
    })
    .sort((a, b) => (b.volume || 0) - (a.volume || 0));

  // --- Páginas: qué targets reclaman cada URL del sitio ---
  const pageClaims = new Map();
  targets.forEach((target) => target.map.filter((entry) => entry.url).forEach((entry) => {
    const claim = pageClaims.get(entry.url) || new Map();
    claim.set(target.name, [...(claim.get(target.name) || []), entry.keyword]);
    pageClaims.set(entry.url, claim);
  }));
  const pages = [...pageClaims.entries()].map(([url, claim]) => ({
    url,
    path: pathOf(url),
    targets: [...claim.entries()].map(([name, keywords]) => ({ name, keywords })),
    shared: claim.size > 1
  })).sort((a, b) => Number(b.shared) - Number(a.shared) || b.targets[0].keywords.length - a.targets[0].keywords.length);
  const sharedPages = pages.filter((page) => page.shared);
  const sameLanding = targets.filter((target) => target.page && targets.some((other) => other !== target && other.page === target.page));

  // --- Calendario conjunto ---
  const calendar = Array.from({ length: 12 }, (_, offset) => {
    const month = (now.getUTCMonth() + offset) % 12;
    const pick = (key) => targets.flatMap((target) => (target.trends?.calendar[offset]?.[key] || []).map((keyword) => ({ target: target.name, keyword })));
    return { offset, month, label: MONTHS[month], year: now.getUTCFullYear() + Math.floor((now.getUTCMonth() + offset) / 12), publish: pick('publish'), campaigns: pick('campaigns'), peaks: pick('peaks') };
  });

  // --- Hallazgos del conjunto ---
  const findings = [];
  const add = (level, title, text) => findings.push({ level, title, text });
  const withData = ranked.filter((target) => target.totals.volume > 0);
  const empty = targets.filter((target) => target.studies.length === 0);

  if (withData.length >= 2) {
    const [first, second] = withData;
    add('success', `Empezar por «${first.name}»`,
      `Es el target con mejor combinación de demanda, facilidad y valor: ${Math.round(first.totals.volume).toLocaleString('es-ES')} búsquedas al mes, ${first.quickWins === 1 ? "1 victoria rápida" : `${first.quickWins} victorias rápidas`} y una puntuación media de ${first.ease}/100 en sus mejores oportunidades. Le sigue «${second.name}» (${second.priorityScore} frente a ${first.priorityScore}). Trabajar los targets de uno en uno da resultados antes que repartir el esfuerzo entre todos.`);
  }
  if (empty.length > 0) {
    add('warning', `${empty.length === 1 ? 'Un target sin estudio' : `${empty.length} targets sin estudio`}: ${quote(empty.map((target) => target.name))}`,
      'Sin keywords estudiadas no se puede comparar con los demás ni saber si tiene demanda. Crea un estudio con 2 a 6 keywords que usaría ese público.');
  }
  if (urls.length === 0 && project.site) {
    add('info', 'Falta leer el sitemap del sitio', `Audita ${project.site} por su sitemap para saber qué página corresponde a cada target y cuáles faltan.`);
  }
  const noPage = targets.filter((target) => urls.length > 0 && target.studies.length > 0 && !target.page);
  if (noPage.length > 0) {
    add('warning', `Sin página propia: ${quote(noPage.map((target) => target.name))}`,
      'Ninguna URL del sitemap trata sus keywords principales. Cada target necesita una página de aterrizaje que hable solo a ese público: la portada no puede posicionar para todos a la vez.');
  }
  if (sameLanding.length > 0) {
    add('warning', `Varios targets comparten página de aterrizaje: ${quote(sameLanding.map((target) => target.name))}`,
      `Apuntan a ${pathOf(sameLanding[0].page)}. Una página responde bien a una sola intención: separa una página por target y deja la compartida como distribuidor que enlaza a ambas.`);
  }
  if (sharedPages.length > 0) {
    add('info', `${sharedPages.length === 1 ? 'Una página recibe' : `${sharedPages.length} páginas reciben`} keywords de varios targets`,
      `${sharedPages.slice(0, 4).map((page) => `${page.path} (${page.targets.map((target) => target.name).join(' y ')})`).join('; ')}. Decide a qué target sirve cada una y mueve las keywords del otro a su propia página.`);
  }
  if (overlaps.length > 0) {
    add(overlaps.length > 5 ? 'warning' : 'info', `${overlaps.length === 1 ? 'Una keyword aparece' : `${overlaps.length} keywords aparecen`} en más de un target`,
      `${overlaps.slice(0, 5).map((entry) => `«${entry.keyword}» (${entry.targets.join(', ')})`).join('; ')}. Solo una página puede posicionar cada búsqueda: asígnala a un target y enlaza desde los demás. ${overlaps.length > 5 ? 'Con tantas coincidencias, puede que dos de estos targets sean en realidad el mismo público.' : ''}`.trim());
  } else if (withData.length >= 2) {
    add('success', 'Los targets no se pisan', 'Ninguna keyword se repite entre targets: cada público busca con sus propias palabras y puede tener su página sin competir con las demás.');
  }
  const informational = withData.filter((target) => target.intents[0]?.intent === 'informational');
  if (informational.length > 0) {
    add('info', `Público que busca informarse: ${quote(informational.map((target) => target.name))}`,
      'La mayor parte de su demanda es informativa: se gana con guías, casos y respuestas a su problema que enlacen a la página del servicio, más que con una página de venta.');
  }
  const seasons = withData.filter((target) => target.trends?.seasonalCount > 0);
  if (seasons.length >= 2) {
    const peaks = seasons.map((target) => ({ name: target.name, months: [...new Set(target.trends.items.flatMap((item) => item.analysis.peakMonths))] }));
    const allSame = peaks.every((entry) => entry.months.some((month) => peaks[0].months.includes(month)));
    add('info', allSame ? 'Los targets con temporada coinciden en el pico' : 'Las temporadas de los targets se complementan',
      `${peaks.map((entry) => `«${entry.name}»: ${entry.months.map((month) => MONTHS[month]).join(', ')}`).join('; ')}. ${allSame ? 'El negocio se concentra en la misma época: conviene buscar un target con demanda en los meses flojos.' : 'Reparten la demanda a lo largo del año: el calendario permite encadenar campañas.'}`);
  }
  const noTrends = withData.filter((target) => !target.trends);
  if (noTrends.length > 0) {
    add('info', `Sin tendencias: ${quote(noTrends.map((target) => target.name))}`, 'Consulta Google Trends en sus estudios para saber si tienen temporada y si su vocabulario coincide con el del público.');
  }

  // --- Plan del proyecto: lo técnico del sitio, lo estructural entre targets y lo mejor de cada target ---
  const tasks = [];
  const push = (task) => tasks.push({ keywords: [], target: null, ...task });
  buildActionPlan([], { siteAudit: project.siteAudit }).forEach((task) => push(task));
  noPage.forEach((target) => push({
    area: 'Arquitectura', impact: 'alto', effort: 'medio', target: target.name,
    title: `Crear la página de aterrizaje de «${target.name}»`,
    why: `Ninguna URL del sitio trata ${quote(target.mainKeywords.slice(0, 3))}: hoy ese público no tiene dónde llegar.`,
    how: `Una página dedicada, con su keyword principal en la URL, el título y el H1, que hable del problema de ese público${target.audience ? ` (${target.audience})` : ''} y enlace a sus casos y contenidos. Enlázala desde la portada y el menú.`,
    keywords: target.mainKeywords
  }));
  if (sameLanding.length > 0) {
    push({
      area: 'Arquitectura', impact: 'alto', effort: 'medio',
      title: `Separar la página que comparten ${quote(sameLanding.map((target) => target.name))}`,
      why: 'Una misma página no puede responder a dos públicos con intenciones distintas.',
      how: `Una página por target; ${pathOf(sameLanding[0].page)} queda como distribuidor con un enlace claro a cada una.`
    });
  }
  if (overlaps.length > 0) {
    push({
      area: 'Arquitectura', impact: 'medio', effort: 'bajo',
      title: 'Asignar a un solo target las keywords repetidas',
      why: `${overlaps.length === 1 ? 'Una keyword está' : `${overlaps.length} keywords están`} en más de un target: sus páginas competirían entre sí.`,
      how: overlaps.slice(0, 8).map((entry) => `«${entry.keyword}» → ${entry.suggestedOwner}`).join('; ') + '. En las demás páginas, enlaza a la que se la queda en lugar de repetir el contenido.',
      keywords: overlaps.slice(0, 8).map((entry) => entry.keyword)
    });
  }
  if (withData.length >= 2) {
    push({
      area: 'Arquitectura', impact: 'medio', effort: 'bajo',
      title: 'Portada como distribuidor hacia cada target',
      why: 'La portada compite por la marca y la propuesta general; quien llega debe reconocer su caso en un clic.',
      how: `Un bloque por target, en este orden: ${ranked.filter((target) => target.totals.volume > 0).map((target) => target.name).join(', ')}. Cada bloque nombra el problema de ese público y enlaza a su página.`
    });
  }
  // de cada target, sus tareas de más impacto; las de mayor prioridad, antes
  ranked.filter((target) => target.report.length > 0).forEach((target) => {
    const own = buildActionPlan(target.report, { audits: target.audits, pageAudits: target.pageAudits, keywordMap: target.map, trendInsights: target.trends })
      // si al target le falta la página de aterrizaje, esa tarea ya está arriba
      .filter((task) => !(noPage.includes(target) && task.title.startsWith('Crear la página de')))
      .filter((task) => task.impact === 'alto' || task.area === 'Calendario').slice(0, 4);
    own.forEach((task) => push({ ...task, target: target.name, targetPriority: target.priority }));
  });
  const IMPACT = { alto: 3, medio: 2, bajo: 1 };
  const EFFORT = { bajo: 1, medio: 2, alto: 3 };
  const plan = tasks
    .map(({ priority, ...task }) => task)
    .sort((a, b) => IMPACT[b.impact] - IMPACT[a.impact] || (a.targetPriority || 0) - (b.targetPriority || 0) || EFFORT[a.effort] - EFFORT[b.effort])
    .map(({ targetPriority, ...task }, index) => ({ priority: index + 1, ...task }));

  return {
    totals: {
      targets: targets.length,
      studies: studies.length,
      keywords: owners.size,
      // cada keyword cuenta una vez aunque esté en varios targets
      volume: [...owners.entries()].reduce((total, [keyword, list]) => total + (list[0].keywordVolumes.get(keyword)?.volume || 0), 0),
      urls: project.siteUrls?.total ?? urls.length
    },
    // sin las estructuras internas: lo que queda es serializable
    targets: ranked.map(({ keywordSet, keywordVolumes, report, audits, pageAudits, ...target }) => ({
      ...target,
      trends: target.trends ? { findings: target.trends.findings, seasonalCount: target.trends.seasonalCount, coverage: target.trends.coverage, newQueries: target.trends.newQueries.slice(0, 10), items: target.trends.items.map(({ keyword, analysis }) => ({ keyword, analysis })) } : null
    })),
    overlaps,
    pages,
    calendar,
    findings,
    plan
  };
}

const int = (value) => (typeof value === 'number' ? Math.round(value).toLocaleString('es-ES') : '—');
const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : '—');

export function projectToMarkdown(project, view) {
  const lines = [
    `# ${project.name}`,
    '',
    [project.client && `**Cliente:** ${project.client}`, project.site && `**Sitio:** ${project.site}`, `**Targets:** ${view.totals.targets}`, `**Keywords:** ${int(view.totals.keywords)}`, `**Búsquedas al mes:** ${int(view.totals.volume)}`].filter(Boolean).join(' · '),
    '',
    '## Conclusiones',
    '',
    ...view.findings.map((finding) => `- **${finding.title}.** ${finding.text}`),
    '',
    '## Targets por prioridad',
    '',
    '| N.º | Target | Búsquedas | Victorias rápidas | Competencia | CPC | Facilidad | Prioridad | Página | Cobertura |',
    '|---:|---|---:|---:|---:|---:|---:|---:|---|---:|',
    ...view.targets.map((target) => `| ${target.priority} | ${target.name} | ${int(target.totals.volume)} | ${target.quickWins} | ${percent(target.avgCompetition)} | ${target.avgCpc === null ? '—' : `${target.avgCpc.toFixed(2).replace('.', ',')} €`} | ${target.ease}/100 | ${target.priorityScore}/100 | ${target.page ? pathOf(target.page) : 'sin página'} | ${target.coverage === null ? '—' : `${target.coverage} %`} |`),
    ''
  ];
  view.targets.forEach((target) => {
    lines.push(`### ${target.priority}. ${target.name}`, '');
    if (target.audience) lines.push(`Público: ${target.audience}`, '');
    lines.push(`- Keywords principales: ${target.mainKeywords.join(', ') || '—'}`,
      `- Mejores oportunidades: ${target.topOpportunities.map((entry) => `${entry.keyword} (${int(entry.volume)}, ${entry.score}/100)`).join('; ') || '—'}`,
      `- Intención dominante: ${target.intents[0]?.label || '—'}`,
      target.gaps.length ? `- Sin página en el sitio: ${target.gaps.join(', ')}` : '',
      ...(target.trends?.findings || []).slice(0, 3).map((finding) => `- ${finding.title}`),
      `- Estudios: ${target.studies.map((study) => study.filename).join(', ') || 'ninguno'}`, '');
  });
  if (view.overlaps.length) {
    lines.push('## Keywords repetidas entre targets', '', '| Keyword | Búsquedas | Targets | Asignar a |', '|---|---:|---|---|',
      ...view.overlaps.slice(0, 30).map((entry) => `| ${entry.keyword} | ${int(entry.volume)} | ${entry.targets.join(', ')} | ${entry.suggestedOwner} |`), '');
  }
  if (view.pages.length) {
    lines.push('## Páginas del sitio y targets', '', '| Página | Target | Keywords |', '|---|---|---|',
      ...view.pages.slice(0, 40).flatMap((page) => page.targets.map((target) => `| ${page.path}${page.shared ? ' (compartida)' : ''} | ${target.name} | ${target.keywords.join(', ')} |`)), '');
  }
  const busy = view.calendar.filter((month) => month.publish.length || month.campaigns.length || month.peaks.length);
  if (busy.length) {
    const cell = (entries) => entries.map((entry) => `${entry.keyword} (${entry.target})`).join(', ') || '—';
    lines.push('## Calendario', '', '| Mes | Publicar contenido para | Arrancar campaña de | En temporada alta |', '|---|---|---|---|',
      ...busy.map((month) => `| ${month.label} ${month.year} | ${cell(month.publish)} | ${cell(month.campaigns)} | ${cell(month.peaks)} |`), '');
  }
  lines.push('## Plan de acción', '',
    ...view.plan.flatMap((task) => [`### ${task.priority}. ${task.title}`, `*${task.area}${task.target ? ` · ${task.target}` : ''} · impacto ${task.impact} · esfuerzo ${task.effort}*`, '', `**Por qué:** ${task.why}`, '', `**Cómo:** ${task.how}`, '']));
  return lines.filter((line) => line !== '' || true).join('\n').replace(/\n{3,}/g, '\n\n');
}
