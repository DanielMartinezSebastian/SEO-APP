class ReportDetailsApp {
    constructor() {
        this.reportData = null;
        this.reportFilename = null;
        this.baseURL = '/api';
        this.init();
    }

    init() {
        // Obtener el filename del reporte desde la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.reportFilename = urlParams.get('filename');
        
        if (!this.reportFilename) {
            this.showError('No se especificó un reporte para mostrar');
            return;
        }

        this.loadReportData();
    }

    async loadReportData() {
        try {
            const response = await fetch(`${this.baseURL}/seo/report/${this.reportFilename}`);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.reportData = result.data;
            
            this.hideLoading();
            this.renderReport();
            
        } catch (error) {
            console.error('Error loading report:', error);
            this.showError('Error al cargar el reporte: ' + error.message);
        }
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('reportContent').classList.remove('hidden');
    }

    showError(message) {
        document.getElementById('loadingState').innerHTML = `
            <div class="error-container">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-message">${message}</div>
                <button onclick="window.history.back()" class="btn-back" style="margin-top: 15px;">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
        `;
    }

    renderReport() {
        this.renderHeader();
        this.renderExecutiveSummary();
        this.renderKeywordsAnalysis();
        this.renderDomainsAnalysis();
        this.renderUrlsAnalysis();
        this.renderRawData();
    }

    renderHeader() {
        const keywords = this.reportData.map(item => item.keyword).join(', ');
        const reportDate = new Date(this.reportData[0]?.timestamp || Date.now());
        
        document.getElementById('reportTitleSection').innerHTML = `
            <h1 class="report-main-title">
                <i class="fas fa-chart-line"></i> Reporte SEO Detallado
            </h1>
            <div class="report-meta">
                <div class="meta-item">
                    <i class="fas fa-key"></i>
                    <span>${this.reportData.length} Keywords analizadas</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${reportDate.toLocaleString('es-ES')}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-file"></i>
                    <span>${this.reportFilename}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-tags"></i>
                    <span>${keywords}</span>
                </div>
            </div>
        `;
    }

    renderExecutiveSummary() {
        const totalKeywords = this.reportData.length;
        const totalSuggestions = this.reportData.reduce((sum, item) => sum + (item.suggestions?.length || 0), 0);
        const totalVolume = this.reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData || {})[0];
            return sum + (keywordData?.search_volume || 0);
        }, 0);
        const avgCPC = this.reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData || {})[0];
            return sum + (keywordData?.cpc || 0);
        }, 0) / totalKeywords;
        const avgCompetition = this.reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData || {})[0];
            return sum + (keywordData?.competition || 0);
        }, 0) / totalKeywords;
        const totalDomains = new Set(this.reportData.flatMap(item => Object.keys(item.domainData || {}))).size;
        const totalUrls = new Set(this.reportData.flatMap(item => Object.keys(item.urlAnalysis || {}))).size;
        const totalErrors = this.reportData.reduce((sum, item) => sum + (item.errors?.length || 0), 0);

        document.getElementById('executiveSummary').innerHTML = `
            <div class="summary-card">
                <div class="summary-value">${totalKeywords}</div>
                <div class="summary-label">Keywords Analizadas</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${this.formatNumber(totalVolume)}</div>
                <div class="summary-label">Volumen Total</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${this.formatCurrency(avgCPC)}</div>
                <div class="summary-label">CPC Promedio</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${this.formatPercent(avgCompetition)}</div>
                <div class="summary-label">Competencia Promedio</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${totalSuggestions}</div>
                <div class="summary-label">Total Sugerencias</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${totalDomains}</div>
                <div class="summary-label">Dominios Analizados</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${totalUrls}</div>
                <div class="summary-label">URLs Analizadas</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${totalErrors > 0 ? 'text-warning' : 'text-success'}">${totalErrors}</div>
                <div class="summary-label">Errores Encontrados</div>
            </div>
        `;
    }

    renderKeywordsAnalysis() {
        const keywordsHTML = this.reportData.map((item, index) => {
            const keywordData = Object.values(item.keywordData || {})[0] || {};
            
            return `
                <div class="keyword-detail-card">
                    <div class="keyword-header" onclick="reportDetailsApp.toggleKeywordDetail(${index})">
                        <div class="keyword-title">${item.keyword}</div>
                        <i class="fas fa-chevron-down keyword-toggle" id="toggle-${index}"></i>
                    </div>
                    <div class="keyword-content" id="content-${index}">
                        ${this.renderKeywordContent(item, keywordData)}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('keywordsAnalysis').innerHTML = keywordsHTML;
    }

    renderKeywordContent(item, keywordData) {
        return `
            <div class="keyword-data-grid">
                <div class="data-item">
                    <div class="data-label">Volumen de búsqueda</div>
                    <div class="data-value">${this.formatNumber(keywordData.search_volume || 0)}</div>
                </div>
                <div class="data-item">
                    <div class="data-label">Competencia</div>
                    <div class="data-value">${this.formatPercent(keywordData.competition || 0)}</div>
                </div>
                <div class="data-item">
                    <div class="data-label">CPC</div>
                    <div class="data-value">${this.formatCurrency(keywordData.cpc || 0)}</div>
                </div>
                <div class="data-item">
                    <div class="data-label">Categorías</div>
                    <div class="data-value">${keywordData.categories ? keywordData.categories.join(', ') : 'N/A'}</div>
                </div>
                <div class="data-item">
                    <div class="data-label">Timestamp</div>
                    <div class="data-value">${new Date(item.timestamp).toLocaleString('es-ES')}</div>
                </div>
                <div class="data-item">
                    <div class="data-label">Errores</div>
                    <div class="data-value ${item.errors?.length > 0 ? 'text-warning' : 'text-success'}">
                        ${item.errors?.length > 0 ? `⚠️ ${item.errors.length}` : '✅ 0'}
                    </div>
                </div>
            </div>

            ${this.renderSuggestions(item.suggestions)}
            ${this.renderSimilarKeywords(keywordData.similar_keywords)}
            ${this.renderKeywordDomains(item.domainData)}
            ${this.renderKeywordUrls(item.urlAnalysis)}
            ${this.renderKeywordErrors(item.errors)}
        `;
    }

    renderSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) return '';
        
        return `
            <div class="suggestions-section">
                <div class="suggestions-title">
                    <i class="fas fa-lightbulb"></i>
                    Sugerencias de Google (${suggestions.length})
                </div>
                <div class="suggestions-list">
                    ${suggestions.map(suggestion => `
                        <span class="suggestion-item">${suggestion}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderSimilarKeywords(similarKeywords) {
        if (!similarKeywords || similarKeywords.length === 0) return '';
        
        return `
            <div class="similar-keywords-section">
                <div class="similar-keywords-title">
                    <i class="fas fa-search"></i>
                    Keywords Similares (${similarKeywords.length})
                </div>
                <table class="similar-table">
                    <thead>
                        <tr>
                            <th>Keyword</th>
                            <th>Volumen</th>
                            <th>CPC</th>
                            <th>Páginas Superpuestas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${similarKeywords.slice(0, 15).map(similar => `
                            <tr>
                                <td>${similar.keyword}</td>
                                <td>${this.formatNumber(similar.search_volume || 0)}</td>
                                <td>${this.formatCurrency(similar.cpc || 0)}</td>
                                <td>${similar.overlapping_pages || 0}</td>
                            </tr>
                        `).join('')}
                        ${similarKeywords.length > 15 ? `
                            <tr>
                                <td colspan="4" class="text-center text-muted">
                                    ... y ${similarKeywords.length - 15} keywords similares más
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderKeywordDomains(domainData) {
        if (!domainData || Object.keys(domainData).length === 0) return '';
        
        return Object.entries(domainData).map(([domain, data]) => `
            <div class="domain-card">
                <div class="domain-title">
                    <i class="fas fa-globe"></i>
                    ${domain}
                </div>
                <div class="domain-stats">
                    <div class="data-item">
                        <div class="data-label">Keywords Top 3</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top3 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Keywords Top 10</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top10 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Keywords Top 50</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top50 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Tráfico Estimado</div>
                        <div class="data-value">${this.formatNumber(data.traffic || 0)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderKeywordUrls(urlAnalysis) {
        if (!urlAnalysis || Object.keys(urlAnalysis).length === 0) return '';
        
        return Object.entries(urlAnalysis).map(([url, data]) => `
            <div class="url-card">
                <div class="url-title">
                    <i class="fas fa-link"></i>
                    <a href="${url}" target="_blank" class="url-link">${url}</a>
                </div>
                <div class="keyword-data-grid">
                    ${data.title ? `
                        <div class="data-item">
                            <div class="data-label">Título</div>
                            <div class="data-value">${data.title}</div>
                        </div>
                    ` : ''}
                    ${data.words ? `
                        <div class="data-item">
                            <div class="data-label">Palabras</div>
                            <div class="data-value">${this.formatNumber(data.words)}</div>
                        </div>
                    ` : ''}
                    ${data.exactKeywords !== undefined ? `
                        <div class="data-item">
                            <div class="data-label">Keywords Exactas</div>
                            <div class="data-value">${data.exactKeywords}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderKeywordErrors(errors) {
        if (!errors || errors.length === 0) return '';
        
        return `
            <div class="error-container">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-message">
                    <strong>Errores encontrados:</strong>
                    <ul style="text-align: left; margin-top: 10px;">
                        ${errors.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    renderDomainsAnalysis() {
        const allDomains = {};
        this.reportData.forEach(item => {
            Object.entries(item.domainData || {}).forEach(([domain, data]) => {
                if (!allDomains[domain]) {
                    allDomains[domain] = data;
                }
            });
        });

        if (Object.keys(allDomains).length === 0) {
            document.getElementById('domainsAnalysis').innerHTML = `
                <p class="text-muted"><i class="fas fa-info-circle"></i> No se encontraron datos de dominios en este reporte.</p>
            `;
            return;
        }

        const domainsHTML = Object.entries(allDomains).map(([domain, data]) => `
            <div class="domain-card">
                <div class="domain-title">
                    <i class="fas fa-globe"></i>
                    ${domain}
                </div>
                <div class="domain-stats">
                    <div class="data-item">
                        <div class="data-label">Keywords Top 3</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top3 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Keywords Top 10</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top10 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Keywords Top 50</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top50 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Keywords Top 100</div>
                        <div class="data-value">${this.formatNumber(data.keyword_count_top100 || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Volumen de Búsqueda</div>
                        <div class="data-value">${this.formatNumber(data.search_volume || 0)}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Tráfico Estimado</div>
                        <div class="data-value">${this.formatNumber(data.traffic || 0)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('domainsAnalysis').innerHTML = domainsHTML;
    }

    renderUrlsAnalysis() {
        const allUrls = {};
        this.reportData.forEach(item => {
            Object.entries(item.urlAnalysis || {}).forEach(([url, data]) => {
                if (!allUrls[url]) {
                    allUrls[url] = data;
                }
            });
        });

        if (Object.keys(allUrls).length === 0) {
            document.getElementById('urlsAnalysis').innerHTML = `
                <p class="text-muted"><i class="fas fa-info-circle"></i> No se encontraron datos de URLs en este reporte.</p>
            `;
            return;
        }

        const urlsHTML = Object.entries(allUrls).map(([url, data]) => `
            <div class="url-card">
                <div class="url-title">
                    <i class="fas fa-link"></i>
                    <a href="${url}" target="_blank" class="url-link">${url}</a>
                </div>
                <div class="keyword-data-grid">
                    ${data.title ? `
                        <div class="data-item">
                            <div class="data-label">Título</div>
                            <div class="data-value">${data.title}</div>
                        </div>
                    ` : ''}
                    ${data.words ? `
                        <div class="data-item">
                            <div class="data-label">Palabras</div>
                            <div class="data-value">${this.formatNumber(data.words)}</div>
                        </div>
                    ` : ''}
                    ${data.exactKeywords !== undefined ? `
                        <div class="data-item">
                            <div class="data-label">Keywords Exactas</div>
                            <div class="data-value">${data.exactKeywords}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        document.getElementById('urlsAnalysis').innerHTML = urlsHTML;
    }

    renderRawData() {
        const jsonString = JSON.stringify(this.reportData, null, 2);
        const codeElement = document.querySelector('#rawDataContent code');
        codeElement.textContent = jsonString;
        
        // Apply syntax highlighting with Prism.js
        if (window.Prism) {
            Prism.highlightElement(codeElement);
        }
    }

    toggleKeywordDetail(index) {
        const content = document.getElementById(`content-${index}`);
        const toggle = document.getElementById(`toggle-${index}`);
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            toggle.classList.add('rotated');
        } else {
            content.classList.add('collapsed');
            toggle.classList.remove('rotated');
        }
    }

    toggleRawData() {
        const rawData = document.getElementById('rawDataContent');
        const toggleText = document.getElementById('toggleRawText');
        
        if (rawData.classList.contains('hidden')) {
            rawData.classList.remove('hidden');
            toggleText.textContent = 'Ocultar datos completos';
        } else {
            rawData.classList.add('hidden');
            toggleText.textContent = 'Mostrar datos completos';
        }
    }

    async copyToClipboard() {
        try {
            const jsonString = JSON.stringify(this.reportData, null, 2);
            await navigator.clipboard.writeText(jsonString);
            
            // Show feedback to user
            const button = document.querySelector('.btn-copy-json');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            button.style.background = '#28a745';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
            
        } catch (err) {
            console.error('Error al copiar al portapapeles:', err);
            // Fallback for older browsers
            this.fallbackCopyToClipboard();
        }
    }

    fallbackCopyToClipboard() {
        try {
            const jsonString = JSON.stringify(this.reportData, null, 2);
            const textArea = document.createElement('textarea');
            textArea.value = jsonString;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
            
            // Show feedback
            const button = document.querySelector('.btn-copy-json');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            button.style.background = '#28a745';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
            
        } catch (err) {
            console.error('Error en el fallback de copia:', err);
            alert('No se pudo copiar el contenido. Por favor, copia manualmente.');
        }
    }

    async downloadJSON() {
        try {
            const response = await fetch(`${this.baseURL}/seo/download/${this.reportFilename}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.reportFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading JSON:', error);
            alert('Error al descargar el archivo JSON');
        }
    }

    async downloadCSV() {
        try {
            const csvFilename = this.reportFilename.replace('seo_report_full_', 'seo_report_summary_').replace('.json', '.csv');
            const response = await fetch(`${this.baseURL}/seo/download/${csvFilename}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = csvFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading CSV:', error);
            alert('Error al descargar el archivo CSV');
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString('es-ES');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    formatPercent(value) {
        return new Intl.NumberFormat('es-ES', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value);
    }

    viewAnalytics() {
        // Redirigir a la página de análisis en la misma pestaña
        window.location.href = `analytics.html?filename=${encodeURIComponent(this.reportFilename)}`;
    }

    openInNewTab(url, event) {
        // Prevenir el menú contextual por defecto y el clic normal
        event.preventDefault();
        event.stopPropagation();
        // Abrir en nueva pestaña
        window.open(url, '_blank');
        return false;
    }
}

// Initialize the app when the page loads
const reportDetailsApp = new ReportDetailsApp();
