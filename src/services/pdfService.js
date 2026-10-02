import PDFDocument from 'pdfkit';
import { INTENT_HINTS, INTENT_LABELS, TYPE_LABELS } from '../../shared/insights.js';
import { MONTHS, MONTHS_SHORT } from '../../shared/seasonality.js';
import { buildDeliverable, METHODOLOGY } from './deliverable.js';

const BASE_COLORS = { ink: '#141414', muted: '#666666', accent: '#d0201c', rule: '#cfcfcf', soft: '#f3f2ee', ok: '#17803f', warn: '#9a5b00', bad: '#c21d36' };
const MARGIN = 50;
const STATUS_LABELS = { ok: 'Correcto', warn: 'Mejorable', fail: 'Falla', skip: 'Sin evaluar' };

// Las fuentes estándar de PDF solo cubren WinAnsi: cualquier otro carácter se sustituye para no romper el texto
const clean = (value) => String(value ?? '')
  .replace(/[→➜]/g, '->')
  .replace(/[^\x09\x0A\x20-\x7E -ÿ€‘’“”–—…•]/g, '?');

const int = (value) => (typeof value === 'number' ? Math.round(value).toLocaleString('es-ES') : '—');
const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : '—');
const euro = (value) => (typeof value === 'number' ? `${value.toFixed(2).replace('.', ',')} €` : '—');
const longDate = (value) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const compact = (value) => (value >= 1e6 ? `${(value / 1e6).toFixed(1).replace('.', ',')} M` : value >= 1e3 ? `${Math.round(value / 1e3)} mil` : String(value));

// Pequeña capa sobre pdfkit: títulos, párrafos, tablas con salto de página, barras y la matriz de oportunidad
class Report {
  constructor(doc, colors) {
    this.doc = doc;
    this.colors = colors;
    this.width = doc.page.width - MARGIN * 2;
    this.bottom = doc.page.height - MARGIN - 20;
    this.sections = 0;
  }

  ensure(height) {
    if (this.doc.y + height > this.bottom) this.doc.addPage();
  }

  space(amount = 10) {
    this.doc.y += amount;
  }

  section(kicker, title, intro) {
    this.sections += 1;
    const number = String(this.sections).padStart(2, '0');
    this.doc.addPage();
    this.doc.font('Helvetica').fontSize(8).fillColor(this.colors.accent).text(clean(`${number} · ${kicker}`).toUpperCase(), MARGIN, MARGIN, { characterSpacing: 1.5 });
    this.space(6);
    this.doc.font('Helvetica-Bold').fontSize(20).fillColor(this.colors.ink).text(clean(title), { width: this.width });
    this.doc.moveTo(MARGIN, this.doc.y + 6).lineTo(MARGIN + 40, this.doc.y + 6).lineWidth(2).strokeColor(this.colors.accent).stroke();
    this.space(18);
    if (intro) this.paragraph(intro, { color: this.colors.muted });
  }

  heading(text, { color = this.colors.ink, size = 12 } = {}) {
    this.ensure(50);
    this.space(8);
    this.doc.font('Helvetica-Bold').fontSize(size).fillColor(color).text(clean(text), MARGIN, this.doc.y, { width: this.width });
    this.space(4);
  }

  paragraph(text, { color = this.colors.ink, size = 10 } = {}) {
    this.doc.font('Helvetica').fontSize(size).fillColor(color);
    this.ensure(this.doc.heightOfString(clean(text), { width: this.width }) + 4);
    this.doc.text(clean(text), MARGIN, this.doc.y, { width: this.width, lineGap: 2 });
    this.space(6);
  }

  bullets(items, { size = 9.5 } = {}) {
    items.forEach((item) => {
      this.doc.font('Helvetica').fontSize(size);
      const height = this.doc.heightOfString(clean(item), { width: this.width - 14, lineGap: 2 });
      this.ensure(height + 4);
      const top = this.doc.y;
      this.doc.fillColor(this.colors.accent).text('•', MARGIN, top);
      this.doc.fillColor(this.colors.ink).text(clean(item), MARGIN + 14, top, { width: this.width - 14, lineGap: 2 });
      this.doc.y = top + height + 4;
    });
    this.space(4);
  }

