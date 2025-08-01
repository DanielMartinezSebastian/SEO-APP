import { getKeywordData } from './src/api/keywordsur.js';

async function testKeywordPatterns() {
  try {
    console.log('=== INVESTIGANDO PATRONES EN KEYWORDS ===\n');
    
    // Keywords de una palabra que sabemos que funcionan
    const singleWords = ['test', 'zomboid', 'seo'];
    
    // Keywords de dos palabras que están fallando
    const twoWords = [
      'zomboid map', 
      'zomboid mods', 
      'zomboid wiki',
      'zomboid key',
      'zomboid servers'
    ];
    
    // Keywords de múltiples palabras que están fallando
    const multiWords = [
      'zomboid map b42',
      'zomboid build 42',
      'zomboid build 42 multiplayer',
      'zomboid b42 multiplayer'
    ];
    
    console.log('1. PROBANDO KEYWORDS DE UNA PALABRA:');
    for (const keyword of singleWords) {
      console.log(`\n--- "${keyword}" ---`);
      try {
        const result = await getKeywordData([keyword], 'ES');
        console.log(`✅ Datos encontrados: ${Object.keys(result).length} keywords`);
        console.log(`Keys: ${Object.keys(result).join(', ')}`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n\n2. PROBANDO KEYWORDS DE DOS PALABRAS:');
    for (const keyword of twoWords) {
      console.log(`\n--- "${keyword}" ---`);
      try {
        const result = await getKeywordData([keyword], 'ES');
        console.log(`✅ Datos encontrados: ${Object.keys(result).length} keywords`);
        console.log(`Keys: ${Object.keys(result).join(', ')}`);
        if (Object.keys(result).length > 0) {
          const firstKey = Object.keys(result)[0];
          console.log(`Primer resultado - search_volume: ${result[firstKey]?.search_volume}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n\n3. PROBANDO KEYWORDS DE MÚLTIPLES PALABRAS:');
    for (const keyword of multiWords) {
      console.log(`\n--- "${keyword}" ---`);
      try {
        const result = await getKeywordData([keyword], 'ES');
        console.log(`✅ Datos encontrados: ${Object.keys(result).length} keywords`);
        console.log(`Keys: ${Object.keys(result).join(', ')}`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n\n4. PROBANDO ENCODING DE URL:');
    const testKeyword = 'zomboid map';
    console.log(`\nProbando diferentes encodings para: "${testKeyword}"`);
    
    // Encoding manual
    const manualArray = JSON.stringify([testKeyword]);
    const manualEncoded = encodeURIComponent(manualArray);
    console.log(`Array JSON: ${manualArray}`);
    console.log(`Encoded: ${manualEncoded}`);
    
    // Verificar la URL completa
    const url = `https://db3.keywordsur.fr/api/ks/keywords?country=ES&keywords=${manualEncoded}`;
    console.log(`URL completa: ${url}`);
    
    console.log('\n\n5. PROBANDO CON CURL DIRECTO:');
    console.log(`Ejecutar este comando manualmente:`);
    console.log(`curl -H "Origin: https://www.google.com" -H "Referer: https://www.google.com/" -H "User-Agent: Mozilla/5.0" -H "Accept: */*" -H "Accept-Language: es-ES,es;q=0.9,en;q=0.8" "${url}"`);
    
  } catch (error) {
    console.error('Error general:', error.message);
    console.error('Stack:', error.stack);
  }
}

testKeywordPatterns();
