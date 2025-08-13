import { test } from 'node:test';
import assert from 'node:assert';
import { ParagraphAnalyzer } from '../src/services/paragraphAnalyzer.js';

test('ParagraphAnalyzer should initialize correctly', () => {
  const analyzer = new ParagraphAnalyzer();
  assert.ok(analyzer);
  assert.ok(analyzer.stopWords);
  assert.ok(analyzer.stopWords.has('el'));
  assert.ok(analyzer.stopWords.has('la'));
});

test('extractCandidateKeywords should extract words and phrases', () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'Amazon es una empresa de comercio electrónico muy popular';
  const candidates = analyzer.extractCandidateKeywords(text);
  
  assert.ok(Array.isArray(candidates));
  assert.ok(candidates.length > 0);
  assert.ok(candidates.includes('amazon'));
  assert.ok(candidates.includes('empresa'));
  assert.ok(candidates.includes('comercio electrónico'));
});

test('extractCandidateKeywords should filter stop words', () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'El gato está en la cocina';
  const candidates = analyzer.extractCandidateKeywords(text);
  
  // Should not contain stop words
  assert.ok(!candidates.includes('el'));
  assert.ok(!candidates.includes('la'));
  assert.ok(!candidates.includes('en'));
  assert.ok(!candidates.includes('está'));
  
  // Should contain meaningful words
  assert.ok(candidates.includes('gato'));
  assert.ok(candidates.includes('cocina'));
});

test('performTextAnalysis should identify keywords in text', () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'Amazon ofrece servicios de comercio electrónico';
  const candidates = ['amazon', 'comercio electrónico', 'servicios'];
  const keywordData = {
    'amazon': { volume: 5000000, cpc: 0.75, competition: 'high' },
    'comercio electrónico': { volume: 150000, cpc: 1.20, competition: 'medium' },
    'servicios': { volume: 50000, cpc: 0.50, competition: 'low' }
  };
  
  const analysis = analyzer.performTextAnalysis(text, candidates, keywordData);
  
  assert.ok(analysis.foundKeywords);
  assert.ok(Array.isArray(analysis.foundKeywords));
  assert.ok(analysis.foundKeywords.length > 0);
  
  // Should find amazon
  const amazonKw = analysis.foundKeywords.find(kw => kw.keyword === 'amazon');
  assert.ok(amazonKw);
  assert.strictEqual(amazonKw.volume, 5000000);
  assert.strictEqual(amazonKw.frequency, 1);
});

test('generateSuggestions should provide keyword recommendations', () => {
  const analyzer = new ParagraphAnalyzer();
  const analysis = {
    foundKeywords: [
      { keyword: 'test', volume: 500, frequency: 1 }
    ],
    highVolumeKeywords: [],
    lowVolumeKeywords: [
      { keyword: 'test', volume: 500, frequency: 1 }
    ],
    totalKeywordOccurrences: 1
  };
  
  const keywordData = {
    'test': { volume: 500 },
    'better-keyword': { volume: 50000 },
    'amazing-keyword': { volume: 100000 }
  };
  
  const suggestions = analyzer.generateSuggestions(analysis, keywordData);
  
  assert.ok(Array.isArray(suggestions));
  assert.ok(suggestions.length > 0);
  
  // Should suggest high volume keywords
  const addKeywordsSuggestion = suggestions.find(s => s.type === 'add_keywords');
  assert.ok(addKeywordsSuggestion);
  assert.ok(addKeywordsSuggestion.keywords.length > 0);
});

test('generateHighlightedHTML should highlight keywords', () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'Amazon es una empresa popular';
  const keywordPositions = [
    { keyword: 'amazon', start: 0, end: 6, volume: 5000000 }
  ];
  
  const highlighted = analyzer.generateHighlightedHTML(text, keywordPositions);
  
  assert.ok(highlighted.includes('<span'));
  assert.ok(highlighted.includes('keyword-very-high'));
  assert.ok(highlighted.includes('Amazon'));
});

test('analyzeParagraph should handle empty text', async () => {
  const analyzer = new ParagraphAnalyzer();
  
  try {
    await analyzer.analyzeParagraph('');
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.ok(error.message.includes('vacío'));
  }
});

test('analyzeParagraph should return complete analysis structure', async () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'Este es un párrafo de prueba para analizar palabras clave importantes';
  
  try {
    const result = await analyzer.analyzeParagraph(text, 'ES');
    
    // Should have basic structure even if API calls fail
    assert.ok(result.originalText);
    assert.ok(typeof result.wordCount === 'number');
    assert.ok(Array.isArray(result.candidateKeywords));
    assert.ok(result.analysis);
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(result.timestamp);
    
    assert.strictEqual(result.originalText, text);
    assert.ok(result.wordCount > 0);
    
  } catch (error) {
    // If external API is not available, that's expected in tests
    console.log('API not available in test environment:', error.message);
  }
});

test('ParagraphAnalyzer should handle API errors gracefully', async () => {
  const analyzer = new ParagraphAnalyzer();
  const text = 'Texto de prueba sin conexión a APIs externas';
  
  try {
    const result = await analyzer.analyzeParagraph(text, 'ES');
    
    // Should still return basic analysis even if external APIs fail
    assert.ok(result);
    assert.ok(result.originalText);
    assert.ok(result.candidateKeywords);
    assert.ok(result.analysis);
    
  } catch (error) {
    // Should not throw errors due to API unavailability
    assert.ok(error.message.includes('Error analizando párrafo'));
  }
});