  // Bloque con título en negrita y texto, marcado con una barra de color a la izquierda
  callout(title, text, color = this.colors.accent) {
    const inner = this.width - 14;
    this.doc.font('Helvetica-Bold').fontSize(10);
    const titleHeight = this.doc.heightOfString(clean(title), { width: inner });
    this.doc.font('Helvetica').fontSize(9.5);
    const textHeight = this.doc.heightOfString(clean(text), { width: inner, lineGap: 2 });
    const height = titleHeight + textHeight + 6;
    this.ensure(height + 10);
    const top = this.doc.y;
    this.doc.rect(MARGIN, top, 3, height).fill(color);
    this.doc.font('Helvetica-Bold').fontSize(10).fillColor(this.colors.ink).text(clean(title), MARGIN + 14, top, { width: inner });
    this.doc.font('Helvetica').fontSize(9.5).fillColor(this.colors.ink).text(clean(text), MARGIN + 14, this.doc.y + 2, { width: inner, lineGap: 2 });
    this.doc.y = top + height + 10;
  }

  // Fila de cifras destacadas
  figures(items) {
    const gap = 10;
    const boxWidth = (this.width - gap * (items.length - 1)) / items.length;
    this.ensure(70);
    const top = this.doc.y;
    items.forEach((item, index) => {
      const left = MARGIN + index * (boxWidth + gap);
      this.doc.rect(left, top, boxWidth, 56).fill(this.colors.soft);
      this.doc.font('Helvetica-Bold').fontSize(18).fillColor(this.colors.accent).text(clean(item.value), left + 10, top + 10, { width: boxWidth - 20, lineBreak: false });
      this.doc.font('Helvetica').fontSize(7.5).fillColor(this.colors.muted).text(clean(item.label).toUpperCase(), left + 10, top + 36, { width: boxWidth - 20, characterSpacing: 0.6 });
    });
    this.doc.y = top + 70;
  }

  // columns: [{ label, width (fracción del ancho), align }]
  table(columns, rows, { emptyText = 'Sin datos.' } = {}) {
    if (rows.length === 0) {
      this.paragraph(emptyText, { color: this.colors.muted });
      return;
    }
    const padding = 5;
    const widths = columns.map((column) => column.width * this.width);
    const lefts = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((total, width) => total + width, 0));

    const drawHeader = () => {
      const top = this.doc.y;
      this.doc.rect(MARGIN, top, this.width, 18).fill(this.colors.ink);
      this.doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
      columns.forEach((column, index) => {
        this.doc.text(clean(column.label).toUpperCase(), lefts[index] + padding, top + 5.5, {
          width: widths[index] - padding * 2, align: column.align || 'left', lineBreak: false, characterSpacing: 0.5
        });
      });
      this.doc.y = top + 18;
    };

