import { test } from 'node:test';
import assert from 'node:assert';
import { KeywordAnalyzer } from '../src/services/keywordService.js';

test('KeywordAnalyzer should have analyzeSuggestions method', () => {
  const analyzer = new KeywordAnalyzer();
  assert(typeof analyzer.analyzeSuggestions === 'function', 'analyzeSuggestions should be a function');
});

test('KeywordAnalyzer should have analyzeSuggestionKeyword method', () => {
  const analyzer = new KeywordAnalyzer();
  assert(typeof analyzer.analyzeSuggestionKeyword === 'function', 'analyzeSuggestionKeyword should be a function');
});

test('KeywordAnalyzer results map should initialize properly', () => {
  const analyzer = new KeywordAnalyzer();
  assert(analyzer.results instanceof Map, 'results should be a Map instance');
  assert(analyzer.results.size === 0, 'results should start empty');
});

test('KeywordAnalyzer getResults should return array', () => {
  const analyzer = new KeywordAnalyzer();
  const results = analyzer.getResults();
  assert(Array.isArray(results), 'getResults should return an array');
  assert(results.length === 0, 'getResults should return empty array initially');
});

test('KeywordAnalyzer getSummary should return array', () => {
  const analyzer = new KeywordAnalyzer();
  const summary = analyzer.getSummary();
  assert(Array.isArray(summary), 'getSummary should return an array');
  assert(summary.length === 0, 'getSummary should return empty array initially');
});