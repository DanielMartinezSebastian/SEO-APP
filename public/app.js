class SEOApp {
    constructor() {
        this.baseURL = '/api';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadReports();
        this.initializeModal();
    }

    initializeModal() {
        // Asegurar que el modal esté oculto al iniciar
        const modal = document.getElementById('reportModal');
        modal.classList.add('hidden');
    }

    bindEvents() {
        // Formulario de análisis
        document.getElementById('analysisForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAnalysis();
        });

        // Botón de actualizar reportes
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadReports();
        });

        // Modal
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Cerrar modal al hacer clic fuera
        document.getElementById('reportModal').addEventListener('click', (e) => {
            if (e.target.id === 'reportModal') {
                this.closeModal();
            }
        });

        // Cerrar modal con tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async loadReports() {
        try {
            const response = await fetch('/api/seo/reports');
            if (response.ok) {
                const result = await response.json();
                this.renderReports(result.reports || []);
            } else {
                console.error('Error loading reports:', response.status);
                document.getElementById('reportsContainer').innerHTML = 
                    '<p>Error al cargar los reportes</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('reportsContainer').innerHTML = 
                '<p>Error al conectar con el servidor</p>';
        }
    }

    renderReports(reports) {
        const container = document.getElementById('reportsContainer');
        const reportsHTML = reports.map(report => `
            <div class="report-card" onclick="app.viewReport('${report.filename}')" oncontextmenu="app.viewReportInNewTab('${report.filename}'); event.preventDefault(); return false;" style="cursor: pointer;">
                <div class="report-header">
                    <div>
                        <div class="report-title">${this.extractKeywordsFromFilename(report.filename)}</div>
                        <div class="report-date">
                            <i class="fas fa-calendar"></i> ${this.formatDate(report.timestamp)}
                        </div>
                        <div class="report-filename">
                            <i class="fas fa-file"></i> ${report.filename}
                        </div>
                    </div>
                </div>
                <div class="report-actions" onclick="event.stopPropagation();">
                    <button class="btn-view" onclick="app.viewReportPage('${report.filename}')" oncontextmenu="app.viewReportInNewTab('${report.filename}'); event.preventDefault(); return false;">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                    <button class="btn-analytics" onclick="app.viewAnalytics('${report.filename}')" oncontextmenu="app.openInNewTab('analytics.html?filename=${encodeURIComponent(report.filename)}', event)">
                        <i class="fas fa-chart-bar"></i> Análisis
                    </button>
                    <button class="btn-download" onclick="app.downloadReport('${report.filename}')">
                        <i class="fas fa-download"></i> Descargar JSON
                    </button>
                    <button class="btn-download" onclick="app.downloadCSV('${report.filename}')">
                        <i class="fas fa-table"></i> Descargar CSV
                    </button>
                    <button class="btn-delete" onclick="app.deleteReport('${report.filename}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="reports-grid">${reportsHTML}</div>`;
        
        // Cargar las keywords reales para cada reporte
        this.loadKeywordsForReports(reports);
    }

    async createAnalysis() {
        const keywords = document.getElementById('keywords').value.trim();
        const country = document.getElementById('country').value;
        const language = document.getElementById('language').value;
        const button = document.getElementById('analyzeBtn');
        const status = document.getElementById('analysisStatus');

        if (!keywords) {
            this.showStatus('Por favor ingresa al menos una keyword', 'error');
            return;
        }

        // Convertir keywords string a array
        const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
        
        if (keywordArray.length === 0) {
            this.showStatus('Por favor ingresa keywords válidas', 'error');
            return;
        }

        if (keywordArray.length > 10) {
            this.showStatus('Máximo 10 keywords por análisis', 'error');
            return;
        }

        // UI feedback
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
        this.showStatus('Iniciando análisis... Esto puede tomar varios minutos.', 'info');

        try {
            const response = await fetch(`${this.baseURL}/seo/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keywords: keywordArray,
                    country,
                    language
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showStatus(`✅ Análisis completado exitosamente! Se analizaron ${data.summary.length} keywords.`, 'success');
                this.renderAnalysisResults(data.summary);
                this.loadReports(); // Actualizar lista de reportes
                document.getElementById('analysisForm').reset();
            } else {
                this.showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Error creando análisis:', error);
            this.showStatus('Error de conexión. Verifica que el servidor esté funcionando.', 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-search"></i> Analizar Keywords';
        }
    }

    renderAnalysisResults(summary) {
        const resultsHTML = `
            <div class="mt-3">
                <h4><i class="fas fa-chart-bar"></i> Resumen del Análisis</h4>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Keyword</th>
                            <th>Volumen</th>
                            <th>Competencia</th>
                            <th>CPC</th>
                            <th>Sugerencias</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.map((item, index) => `
                            <tr class="clickable-row" onclick="app.toggleAnalysisDetails('${item.keyword}', ${index})" data-keyword="${item.keyword}">
                                <td><strong>${item.keyword}</strong> <i class="fas fa-chevron-down row-toggle" id="analysis-toggle-${index}"></i></td>
                                <td>${this.formatNumber(item.searchVolume)}</td>
                                <td>${this.formatPercent(item.competition)}</td>
                                <td>${this.formatCurrency(item.cpc)}</td>
                                <td>${item.suggestionsCount}</td>
                            </tr>
                            <tr class="detail-row hidden" id="analysis-detail-${index}">
                                <td colspan="5">
                                    <div class="analysis-loading">
                                        <i class="fas fa-spinner fa-spin"></i> Cargando detalles...
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const status = document.getElementById('analysisStatus');
        status.innerHTML += resultsHTML;
    }

    async viewReport(filename) {
        try {
            // Mostrar modal y cargar datos
            const modal = document.getElementById('reportModal');
            const modalTitle = document.getElementById('modalTitle');
            const reportDetails = document.getElementById('reportDetails');
            
            // Mostrar el modal
            modal.classList.remove('hidden');
            modalTitle.textContent = `Reporte: ${filename}`;
            reportDetails.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando datos del reporte...</div>';
            
            // Cargar datos del reporte
            const response = await fetch(`/api/seo/report/${filename}`);
            if (response.ok) {
                const result = await response.json();
                this.renderReportDetails(result.data);
            } else {
                reportDetails.innerHTML = '<p class="text-error">Error al cargar el reporte</p>';
            }
        } catch (error) {
            console.error('Error loading report:', error);
            const reportDetails = document.getElementById('reportDetails');
            reportDetails.innerHTML = '<p class="text-error">Error de conexión</p>';
        }
    }

    async viewReportPage(filename) {
        // Redirigir a la página de detalles en la misma pestaña
        window.location.href = `report-details.html?filename=${encodeURIComponent(filename)}`;
    }

    async viewReportInNewTab(filename) {
        // Redirigir a la página de detalles en nueva pestaña
        window.open(`report-details.html?filename=${encodeURIComponent(filename)}`, '_blank');
    }

    async viewAnalytics(filename) {
        // Redirigir a la página de análisis en la misma pestaña
        window.location.href = `analytics.html?filename=${encodeURIComponent(filename)}`;
    }

    openInNewTab(url, event) {
        // Prevenir el menú contextual por defecto y el clic normal
        event.preventDefault();
        event.stopPropagation();
        // Abrir en nueva pestaña
        window.open(url, '_blank');
        return false;
    }

    renderReportDetails(reportData) {
        const details = document.getElementById('reportDetails');
        
        // Calcular métricas generales
        const totalKeywords = reportData.length;
        const totalVolume = reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData)[0];
            return sum + (keywordData?.search_volume || 0);
        }, 0);

        const avgCompetition = reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData)[0];
            return sum + (keywordData?.competition || 0);
        }, 0) / totalKeywords;

        const avgCPC = reportData.reduce((sum, item) => {
            const keywordData = Object.values(item.keywordData)[0];
            return sum + (keywordData?.cpc || 0);
        }, 0) / totalKeywords;

        const detailsHTML = `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${totalKeywords}</div>
                    <div class="metric-label">Keywords Analizadas</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.formatNumber(totalVolume)}</div>
                    <div class="metric-label">Volumen Total</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.formatPercent(avgCompetition)}</div>
                    <div class="metric-label">Competencia Promedio</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.formatCurrency(avgCPC)}</div>
                    <div class="metric-label">CPC Promedio</div>
                </div>
            </div>

            <h4><i class="fas fa-list"></i> Detalles por Keyword</h4>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Keyword</th>
                        <th>Volumen</th>
                        <th>Competencia</th>
                        <th>CPC</th>
                        <th>Sugerencias</th>
                        <th>Errores</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.map((item, index) => {
                        const keywordData = Object.values(item.keywordData)[0] || {};
                        return `
                            <tr class="clickable-row" onclick="app.toggleKeywordDetails('${item.keyword}', ${index})" data-keyword="${item.keyword}">
                                <td><strong>${item.keyword}</strong> <i class="fas fa-chevron-down row-toggle" id="toggle-${index}"></i></td>
                                <td>${this.formatNumber(keywordData.search_volume || 0)}</td>
                                <td>${this.formatPercent(keywordData.competition || 0)}</td>
                                <td>${this.formatCurrency(keywordData.cpc || 0)}</td>
                                <td>${item.suggestions.length}</td>
                                <td class="${item.errors.length > 0 ? 'text-error' : 'text-success'}">
                                    ${item.errors.length > 0 ? `⚠️ ${item.errors.length}` : '✅ 0'}
                                </td>
                            </tr>
                            <tr class="detail-row hidden" id="detail-${index}">
                                <td colspan="6">
                                    <div class="keyword-details">
                                        ${this.renderKeywordDetails(item)}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        details.innerHTML = detailsHTML;
    }

    toggleKeywordDetails(keyword, index) {
        const detailRow = document.getElementById(`detail-${index}`);
        const toggleIcon = document.getElementById(`toggle-${index}`);
        
        if (detailRow.classList.contains('hidden')) {
            detailRow.classList.remove('hidden');
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-up');
        } else {
            detailRow.classList.add('hidden');
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
        }
    }

    renderKeywordDetails(item) {
        const keywordData = Object.values(item.keywordData || {})[0] || {};
        const domainData = Object.values(item.domainData || {})[0] || {};
        const urlData = Object.values(item.urlAnalysis || {})[0] || {};

        return `
            <div class="keyword-detail-container">
                <div class="detail-section">
                    <h5><i class="fas fa-key"></i> Información de la Keyword</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Keyword:</span>
                            <span class="detail-value">${item.keyword}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Volumen de búsqueda:</span>
                            <span class="detail-value">${this.formatNumber(keywordData.search_volume || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Competencia:</span>
                            <span class="detail-value">${this.formatPercent(keywordData.competition || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">CPC:</span>
                            <span class="detail-value">${this.formatCurrency(keywordData.cpc || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Categorías:</span>
                            <span class="detail-value">${keywordData.categories ? keywordData.categories.join(', ') : 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Timestamp:</span>
                            <span class="detail-value">${new Date(item.timestamp).toLocaleString('es-ES')}</span>
                        </div>
                    </div>
                </div>

                ${item.suggestions && item.suggestions.length > 0 ? `
                <div class="detail-section">
                    <h5><i class="fas fa-lightbulb"></i> Sugerencias de Google (${item.suggestions.length})</h5>
                    <div class="suggestions-grid">
                        ${item.suggestions.map(suggestion => `
                            <span class="suggestion-tag">${suggestion}</span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${keywordData.similar_keywords && keywordData.similar_keywords.length > 0 ? `
                <div class="detail-section">
                    <h5><i class="fas fa-search"></i> Keywords Similares (${keywordData.similar_keywords.length})</h5>
                    <table class="similar-keywords-table">
                        <thead>
                            <tr>
                                <th>Keyword</th>
                                <th>Volumen</th>
                                <th>CPC</th>
                                <th>Páginas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${keywordData.similar_keywords.slice(0, 10).map(similar => `
                                <tr>
                                    <td>${similar.keyword}</td>
                                    <td>${this.formatNumber(similar.search_volume || 0)}</td>
                                    <td>${this.formatCurrency(similar.cpc || 0)}</td>
                                    <td>${similar.overlapping_pages || 0}</td>
                                </tr>
                            `).join('')}
                            ${keywordData.similar_keywords.length > 10 ? `
                                <tr>
                                    <td colspan="4" class="text-center text-muted">
                                        ... y ${keywordData.similar_keywords.length - 10} más
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
                ` : ''}

                ${Object.keys(item.domainData || {}).length > 0 ? `
                <div class="detail-section">
                    <h5><i class="fas fa-globe"></i> Datos del Dominio</h5>
                    <div class="detail-grid">
                        ${Object.entries(item.domainData || {}).map(([domain, data]) => `
                            <div class="detail-item full-width">
                                <span class="detail-label">Dominio:</span>
                                <span class="detail-value">${domain}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Keywords Top 3:</span>
                                <span class="detail-value">${this.formatNumber(data.keyword_count_top3 || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Keywords Top 10:</span>
                                <span class="detail-value">${this.formatNumber(data.keyword_count_top10 || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Keywords Top 50:</span>
                                <span class="detail-value">${this.formatNumber(data.keyword_count_top50 || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Tráfico estimado:</span>
                                <span class="detail-value">${this.formatNumber(data.traffic || 0)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${Object.keys(item.urlAnalysis || {}).length > 0 ? `
                <div class="detail-section">
                    <h5><i class="fas fa-link"></i> Análisis de URL</h5>
                    <div class="detail-grid">
                        ${Object.entries(item.urlAnalysis || {}).map(([url, data]) => `
                            <div class="detail-item full-width">
                                <span class="detail-label">URL:</span>
                                <span class="detail-value"><a href="${url}" target="_blank">${url}</a></span>
                            </div>
                            ${data.title ? `
                                <div class="detail-item full-width">
                                    <span class="detail-label">Título:</span>
                                    <span class="detail-value">${data.title}</span>
                                </div>
                            ` : ''}
                            ${data.words ? `
                                <div class="detail-item">
                                    <span class="detail-label">Palabras:</span>
                                    <span class="detail-value">${this.formatNumber(data.words)}</span>
                                </div>
                            ` : ''}
                            ${data.exactKeywords !== undefined ? `
                                <div class="detail-item">
                                    <span class="detail-label">Keywords exactas:</span>
                                    <span class="detail-value">${data.exactKeywords}</span>
                                </div>
                            ` : ''}
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${item.errors && item.errors.length > 0 ? `
                <div class="detail-section">
                    <h5><i class="fas fa-exclamation-triangle"></i> Errores</h5>
                    <div class="errors-list">
                        ${item.errors.map(error => `
                            <div class="error-item">
                                <i class="fas fa-times-circle"></i> ${error}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    async toggleAnalysisDetails(keyword, index) {
        const detailRow = document.getElementById(`analysis-detail-${index}`);
        const toggleIcon = document.getElementById(`analysis-toggle-${index}`);
        
        if (detailRow.classList.contains('hidden')) {
            detailRow.classList.remove('hidden');
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-up');
            
            // Cargar los detalles del último análisis si no están cargados
            if (detailRow.querySelector('.analysis-loading')) {
                await this.loadAnalysisDetails(keyword, index);
            }
        } else {
            detailRow.classList.add('hidden');
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
        }
    }

    async loadAnalysisDetails(keyword, index) {
        const detailCell = document.querySelector(`#analysis-detail-${index} td`);
        
        try {
            // Obtener el último reporte para encontrar los detalles de esta keyword
            const reportsResponse = await fetch('/api/seo/reports');
            const reportsResult = await reportsResponse.json();
            
            if (reportsResult.reports && reportsResult.reports.length > 0) {
                const latestReport = reportsResult.reports[0];
                const reportResponse = await fetch(`/api/seo/report/${latestReport.filename}`);
                const reportResult = await reportResponse.json();
                
                // Buscar los datos de esta keyword específica
                const keywordItem = reportResult.data.find(item => item.keyword === keyword);
                
                if (keywordItem) {
                    detailCell.innerHTML = `
                        <div class="keyword-details">
                            ${this.renderKeywordDetails(keywordItem)}
                        </div>
                    `;
                } else {
                    detailCell.innerHTML = `
                        <div class="keyword-details">
                            <p><i class="fas fa-info-circle"></i> No se encontraron detalles para esta keyword en el último reporte.</p>
                        </div>
                    `;
                }
            } else {
                detailCell.innerHTML = `
                    <div class="keyword-details">
                        <p><i class="fas fa-info-circle"></i> No hay reportes disponibles.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading analysis details:', error);
            detailCell.innerHTML = `
                <div class="keyword-details">
                    <p><i class="fas fa-exclamation-triangle"></i> Error al cargar los detalles.</p>
                </div>
            `;
        }
    }

    async downloadReport(filename) {
        try {
            const response = await fetch(`${this.baseURL}/seo/download/${filename}`);
            if (response.ok) {
                const blob = await response.blob();
                this.downloadBlob(blob, filename);
            } else {
                alert('Error al descargar el archivo');
            }
        } catch (error) {
            console.error('Error descargando reporte:', error);
            alert('Error de conexión');
        }
    }

    async downloadCSV(filename) {
        const csvFilename = filename.replace('_full_', '_summary_').replace('.json', '.csv');
        try {
            const response = await fetch(`${this.baseURL}/seo/download/${csvFilename}`);
            if (response.ok) {
                const blob = await response.blob();
                this.downloadBlob(blob, csvFilename);
            } else {
                alert('Error al descargar el archivo CSV');
            }
        } catch (error) {
            console.error('Error descargando CSV:', error);
            alert('Error de conexión');
        }
    }

    downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async deleteReport(filename) {
        if (!confirm(`¿Estás seguro de que quieres eliminar el reporte "${filename}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/seo/report/${filename}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                alert('Reporte eliminado exitosamente');
                this.loadReports(); // Actualizar lista
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error eliminando reporte:', error);
            alert('Error de conexión');
        }
    }

    closeModal() {
        document.getElementById('reportModal').classList.add('hidden');
    }

    showStatus(message, type) {
        const status = document.getElementById('analysisStatus');
        status.className = `status ${type}`;
        status.innerHTML = message;
        status.classList.remove('hidden');

        // Auto-hide después de 10 segundos para mensajes de éxito
        if (type === 'success') {
            setTimeout(() => {
                status.classList.add('hidden');
            }, 10000);
        }
    }

    formatNumber(num) {
        if (!num || num === 0) return '0';
        return num.toLocaleString('es-ES');
    }

    formatPercent(num) {
        if (!num || num === 0) return '0%';
        return (num * 100).toFixed(1) + '%';
    }

    formatCurrency(num) {
        if (!num || num === 0) return '0€';
        return num.toFixed(2) + '€';
    }

    formatDate(timestamp) {
        try {
            // Formato: "2025:07:31 19:14:28:692"
            const cleanTimestamp = timestamp.replace(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{3})/, '$1-$2-$3 $4:$5:$6.$7');
            const date = new Date(cleanTimestamp);
            return date.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return timestamp;
        }
    }

    extractKeywordsFromFilename(filename) {
        // Placeholder inicial, será reemplazado por las keywords reales
        return 'Cargando keywords...';
    }

    async loadKeywordsForReports(reports) {
        for (const report of reports) {
            try {
                const response = await fetch(`/api/seo/report/${report.filename}`);
                if (response.ok) {
                    const result = await response.json();
                    const keywords = this.extractKeywordsFromData(result.data);
                    
                    // Buscar la tarjeta correspondiente y actualizar el título
                    const reportCards = document.querySelectorAll('.report-card');
                    reportCards.forEach(card => {
                        const filenameElement = card.querySelector('.report-filename');
                        if (filenameElement && filenameElement.textContent.includes(report.filename)) {
                            const titleElement = card.querySelector('.report-title');
                            if (titleElement) {
                                titleElement.innerHTML = `<i class="fas fa-key"></i> ${keywords}`;
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading keywords for report:', report.filename, error);
                // En caso de error, mostrar el filename
                const reportCards = document.querySelectorAll('.report-card');
                reportCards.forEach(card => {
                    const filenameElement = card.querySelector('.report-filename');
                    if (filenameElement && filenameElement.textContent.includes(report.filename)) {
                        const titleElement = card.querySelector('.report-title');
                        if (titleElement && titleElement.textContent === 'Cargando keywords...') {
                            titleElement.innerHTML = `<i class="fas fa-file"></i> ${report.filename}`;
                        }
                    }
                });
            }
        }
    }

    extractKeywordsFromData(data) {
        const keywords = [];
        
        // Los datos vienen como un array de objetos con análisis de keywords
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.keyword) {
                    keywords.push(item.keyword);
                }
            });
        }
        
        // Truncar a máximo 10 keywords
        const truncatedKeywords = keywords.slice(0, 10);
        
        if (keywords.length > 10) {
            return truncatedKeywords.join(', ') + ` (+${keywords.length - 10} más)`;
        } else if (truncatedKeywords.length > 0) {
            return truncatedKeywords.join(', ');
        } else {
            return 'Sin keywords encontradas';
        }
    }
}

// Inicializar la aplicación
const app = new SEOApp();
