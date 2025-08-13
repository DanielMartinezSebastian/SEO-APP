// Tools page functionality

// Paragraph Analyzer functionality
let currentAnalysis = null;
let selectedStudy = null;

// Initialize page when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Load available studies on page load
    loadAvailableStudies();
    
    // Check for pre-selected study from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedStudy = urlParams.get('study');
    if (preSelectedStudy) {
        // Wait for studies to load, then select the specified study
        setTimeout(() => {
            const selector = document.getElementById('studySelector');
            if (selector) {
                // Try to find and select the study
                for (let i = 0; i < selector.options.length; i++) {
                    if (selector.options[i].value === preSelectedStudy) {
                        selector.value = preSelectedStudy;
                        onStudyChange();
                        
                        // Show a notification that the study was pre-selected
                        showSuccessMessage(`Estudio "${preSelectedStudy}" seleccionado automáticamente desde el reporte.`);
                        break;
                    }
                }
            }
        }, 1000);
    }
    
    // Character counter for textarea
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
 * Load available SEO studies from the API
 */
async function loadAvailableStudies() {
    try {
        const response = await fetch('/api/seo/reports');
        const data = await response.json();
        
        if (data.success) {
            populateStudySelector(data.reports);
        } else {
            console.error('Error loading studies:', data.error);
            showError('Error al cargar los estudios SEO disponibles');
        }
    } catch (error) {
        console.error('Error fetching studies:', error);
        showError('Error de conexión al cargar estudios');
    }
}

/**
 * Populate the study selector dropdown
 */
function populateStudySelector(reports) {
    const selector = document.getElementById('studySelector');
    if (!selector) return;
    
    // Clear existing options except the first one
    while (selector.children.length > 1) {
        selector.removeChild(selector.lastChild);
    }
    
    // Add reports as options
    reports.forEach(report => {
        const option = document.createElement('option');
        option.value = report.filename;
        option.textContent = `${report.timestamp} (${report.filename})`;
        selector.appendChild(option);
    });
    
    // Update UI based on available studies
    updateStudySelectorUI(reports.length > 0);
}

/**
 * Update study selector UI based on availability
 */
