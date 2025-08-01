import { getKeywordData } from './src/api/keywordsur.js';

async function testKeywordAPI() {
  try {
    console.log('Probando API de keywords...');
    
    // Probar con una sola keyword
    console.log('\n1. Probando con "test":');
    const result1 = await getKeywordData(['test'], 'ES');
    console.log('Resultado:', JSON.stringify(result1, null, 2));
    
    // Probar con "zomboid map"
    console.log('\n2. Probando con "zomboid map":');
    const result2 = await getKeywordData(['zomboid map'], 'ES');
    console.log('Resultado:', JSON.stringify(result2, null, 2));
    
    // Probar con múltiples keywords
    console.log('\n3. Probando con múltiples keywords:');
    const result3 = await getKeywordData(['zomboid', 'zomboid map', 'zomboid mods'], 'ES');
    console.log('Resultado:', JSON.stringify(result3, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testKeywordAPI();
