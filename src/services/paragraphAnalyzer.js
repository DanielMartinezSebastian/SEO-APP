import { getKeywordData } from '../api/keywordsur.js';

export class ParagraphAnalyzer {
  constructor() {
    this.stopWords = new Set([
      'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'uno', 'una', 'como', 'pero', 'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'también', 'fue', 'había', 'era', 'muy', 'años', 'hasta', 'desde', 'está', 'mi', 'porque', 'qué', 'sólo', 'han', 'yo', 'hay', 'vez', 'puede', 'todos', 'así', 'nos', 'ni', 'parte', 'tiene', 'él', 'uno', 'donde', 'bien', 'tiempo', 'mismo', 'ese', 'ahora', 'cada', 'e', 'vida', 'otro', 'después', 'te', 'otros', 'aunque', 'esa', 'eso', 'hace', 'otra', 'gobierno', 'tan', 'durante', 'siempre', 'día', 'tanto', 'ella', 'tres', 'sí', 'dijo', 'sido', 'gran', 'país', 'según', 'menos', 'mundo', 'año', 'antes', 'estado', 'quienes', 'muchos', 'hubiera', 'estar', 'fueron', 'dice', 'muchas', 'seria', 'cuando', 'hacer', 'algunos', 'contra', 'sin', 'lugar', 'solo', 'primera', 'casa', 'mientras', 'trabajo', 'vida', 'ejemplo', 'llevar', 'agua', 'conocer', 'de', 'la', 'el', 'y', 'a', 'que', 'un', 'en', 'no', 'se'
    ]);
  }

  /**
   * Extrae palabras clave candidatas de un párrafo
   * @param {string} text - El texto a analizar
   * @returns {Array} Array de palabras y frases candidatas
   */
  extractCandidateKeywords(text) {
    // Limpiar el texto
    const cleanText = text.toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleanText.split(' ').filter(word => 
      word.length > 2 && !this.stopWords.has(word)
    );

    const candidates = new Set();

    // Palabras individuales
    words.forEach(word => {
      if (word.length >= 3) {
        candidates.add(word);
      }
    });

    // Frases de 2 palabras
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      candidates.add(phrase);
    }