function updateStudySelectorUI(hasStudies) {
    const selector = document.getElementById('studySelector');
    const toolCards = document.querySelectorAll('.tool-card:not(.coming-soon)');
    
    if (!hasStudies) {
        // Disable selector and show message
        if (selector) {
            selector.disabled = true;
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay estudios SEO disponibles';
            selector.appendChild(option);
        }
        
        // Show message in tool cards
        toolCards.forEach(card => {
            const button = card.querySelector('.tool-button');
            if (button) {
                button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Requiere estudio SEO';
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    } else {
        // Enable selector
        if (selector) {
            selector.disabled = false;
        }
        
        // Reset tool cards
        toolCards.forEach(card => {
            const button = card.querySelector('.tool-button');
            if (button && !button.dataset.originalContent) {
                button.dataset.originalContent = button.innerHTML;
            }
        });
    }
}

/**
 * Handle study selection change
 */
async function onStudyChange() {
    const selector = document.getElementById('studySelector');
    const selectedStudyInfo = document.getElementById('selectedStudyInfo');
    
    if (!selector || !selectedStudyInfo) return;
    
    const selectedFilename = selector.value;
    
    if (!selectedFilename) {
        // No study selected
        selectedStudy = null;
        selectedStudyInfo.style.display = 'none';
        updateToolsAvailability(false);
        return;
    }
    
    try {
        // Load study details
        const response = await fetch(`/api/seo/report/${selectedFilename}`);
        const data = await response.json();
        
        if (data.success) {
            selectedStudy = {
                filename: selectedFilename,
                data: data.data
            };
            
            // Show study info
            displaySelectedStudyInfo(data.data);
            selectedStudyInfo.style.display = 'block';
            updateToolsAvailability(true);
        } else {
            showError('Error al cargar el estudio seleccionado');
            selectedStudy = null;
            selectedStudyInfo.style.display = 'none';
            updateToolsAvailability(false);
        }
    } catch (error) {
        console.error('Error loading study:', error);
        showError('Error de conexión al cargar el estudio');
        selectedStudy = null;
        selectedStudyInfo.style.display = 'none';
        updateToolsAvailability(false);
    }
}

/**
 * Display information about the selected study
 */
function displaySelectedStudyInfo(studyData) {
    const selectedStudyInfo = document.getElementById('selectedStudyInfo');
    if (!selectedStudyInfo) return;
    
    const metadata = studyData.metadata || {};
    const summary = studyData.summary || [];
    
    const keywords = metadata.keywords || summary.map(item => item.keyword).slice(0, 10);
    const keywordsCount = summary.length;
    const totalVolume = summary.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
    
    selectedStudyInfo.innerHTML = `
        <h3><i class="fas fa-check-circle"></i> Estudio SEO Seleccionado</h3>
        <div class="study-meta">
            <div class="study-meta-item">
                <span class="study-meta-label">Fecha:</span>
                <span class="study-meta-value">${metadata.timestamp || 'No disponible'}</span>
            </div>
            <div class="study-meta-item">
                <span class="study-meta-label">País:</span>
                <span class="study-meta-value">${metadata.country || 'No especificado'}</span>
            </div>
            <div class="study-meta-item">
                <span class="study-meta-label">Keywords:</span>
                <span class="study-meta-value">${keywordsCount}</span>
            </div>
            <div class="study-meta-item">
                <span class="study-meta-label">Volumen total:</span>
                <span class="study-meta-value">${formatNumber(totalVolume)}</span>
            </div>
        </div>
        <div class="study-keywords-preview">
            <h4>Keywords principales:</h4>
            <div class="keywords-preview-list">
                ${keywords.slice(0, 8).map(keyword => 
                    `<span class="keyword-preview-tag">${keyword}</span>`
                ).join('')}
                ${keywords.length > 8 ? `<span class="keyword-preview-tag">+${keywords.length - 8} más</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Update tools availability based on study selection
 */
function updateToolsAvailability(hasStudy) {
    const toolCards = document.querySelectorAll('.tool-card:not(.coming-soon)');
    
    toolCards.forEach(card => {
        const button = card.querySelector('.tool-button');
        if (!button) return;
        
        if (hasStudy) {
            // Enable tool
            button.disabled = false;
            button.classList.remove('disabled');
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
            }
        } else {
            // Disable tool
            button.disabled = true;
            button.classList.add('disabled');
            button.innerHTML = '<i class="fas fa-database"></i> Selecciona un estudio SEO';
        }
    });
}

/**
 * Format number with thousand separators
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('es-ES');
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Add toast styles if they don't exist
    if (!document.querySelector('#success-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'success-toast-styles';
        style.textContent = `
            .success-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--success-color, #10b981);
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                font-weight: 500;
                animation: slideInRight 0.3s ease;
                max-width: 400px;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove toast after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

/**
 * Show error message
 */
function showError(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    
    // Add toast styles if they don't exist
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .error-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--error-color);
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                font-weight: 500;
                animation: slideInRight 0.3s ease;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

/**
 * Opens the paragraph analyzer modal
 */
function openParagraphAnalyzer() {
    // Check if a study is selected
    if (!selectedStudy) {
        showError('Por favor, selecciona un estudio SEO antes de usar las herramientas');
        return;
    }
    
    const modal = document.getElementById('paragraphModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Update modal title to show selected study
        const modalHeader = modal.querySelector('.modal-header h2');
        if (modalHeader && selectedStudy) {
            modalHeader.innerHTML = `
                <i class="fas fa-paragraph"></i> 
                Analizador de Párrafos
                <small style="font-size: 0.7em; color: var(--text-muted); margin-left: 1rem;">
                    (Estudio: ${selectedStudy.filename})
                </small>
            `;
        }
        
        // Pre-fill country from selected study if available
        const country = document.getElementById('analysisCountry');
        const studyCountry = selectedStudy?.data?.metadata?.country;
        if (country && studyCountry) {
            country.value = studyCountry;
        }
        
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
        const requestBody = {
            paragraph: paragraph,
            country: country.value
        };
        
        // Include selected study context if available
        if (selectedStudy) {
            requestBody.studyContext = {
                filename: selectedStudy.filename,
                keywords: selectedStudy.data.summary?.map(item => ({
                    keyword: item.keyword,
                    volume: item.searchVolume,
                    competition: item.competition,
                    cpc: item.cpc
                })) || [],
                metadata: selectedStudy.data.metadata
            };
        }
        
        const response = await fetch('/api/seo/analyze-paragraph', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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
    
    // Add study context information if available
    if (analysis.studyContext) {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid && !document.getElementById('study-context-info')) {
            const studyContextCard = document.createElement('div');
            studyContextCard.className = 'stat-card study-context-card';
            studyContextCard.id = 'study-context-info';
            studyContextCard.innerHTML = `
                <i class="fas fa-database"></i>
                <div class="stat-info">
                    <span class="stat-label">Coincidencias con estudio</span>
                    <span class="stat-value">${analysis.studyContext.matchedKeywords?.length || 0}</span>
                </div>
            `;
            statsGrid.appendChild(studyContextCard);
        }
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
        let suggestionClass = 'suggestion-item';
        let iconClass = 'fas fa-lightbulb';
        
        // Add priority-based styling
        if (suggestion.priority === 'high') {
            suggestionClass += ' suggestion-high-priority';
            iconClass = 'fas fa-star';
        } else if (suggestion.priority === 'warning') {
            suggestionClass += ' suggestion-warning';
            iconClass = 'fas fa-exclamation-triangle';
        } else if (suggestion.priority === 'info') {
            suggestionClass += ' suggestion-info';
            iconClass = 'fas fa-info-circle';
        }
        
        switch (suggestion.type) {
            case 'study_recommendations':
                content = `
                    <div class="suggestion-keywords study-keywords">
                        ${suggestion.keywords.map(kw => `
                            <div class="suggestion-keyword study-keyword">
                                <span class="keyword-name">${kw.keyword}</span>
                                <span class="keyword-volume">Vol: ${(kw.volume || 0).toLocaleString()}</span>
                                <span class="keyword-source">Del estudio SEO</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'study_matches':
                content = `
                    <div class="suggestion-keywords study-matches">
                        ${suggestion.keywords.map(kw => `
                            <div class="suggestion-keyword matched-keyword">
                                <span class="keyword-name">${kw.keyword}</span>
                                <span class="keyword-volume">Vol: ${(kw.volume || 0).toLocaleString()}</span>
                                <span class="keyword-match-badge">✓ En el estudio</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'study_partial_matches':
                content = `
                    <div class="suggestion-keywords study-partial-matches">
                        ${suggestion.keywords.map(kw => `
                            <div class="suggestion-keyword partial-match-keyword">
                                <span class="keyword-name">${kw.keyword}</span>
                                <span class="keyword-related">Relacionado: "${kw.relatedTerm}"</span>
                                <span class="keyword-volume">Vol: ${(kw.volume || 0).toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'study_coverage':
                content = `
                    <div class="coverage-info">
                        <p class="coverage-text">${suggestion.description}</p>
                    </div>
                `;
                break;
            
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
            <div class="${suggestionClass}">
                <div class="suggestion-title">
                    <i class="${iconClass}"></i>
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