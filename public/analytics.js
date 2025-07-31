class AnalyticsApp {
    constructor() {
        this.reportData = null;
        this.reportFilename = null;
        this.allKeywords = [];
        this.filteredKeywords = [];
        this.currentChart = null;
        this.distributionCharts = {};
        this.baseURL = '/api';
        this.colorPalette = {};
        // Paleta de colores mejor diferenciados para keywords principales
        this.mainKeywordColors = [
            '#e6194b', // Rojo
            '#3cb44b', // Verde
            '#ffe119', // Amarillo
            '#4363d8', // Azul
            '#f58231', // Naranja
            '#911eb4', // Morado
            '#46f0f0', // Cian
            '#f032e6', // Rosa
            '#bcf60c', // Lima
            '#fabebe', // Rosa claro
            '#008080', // Verde azulado
            '#e6beff', // Lila claro
            '#9a6324', // Marrón
            '#fffac8', // Amarillo claro
            '#800000', // Granate
            '#aaffc3', // Verde menta
            '#808000', // Oliva
            '#ffd8b1', // Melocotón
            '#000075', // Azul oscuro
            '#808080', // Gris
            '#ffffff', // Blanco
            '#000000'  // Negro
        ];
        this.currentConfig = {
            chartType: 'bar',
            sortMetric: 'search_volume',
            sortOrder: 'desc',
            keywordFilter: 'all',
            topLimit: 20
        };
        
        // Esperar a que el tema esté inicializado
        this.waitForTheme().then(() => {
            this.init();
        });
    }

    async waitForTheme() {
        // Esperar a que el ThemeManager esté disponible
        while (!window.themeManager) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Configurar Chart.js para el tema actual
        this.configureChartTheme();
    }

    configureChartTheme() {
        const isDark = window.themeManager.isDarkMode();
        
        // Configurar colores por defecto de Chart.js
        Chart.defaults.color = isDark ? '#ffffff' : '#666666';
        Chart.defaults.borderColor = isDark ? '#404040' : '#dee2e6';
        Chart.defaults.backgroundColor = isDark ? '#1e1e1e' : '#ffffff';
        
        // Configurar colores de grid
        if (Chart.defaults.scales) {
            Chart.defaults.scales.category = Chart.defaults.scales.category || {};
            Chart.defaults.scales.linear = Chart.defaults.scales.linear || {};
            
            Chart.defaults.scales.category.grid = {
                color: isDark ? '#404040' : '#e0e0e0'
            };
            
            Chart.defaults.scales.linear.grid = {
                color: isDark ? '#404040' : '#e0e0e0'
            };
        }
    }

    init() {
        // Obtener el filename del reporte desde la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.reportFilename = urlParams.get('filename');
        
        if (!this.reportFilename) {
            this.showError('No se especificó un reporte para analizar');
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
            
            this.processKeywordsData();
            this.hideLoading();
            this.renderAnalytics();
            
        } catch (error) {
            console.error('Error loading report:', error);
            this.showError('Error al cargar el reporte: ' + error.message);
        }
    }

    processKeywordsData() {
        this.allKeywords = [];
        this.generateColorPalette();
        
        this.reportData.forEach((item, index) => {
            const keywordData = Object.values(item.keywordData || {})[0] || {};
            
            // Keyword principal
            this.allKeywords.push({
                keyword: item.keyword,
                type: 'main',
                search_volume: keywordData.search_volume || 0,
                cpc: keywordData.cpc || 0,
                competition: keywordData.competition || 0,
                similar_count: keywordData.similar_keywords?.length || 0,
                suggestions_count: item.suggestions?.length || 0,
                keyword_length: item.keyword.length,
                categories: keywordData.categories || [],
                parent_keyword: item.keyword,
                color_group: item.keyword,
                color_index: index
            });

            // Keywords similares
            if (keywordData.similar_keywords) {
                keywordData.similar_keywords.forEach(similar => {
                    this.allKeywords.push({
                        keyword: similar.keyword,
                        type: 'similar',
                        search_volume: similar.search_volume || 0,
                        cpc: similar.cpc || 0,
                        competition: similar.competition || 0,
                        similar_count: 0,
                        suggestions_count: 0,
                        keyword_length: similar.keyword.length,
                        overlapping_pages: similar.overlapping_pages || 0,
                        parent_keyword: item.keyword,
                        color_group: item.keyword,
                        color_index: index
                    });
                });
            }

            // Sugerencias
            if (item.suggestions) {
                item.suggestions.forEach(suggestion => {
                    this.allKeywords.push({
                        keyword: suggestion,
                        type: 'suggestion',
                        search_volume: 0, // Las sugerencias no tienen datos de volumen
                        cpc: 0,
                        competition: 0,
                        similar_count: 0,
                        suggestions_count: 0,
                        keyword_length: suggestion.length,
                        parent_keyword: item.keyword,
                        color_group: item.keyword,
                        color_index: index
                    });
                });
            }
        });

        this.filteredKeywords = [...this.allKeywords];
        this.applyFilters();
    }

    generateColorPalette() {
        this.colorPalette = {};
        
        this.reportData.forEach((item, index) => {
            const baseColor = this.mainKeywordColors[index % this.mainKeywordColors.length];
            const colorGroup = {
                main: this.hexToRgba(baseColor, 0.8),
                similar: this.hexToRgba(baseColor, 0.6),
                suggestion: this.hexToRgba(baseColor, 0.4),
                border: {
                    main: this.hexToRgba(baseColor, 1),
                    similar: this.hexToRgba(baseColor, 0.8),
                    suggestion: this.hexToRgba(baseColor, 0.6)
                }
            };
            
            this.colorPalette[item.keyword] = colorGroup;
        });
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    applyFilters() {
        let filtered = [...this.allKeywords];

        // Filtrar por tipo
        if (this.currentConfig.keywordFilter !== 'all') {
            filtered = filtered.filter(kw => kw.type === this.currentConfig.keywordFilter);
        }

        // Ordenar
        filtered.sort((a, b) => {
            const metric = this.currentConfig.sortMetric;
            const aVal = a[metric] || 0;
            const bVal = b[metric] || 0;
            
            if (this.currentConfig.sortOrder === 'desc') {
                return bVal - aVal;
            } else {
                return aVal - bVal;
            }
        });

        // Limitar resultados
        if (this.currentConfig.topLimit !== 'all') {
            filtered = filtered.slice(0, parseInt(this.currentConfig.topLimit));
        }

        this.filteredKeywords = filtered;
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('analyticsTitle').classList.remove('hidden');
        document.getElementById('analyticsContent').classList.remove('hidden');
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

    renderAnalytics() {
        this.renderHeader();
        this.renderStatistics();
        this.renderMainChart();
        this.renderTable();
        this.renderDistributionCharts();
        this.renderInsights();
    }

    renderHeader() {
        const keywords = this.reportData.map(item => item.keyword).join(', ');
        const reportDate = new Date(this.reportData[0]?.timestamp || Date.now());
        
        document.getElementById('reportMeta').innerHTML = `
            <div class="meta-item">
                <i class="fas fa-key"></i>
                <span>${this.reportData.length} Keywords principales analizadas</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-calendar"></i>
                <span>${reportDate.toLocaleString('es-ES')}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-file"></i>
                <span>${this.reportFilename}</span>
            </div>
        `;
    }

    renderStatistics() {
        const totalKeywords = this.allKeywords.length;
        const mainKeywords = this.allKeywords.filter(kw => kw.type === 'main');
        const avgVolume = mainKeywords.reduce((sum, kw) => sum + kw.search_volume, 0) / (mainKeywords.length || 1);
        const avgCPC = mainKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / (mainKeywords.length || 1);
        const avgCompetition = mainKeywords.reduce((sum, kw) => sum + kw.competition, 0) / (mainKeywords.length || 1);
        const totalSuggestions = this.allKeywords.filter(kw => kw.type === 'suggestion').length;
        const totalSimilar = this.allKeywords.filter(kw => kw.type === 'similar').length;

        document.getElementById('totalKeywords').textContent = this.formatNumber(totalKeywords);
        document.getElementById('avgVolume').textContent = this.formatNumber(avgVolume);
        document.getElementById('avgCPC').textContent = this.formatCurrency(avgCPC);
        document.getElementById('avgCompetition').textContent = this.formatPercent(avgCompetition);
        document.getElementById('totalSuggestions').textContent = this.formatNumber(totalSuggestions);
        document.getElementById('totalSimilar').textContent = this.formatNumber(totalSimilar);
    }

    renderMainChart() {
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        
        if (this.currentChart) {
            this.currentChart.destroy();
        }

        const chartData = this.prepareChartData();
        const chartConfig = this.getChartConfig(chartData);

        this.currentChart = new Chart(ctx, chartConfig);
        
        // Actualizar título y descripción
        this.updateChartInfo();
        
        // Renderizar leyenda de colores
        this.renderColorLegend();
    }

    renderColorLegend() {
        const legendContainer = document.getElementById('colorLegend');
        
        const legendHTML = Object.entries(this.colorPalette).map(([keyword, colors], index) => {
            const mainKeywordData = this.reportData.find(item => item.keyword === keyword);
            const keywordCounts = {
                main: this.allKeywords.filter(kw => kw.color_group === keyword && kw.type === 'main').length,
                similar: this.allKeywords.filter(kw => kw.color_group === keyword && kw.type === 'similar').length,
                suggestion: this.allKeywords.filter(kw => kw.color_group === keyword && kw.type === 'suggestion').length
            };
            
            const totalCount = keywordCounts.main + keywordCounts.similar + keywordCounts.suggestion;
            
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors.main}; border-color: ${colors.border.main};">
                        ${index + 1}
                    </div>
                    <span>${keyword}</span>
                    <div class="legend-types" title="Principal: ${keywordCounts.main}, Similares: ${keywordCounts.similar}, Sugerencias: ${keywordCounts.suggestion}">
                        <div class="legend-type" style="background: ${colors.main};" title="Principal (${keywordCounts.main})"></div>
                        <div class="legend-type" style="background: ${colors.similar};" title="Similares (${keywordCounts.similar})"></div>
                        <div class="legend-type" style="background: ${colors.suggestion};" title="Sugerencias (${keywordCounts.suggestion})"></div>
                    </div>
                    <small style="color: var(--text-secondary);">(${totalCount} total)</small>
                </div>
            `;
        }).join('');

        legendContainer.innerHTML = legendHTML;
    }

    prepareChartData() {
        const metric = this.currentConfig.sortMetric;
        const labels = this.filteredKeywords.map(kw => kw.keyword);
        const data = this.filteredKeywords.map(kw => kw[metric] || 0);
        const backgroundColors = this.filteredKeywords.map(kw => this.getColorByKeyword(kw));
        const borderColors = this.filteredKeywords.map(kw => this.getBorderColorByKeyword(kw));

        return { labels, data, backgroundColors, borderColors };
    }

    getChartConfig(chartData) {
        const chartType = this.currentConfig.chartType;
        const metric = this.currentConfig.sortMetric;
        const isDark = window.themeManager.isDarkMode();

        const config = {
            type: chartType,
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: this.getMetricLabel(metric),
                    data: chartData.data,
                    backgroundColor: chartData.backgroundColors,
                    borderColor: chartData.borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: ['pie', 'doughnut'].includes(chartType),
                        position: 'right',
                        labels: {
                            color: isDark ? '#ffffff' : '#666666',
                            generateLabels: (chart) => {
                                if (['pie', 'doughnut'].includes(chartType)) {
                                    return this.generateCustomLegend(chart);
                                }
                                return Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(40, 40, 40, 0.95)' : 'rgba(0, 0, 0, 0.8)',
                        titleColor: isDark ? '#ffffff' : '#ffffff',
                        bodyColor: isDark ? '#ffffff' : '#ffffff',
                        borderColor: isDark ? '#666666' : '#cccccc',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const kw = this.filteredKeywords[context.dataIndex];
                                let label = `${kw.keyword}`;
                                
                                if (kw.parent_keyword !== kw.keyword) {
                                    label += ` (${kw.parent_keyword})`;
                                }
                                
                                label += `: `;
                                
                                switch (metric) {
                                    case 'search_volume':
                                        label += this.formatNumber(context.parsed.y || context.parsed);
                                        break;
                                    case 'cpc':
                                        label += this.formatCurrency(context.parsed.y || context.parsed);
                                        break;
                                    case 'competition':
                                        label += this.formatPercent(context.parsed.y || context.parsed);
                                        break;
                                    default:
                                        label += context.parsed.y || context.parsed;
                                }
                                
                                return label;
                            }
                        }
                    }
                },
                scales: ['pie', 'doughnut', 'radar'].includes(chartType) ? {} : {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: isDark ? '#404040' : '#e0e0e0'
                        },
                        ticks: {
                            color: isDark ? '#ffffff' : '#666666',
                            callback: (value) => {
                                switch (metric) {
                                    case 'search_volume':
                                        return this.formatNumber(value);
                                    case 'cpc':
                                        return this.formatCurrency(value);
                                    case 'competition':
                                        return this.formatPercent(value);
                                    default:
                                        return value;
                                }
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: isDark ? '#404040' : '#e0e0e0'
                        },
                        ticks: {
                            color: isDark ? '#ffffff' : '#666666',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        };

        return config;
    }

    getColorByType(type) {
        switch (type) {
            case 'main': return 'rgba(102, 126, 234, 0.8)';
            case 'similar': return 'rgba(78, 205, 196, 0.8)';
            case 'suggestion': return 'rgba(255, 152, 0, 0.8)';
            default: return 'rgba(128, 128, 128, 0.8)';
        }
    }

    getColorByKeyword(keyword) {
        const colorGroup = this.colorPalette[keyword.color_group];
        if (colorGroup) {
            return colorGroup[keyword.type];
        }
        return this.getColorByType(keyword.type);
    }

    getBorderColorByKeyword(keyword) {
        const colorGroup = this.colorPalette[keyword.color_group];
        if (colorGroup && colorGroup.border) {
            return colorGroup.border[keyword.type];
        }
        return this.getColorByKeyword(keyword).replace('0.8', '1');
    }

    generateCustomLegend(chart) {
        const labels = [];
        const groupedKeywords = {};
        
        // Agrupar keywords por parent_keyword
        this.filteredKeywords.forEach((kw, index) => {
            const parentKeyword = kw.parent_keyword;
            if (!groupedKeywords[parentKeyword]) {
                groupedKeywords[parentKeyword] = [];
            }
            groupedKeywords[parentKeyword].push({
                keyword: kw,
                index: index,
                color: this.getColorByKeyword(kw)
            });
        });

        // Crear labels agrupados
        Object.entries(groupedKeywords).forEach(([parentKeyword, keywords]) => {
            const mainKeyword = keywords.find(k => k.keyword.type === 'main');
            if (mainKeyword) {
                labels.push({
                    text: `${parentKeyword} (${keywords.length})`,
                    fillStyle: mainKeyword.color,
                    strokeStyle: this.getBorderColorByKeyword(mainKeyword.keyword),
                    lineWidth: 2,
                    hidden: false
                });
            }
        });

        return labels;
    }

    getMetricLabel(metric) {
        const labels = {
            search_volume: 'Volumen de Búsqueda',
            cpc: 'CPC (€)',
            competition: 'Competencia (%)',
            similar_count: 'Cantidad de Similares',
            suggestions_count: 'Cantidad de Sugerencias',
            keyword_length: 'Longitud de Keyword'
        };
        return labels[metric] || metric;
    }

    updateChartInfo() {
        const metric = this.currentConfig.sortMetric;
        const filter = this.currentConfig.keywordFilter;
        const limit = this.currentConfig.topLimit;
        const order = this.currentConfig.sortOrder;

        document.getElementById('chartTitle').textContent = `Análisis por ${this.getMetricLabel(metric)}`;
        
        let info = `Mostrando `;
        if (limit === 'all') {
            info += `todas las keywords`;
        } else {
            info += `top ${limit} keywords`;
        }
        
        if (filter !== 'all') {
            const filterLabels = {
                main: 'principales',
                similar: 'similares',
                suggestion: 'sugerencias'
            };
            info += ` ${filterLabels[filter]}`;
        }
        
        info += ` ordenadas por ${this.getMetricLabel(metric).toLowerCase()} ${order === 'desc' ? 'descendente' : 'ascendente'}`;
        
        document.getElementById('chartInfo').textContent = info;
    }

    renderTable() {
        const tbody = document.getElementById('analyticsTableBody');
        
        const tableHTML = this.filteredKeywords.map(kw => {
            const bgColor = this.getColorByKeyword(kw);
            const textColor = kw.type === 'main' ? '#fff' : '#333';
            
            return `
            <tr style="background: linear-gradient(90deg, ${bgColor} 0%, ${bgColor.replace('0.8', '0.1')} 100%);">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${bgColor}; border: 2px solid ${this.getBorderColorByKeyword(kw)};"></div>
                        <div>
                            <strong>${kw.keyword}</strong>
                            ${kw.parent_keyword !== kw.keyword ? `<br><small style="color: var(--text-secondary);">de: ${kw.parent_keyword}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td><span class="keyword-type ${kw.type}" style="background: ${bgColor}; color: ${textColor};">${this.getTypeLabel(kw.type)}</span></td>
                <td>${this.formatNumber(kw.search_volume)}</td>
                <td>${this.formatCurrency(kw.cpc)}</td>
                <td>${this.formatPercent(kw.competition)}</td>
                <td>${kw.similar_count}</td>
                <td>${kw.suggestions_count}</td>
            </tr>
        `}).join('');

        tbody.innerHTML = tableHTML;
    }

    getTypeLabel(type) {
        const labels = {
            main: 'Principal',
            similar: 'Similar',
            suggestion: 'Sugerencia'
        };
        return labels[type] || type;
    }

    renderDistributionCharts() {
        this.renderTypeDistribution();
        this.renderCompetitionDistribution();
        this.renderCPCDistribution();
        this.renderCorrelationChart();
    }

    renderTypeDistribution() {
        const ctx = document.getElementById('typeDistributionChart').getContext('2d');
        
        if (this.distributionCharts.type) {
            this.distributionCharts.type.destroy();
        }

        const typeCounts = {
            main: this.allKeywords.filter(kw => kw.type === 'main').length,
            similar: this.allKeywords.filter(kw => kw.type === 'similar').length,
            suggestion: this.allKeywords.filter(kw => kw.type === 'suggestion').length
        };

        this.distributionCharts.type = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Principales', 'Similares', 'Sugerencias'],
                datasets: [{
                    data: [typeCounts.main, typeCounts.similar, typeCounts.suggestion],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(102, 126, 234, 0.6)',
                        'rgba(102, 126, 234, 0.4)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(102, 126, 234, 0.6)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderCompetitionDistribution() {
        const ctx = document.getElementById('competitionDistributionChart').getContext('2d');
        
        if (this.distributionCharts.competition) {
            this.distributionCharts.competition.destroy();
        }

        const mainKeywords = this.allKeywords.filter(kw => kw.type === 'main');
        const ranges = {
            'Baja (0-30%)': mainKeywords.filter(kw => kw.competition <= 0.3).length,
            'Media (30-70%)': mainKeywords.filter(kw => kw.competition > 0.3 && kw.competition <= 0.7).length,
            'Alta (70-100%)': mainKeywords.filter(kw => kw.competition > 0.7).length
        };

        this.distributionCharts.competition = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(ranges),
                datasets: [{
                    label: 'Cantidad de Keywords',
                    data: Object.values(ranges),
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(244, 67, 54, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderCPCDistribution() {
        const ctx = document.getElementById('cpcDistributionChart').getContext('2d');
        
        if (this.distributionCharts.cpc) {
            this.distributionCharts.cpc.destroy();
        }

        const mainKeywords = this.allKeywords.filter(kw => kw.type === 'main');
        const ranges = {
            'Bajo (€0-0.10)': mainKeywords.filter(kw => kw.cpc <= 0.10).length,
            'Medio (€0.10-0.50)': mainKeywords.filter(kw => kw.cpc > 0.10 && kw.cpc <= 0.50).length,
            'Alto (€0.50+)': mainKeywords.filter(kw => kw.cpc > 0.50).length
        };

        this.distributionCharts.cpc = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(ranges),
                datasets: [{
                    data: Object.values(ranges),
                    backgroundColor: [
                        'rgba(33, 150, 243, 0.8)',
                        'rgba(156, 39, 176, 0.8)',
                        'rgba(233, 30, 99, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderCorrelationChart() {
        const ctx = document.getElementById('correlationChart').getContext('2d');
        
        if (this.distributionCharts.correlation) {
            this.distributionCharts.correlation.destroy();
        }

        const mainKeywords = this.allKeywords.filter(kw => kw.type === 'main');
        const data = mainKeywords.map(kw => ({
            x: kw.search_volume,
            y: kw.cpc
        }));

        this.distributionCharts.correlation = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Volumen vs CPC',
                    data: data,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Volumen de Búsqueda'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'CPC (€)'
                        }
                    }
                }
            }
        });
    }

    renderInsights() {
        const insights = this.generateInsights();
        const container = document.getElementById('insightsContainer');
        
        const insightsHTML = insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-title">
                    <i class="${insight.icon}"></i>
                    ${insight.title}
                </div>
                <div class="insight-content">${insight.content}</div>
            </div>
        `).join('');

        container.innerHTML = insightsHTML;
    }

    generateInsights() {
        const insights = [];
        const mainKeywords = this.allKeywords.filter(kw => kw.type === 'main');
        
        // Keyword con mayor volumen
        const highestVolume = mainKeywords.reduce((max, kw) => 
            kw.search_volume > max.search_volume ? kw : max, mainKeywords[0]);
        
        if (highestVolume) {
            insights.push({
                type: 'info',
                icon: 'fas fa-chart-line',
                title: 'Mayor Volumen de Búsqueda',
                content: `"${highestVolume.keyword}" tiene el mayor volumen con ${this.formatNumber(highestVolume.search_volume)} búsquedas mensuales.`
            });
        }

        // Keyword con mayor CPC
        const highestCPC = mainKeywords.reduce((max, kw) => 
            kw.cpc > max.cpc ? kw : max, mainKeywords[0]);
        
        if (highestCPC && highestCPC.cpc > 0) {
            insights.push({
                type: 'warning',
                icon: 'fas fa-euro-sign',
                title: 'Mayor Coste por Clic',
                content: `"${highestCPC.keyword}" tiene el CPC más alto con ${this.formatCurrency(highestCPC.cpc)} por clic.`
            });
        }

        // Análisis de competencia
        const highCompetition = mainKeywords.filter(kw => kw.competition > 0.7).length;
        const totalMain = mainKeywords.length;
        
        if (highCompetition > 0) {
            const percentage = (highCompetition / totalMain * 100).toFixed(1);
            insights.push({
                type: highCompetition / totalMain > 0.5 ? 'warning' : 'info',
                icon: 'fas fa-users',
                title: 'Análisis de Competencia',
                content: `${percentage}% de las keywords principales (${highCompetition}/${totalMain}) tienen alta competencia (>70%).`
            });
        }

        // Oportunidades de low-hanging fruit
        const lowCompetitionHighVolume = mainKeywords.filter(kw => 
            kw.competition < 0.3 && kw.search_volume > 1000);
        
        if (lowCompetitionHighVolume.length > 0) {
            insights.push({
                type: 'success',
                icon: 'fas fa-gem',
                title: 'Oportunidades Detectadas',
                content: `Encontradas ${lowCompetitionHighVolume.length} keywords con baja competencia (<30%) y alto volumen (>1K búsquedas).`
            });
        }

        return insights;
    }

    // Event handlers para los controles
    changeChartType() {
        this.currentConfig.chartType = document.getElementById('chartType').value;
        this.renderMainChart();
    }

    changeSortMetric() {
        this.currentConfig.sortMetric = document.getElementById('sortMetric').value;
        this.applyFilters();
        this.renderMainChart();
        this.renderTable();
    }

    changeSortOrder() {
        this.currentConfig.sortOrder = document.getElementById('sortOrder').value;
        this.applyFilters();
        this.renderMainChart();
        this.renderTable();
    }

    changeKeywordFilter() {
        this.currentConfig.keywordFilter = document.getElementById('keywordFilter').value;
        this.applyFilters();
        this.renderMainChart();
        this.renderTable();
        this.renderStatistics();
    }

    changeTopLimit() {
        this.currentConfig.topLimit = document.getElementById('topLimit').value;
        this.applyFilters();
        this.renderMainChart();
        this.renderTable();
    }

    // Funciones de exportación
    exportChart() {
        if (this.currentChart) {
            const link = document.createElement('a');
            link.download = `analytics_chart_${this.reportFilename.replace('.json', '')}.png`;
            link.href = this.currentChart.toBase64Image();
            link.click();
        }
    }

    exportTableCSV() {
        const headers = ['Keyword', 'Tipo', 'Volumen', 'CPC', 'Competencia', 'Similares', 'Sugerencias', 'Longitud'];
        const csvContent = [
            headers.join(','),
            ...this.filteredKeywords.map(kw => [
                `"${kw.keyword}"`,
                this.getTypeLabel(kw.type),
                kw.search_volume,
                kw.cpc,
                kw.competition,
                kw.similar_count,
                kw.suggestions_count,
                kw.keyword_length
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_data_${this.reportFilename.replace('.json', '')}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    sortTable(column) {
        this.currentConfig.sortMetric = column;
        this.currentConfig.sortOrder = this.currentConfig.sortOrder === 'desc' ? 'asc' : 'desc';
        
        // Actualizar los selectores
        document.getElementById('sortMetric').value = column;
        document.getElementById('sortOrder').value = this.currentConfig.sortOrder;
        
        this.applyFilters();
        this.renderMainChart();
        this.renderTable();
    }

    // Utility functions
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
}

// Initialize the app when the page loads
const analyticsApp = new AnalyticsApp();