    this.ensure(50);
    drawHeader();
    rows.forEach((row, rowIndex) => {
      this.doc.font('Helvetica').fontSize(8.5);
      const cells = row.map((cell) => (cell && typeof cell === 'object' ? cell : { text: cell }));
      const height = Math.max(...cells.map((cell, index) =>
        this.doc.heightOfString(clean(cell.text), { width: widths[index] - padding * 2 }))) + padding * 2;
      if (this.doc.y + height > this.bottom) {
        this.doc.addPage();
        drawHeader();
      }
      const top = this.doc.y;
      if (rowIndex % 2 === 0) this.doc.rect(MARGIN, top, this.width, height).fill(this.colors.soft);
      cells.forEach((cell, index) => {
        this.doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(cell.color || this.colors.ink)
          .text(clean(cell.text), lefts[index] + padding, top + padding, { width: widths[index] - padding * 2, align: columns[index].align || 'left' });
      });
      this.doc.y = top + height;
    });
    this.space(12);
  }

  // Barras horizontales proporcionales: [{ label, value, note }]
  bars(items) {
    const max = Math.max(1, ...items.map((item) => item.value));
    const labelWidth = 130;
    const noteWidth = 150;
    const track = this.width - labelWidth - noteWidth - 16;
    items.forEach((item) => {
      this.ensure(20);
      const top = this.doc.y;
      this.doc.font('Helvetica').fontSize(9).fillColor(this.colors.ink).text(clean(item.label), MARGIN, top + 2, { width: labelWidth, lineBreak: false });
      this.doc.rect(MARGIN + labelWidth + 8, top, track, 12).fill(this.colors.soft);
      this.doc.rect(MARGIN + labelWidth + 8, top, Math.max(item.value > 0 ? 2 : 0, track * (item.value / max)), 12).fill(this.colors.accent);
      this.doc.font('Helvetica').fontSize(8.5).fillColor(this.colors.muted).text(clean(item.note), MARGIN + labelWidth + track + 16, top + 2, { width: noteWidth, lineBreak: false });
      this.doc.y = top + 18;
    });
    this.space(8);
  }

  // Perfil estacional: una barra por mes (100 = media del año); los meses de temporada alta, en color de acento
  profile(values, peakMonths) {
    const height = 54;
    this.ensure(height + 26);
    const top = this.doc.y;
    const gap = 4;
    const barWidth = (this.width - gap * 11) / 12;
    const max = Math.max(130, ...values);
    const base = top + height;
    values.forEach((value, month) => {
      const left = MARGIN + month * (barWidth + gap);
      const barHeight = Math.max(1, (value / max) * height);
      const peak = peakMonths.includes(month);
      this.doc.rect(left, base - barHeight, barWidth, barHeight).fill(peak ? this.colors.accent : this.colors.rule);
      this.doc.font(peak ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).fillColor(peak ? this.colors.ink : this.colors.muted)
        .text(MONTHS_SHORT[month], left, base + 3, { width: barWidth, align: 'center', lineBreak: false })
        .text(String(value), left, base + 11, { width: barWidth, align: 'center', lineBreak: false });
    });
    // línea de la media del año
    const averageY = base - (100 / max) * height;
    this.doc.moveTo(MARGIN, averageY).lineTo(MARGIN + this.width, averageY).lineWidth(0.5).dash(2, { space: 2 }).strokeColor(this.colors.muted).stroke().undash();
    this.doc.y = base + 26;
  }

  // Matriz de oportunidad: competencia (X) frente a búsquedas (Y, logarítmico). Numera los mejores puntos.
  matrix(keywords, medianVolume) {
    const points = keywords.filter((entry) => entry.volume > 0 && entry.competition !== null);
    if (points.length === 0) return [];
    const height = 250;
    this.ensure(height + 40);
    const left = MARGIN + 46;
    const top = this.doc.y + 6;
    const width = this.width - 56;
    const logs = points.map((entry) => Math.log10(entry.volume));
    const minLog = Math.floor(Math.min(...logs));
    const maxLog = Math.max(minLog + 1, Math.ceil(Math.max(...logs)));
    const x = (competition) => left + competition * width;
    const y = (volume) => top + height - ((Math.log10(volume) - minLog) / (maxLog - minLog)) * height;
    const splitX = x(0.4);
    const splitY = y(Math.min(Math.max(medianVolume || 1, 10 ** minLog), 10 ** maxLog));
    const doc = this.doc;

    doc.save().fillOpacity(0.1).rect(left, top, splitX - left, splitY - top).fill(this.colors.accent).restore();
    doc.rect(left, top, width, height).lineWidth(0.5).strokeColor(this.colors.rule).stroke();
    doc.moveTo(splitX, top).lineTo(splitX, top + height).dash(3, { space: 3 }).strokeColor(this.colors.muted).stroke().undash();
    doc.moveTo(left, splitY).lineTo(left + width, splitY).dash(3, { space: 3 }).stroke().undash();

    doc.font('Helvetica').fontSize(7).fillColor(this.colors.muted);
    for (let power = minLog; power <= maxLog; power++) {
      doc.text(compact(10 ** power), MARGIN, y(10 ** power) - 3, { width: 40, align: 'right', lineBreak: false });
    }
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((tick) => doc.text(`${tick * 100} %`, x(tick) - 15, top + height + 5, { width: 30, align: 'center', lineBreak: false }));
    doc.text('COMPETENCIA', left, top + height + 16, { width, align: 'center', characterSpacing: 1, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(this.colors.accent).text('VICTORIAS RÁPIDAS', left + 5, top + 5, { lineBreak: false, characterSpacing: 0.8 });
    doc.font('Helvetica').fillColor(this.colors.muted).text('A LARGO PLAZO', left, top + 5, { width: width - 5, align: 'right', lineBreak: false, characterSpacing: 0.8 });

    const best = [...points].sort((a, b) => b.score - a.score).slice(0, 10);
    points.forEach((entry) => {
      const isMain = entry.type === 'main';
      doc.circle(x(entry.competition), y(entry.volume), isMain ? 4.5 : 3).fillOpacity(isMain ? 1 : 0.55).fill(isMain ? this.colors.accent : this.colors.ink);
    });
    doc.fillOpacity(1);
    best.forEach((entry, index) => {
      const right = entry.competition > 0.85;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(this.colors.ink)
        .text(String(index + 1), x(entry.competition) + (right ? -16 : 6), y(entry.volume) - 3 + (index % 2 ? 5 : -5), { width: 10, align: right ? 'right' : 'left', lineBreak: false });
    });
    this.doc.y = top + height + 32;
    return best;
  }
}

function cover(doc, colors, { meta, insights }) {
  const width = doc.page.width - MARGIN * 2;
  doc.rect(0, 0, doc.page.width, 8).fill(colors.accent);
  doc.font('Helvetica').fontSize(9).fillColor(colors.accent).text('ESTUDIO DE POSICIONAMIENTO EN BUSCADORES', MARGIN, 150, { characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(30).fillColor(colors.ink).text(clean(meta.title), MARGIN, 172, { width });
  doc.font('Helvetica').fontSize(13).fillColor(colors.muted).text(clean(meta.keywords.join(' · ')), MARGIN, doc.y + 10, { width });

  const rows = [
    ['Cliente', meta.client],
    ['Sitio web', meta.site],
    ['Elaborado por', meta.author],
    ['Fecha del estudio', longDate(meta.date)],
    ['Mercado', meta.country ? `${meta.country} · idioma ${meta.language}` : null],
    ['Keywords analizadas', `${insights.totals.keywords} (${meta.keywords.length} principales)`]
  ].filter(([, value]) => value);

  let top = 430;
  rows.forEach(([label, value]) => {
    doc.moveTo(MARGIN, top).lineTo(MARGIN + width, top).lineWidth(0.5).strokeColor(colors.rule).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text(label.toUpperCase(), MARGIN, top + 9, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.ink).text(clean(value), MARGIN + 170, top + 7, { width: width - 170 });
    top += 30;
  });
}

// «Búsquedas» siempre son mensuales; se explica en la metodología para no partir la cabecera
const KEYWORD_COLUMNS = [
  { label: 'Keyword', width: 0.33 },
  { label: 'Tipo', width: 0.12 },
  { label: 'Intención', width: 0.14 },
  { label: 'Búsquedas', width: 0.13, align: 'right' },
  { label: 'Comp.', width: 0.1, align: 'right' },
  { label: 'CPC', width: 0.09, align: 'right' },
  { label: 'Punt.', width: 0.09, align: 'right' }
];

function writeContent(doc, colors, deliverable) {
  const { meta, insights, mains, plan, briefs } = deliverable;
  const page = new Report(doc, colors);
  const status = { ok: colors.ok, warn: colors.warn, fail: colors.bad, skip: colors.muted };
  const keywordRow = (entry) => [
    { text: entry.keyword, bold: entry.type === 'main' },
    TYPE_LABELS[entry.type],
    INTENT_LABELS[entry.intent],
    int(entry.volume),
    percent(entry.competition),
    euro(entry.cpc),
    { text: String(entry.score), bold: true, color: colors.accent }
  ];

  cover(doc, colors, deliverable);

  // ---------- Resumen ejecutivo ----------
  page.section('Resumen ejecutivo', 'Qué dice el estudio',
    'Las conclusiones principales, cada una con el dato que la sostiene. El plan de acción de la sección siguiente las convierte en tareas.');
  page.figures([
    { value: int(insights.totals.keywords), label: 'Keywords estudiadas' },
    { value: int(insights.totals.volume), label: 'Búsquedas al mes' },
    { value: euro(deliverable.averages.cpc), label: 'CPC medio (principales)' },
    { value: percent(deliverable.averages.competition), label: 'Competencia media' }
  ]);
  if (deliverable.siteData) {
    page.callout(`Punto de partida de ${meta.site}`,
      `Tráfico orgánico estimado: ${int(deliverable.siteData.traffic)} visitas al mes. Keywords posicionadas en el top 3: ${int(deliverable.siteData.keyword_count_top3)}; ` +
      `en el top 10: ${int(deliverable.siteData.keyword_count_top10)}; en el top 100: ${int(deliverable.siteData.keyword_count_top100)}.`, colors.ink);
  }
  const levelColor = { success: colors.ok, warning: colors.warn, info: colors.accent };
  insights.recommendations.forEach((item) => page.callout(item.title, item.text, levelColor[item.level]));
  if (meta.notes) page.callout('Notas del estudio', meta.notes, colors.rule);

  // ---------- Plan de acción ----------
  page.section('Plan de acción', 'Qué hacer y en qué orden',
    'Tareas ordenadas por impacto estimado y, a igual impacto, por menor esfuerzo. Las primeras son las que antes se notan.');
  page.table(
    [{ label: 'N.º', width: 0.07, align: 'right' }, { label: 'Tarea', width: 0.55 }, { label: 'Área', width: 0.14 }, { label: 'Impacto', width: 0.12 }, { label: 'Esfuerzo', width: 0.12 }],
    plan.map((task) => [String(task.priority), { text: task.title, bold: true }, task.area,
      { text: task.impact, bold: task.impact === 'alto', color: task.impact === 'alto' ? colors.accent : colors.ink }, task.effort]),
    { emptyText: 'El estudio no tiene datos suficientes para proponer tareas.' }
  );
  plan.forEach((task) => page.callout(`${task.priority}. ${task.title}`, `Por qué: ${task.why}\nCómo: ${task.how}`, task.impact === 'alto' ? colors.accent : colors.rule));

  // ---------- Keywords y oportunidades ----------
  page.section('Oportunidades', 'Dónde está la demanda',
    'Cada punto es una keyword. Arriba a la izquierda quedan las que tienen muchas búsquedas y poca competencia; en rojo, las keywords principales del estudio. Los números señalan las diez mejores oportunidades de la tabla.');
  const best = page.matrix(insights.keywords, insights.totals.medianVolume);
  if (best.length > 0) {
    page.table(
      [{ label: 'N.º', width: 0.07, align: 'right' }, { label: 'Keyword', width: 0.45 }, { label: 'Búsquedas', width: 0.16, align: 'right' },
        { label: 'Comp.', width: 0.12, align: 'right' }, { label: 'CPC', width: 0.1, align: 'right' }, { label: 'Punt.', width: 0.1, align: 'right' }],
      best.map((entry, index) => [String(index + 1), { text: entry.keyword, bold: entry.type === 'main' }, int(entry.volume), percent(entry.competition), euro(entry.cpc),
        { text: String(entry.score), bold: true, color: colors.accent }])
    );
  }
  page.heading('Keywords principales');
  page.table(KEYWORD_COLUMNS, mains.map(keywordRow));
  page.heading('Ranking de oportunidades');
  page.paragraph('Incluye sugerencias de Google, keywords similares e ideas ampliadas. Las similares no traen dato de competencia y por eso no salen en la matriz.', { color: colors.muted, size: 9 });
  page.table(KEYWORD_COLUMNS, insights.opportunities.map(keywordRow), { emptyText: 'Ninguna keyword del estudio tiene datos de demanda.' });
  page.heading(`Victorias rápidas (${insights.quickWins.length})`);
  page.paragraph('Keywords con demanda por encima de la mediana del estudio y competencia inferior al 40 %.', { color: colors.muted, size: 9 });
  page.table(KEYWORD_COLUMNS, insights.quickWins.slice(0, 15).map(keywordRow), { emptyText: 'No hay keywords que cumplan las dos condiciones.' });

  // ---------- Intención y temas ----------
  page.section('Intención y temas', 'Qué quiere quien busca',
    'Cada keyword se clasifica por las palabras que la acompañan (comprar, mejor, cómo, cerca…). La intención decide el tipo de página que hay que crear.');
  page.bars(insights.intents.map((entry) => ({ label: entry.label, value: entry.volume, note: `${entry.count} keywords · ${int(entry.volume)} búsquedas` })));
  insights.intents.filter((entry) => entry.count > 0).forEach((entry) => {
    const examples = insights.keywords.filter((keyword) => keyword.intent === entry.intent).slice(0, 4).map((keyword) => `«${keyword.keyword}»`).join(', ');
    page.callout(entry.label, `${INTENT_HINTS[entry.intent]} Ejemplos: ${examples}.`);
  });

  page.heading('Temas en los que se agrupan las keywords');
  page.paragraph('Grupos de keywords que comparten un término. Cada grupo es candidato a una página, una categoría o una sección de contenido.', { color: colors.muted, size: 9 });
  page.table(
    [{ label: 'Tema', width: 0.17 }, { label: 'N.º', width: 0.07, align: 'right' }, { label: 'Búsquedas', width: 0.13, align: 'right' },
      { label: 'Comp.', width: 0.1, align: 'right' }, { label: 'Keywords del grupo', width: 0.53 }],
    insights.clusters.slice(0, 20).map((cluster) => [
      { text: cluster.term, bold: true },
      String(cluster.keywords.length),
      int(cluster.totalVolume),
      percent(cluster.avgCompetition),
      cluster.keywords.slice(0, 6).map((entry) => entry.keyword).join(', ') + (cluster.keywords.length > 6 ? '…' : '')
    ]),
    { emptyText: 'Las keywords del estudio no comparten términos suficientes para formar grupos.' }
  );

  // ---------- Tendencias y calendario ----------
  const trends = deliverable.trends;
  if (trends && trends.items.some((item) => item.analysis.enough)) {
    const signed = (value) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value} %`);
    const months = (list) => list.map((month) => MONTHS[month]).join(', ');
    page.section('Tendencias', 'Cuándo se busca y hacia dónde va',
      'Interés en Google de los últimos cinco años para las keywords principales y las mejores oportunidades. El volumen dice cuánto se busca de media; esto dice en qué meses y si crece o cae.');
    page.table(
      [{ label: 'Keyword', width: 0.27 }, { label: 'Patrón', width: 0.19 }, { label: 'Temporada alta', width: 0.24 }, { label: 'Último año', width: 0.15, align: 'right' }, { label: '5 años', width: 0.15, align: 'right' }],
      trends.items.map((item) => {
        const a = item.analysis;
        if (!a.enough) return [{ text: item.keyword, bold: item.role === 'main' }, { text: 'Sin datos suficientes', color: colors.muted }, '—', '—', '—'];
        const tone = (value) => (value === null ? colors.ink : value >= 15 ? colors.ok : value <= -15 ? colors.bad : colors.ink);
        return [{ text: item.keyword, bold: item.role === 'main' }, a.patternLabel, a.peakMonths.length ? months(a.peakMonths) : '—',
          { text: signed(a.yearChange), bold: true, color: tone(a.yearChange) }, { text: signed(a.longChange), color: tone(a.longChange) }];
      })
    );
    const findingColor = { success: colors.ok, warning: colors.warn, info: colors.accent };
    trends.findings.forEach((finding) => page.callout(finding.title, finding.text, findingColor[finding.level]));

    const seasonal = trends.items.filter((item) => item.analysis.peakMonths.length > 0);
    if (seasonal.length > 0) {
      page.heading('Perfil del año de las keywords con temporada');
      page.paragraph('Cada barra es un mes; 100 es la media del año (línea de puntos). En color, los meses de temporada alta.', { color: colors.muted, size: 9 });
      seasonal.forEach((item) => {
        page.ensure(110);
        page.heading(item.keyword, { size: 10 });
        page.profile(item.analysis.profile, item.analysis.peakMonths);
      });

      page.heading('Calendario de los próximos doce meses');
      page.paragraph('El contenido se publica tres meses antes del pico para llegar posicionado; las campañas de pago, correo y redes arrancan un mes antes.', { color: colors.muted, size: 9 });
      page.table(
        [{ label: 'Mes', width: 0.19 }, { label: 'Publicar contenido para', width: 0.27 }, { label: 'Arrancar campaña de', width: 0.27 }, { label: 'En temporada alta', width: 0.27 }],
        trends.calendar.filter((month) => month.peaks.length || month.publish.length || month.campaigns.length).map((month) => [
          { text: `${month.label} ${month.year}`, bold: true }, month.publish.join(', ') || '—', month.campaigns.join(', ') || '—',
          { text: month.peaks.join(', ') || '—', color: month.peaks.length ? colors.accent : colors.ink, bold: month.peaks.length > 0 }
        ])
      );
    }
    if (trends.rising.length > 0) {
      page.heading('Consultas en auge');
      page.paragraph('Las búsquedas relacionadas que más han crecido. Las que no están en el estudio son candidatas a contenido nuevo o pistas de producto.', { color: colors.muted, size: 9 });
      page.table(
        [{ label: 'Consulta', width: 0.4 }, { label: 'Subida', width: 0.15, align: 'right' }, { label: 'Relacionada con', width: 0.27 }, { label: 'En el estudio', width: 0.18 }],
        trends.rising.slice(0, 20).map((query) => [
          { text: query.query, bold: !query.inStudy }, query.breakout ? 'Disparada' : `+${int(query.value)} %`, query.from,
          { text: query.inStudy ? 'Sí' : 'No: evaluar', color: query.inStudy ? colors.muted : colors.warn, bold: !query.inStudy }
        ])
      );
    }
  }

  // ---------- Briefs de contenido ----------
  page.section('Contenido', 'Brief de cada keyword principal',
    'Lo que necesita quien vaya a escribir cada página: enfoque, estructura, keywords secundarias y preguntas que responder.');
  briefs.forEach((brief, index) => {
    if (index > 0) page.space(10);
    page.heading(brief.keyword, { color: colors.accent, size: 14 });
    page.bullets([
      `Intención: ${brief.intentLabel}. Tipo de página: ${brief.pageType}.`,
      `Extensión orientativa: de ${brief.wordCount.min} a ${brief.wordCount.max} palabras.`,
      `Enfoque: ${brief.angle}`,
      `Títulos posibles: ${brief.titleIdeas.join(' · ')}`,
      `Datos estructurados: ${brief.schema.join(', ')}.`
    ]);
    page.heading('Esquema propuesto', { size: 10 });
    page.bullets(brief.outline.map((section) => `H2: ${section.heading}${section.covers.length ? ` (cubre: ${section.covers.join(', ')})` : ''}`), { size: 9 });
    if (brief.secondaryKeywords.length) {
      page.heading('Keywords secundarias', { size: 10 });
      page.paragraph(brief.secondaryKeywords.map((item) => `${item.keyword} (${int(item.volume)})`).join(' · '), { size: 9 });
    }
    if (brief.terms.length) {
      page.heading('Vocabulario a cubrir', { size: 10 });
      page.paragraph(brief.terms.join(', '), { size: 9 });
    }
  });
  page.heading('Antes de publicar cualquier página');
  page.bullets(briefs[0]?.checklist || []);

  // ---------- Auditorías ----------
  const auditTable = (audit) => page.table(
    [{ label: 'Estado', width: 0.14 }, { label: 'Comprobación', width: 0.28 }, { label: 'Detalle', width: 0.58 }],
    audit.result.checks.filter((item) => item.status === 'fail' || item.status === 'warn').map((item) => [
      { text: STATUS_LABELS[item.status], bold: true, color: status[item.status] }, item.label, item.detail
    ]),
    { emptyText: 'Nada que corregir: todas las comprobaciones evaluadas son correctas.' }
  );
  const observation = (entry) => (!entry.url ? 'Hueco de contenido: crear' : entry.alternatives.length > 0 ? `Compite con ${entry.alternatives.length} más` : entry.coverage < 1 ? 'Coincidencia parcial' : 'Página propia');
  const siteAudit = deliverable.siteAudit;
  if (deliverable.pageAudits.length + deliverable.audits.length + deliverable.keywordMap.length > 0 || siteAudit) {
    page.section('Sitio web', 'Estado de las páginas y los textos',
      'Qué página del sitio cubre cada keyword y, de cada página o texto revisado, su nota de 0 a 100 y lo que hay que corregir. Lo que está bien no se lista.');
    if (siteAudit) {
      const severityColor = { alta: colors.bad, media: colors.warn, baja: colors.muted };
      page.heading(`Auditoría del sitio por su sitemap${siteAudit.environment === 'local' ? ' (entorno de desarrollo)' : ''}`);
      page.paragraph(`${siteAudit.origin} · revisado el ${longDate(siteAudit.fetchedAt)} · ${siteAudit.sitemap.sources.map((source) => source.url.replace(/^https?:\/\/[^/]+/, '')).join(', ')}`, { color: colors.muted, size: 9 });
      page.figures([
        { value: `${siteAudit.score}/100`, label: 'Páginas sin problemas' },
        { value: int(siteAudit.sitemap.total), label: 'URLs en el sitemap' },
        { value: int(siteAudit.checked), label: 'URLs comprobadas' },
        { value: String(siteAudit.issues.length), label: 'Tipos de problema' }
      ]);
      if (siteAudit.sitemap.issues.length > 0) page.callout('Sobre el sitemap', siteAudit.sitemap.issues.join(' '), colors.rule);
      page.table(
        [{ label: 'Gravedad', width: 0.12 }, { label: 'Problema', width: 0.3 }, { label: 'Qué hacer', width: 0.3 }, { label: 'Páginas', width: 0.28 }],
        siteAudit.issues.map((issue) => [
          { text: issue.severity, bold: true, color: severityColor[issue.severity] }, { text: issue.title, bold: true }, issue.fix,
          issue.urls.slice(0, 5).map((url) => url.replace(/^https?:\/\/[^/]+/, '') || '/').join('\n') + (issue.count > 5 ? `\n… y ${issue.count - 5} más` : '')
        ]),
        { emptyText: 'Ninguna de las páginas comprobadas tiene problemas.' }
      );
    }
    if (deliverable.keywordMap.length > 0) {
      page.heading(`Mapa de keywords de ${meta.site}`);
      page.table(
        [{ label: 'Keyword', width: 0.3 }, { label: 'Página del sitio', width: 0.45 }, { label: 'Observación', width: 0.25 }],
        deliverable.keywordMap.map((entry) => [
          { text: entry.keyword, bold: true },
          entry.url ? entry.url.replace(/^https?:\/\/[^/]+/, '') || '/' : '—',
          { text: observation(entry), color: entry.url ? colors.ink : colors.warn, bold: !entry.url }
        ])
      );
    }
    deliverable.pageAudits.forEach((audit) => {
      page.heading(audit.url, { size: 11 });
      page.paragraph(`${audit.keyword ? `Keyword objetivo: «${audit.keyword}» · ` : ''}Revisada el ${longDate(audit.createdAt)}`, { color: colors.muted, size: 9 });
      const passed = audit.result.checks.filter((item) => item.status === 'ok').length;
      page.figures([
        { value: `${audit.result.score}/100`, label: audit.result.verdict },
        { value: `${passed}/${audit.result.checks.filter((item) => item.status !== 'skip').length}`, label: 'Comprobaciones correctas' },
        { value: int(audit.result.stats.words), label: 'Palabras' },
        { value: `${audit.result.stats.responseMs} ms`, label: 'Respuesta del servidor' }
      ]);
      auditTable(audit);
    });
    deliverable.audits.forEach((audit) => {
      page.heading(`Texto: ${audit.name}`, { size: 11 });
      page.paragraph(`${audit.keyword ? `Keyword objetivo: «${audit.keyword}» · ` : ''}Revisado el ${longDate(audit.createdAt)}`, { color: colors.muted, size: 9 });
      page.figures([
        { value: `${audit.result.score}/100`, label: audit.result.verdict },
        { value: int(audit.result.stats.words), label: 'Palabras' },
        { value: `${String(audit.result.stats.keywordDensity).replace('.', ',')} %`, label: 'Densidad de keyword' },
        { value: audit.result.stats.readability === null ? '—' : `${audit.result.stats.readability}/100`, label: 'Legibilidad' }
      ]);
      auditTable(audit);
      if (audit.result.related.missing.length > 0) {
        page.callout('Términos del estudio que el texto no usa', audit.result.related.missing.slice(0, 40).join(', ') + '.', colors.rule);
      }
    });
  }

  // ---------- Metodología ----------
  page.section('Metodología', 'Cómo leer este informe', null);
  METHODOLOGY.forEach(([title, text]) => page.callout(title, text, colors.rule));
}

function footers(doc, colors, meta) {
  const range = doc.bufferedPageRange();
  for (let index = 1; index < range.count; index++) {
    doc.switchToPage(index);
    const top = doc.page.height - MARGIN;
    doc.moveTo(MARGIN, top - 8).lineTo(doc.page.width - MARGIN, top - 8).lineWidth(0.5).strokeColor(colors.rule).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(colors.muted);
    doc.text(clean([meta.title, meta.client, meta.author].filter(Boolean).join(' · ')), MARGIN, top, { lineBreak: false });
    doc.text(`${index + 1} / ${range.count}`, MARGIN, top, { width: doc.page.width - MARGIN * 2, align: 'right', lineBreak: false });
  }
}

/**
 * Genera el informe para clientes de un estudio.
 * @param {object[]} report  datos del estudio
 * @param {object} study     ficha del estudio: name, client, site, author, accent, notes, audits, pageAudits, siteData
 * @returns {Promise<Buffer>}
 */
export function buildReportPdf(report, study = {}) {
  return new Promise((resolve, reject) => {
    const deliverable = buildDeliverable(report, study);
    // el color de acento lo puede poner la agencia para que el informe lleve su marca
    const colors = { ...BASE_COLORS, ...(deliverable.meta.accent ? { accent: deliverable.meta.accent } : {}) };
    const doc = new PDFDocument({
      size: 'A4',
      // el pie se escribe dentro del margen inferior: sin margen propio pdfkit abriría una página nueva
      margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 0 },
      bufferPages: true,
      info: {
        Title: clean(deliverable.meta.title),
        Author: clean(deliverable.meta.author || 'SEO App'),
        Subject: clean(deliverable.meta.keywords.join(', '))
      }
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      writeContent(doc, colors, deliverable);
      footers(doc, colors, deliverable.meta);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
