// Informe del estudio en Markdown: el mismo contenido que el PDF, para pegarlo en un gestor de proyectos,
// un documento compartido o dárselo a un agente.
import { INTENT_HINTS, INTENT_LABELS, TYPE_LABELS } from '../../shared/insights.js';
import { planToMarkdown } from '../../shared/plan.js';
import { briefToMarkdown } from '../../shared/brief.js';
import { trendsToMarkdown } from '../../shared/seasonality.js';
import { buildDeliverable, METHODOLOGY } from './deliverable.js';

const int = (value) => (typeof value === 'number' ? Math.round(value).toLocaleString('es-ES') : '—');
const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : '—');
const euro = (value) => (typeof value === 'number' ? `${value.toFixed(2).replace('.', ',')} €` : '—');
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const STATUS = { ok: 'Correcto', warn: 'Mejorable', fail: 'Falla', skip: 'Sin evaluar' };

const keywordTable = (entries) => [
  '| Keyword | Tipo | Intención | Búsquedas | Comp. | CPC | Punt. |',
  '|---|---|---|---:|---:|---:|---:|',
  ...entries.map((entry) => `| ${cell(entry.keyword)} | ${TYPE_LABELS[entry.type]} | ${INTENT_LABELS[entry.intent]} | ${int(entry.volume)} | ${percent(entry.competition)} | ${euro(entry.cpc)} | ${entry.score} |`)
].join('\n');

const auditBlock = (heading, audit) => [
  `### ${heading} — ${audit.result.score}/100 (${audit.result.verdict})`,
  '',
  '| Estado | Comprobación | Detalle |',
  '|---|---|---|',
  ...audit.result.checks.map((check) => `| ${STATUS[check.status]} | ${cell(check.label)} | ${cell(check.detail)} |`),
  ''
].join('\n');

export function buildReportMarkdown(report, study = {}) {
  const doc = buildDeliverable(report, study);
  const { meta, insights } = doc;
  const lines = [
    `# ${meta.title}`,
    '',
    [meta.client && `**Cliente:** ${meta.client}`, meta.site && `**Sitio:** ${meta.site}`, meta.author && `**Elaborado por:** ${meta.author}`,
      `**Fecha:** ${new Date(meta.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      meta.country && `**Mercado:** ${meta.country} · idioma ${meta.language}`].filter(Boolean).join(' · '),
    '',
    `Keywords del estudio: ${meta.keywords.join(', ')}.`,
    '',
    '## 1. Resumen ejecutivo',
    '',
    `- Keywords estudiadas: **${int(insights.totals.keywords)}**`,
    `- Búsquedas al mes (suma): **${int(insights.totals.volume)}**`,
    `- CPC medio de las principales: **${euro(doc.averages.cpc)}**`,
    `- Competencia media de las principales: **${percent(doc.averages.competition)}**`
  ];
  if (doc.siteData) {
    lines.push(`- Situación de ${meta.site}: **${int(doc.siteData.traffic)}** visitas orgánicas estimadas al mes y **${int(doc.siteData.keyword_count_top10)}** keywords en el top 10.`);
  }
  lines.push('', ...insights.recommendations.map((item) => `- **${item.title}.** ${item.text}`));
  if (meta.notes) lines.push('', `> ${meta.notes.replace(/\n/g, '\n> ')}`);

  lines.push('', '## 2. Plan de acción', '', planToMarkdown(doc.plan));

  lines.push('## 3. Keywords y oportunidades', '', '### Keywords principales', '', keywordTable(doc.mains), '',
    '### Mejores oportunidades', '', keywordTable(insights.opportunities), '',
    `### Victorias rápidas (${insights.quickWins.length})`, '',
    insights.quickWins.length ? keywordTable(insights.quickWins.slice(0, 15)) : 'No hay keywords con demanda por encima de la mediana y competencia inferior al 40 %.', '');

  lines.push('## 4. Intención y temas', '',
    ...insights.intents.filter((entry) => entry.count > 0).map((entry) => `- **${entry.label}** (${entry.count} keywords, ${int(entry.volume)} búsquedas): ${INTENT_HINTS[entry.intent]}`),
    '');
  if (insights.clusters.length) {
    lines.push('| Tema | N.º | Búsquedas | Keywords del grupo |', '|---|---:|---:|---|',
      ...insights.clusters.slice(0, 20).map((cluster) => `| ${cell(cluster.term)} | ${cluster.keywords.length} | ${int(cluster.totalVolume)} | ${cell(cluster.keywords.slice(0, 6).map((entry) => entry.keyword).join(', '))} |`), '');
  }

  if (doc.trends && doc.trends.items.length) {
    lines.push('## Tendencias y calendario', '', 'Interés en Google de los últimos cinco años (Google Trends). 100 = media del año de cada keyword.', '', trendsToMarkdown(doc.trends));
  }

  lines.push('## 5. Briefs de contenido', '');
  // los briefs traen su propio título de nivel 1: aquí cuelgan de la sección
  doc.briefs.forEach((brief) => lines.push(briefToMarkdown(brief).replace(/^# /m, '### ').replace(/^## /gm, '#### '), ''));

  if (doc.pageAudits.length || doc.audits.length || doc.keywordMap.length || doc.siteAudit) {
    lines.push('## 6. Auditorías', '');
    if (doc.siteAudit) {
      const site = doc.siteAudit;
      lines.push(`### Auditoría del sitio por su sitemap — ${site.score}/100`, '',
        `${site.origin}${site.environment === 'local' ? ' (entorno de desarrollo)' : ''} · ${site.checked} de ${site.sitemap.total} URLs comprobadas.`, '',
        ...site.sitemap.issues.map((issue) => `- ${issue}`), '');
      if (site.issues.length) {
        lines.push('| Gravedad | Problema | Qué hacer | Páginas |', '|---|---|---|---|',
          ...site.issues.map((issue) => `| ${issue.severity} | ${cell(issue.title)} | ${cell(issue.fix)} | ${cell(issue.urls.slice(0, 5).join(', '))}${issue.count > 5 ? ` y ${issue.count - 5} más` : ''} |`), '');
      } else {
        lines.push('Ninguna de las páginas comprobadas tiene problemas.', '');
      }
    }
    if (doc.keywordMap.length) {
      lines.push(`### Mapa de keywords de ${meta.site}`, '', '| Keyword | Página del sitio | Observación |', '|---|---|---|',
        ...doc.keywordMap.map((entry) => `| ${cell(entry.keyword)} | ${entry.url || '—'} | ${!entry.url ? 'Hueco de contenido: crear' : entry.alternatives.length ? `Compite con ${entry.alternatives.length} más` : entry.coverage < 1 ? 'Coincidencia parcial' : 'Página propia'} |`), '');
    }
    doc.pageAudits.forEach((audit) => lines.push(auditBlock(`${audit.url}${audit.keyword ? ` · «${audit.keyword}»` : ''}`, audit)));
    doc.audits.forEach((audit) => lines.push(auditBlock(`Texto: ${audit.name}${audit.keyword ? ` · «${audit.keyword}»` : ''}`, audit)));
  }

  lines.push('## Metodología', '', ...METHODOLOGY.map(([title, text]) => `- **${title}.** ${text}`), '');
  return lines.join('\n');
}
