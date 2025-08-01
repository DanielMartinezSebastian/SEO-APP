import { getKeywordData } from './src/api/keywordsur.js';

async function testSpecificKeywords() {
  try {
    console.log('Probando keywords específicas que están fallando...');
    
    const keywords = [
      'zomboid map b42',
      'zomboid build 42 multiplayer',
      'zomboid build 42',
      'zomboid b42 multiplayer',
      'zomboid key',
      'zomboid servers'
    ];
    
    for (const keyword of keywords) {
      console.log(`\n--- Probando: "${keyword}" ---`);
      try {
        const result = await getKeywordData([keyword], 'ES');
        console.log('Resultado:', JSON.stringify(result, null, 2));
        console.log('Keys en resultado:', Object.keys(result));
        console.log('¿Tiene el keyword?', keyword in result);
      } catch (error) {
        console.error(`Error con "${keyword}":`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

testSpecificKeywords();
