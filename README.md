# SEO-APP

Herramienta completa de análisis SEO con backend API y frontend web interactivo.

## 🚀 Características

- **Backend API REST** completo para análisis SEO
- **Frontend Web** interactivo con múltiples vistas
- **Análisis Multi-API**: Google Suggestions, Keywordsur, URL Analysis
- **Visualización Gráfica** avanzada con Chart.js
- **Sistema de Temas** claro/oscuro automático
- **Exportación** en JSON y CSV
- **Gestión de Reportes** completa
- **Diseño Responsive** optimizado para todos los dispositivos

## 📋 Funcionalidades

### 🌐 Frontend Web
- **Página Principal**: Crear análisis y gestionar reportes
- **Vista Detallada**: Información completa de cada reporte
- **Análisis Gráfico**: Visualizaciones interactivas con múltiples métricas
- **Navegación Intuitiva**: Mismo tab por defecto, nueva pestaña con clic derecho
- **Sistema de Temas**: Cambio automático entre modo claro y oscuro
- **Layout Centrado**: Diseño optimizado con flexbox y 100dvh
- **Favicon Dinámico**: Icono que cambia según el tema actual

### 🎨 Mejoras de UI/UX Implementadas
- **Botones mejorados**: Colores púrpura corporativos consistentes
- **Centrado perfecto**: Layout responsivo centrado verticalmente
- **Bordes seamless**: Conexión visual entre secciones cuando hay reportes
- **Ancho optimizado**: 900px máximo para mejor legibilidad
- **Headers adaptativos**: Visibilidad correcta en ambos temas
- **Favicon completo**: Implementación con site.webmanifest y múltiples tamaños

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

## 🎨 Sistema de Colores y Temas

### Colores de Keywords
- Cada keyword principal tiene su **color único**
- Keywords similares usan **tonos derivados** (60% opacidad)
- Sugerencias usan **tonos más claros** (40% opacidad)
- **Leyenda visual** para identificación rápida

### Sistema de Temas
- **Detección automática** del tema del sistema
- **Cambio manual** con botón toggle
- **Persistencia** en localStorage
- **Transiciones suaves** entre temas
- **Colores adaptativos** en gráficos y UI

## 🖼️ Assets y Branding
- **Logo corporativo**: seo-logo.png integrado
- **Favicon dinámico**: Cambia automáticamente con el tema
- **Site manifest**: Configuración PWA completa
- **Iconos múltiples**: 16x16, 32x32, 192x192, 512x512

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
│   ├── themes.js      # Sistema de temas
│   ├── seo-logo.png   # Logo corporativo
│   ├── favicon.svg    # Favicon dinámico
│   ├── site.webmanifest # Configuración PWA
│   └── *.js, *.css   # Scripts y estilos
└── data/results/      # Reportes generados
```

## 🎯 Uso Básico

1. **Accede** a `http://localhost:3000`
2. **Ingresa keywords** separadas por comas
3. **Inicia análisis** y espera los resultados
4. **Visualiza** reportes en la página principal
5. **Explora** detalles y análisis gráfico
6. **Cambia tema** con el botón toggle
7. **Exporta** datos según necesidades

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
- **Temas adaptativos**: Todos los gráficos se adaptan al tema actual

## 🔧 Características Técnicas

### Frontend
- **Chart.js**: Visualizaciones interactivas
- **Flexbox Layout**: Centrado perfecto con 100dvh
- **CSS Variables**: Sistema de temas dinámico
- **Responsive Design**: Optimizado para móviles y desktop
- **LocalStorage**: Persistencia de preferencias

### Backend
- **Express.js**: Servidor web robusto
- **File System**: Gestión de reportes
- **CORS**: Configuración para desarrollo
- **Error Handling**: Manejo completo de errores

## 📝 Notas de Desarrollo

### Últimas Mejoras Implementadas
- ✅ Sistema de temas claro/oscuro completo
- ✅ Favicon dinámico que cambia con el tema
- ✅ Logo corporativo integrado
- ✅ Layout centrado con 100dvh
- ✅ Bordes seamless entre secciones
- ✅ Ancho optimizado (900px)
- ✅ Botones con colores corporativos
- ✅ Headers adaptativos para ambos temas
- ⚠️ Leyendas de gráficos circulares: Implementación parcial (requiere investigación adicional de Chart.js)

### Problemas Conocidos
- Las leyendas de gráficos circulares (doughnut/pie) pueden no cambiar de color inmediatamente al cambiar tema
- Workaround implementado con CSS `!important` y manipulación DOM

## 🌟 Funcionalidades Destacadas

### Sistema de Temas Avanzado
- **Detección automática** del tema del sistema operativo
- **Cambio manual** preservado en localStorage
- **Favicon adaptativo** que cambia según el tema
- **Transiciones CSS** suaves entre temas
- **Variables CSS** para consistencia global

### Layout Responsive Premium
- **Centrado vertical** perfecto con flexbox y 100dvh
- **Ancho optimizado** de 900px para mejor legibilidad
- **Bordes seamless** entre secciones cuando hay reportes
- **Headers adaptativos** que se ven correctamente en ambos temas
- **Diseño mobile-first** optimizado para todos los dispositivos

### Branding Corporativo
- **Logo integrado** en header principal
- **Colores púrpura** consistentes en toda la aplicación
- **Botones estilizados** con hover effects
- **Favicon SVG** dinámico y escalable
- **PWA ready** con site.webmanifest completo

---

Desarrollado con ❤️ para análisis SEO profesional
