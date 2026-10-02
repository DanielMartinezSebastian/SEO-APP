import { test } from 'node:test';
import assert from 'node:assert';
import {
  countMissingSuggestions,
  csvFilenameFor,
  dateFromFilename,
  flattenKeywords,
  mainKeywordData,
  sortKeywords,
  summarizeReport
} from '../web/src/lib/report.js';
import { toCsv } from '../web/src/lib/format.js';

// La API devuelve keywordData sin orden garantizado: la keyword principal no es la primera clave
const report = [
  {
    keyword: 'zapatos',
    timestamp: '2026-10-02T18:16:42.064Z',
    suggestions: ['zapatos mujer', 'zapatos nike', 'zapatos raros'],
    keywordData: {
      'zapatos raros': { no_data: true },
      'zapatos mujer': { search_volume: 40500, competition: 1, cpc: 0.29 },
      zapatos: {
        search_volume: 135000,
        competition: 0.98,
        cpc: 0.31,
        similar_keywords: [{ keyword: 'comprar zapatos', search_volume: 720, cpc: 1.1 }]
      }
    },
    domainData: { 'zapatos.es': { traffic: 456702 } },
    urlAnalysis: { 'https://www.zapatos.es': { words: 1404 } },
    errors: []
  }
];

test('mainKeywordData busca por keyword y no por la primera clave', () => {
  assert.strictEqual(mainKeywordData(report[0]).search_volume, 135000);
  assert.deepStrictEqual(mainKeywordData({ keyword: 'x', keywordData: {} }), {});
});

test('summarizeReport usa los datos de la keyword principal', () => {
  const summary = summarizeReport(report);
  assert.strictEqual(summary.totalVolume, 135000);
  assert.strictEqual(summary.avgCPC, 0.31);
  assert.strictEqual(summary.totalSuggestions, 3);
  assert.strictEqual(summarizeReport([]).avgCPC, 0);
});

test('countMissingSuggestions cuenta solo las sugerencias sin consultar', () => {
  assert.strictEqual(countMissingSuggestions(report), 1);
  assert.strictEqual(countMissingSuggestions(null), 0);
});

test('dateFromFilename entiende nombres con y sin Z final', () => {
  const expected = '2026-10-02T18:16:42.064Z';
  assert.strictEqual(dateFromFilename('seo_report_full_2026-10-02T18-16-42-064.json').toISOString(), expected);
  assert.strictEqual(dateFromFilename('seo_report_full_2026-10-02T18-16-42-064Z.json').toISOString(), expected);
  assert.strictEqual(dateFromFilename('otro.json'), null);
});

test('csvFilenameFor deriva el nombre del CSV', () => {
  assert.strictEqual(csvFilenameFor('seo_report_full_X.json'), 'seo_report_summary_X.csv');
});

test('flattenKeywords y sortKeywords', () => {
  const all = flattenKeywords(report);
  assert.deepStrictEqual(all.map((kw) => kw.type), ['main', 'similar', 'suggestion', 'suggestion', 'suggestion']);
  assert.strictEqual(new Set(all.map((kw) => kw.id)).size, all.length);
  assert.strictEqual(sortKeywords(all, 'search_volume', 'desc')[0].keyword, 'zapatos');
  assert.strictEqual(sortKeywords(all, 'keyword', 'asc')[0].keyword, 'comprar zapatos');
});

test('toCsv no deja comas ni saltos de línea dentro de una celda', () => {
  const csv = toCsv(['Keyword', 'CPC'], [['uno, dos\ntres', '0,31 €']]);
  const rows = csv.split('\n');
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].split(',').length, 2);
});
