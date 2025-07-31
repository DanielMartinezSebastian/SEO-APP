# SEO-APP

Herramienta completa de análisis SEO con backend API y frontend web interactivo.

## 🚀 Características

- **Backend API REST** completo para análisis SEO
- **Frontend Web** interactivo con múltiples vistas
- **Análisis Multi-API**: Google Suggestions, Keywordsur, URL Analysis
- **Visualización Gráfica** avanzada con Chart.js
- **Exportación** en JSON y CSV
- **Gestión de Reportes** completa

## 📋 Funcionalidades

### 🌐 Frontend Web
- **Página Principal**: Crear análisis y gestionar reportes
- **Vista Detallada**: Información completa de cada reporte
- **Análisis Gráfico**: Visualizaciones interactivas con múltiples métricas
- **Navegación Intuitiva**: Mismo tab por defecto, nueva pestaña con clic derecho

### 🔧 Backend API
- `POST /api/seo/analyze` - Crear nuevo análisis
- `GET /api/seo/reports` - Listar todos los reportes
- `GET /api/seo/report/:filename` - Obtener reporte específico
- `GET /api/seo/download/:filename` - Descargar archivo
- `DELETE /api/seo/report/:filename` - Eliminar reporte

### 📊 Análisis Incluye
- **Keywords principales** y sus métricas (volumen, CPC, competencia)
- **Keywords similares** con datos de superposición
- **Sugerencias de Google** automáticas
- **Análisis de dominios** (ranking keywords, tráfico estimado)
- **Análisis de URLs** (contenido, palabras, keywords exactas)

## 🎨 Sistema de Colores
- Cada keyword principal tiene su **color único**
- Keywords similares usan **tonos derivados** (60% opacidad)
- Sugerencias usan **tonos más claros** (40% opacidad)
- **Leyenda visual** para identificación rápida

## 🛠️ Instalación y Uso

### Prerrequisitos
- Node.js 18+
- NPM o Yarn

### Instalación
```bash
git clone <repository>
cd SEO-APP
npm install
```

### Iniciar Aplicación
```bash
npm start
```

Esto iniciará:
- **Servidor web** en `http://localhost:3000`
- **API REST** disponible en `/api/*`
- **Interfaz web** para crear y gestionar análisis

### Scripts Disponibles
- `npm start` - Inicia servidor completo
- `npm run dev` - Modo desarrollo con auto-reload
- `npm run server` - Solo servidor (sin mensajes de inicio)
- `npm run server:dev` - Servidor en modo desarrollo

## 📁 Estructura del Proyecto

```
SEO-APP/
├── src/
│   ├── api/           # Módulos de APIs externas
│   ├── server/        # Servidor Express y rutas
│   ├── services/      # Lógica de negocio
│   └── utils/         # Utilidades
├── public/            # Frontend web
│   ├── index.html     # Página principal
│   ├── report-details.html  # Vista detallada
│   ├── analytics.html # Análisis gráfico
│   └── *.js, *.css   # Scripts y estilos
└── data/results/      # Reportes generados
```

## 🎯 Uso Básico

1. **Accede** a `http://localhost:3000`
2. **Ingresa keywords** separadas por comas
3. **Inicia análisis** y espera los resultados
4. **Visualiza** reportes en la página principal
5. **Explora** detalles y análisis gráfico
6. **Exporta** datos según necesidades

## 🔧 Configuración APIs

Las APIs se configuran en los archivos correspondientes:
- `src/api/googleSuggestions.js`
- `src/api/keywordsur.js` 
- `src/api/urlAnalysis.js`

## 📈 Métricas Analizadas

- **Volumen de búsqueda mensual**
- **CPC (Coste por Clic)**
- **Nivel de competencia**
- **Keywords similares**
- **Sugerencias relacionadas**
- **Análisis de dominios competidores**
- **Análisis de contenido de URLs**

## 🎨 Visualizaciones

- **Gráficos principales**: Barras, circular, dona, líneas, radar
- **Distribuciones**: Por tipo, competencia, CPC
- **Correlaciones**: Volumen vs CPC
- **Insights automáticos**: Oportunidades y recomendaciones

---

Desarrollado con ❤️ para análisis SEO profesional
