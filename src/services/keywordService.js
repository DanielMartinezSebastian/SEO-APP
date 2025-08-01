import { getGoogleSuggestions } from '../api/googleSuggestions.js';
import { getKeywordData, getDomainData } from '../api/keywordsur.js';
import { analyzeUrl } from '../api/urlAnalysis.js';
import ora from 'ora';
import chalk from 'chalk';

export class KeywordAnalyzer {
  constructor() {
    this.results = new Map();
  }

  // Función para limpiar keywords y crear URLs válidas
  sanitizeKeywordForUrl(keyword) {
    return keyword
      .toLowerCase()
      .replace(/[áàäâã]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöôõ]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/\s+/g, '-')           // Espacios -> guiones
      .replace(/[^a-z0-9\-]/g, '')    // Eliminar caracteres especiales
      .replace(/-+/g, '-')            // Múltiples guiones -> un guión
      .replace(/^-|-$/g, '');         // Eliminar guiones al inicio/final
  }

  async analyzeKeyword(keyword, country = 'ES', language = 'es') {
    const spinner = ora(`Analizando "${keyword}"...`).start();
    const result = {
      keyword,
      timestamp: new Date().toISOString(),
      suggestions: [],
      keywordData: {},
      domainData: {},
      urlAnalysis: {},
      errors: []
    };

    try {
      // 1. Obtener sugerencias
      spinner.text = `Obteniendo sugerencias para "${keyword}"...`;
      result.suggestions = await getGoogleSuggestions(keyword);
      
      // 2. Analizar keywords (incluir keyword original + sugerencias)
      spinner.text = `Analizando volumen y competencia...`;
      const keywordsToAnalyze = [keyword, ...result.suggestions.slice(0, 5)];
      result.keywordData = await getKeywordData(keywordsToAnalyze, country);
      
      // 3. Analizar dominio
      spinner.text = `Analizando dominio ${keyword}.es...`;
      const cleanKeyword = this.sanitizeKeywordForUrl(keyword);
      const domain = `${cleanKeyword}.es`;
      result.domainData = await getDomainData(domain, country);
      
      // 4. Análisis on-page
      spinner.text = `Analizando contenido on-page...`;
      const url = `https://www.${domain}`;
      result.urlAnalysis = await analyzeUrl(url, country, language);
      
      spinner.succeed(chalk.green(`✅ Análisis completado para "${keyword}"`));
      this.results.set(keyword, result);
      return result;
      
    } catch (error) {
      result.errors.push(error.message);
      spinner.fail(chalk.red(`❌ Error analizando "${keyword}": ${error.message}`));
      this.results.set(keyword, result);
      return result;
    }
  }

  async analyzeMultipleKeywords(keywords, country = 'ES', language = 'es') {
    console.log(chalk.blue(`\n📊 Iniciando análisis de ${keywords.length} keywords...\n`));
    
    for (const keyword of keywords) {
      await this.analyzeKeyword(keyword, country, language);
      // Pequeña pausa entre peticiones
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.getResults();
  }

  async analyzeSuggestions(suggestions, country = 'ES', language = 'es') {
    console.log(chalk.blue(`\n🔍 Analizando ${suggestions.length} sugerencias para obtener datos SEO...\n`));
    
    for (const suggestion of suggestions) {
      await this.analyzeSuggestionKeyword(suggestion, country, language);
      // Pequeña pausa entre peticiones
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.getResults();
  }

  async analyzeSuggestionKeyword(keyword, country = 'ES', language = 'es') {
    const spinner = ora(`Analizando sugerencia "${keyword}"...`).start();
    const result = {
      keyword,
      timestamp: new Date().toISOString(),
      suggestions: [],
      keywordData: {},
      domainData: {},
      urlAnalysis: {},
      errors: []
    };

    try {
      // Para sugerencias, nos enfocamos principalmente en obtener datos SEO básicos
      // sin analizar dominios ni URLs para ser más eficiente
      
      // 1. Obtener datos SEO básicos del keyword
      spinner.text = `Obteniendo datos SEO para "${keyword}"...`;
      result.keywordData = await getKeywordData([keyword], country);
      
      // 2. Obtener algunas sugerencias básicas si es necesario
      spinner.text = `Obteniendo sugerencias rápidas para "${keyword}"...`;
      try {
        result.suggestions = await getGoogleSuggestions(keyword);
        // Limitar a máximo 3 sugerencias para eficiencia
        result.suggestions = result.suggestions.slice(0, 3);
      } catch (error) {
        // Si falla la obtención de sugerencias, no es crítico
        result.errors.push(`Error obteniendo sugerencias: ${error.message}`);
      }
      
      spinner.succeed(chalk.green(`✅ Datos SEO obtenidos para sugerencia "${keyword}"`));
      this.results.set(keyword, result);
      return result;
      
    } catch (error) {
      result.errors.push(error.message);
      spinner.fail(chalk.red(`❌ Error analizando sugerencia "${keyword}": ${error.message}`));
      this.results.set(keyword, result);
      return result;
    }
  }

  getResults() {
    return Array.from(this.results.values());
  }

  getSummary() {
    const summary = [];
    
    for (const [keyword, data] of this.results) {
      const keywordInfo = data.keywordData[keyword] || {};
      const cleanKeyword = this.sanitizeKeywordForUrl(keyword);
      const domainInfo = data.domainData[`${cleanKeyword}.es`] || {};
      const urlInfo = data.urlAnalysis[`https://www.${cleanKeyword}.es`] || {};
      
      summary.push({
        keyword,
        searchVolume: keywordInfo.search_volume || 0,
        competition: keywordInfo.competition || 0,
        cpc: keywordInfo.cpc || 0,
        suggestionsCount: data.suggestions.length,
        domainTraffic: domainInfo.traffic || 0,
        domainKeywords: domainInfo.keyword_count_top10 || 0,
        pageWords: urlInfo.words || 0,
        errors: data.errors.length
      });
    }
    
    return summary;
  }
}