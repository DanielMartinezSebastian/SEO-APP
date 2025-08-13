// Tools page functionality

// Paragraph Analyzer functionality
let currentAnalysis = null;

// Character counter for textarea
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('paragraphText');
    const charCount = document.getElementById('charCount');
    
    if (textarea && charCount) {
        textarea.addEventListener('input', function() {
            const count = this.value.length;
            charCount.textContent = count;
            
            // Change color based on character count
            if (count > 1800) {
                charCount.style.color = 'var(--error-color)';
            } else if (count > 1500) {
                charCount.style.color = 'var(--warning-color)';
            } else {
                charCount.style.color = 'var(--text-muted)';
            }
        });
    }
});

/**
 * Opens the paragraph analyzer modal
 */
function openParagraphAnalyzer() {
    const modal = document.getElementById('paragraphModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Focus on textarea
        setTimeout(() => {
            const textarea = document.getElementById('paragraphText');
            if (textarea) {
                textarea.focus();
            }
        }, 100);
    }
}

/**
 * Closes the paragraph analyzer modal
 */
function closeParagraphAnalyzer() {
    const modal = document.getElementById('paragraphModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset form and results
        resetAnalyzerForm();
    }
}

/**
 * Resets the analyzer form and results
 */
function resetAnalyzerForm() {
    // Reset form
    const textarea = document.getElementById('paragraphText');
    const charCount = document.getElementById('charCount');
    const country = document.getElementById('analysisCountry');
    
    if (textarea) textarea.value = '';
    if (charCount) {
        charCount.textContent = '0';
        charCount.style.color = 'var(--text-muted)';
    }
    if (country) country.value = 'ES';
    
    // Hide results
    const results = document.getElementById('analysisResults');
    const loading = document.getElementById('analysisLoading');
    
    if (results) results.style.display = 'none';
    if (loading) loading.style.display = 'none';
    
    // Clear analysis data
    currentAnalysis = null;
}

/**
 * Analyzes the paragraph text
 */
async function analyzeParagraph() {
    const textarea = document.getElementById('paragraphText');
    const country = document.getElementById('analysisCountry');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('analysisLoading');
    const results = document.getElementById('analysisResults');
    
    if (!textarea || !country) {
        showError('Elementos del formulario no encontrados');
        return;
    }
    
    const paragraph = textarea.value.trim();
    
    if (!paragraph) {
        showError('Por favor, ingresa un párrafo para analizar');
        return;
    }
    
    if (paragraph.length < 10) {
        showError('El párrafo debe tener al menos 10 caracteres');
        return;
    }
    
    try {
        // Show loading state
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
        }
        if (loading) loading.style.display = 'block';
        if (results) results.style.display = 'none';
        
        // Make API request
        const response = await fetch('/api/seo/analyze-paragraph', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paragraph: paragraph,
                country: country.value
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Error analizando el párrafo');
        }
        
        // Store analysis data
        currentAnalysis = data.data;
        
        // Display results
        displayAnalysisResults(currentAnalysis);
        
    } catch (error) {
        console.error('Error analyzing paragraph:', error);
        showError(`Error al analizar el párrafo: ${error.message}`);
    } finally {
        // Reset button state
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analizar Párrafo';
        }
        if (loading) loading.style.display = 'none';
    }
}

/**
 * Displays the analysis results in the UI
 */
