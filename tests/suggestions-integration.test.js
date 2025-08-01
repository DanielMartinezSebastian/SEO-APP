import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

test('analyze-suggestions endpoint validation', async () => {
  // Test that the required route exists in the seo.js file
  const routeFile = await fs.readFile('./src/server/routes/seo.js', 'utf8');
  
  assert(routeFile.includes('POST /api/seo/analyze-suggestions'), 
    'Should contain the analyze-suggestions route');
  assert(routeFile.includes('analyzer.analyzeSuggestions'), 
    'Should call analyzeSuggestions method');
  assert(routeFile.includes('mergeSuggestionsIntoReport'), 
    'Should have merge function');
});

test('report details contains suggestions button', async () => {
  // Test that the report-details.html contains the new button
  const htmlFile = await fs.readFile('./public/report-details.html', 'utf8');
  
  assert(htmlFile.includes('analyzeSuggestionsBtn'), 
    'Should contain suggestions button ID');
  assert(htmlFile.includes('Analizar Sugerencias'), 
    'Should contain suggestions button text');
  assert(htmlFile.includes('reportDetailsApp.analyzeSuggestions()'), 
    'Should contain button onclick handler');
});

test('report details JS contains suggestions functionality', async () => {
  // Test that the report-details.js contains the new methods
  const jsFile = await fs.readFile('./public/report-details.js', 'utf8');
  
  assert(jsFile.includes('analyzeSuggestions()'), 
    'Should contain analyzeSuggestions method');
  assert(jsFile.includes('getMissingSuggestionsCount()'), 
    'Should contain getMissingSuggestionsCount method');
  assert(jsFile.includes('checkAndShowSuggestionsButton()'), 
    'Should contain checkAndShowSuggestionsButton method');
  assert(jsFile.includes('/seo/analyze-suggestions'), 
    'Should make request to analyze-suggestions endpoint');
});

test('sample report data structure', async () => {
  // Test that our sample report has the expected structure
  const reportPath = './data/results/seo_report_full_2025-01-08T10-16-07-163Z.json';
  const reportData = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  
  assert(Array.isArray(reportData), 'Report should be an array');
  assert(reportData.length > 0, 'Report should have data');
  
  const firstItem = reportData[0];
  assert(firstItem.keyword, 'Should have keyword field');
  assert(Array.isArray(firstItem.suggestions), 'Should have suggestions array');
  assert(typeof firstItem.keywordData === 'object', 'Should have keywordData object');
  assert(firstItem.suggestions.length > 0, 'Should have suggestions for testing');
  
  // Verify that suggestions don't have SEO data (this is what we want to test)
  const hasUncoveredSuggestions = firstItem.suggestions.some(suggestion => 
    !firstItem.keywordData[suggestion] || 
    typeof firstItem.keywordData[suggestion].search_volume !== 'number'
  );
  assert(hasUncoveredSuggestions, 'Should have suggestions without SEO data for testing');
});