    // Frases de 3 palabras
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      candidates.add(phrase);
    }

    return Array.from(candidates).slice(0, 20); // Limitar a 20 candidatos
  }

  /**
   * Analiza un párrafo y retorna sugerencias de keywords
   * @param {string} paragraph - El párrafo a analizar
   * @param {string} country - Código del país (ES, US, etc.)
   * @param {Object} studyContext - Contexto del estudio SEO seleccionado (opcional)
   * @returns {Object} Análisis del párrafo con sugerencias
   */
  async analyzeParagraph(paragraph, country = 'ES', studyContext = null) {
    try {
      if (!paragraph || paragraph.trim().length === 0) {
        throw new Error('El párrafo no puede estar vacío');
      }

      const originalText = paragraph.trim();
      const candidates = this.extractCandidateKeywords(originalText);

      // Obtener datos de volumen para los candidatos
      let keywordData = {};
      if (candidates.length > 0) {
        try {
          keywordData = await getKeywordData(candidates, country);
        } catch (error) {
          console.warn('Error obteniendo datos de keywords:', error.message);
          // Continuar con análisis básico sin datos de volumen
        }
      }

      // Si hay contexto de estudio, enriquecer el análisis
      let studyEnrichment = null;
      if (studyContext && studyContext.keywords) {
        studyEnrichment = this.enrichWithStudyContext(candidates, studyContext);
      }

      // Analizar el texto
      const analysis = this.performTextAnalysis(originalText, candidates, keywordData, studyEnrichment);

      return {
        originalText,
        wordCount: originalText.split(/\s+/).length,
        candidateKeywords: candidates,
        keywordData,
        studyContext: studyContext ? {
          filename: studyContext.filename,
          totalKeywords: studyContext.keywords.length,
          matchedKeywords: studyEnrichment?.matchedKeywords || []
        } : null,
        analysis,
        suggestions: this.generateSuggestions(analysis, keywordData, studyEnrichment),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Error analizando párrafo: ${error.message}`);
    }
  }

  /**
   * Enriquece el análisis con contexto del estudio SEO
   * @param {Array} candidates - Keywords candidatas extraídas del texto
   * @param {Object} studyContext - Contexto del estudio SEO
   * @returns {Object} Datos de enriquecimiento
   */
  enrichWithStudyContext(candidates, studyContext) {
    const studyKeywords = studyContext.keywords || [];
    const matchedKeywords = [];
    const recommendedKeywords = [];
    
    // Buscar coincidencias entre candidatos y keywords del estudio
    candidates.forEach(candidate => {
      const studyMatch = studyKeywords.find(sk => 
        sk.keyword.toLowerCase() === candidate.toLowerCase() ||
        sk.keyword.toLowerCase().includes(candidate.toLowerCase()) ||
        candidate.toLowerCase().includes(sk.keyword.toLowerCase())
      );
      
      if (studyMatch) {
        matchedKeywords.push({
          candidate,
          studyKeyword: studyMatch.keyword,
          volume: studyMatch.volume,
          competition: studyMatch.competition,
          cpc: studyMatch.cpc,
          isExactMatch: studyMatch.keyword.toLowerCase() === candidate.toLowerCase()
        });
      }
    });
    
    // Recomendar keywords del estudio que no están en el texto pero podrían ser relevantes
    const highVolumeStudyKeywords = studyKeywords
      .filter(sk => sk.volume > 5000)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
    
    highVolumeStudyKeywords.forEach(sk => {
      const isInText = candidates.some(candidate => 
        candidate.toLowerCase().includes(sk.keyword.toLowerCase()) ||
        sk.keyword.toLowerCase().includes(candidate.toLowerCase())
      );
      
      if (!isInText) {
        recommendedKeywords.push({
          keyword: sk.keyword,
          volume: sk.volume,
          competition: sk.competition,
          cpc: sk.cpc,
          reason: 'Alto volumen en el estudio'
        });
      }
    });
    
    return {
      matchedKeywords,
      recommendedKeywords,
      totalStudyKeywords: studyKeywords.length,
      matchRate: matchedKeywords.length / Math.max(candidates.length, 1)
    };
  }

  /**
   * Realiza el análisis del texto identificando keywords presentes
   * @param {string} text - Texto original
   * @param {Array} candidates - Keywords candidatas
   * @param {Object} keywordData - Datos de volumen de keywords
   * @param {Object} studyEnrichment - Datos de enriquecimiento del estudio (opcional)
   * @returns {Object} Análisis del texto
   */
  performTextAnalysis(text, candidates, keywordData, studyEnrichment = null) {
    const lowerText = text.toLowerCase();
    const foundKeywords = [];
    const highlightedText = text;
    const keywordPositions = [];

    candidates.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = [...lowerText.matchAll(regex)];

      if (matches.length > 0) {
        const keywordInfo = keywordData[keyword] || {};
        foundKeywords.push({
          keyword,
          frequency: matches.length,
          volume: keywordInfo.volume || 0,
          cpc: keywordInfo.cpc || 0,
          competition: keywordInfo.competition || 'unknown',
          positions: matches.map(match => ({
            start: match.index,
            end: match.index + keyword.length
          }))
        });

        matches.forEach(match => {
          keywordPositions.push({
            keyword,
            start: match.index,
            end: match.index + keyword.length,
            volume: keywordInfo.volume || 0
          });
        });
      }
    });

    // Ordenar keywords por volumen de búsqueda
    foundKeywords.sort((a, b) => (b.volume || 0) - (a.volume || 0));

    return {
      foundKeywords,
      keywordPositions: keywordPositions.sort((a, b) => a.start - b.start),
      totalKeywordOccurrences: foundKeywords.reduce((sum, kw) => sum + kw.frequency, 0),
      highVolumeKeywords: foundKeywords.filter(kw => (kw.volume || 0) > 1000),
      lowVolumeKeywords: foundKeywords.filter(kw => (kw.volume || 0) > 0 && (kw.volume || 0) <= 1000)
    };
  }

  /**
   * Genera sugerencias basadas en el análisis
   * @param {Object} analysis - Análisis del texto
   * @param {Object} keywordData - Datos de keywords
   * @param {Object} studyEnrichment - Datos de enriquecimiento del estudio (opcional)
   * @returns {Array} Array de sugerencias
   */
  generateSuggestions(analysis, keywordData, studyEnrichment = null) {
    const suggestions = [];

    // Si hay datos del estudio, priorizar esas sugerencias
    if (studyEnrichment) {
      // Sugerir keywords del estudio que no están en el texto
      if (studyEnrichment.recommendedKeywords.length > 0) {
        suggestions.push({
          type: 'study_recommendations',
          title: 'Keywords recomendadas del estudio SEO',
          description: 'Estas keywords de tu estudio SEO tienen alto volumen y podrían mejorar el párrafo:',
          keywords: studyEnrichment.recommendedKeywords,
          priority: 'high'
        });
      }

      // Mostrar coincidencias con el estudio
      if (studyEnrichment.matchedKeywords.length > 0) {
        const exactMatches = studyEnrichment.matchedKeywords.filter(mk => mk.isExactMatch);
        const partialMatches = studyEnrichment.matchedKeywords.filter(mk => !mk.isExactMatch);
        
        if (exactMatches.length > 0) {
          suggestions.push({
            type: 'study_matches',
            title: 'Keywords del estudio encontradas',
            description: `Excelente! Tu párrafo ya incluye ${exactMatches.length} keywords de tu estudio SEO:`,
            keywords: exactMatches.map(mk => ({
              keyword: mk.studyKeyword,
              volume: mk.volume,
              cpc: mk.cpc,
              competition: mk.competition
            })),
            priority: 'info'
          });
        }
        
        if (partialMatches.length > 0) {
          suggestions.push({
            type: 'study_partial_matches',
            title: 'Keywords relacionadas del estudio',
            description: 'Tu párrafo contiene términos relacionados con estas keywords del estudio:',
            keywords: partialMatches.map(mk => ({
              keyword: mk.studyKeyword,
              relatedTerm: mk.candidate,
              volume: mk.volume,
              cpc: mk.cpc,
              competition: mk.competition
            })),
            priority: 'medium'
          });
        }
      }

      // Análisis de cobertura del estudio
      if (studyEnrichment.matchRate < 0.2) {
        suggestions.push({
          type: 'study_coverage',
          title: 'Baja cobertura del estudio SEO',
          description: `Tu párrafo solo utiliza un ${Math.round(studyEnrichment.matchRate * 100)}% de las keywords de tu estudio. Considera incluir más términos relevantes del estudio.`,
          priority: 'warning'
        });
      }
    }

    // Sugerir keywords de alto volumen no utilizadas (mantener funcionalidad original)
    const usedKeywords = new Set(analysis.foundKeywords.map(kw => kw.keyword));
    const availableHighVolumeKeywords = Object.entries(keywordData)
      .filter(([keyword, data]) => !usedKeywords.has(keyword) && (data.volume || 0) > 1000)
      .sort(([, a], [, b]) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5);

    if (availableHighVolumeKeywords.length > 0) {
      suggestions.push({
        type: 'add_keywords',
        title: 'Keywords de alto volumen adicionales',
        description: 'Considera incluir estas keywords con alto volumen de búsqueda:',
        keywords: availableHighVolumeKeywords.map(([keyword, data]) => ({
          keyword,
          volume: data.volume,
          cpc: data.cpc,
          competition: data.competition
        })),
        priority: 'medium'
      });
    }

    // Sugerir reemplazos para keywords de bajo volumen
    const lowVolumeUsed = analysis.lowVolumeKeywords;
    if (lowVolumeUsed.length > 0) {
      const replacements = [];
      lowVolumeUsed.forEach(lowKw => {
        const betterAlternatives = Object.entries(keywordData)
          .filter(([keyword, data]) => 
            keyword !== lowKw.keyword && 
            (data.volume || 0) > (lowKw.volume || 0) * 2 &&
            keyword.includes(lowKw.keyword.split(' ')[0]) // Relacionada por palabra
          )
          .sort(([, a], [, b]) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 2);

        if (betterAlternatives.length > 0) {
          replacements.push({
            current: lowKw,
            alternatives: betterAlternatives.map(([keyword, data]) => ({
              keyword,
              volume: data.volume,
              improvement: `+${Math.round(((data.volume - lowKw.volume) / lowKw.volume) * 100)}%`
            }))
          });
        }
      });

      if (replacements.length > 0) {
        suggestions.push({
          type: 'replace_keywords',
          title: 'Oportunidades de mejora',
          description: 'Considera reemplazar estas keywords por alternativas de mayor volumen:',
          replacements
        });
      }
    }

    // Análisis de densidad
    const textLength = analysis.foundKeywords.reduce((sum, kw) => 
      sum + (kw.keyword.split(' ').length * kw.frequency), 0
    );
    const totalWords = textLength; // Aproximación

    if (analysis.totalKeywordOccurrences > 0 && totalWords > 0) {
      const density = (analysis.totalKeywordOccurrences / totalWords) * 100;
      
      if (density < 1) {
        suggestions.push({
          type: 'density',
          title: 'Densidad de keywords baja',
          description: `La densidad de keywords es del ${density.toFixed(1)}%. Considera incluir más keywords relevantes.`,
          recommendation: 'Densidad recomendada: 1-3%'
        });
      } else if (density > 5) {
        suggestions.push({
          type: 'density',
          title: 'Densidad de keywords alta',
          description: `La densidad de keywords es del ${density.toFixed(1)}%. Evita el keyword stuffing.`,
          recommendation: 'Densidad recomendada: 1-3%'
        });
      }
    }

    return suggestions;
  }

  /**
   * Genera HTML con keywords resaltadas
   * @param {string} text - Texto original
   * @param {Array} keywordPositions - Posiciones de keywords
   * @returns {string} HTML con keywords resaltadas
   */
  generateHighlightedHTML(text, keywordPositions) {
    if (!keywordPositions || keywordPositions.length === 0) {
      return text;
    }

    // Ordenar posiciones por índice de inicio (descendente para no afectar índices)
    const sortedPositions = [...keywordPositions].sort((a, b) => b.start - a.start);
    
    let highlightedText = text;
    
    sortedPositions.forEach(pos => {
      const { start, end, volume, keyword } = pos;
      const originalText = highlightedText.substring(start, end);
      
      // Determinar clase CSS basada en volumen
      let cssClass = 'keyword-low';
      if (volume > 10000) cssClass = 'keyword-very-high';
      else if (volume > 5000) cssClass = 'keyword-high';
      else if (volume > 1000) cssClass = 'keyword-medium';
      
      const highlightedKeyword = `<span class="${cssClass}" data-keyword="${keyword}" data-volume="${volume}" title="Volumen: ${volume}">${originalText}</span>`;
      
      highlightedText = highlightedText.substring(0, start) + 
                      highlightedKeyword + 
                      highlightedText.substring(end);
    });

    return highlightedText;
  }
}