function displayAnalysisResults(analysis) {
    const results = document.getElementById('analysisResults');
    if (!results) return;
    
    // Update statistics
    updateAnalysisStats(analysis);
    
    // Display highlighted text
    displayHighlightedText(analysis);
    
    // Display found keywords
    displayFoundKeywords(analysis);
    
    // Display suggestions
    displaySuggestions(analysis);
    
    // Show results section
    results.style.display = 'block';
    
    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Updates the analysis statistics
 */
function updateAnalysisStats(analysis) {
    const wordCount = document.getElementById('wordCount');
    const keywordCount = document.getElementById('keywordCount');
    const highVolumeCount = document.getElementById('highVolumeCount');
    
    if (wordCount) {
        wordCount.textContent = analysis.wordCount || 0;
    }
    
    if (keywordCount) {
        keywordCount.textContent = analysis.analysis.foundKeywords?.length || 0;
    }
    
    if (highVolumeCount) {
        highVolumeCount.textContent = analysis.analysis.highVolumeKeywords?.length || 0;
    }
}

/**
 * Displays the highlighted text
 */
function displayHighlightedText(analysis) {
    const container = document.getElementById('highlightedText');
    if (!container) return;
    
    if (analysis.highlightedHTML) {
        container.innerHTML = analysis.highlightedHTML;
    } else {
        container.textContent = analysis.originalText;
    }
}

/**
 * Displays the found keywords
 */
function displayFoundKeywords(analysis) {
    const container = document.getElementById('foundKeywords');
    if (!container) return;
    
    const keywords = analysis.analysis.foundKeywords || [];
    
    if (keywords.length === 0) {
        container.innerHTML = '<p class="no-results">No se encontraron keywords con datos de volumen.</p>';
        return;
    }
    
    const keywordsHTML = keywords.map(keyword => {
        const volume = keyword.volume || 0;
        const frequency = keyword.frequency || 0;
        const cpc = keyword.cpc || 0;
        const competition = keyword.competition || 'desconocida';
        
        let volumeClass = 'keyword-low';
        if (volume > 10000) volumeClass = 'keyword-very-high';
        else if (volume > 5000) volumeClass = 'keyword-high';
        else if (volume > 1000) volumeClass = 'keyword-medium';
        
        return `
            <div class="keyword-item">
                <div class="keyword-name">
                    <span class="${volumeClass}" style="padding: 2px 6px; border-radius: 3px;">${keyword.keyword}</span>
                </div>
                <div class="keyword-stats">
                    <span class="keyword-volume">Vol: ${volume.toLocaleString()}</span>
                    <span>Freq: ${frequency}</span>
                    <span>CPC: $${cpc.toFixed(2)}</span>
                    <span>Comp: ${competition}</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = keywordsHTML;
}

/**
 * Displays the optimization suggestions
 */
function displaySuggestions(analysis) {
    const container = document.getElementById('suggestions');
    if (!container) return;
    
    const suggestions = analysis.suggestions || [];
    
    if (suggestions.length === 0) {
        container.innerHTML = '<p class="no-results">No hay sugerencias específicas para este párrafo.</p>';
        return;
    }
    
    const suggestionsHTML = suggestions.map(suggestion => {
        let content = '';
        
        switch (suggestion.type) {
            case 'add_keywords':
                content = `
                    <div class="suggestion-keywords">
                        ${suggestion.keywords.map(kw => `
                            <div class="suggestion-keyword">
                                <span class="keyword-name">${kw.keyword}</span>
                                <span class="keyword-volume">Vol: ${(kw.volume || 0).toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'replace_keywords':
                content = `
                    <div class="replacement-items">
                        ${suggestion.replacements.map(replacement => `
                            <div class="replacement-item">
                                <div class="replacement-current">
                                    Actual: ${replacement.current.keyword} (Vol: ${(replacement.current.volume || 0).toLocaleString()})
                                </div>
                                <div class="replacement-alternatives">
                                    ${replacement.alternatives.map(alt => `
                                        <div class="replacement-alternative">
                                            <span>${alt.keyword}</span>
                                            <span>Vol: ${(alt.volume || 0).toLocaleString()} (${alt.improvement})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'density':
                content = `
                    <div class="density-info">
                        <p>${suggestion.recommendation}</p>
                    </div>
                `;
                break;
                
            default:
                content = '<p>Información adicional disponible.</p>';
        }
        
        return `
            <div class="suggestion-item">
                <div class="suggestion-title">
                    <i class="fas fa-lightbulb"></i>
                    ${suggestion.title}
                </div>
                <div class="suggestion-description">
                    ${suggestion.description}
                </div>
                ${content}
            </div>
        `;
    }).join('');
    
    container.innerHTML = suggestionsHTML;
}

/**
 * Shows an error message
 */
function showError(message) {
    // Create or update error display
    let errorDiv = document.getElementById('analysisError');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'analysisError';
        errorDiv.style.cssText = `
            background: var(--error-bg);
            color: var(--error-color);
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid var(--error-color);
            margin: 1rem 0;
        `;
        
        // Insert after the form
        const form = document.querySelector('.analyzer-form');
        if (form) {
            form.parentNode.insertBefore(errorDiv, form.nextSibling);
        }
    }
    
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Error:</strong> ${message}
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.remove();
        }
    }, 5000);
    
    // Scroll to error
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('paragraphModal');
    if (event.target === modal) {
        closeParagraphAnalyzer();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('paragraphModal');
        if (modal && modal.style.display === 'block') {
            closeParagraphAnalyzer();
        }
    }
});

// Handle enter key in textarea (Ctrl+Enter to analyze)
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        const modal = document.getElementById('paragraphModal');
        if (modal && modal.style.display === 'block') {
            analyzeParagraph();
        }
    }
});