import { test } from 'node:test';
import assert from 'node:assert';
import { buildInsights, classifyIntent, clusterByTerms, collectKeywords, opportunityScore } from '../shared/insights.js';
import { analyzeContent, relatedKeywordsFor } from '../shared/contentAnalysis.js';

const report = [
  {
    keyword: 'zapatos',
    language: 'es',
    suggestions: ['zapatos mujer', 'comprar zapatos', 'zapatos raros'],
    ideas: [{ keyword: 'cómo limpiar zapatos', group: 'pregunta' }, { keyword: 'mejor zapatos mujer', group: 'comparativa' }],
    keywordData: {
      'zapatos raros': { no_data: true },
      'zapatos mujer': { search_volume: 40500, competition: 0.2, cpc: 0.29 },
      'comprar zapatos': { search_volume: 720, competition: 1, cpc: 1.1 },
      'cómo limpiar zapatos': { search_volume: 2400, competition: 0.1, cpc: 0.05 },
      zapatos: {
        search_volume: 135000,
        competition: 0.98,
        cpc: 0.31,
        similar_keywords: [{ keyword: 'tienda zapatos', search_volume: 3600, cpc: 0.27 }, { keyword: 'zapatos mujer', search_volume: 40500, cpc: 0.29 }]
      }
    },
    errors: []
  }
];

test('classifyIntent reconoce la intención por las palabras de la keyword', () => {
  assert.strictEqual(classifyIntent('comprar zapatos baratos'), 'transactional');
  assert.strictEqual(classifyIntent('Cómo limpiar zapatos'), 'informational');
  assert.strictEqual(classifyIntent('mejores zapatos de running'), 'commercial');
  assert.strictEqual(classifyIntent('zapatería cerca de mí'), 'local');
  assert.strictEqual(classifyIntent('zapatos'), 'general');
});

test('collectKeywords une todos los tipos sin duplicar keywords', () => {
  const keywords = collectKeywords(report);
  const texts = keywords.map((entry) => entry.keyword);
  assert.strictEqual(new Set(texts).size, texts.length);
  assert.strictEqual(texts.filter((text) => text === 'zapatos mujer').length, 1);
  // la entrada con dato de competencia (sugerencia) gana a la que no lo tiene (similar)
  assert.strictEqual(keywords.find((entry) => entry.keyword === 'zapatos mujer').competition, 0.2);
  assert.strictEqual(keywords.find((entry) => entry.keyword === 'tienda zapatos').competition, null);
  assert.strictEqual(keywords.find((entry) => entry.keyword === 'zapatos raros').volume, null);
  assert.strictEqual(keywords.find((entry) => entry.keyword === 'cómo limpiar zapatos').type, 'idea');
});

test('opportunityScore premia demanda y poca competencia', () => {
  const easy = opportunityScore({ volume: 10000, competition: 0.1, cpc: 0.5 }, 100000);
  const hard = opportunityScore({ volume: 10000, competition: 0.95, cpc: 0.5 }, 100000);
  assert(easy > hard);
  assert.strictEqual(opportunityScore({ volume: 0, competition: 0, cpc: 5 }, 100000), 0);
  // sin dato propio se usa la competencia de la keyword principal: no adelanta a una con dato por faltarle
  const unknown = opportunityScore({ volume: 10000, competition: null, parentCompetition: 0.95, cpc: 0.5 }, 100000);
  assert.strictEqual(unknown, hard);
  assert(easy >= 0 && easy <= 100);
});

test('clusterByTerms agrupa por término compartido, sin el de la keyword principal', () => {
  const clusters = clusterByTerms(collectKeywords(report));
  assert(clusters.some((cluster) => cluster.term === 'mujer' && cluster.keywords.length === 2));
  assert(!clusters.some((cluster) => cluster.term === 'zapatos'));
});

test('buildInsights devuelve ranking, victorias rápidas y recomendaciones', () => {
  const insights = buildInsights(report);
  assert.strictEqual(insights.totals.keywords, 7);
  assert(insights.opportunities.every((entry) => entry.volume > 0));
  assert(insights.quickWins.some((entry) => entry.keyword === 'zapatos mujer'));
  assert(!insights.quickWins.some((entry) => entry.keyword === 'zapatos'));
  assert(insights.questions.some((entry) => entry.keyword === 'cómo limpiar zapatos'));
  assert(insights.recommendations.length >= 3);
  assert.deepStrictEqual(buildInsights([]).opportunities, []);
});

const goodText = [
  '# Zapatos de mujer: guía de compra',
  'Elegir zapatos no es fácil. En esta guía vemos cómo acertar con la talla, el material y el uso.',
  '## Cómo elegir zapatos',
  'Mide el pie por la tarde. Prueba los zapatos con el calcetín que vayas a usar. [Ver tienda](https://example.com)',
  ...Array.from({ length: 60 }, () => 'Un buen par dura años si se cuida. Límpialo tras cada uso y guárdalo seco.')
].join('\n\n');

test('analyzeContent puntúa un texto bien planteado y detecta lo que falta', () => {
  const result = analyzeContent({
    text: goodText,
    keyword: 'zapatos',
    title: 'Zapatos de mujer: guía para elegir bien',
    metaDescription: 'Guía para elegir zapatos de mujer: talla, materiales y cuidados para que duren años sin perder forma.',
    relatedKeywords: relatedKeywordsFor(report, 'zapatos'),
    language: 'es'
  });
  const status = Object.fromEntries(result.checks.map((check) => [check.id, check.status]));

  assert(result.score >= 70, `nota ${result.score}`);
  assert.strictEqual(status['title-keyword'], 'ok');
  assert.strictEqual(status['keyword-intro'], 'ok');
  assert.strictEqual(status['heading-keyword'], 'ok');
  assert.strictEqual(status.links, 'ok');
  assert(result.related.used.includes('mujer'));
  assert(result.related.used.includes('tienda'));
  assert(result.stats.words > 600);
});

test('analyzeContent penaliza la ausencia de keyword y el relleno', () => {
  const missing = analyzeContent({ text: 'Texto corto sin relación con el tema.', keyword: 'zapatos', title: 'Otra cosa' });
  const status = Object.fromEntries(missing.checks.map((check) => [check.id, check.status]));
  assert.strictEqual(status['keyword-density'], 'fail');
  assert.strictEqual(status['title-keyword'], 'fail');
  assert.strictEqual(status.length, 'fail');
  assert(missing.score < 40);

  const stuffed = analyzeContent({ text: 'zapatos zapatos zapatos baratos zapatos. '.repeat(80), keyword: 'zapatos' });
  assert.strictEqual(stuffed.checks.find((check) => check.id === 'keyword-density').status, 'fail');
  assert(stuffed.stats.keywordDensity > 3.5);
});

test('analyzeContent no distingue tildes ni mayúsculas, lee HTML y no puntúa un texto vacío', () => {
  const html = analyzeContent({ text: '<h1>ZAPATOS de piel</h1><p>Los zápatos de piel duran más.</p><img src="a.jpg"><a href="/x">ver</a>', keyword: 'zapatos' });
  assert.strictEqual(html.stats.keywordOccurrences, 2);
  assert.strictEqual(html.stats.headings, 1);
  assert.strictEqual(html.checks.find((check) => check.id === 'images-alt').status, 'warn');

  const empty = analyzeContent({ text: '   ', keyword: 'zapatos' });
  assert.strictEqual(empty.score, 0);
  assert.strictEqual(empty.stats.words, 0);
});
