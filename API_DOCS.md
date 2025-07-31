# API Endpoints - SEO App

## 📋 Documentación de la API

### Base URL
```
http://localhost:3000/api
```

## 🔍 Endpoints Disponibles

### 1. Health Check
```
GET /api/health
```
**Respuesta:**
```json
{
  "status": "OK",
  "message": "SEO API Server running",
  "timestamp": "2025-07-31T18:45:31.805Z"
}
```

### 2. Listar Reportes
```
GET /api/seo/reports
```
**Respuesta:**
```json
{
  "success": true,
  "count": 2,
  "reports": [
    {
      "filename": "seo_report_full_2025-07-31T18-45-31-805Z.json",
      "timestamp": "2025-07-31 18:45:31",
      "url": "/reports/seo_report_full_2025-07-31T18-45-31-805Z.json",
      "downloadUrl": "/api/seo/download/seo_report_full_2025-07-31T18-45-31-805Z.json"
    }
  ]
}
```

### 3. Obtener Reporte Específico
```
GET /api/seo/report/:filename
```
**Ejemplo:**
```
GET /api/seo/report/seo_report_full_2025-07-31T18-45-31-805Z.json
```

### 4. Crear Nuevo Análisis
```
POST /api/seo/analyze
Content-Type: application/json

{
  "keywords": ["amazon", "ebay"],
  "country": "ES",
  "language": "es"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Análisis completado exitosamente",
  "summary": [
    {
      "keyword": "amazon",
      "searchVolume": 16600000,
      "competition": 0.14,
      "cpc": 0.02,
      "suggestionsCount": 10,
      "domainTraffic": 267446480,
      "domainKeywords": 3160167,
      "pageWords": 27,
      "errors": 0
    }
  ],
  "files": {
    "json": "/data/results/seo_report_full_2025-07-31T19-15-22-123Z.json",
    "csv": "/data/results/seo_report_summary_2025-07-31T19-15-22-123Z.csv"
  },
  "downloadUrls": {
    "json": "/api/seo/download/seo_report_full_2025-07-31T19-15-22-123Z.json",
    "csv": "/api/seo/download/seo_report_summary_2025-07-31T19-15-22-123Z.csv"
  }
}
```

### 5. Descargar Archivo
```
GET /api/seo/download/:filename
```

### 6. Eliminar Reporte
```
DELETE /api/seo/report/:filename
```

## 🚀 Cómo usar

### Instalar dependencias
```bash
npm install
```

### Iniciar servidor API
```bash
npm run server
```

### Desarrollo con auto-reload
```bash
npm run server:dev
```

## 📝 Ejemplos de uso con curl

### Crear análisis
```bash
curl -X POST http://localhost:3000/api/seo/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["amazon", "ebay"],
    "country": "ES",
    "language": "es"
  }'
```

### Listar reportes
```bash
curl http://localhost:3000/api/seo/reports
```

### Obtener reporte específico
```bash
curl http://localhost:3000/api/seo/report/seo_report_full_2025-07-31T18-45-31-805Z.json
```

### Descargar archivo
```bash
curl -OJ http://localhost:3000/api/seo/download/seo_report_full_2025-07-31T18-45-31-805Z.json
```
