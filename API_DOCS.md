# API REST de SEO App

Base: `http://localhost:3000/api` (el puerto se cambia con `PORT`).

- La API solo admite peticiones del mismo origen desde un navegador (no envía cabeceras CORS). `curl`, scripts y agentes no tienen esa restricción.
- Si la instancia define `SEO_AUTH=usuario:contraseña`, todas las rutas salvo `/api/health` exigen `Authorization: Basic …`.
- Lo mismo que hace la API se puede hacer sin servidor con la CLI (`seo …`) o por MCP (`seo mcp`): ver `docs/AGENTES.md`.

## Convenciones

**Errores.** Siempre con la misma forma:

```json
{ "success": false, "error": "Descripción", "message": "Detalle opcional" }
```

| Código | Cuándo |
|---|---|
| 400 | Entrada inválida: JSON mal formado, keywords, país, idioma, dominio, URL o nombre de archivo |
| 401 | Faltan las credenciales o no son correctas (solo con `SEO_AUTH`) |
| 404 | Estudio, auditoría o endpoint inexistente |
| 502 | No se pudo consultar la fuente de datos externa |
| 500 | Error interno |

**Nombres de archivo.** `:filename` es siempre `seo_report_full_<fecha>.json` (por ejemplo
`seo_report_full_2025-07-31T18-45-31-805.json`). Cualquier otro nombre devuelve 400.

**Markdown.** Los endpoints que lo indican aceptan `?format=md` y devuelven `text/markdown`.

## Estudios

### `GET /api/health`
Estado del servidor. No requiere credenciales.

### `GET /api/seo/reports`
Estudios guardados, del más reciente al más antiguo.

```json
{
  "success": true,
  "count": 1,
  "reports": [
    {
      "filename": "seo_report_full_2025-07-31T18-45-31-805.json",
      "timestamp": "2025-07-31T18:45:31.805Z",
      "name": "SEO tienda de running",
      "client": "Deportes Sur",
      "site": "tienda.com",
      "keywords": ["zapatillas running", "zapatillas trail"],
      "country": "ES",
      "language": "es",
      "totals": { "keywords": 99, "volume": 164710, "quickWins": 0, "audits": 3 },
      "errors": 0
    }
  ]
}
```

### `POST /api/seo/analyze`
Crea un estudio. Responde al terminar: unos 5 segundos por keyword.

```json
{
  "keywords": ["zapatillas running", "zapatillas trail"],
  "country": "ES",
  "language": "es",
  "name": "SEO tienda de running",
  "client": "Deportes Sur",
  "site": "tienda.com"
}
```

- `keywords`: de 1 a 25 textos de hasta 100 caracteres (se eliminan duplicados y vacíos).
- `country` / `language`: códigos de dos letras; por defecto `ES` / `es`.
- `name`, `client`, `site`, `author`, `notes`, `accent`: ficha del estudio, opcional. `site` es un dominio (`ejemplo.com`); con él se consultan sus datos de tráfico.
- Si una fuente falla, el error se anota en `errors` de esa keyword y el resto continúa.

Respuesta: `study` (resumen como en el listado), `files.json` (nombre de archivo para el resto de llamadas) y `data` (las keywords).

### `GET /api/seo/report/:filename`
Estudio completo: `data` (keywords), `study` (ficha y auditorías) y `summary` (totales).

Cada elemento de `data`:

```json
{
  "keyword": "zapatillas running",
  "country": "ES",
  "language": "es",
  "timestamp": "2025-07-31T18:45:31.805Z",
  "suggestions": ["zapatillas running hombre", "…"],
  "ideas": [{ "keyword": "como elegir zapatillas running", "group": "pregunta" }],
  "keywordData": {
    "zapatillas running": { "search_volume": 22200, "competition": 1, "cpc": 0.33, "similar_keywords": [] },
    "zapatillas running hombre": { "search_volume": 33100, "competition": 1, "cpc": 0.33 },
    "como atar zapatillas running": { "no_data": true }
  },
  "errors": []
}
```

- `keywordData` está indexado por keyword y **sin orden garantizado**: los datos de la keyword principal son `keywordData[keyword]`.
- `ideas` son keywords ampliadas a partir del autocompletado de Google; `group` es `pregunta`, `comparativa` o `modificador` (hasta 30 por keyword).
- Una keyword sin entrada en `keywordData` está pendiente de consultar; con `{ "no_data": true }` la fuente no tiene datos.
- Los estudios antiguos traen además `domain`, `domainData` y `urlAnalysis` de un dominio deducido de la keyword; ya no se generan.

`study`: `name`, `client`, `site`, `author`, `notes`, `accent`, `siteData` (tráfico y keywords posicionadas del sitio),
`siteUrls` (sitemap leído), `audits` (textos) y `pageAudits` (páginas).

### `PATCH /api/seo/report/:filename/study`
Actualiza la ficha. Solo cambia los campos enviados: `name`, `client`, `site`, `author`, `notes`, `accent` (`#rrggbb`,
color del PDF). Al cambiar `site` se renuevan sus datos y se descarta el sitemap leído.

### `POST /api/seo/analyze-suggestions`
`{ "filename": "…" }`. Consulta las keywords que quedaron sin datos (un lote que falló) y actualiza el estudio.

### `DELETE /api/seo/report/:filename`
Borra el estudio con su CSV, su ficha y sus auditorías.

## Proyectos

Un proyecto es un sitio con varios targets (públicos), cada uno con uno o más estudios. `:id` son 8 caracteres hexadecimales.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/seo/projects` | Lista los proyectos con sus targets por prioridad |
| `POST /api/seo/projects` | Crea uno: `{ name, client?, site?, author?, notes? }` → `201 { project }` |
| `GET /api/seo/projects/:id` | `{ project, view }`; con `?format=md`, el informe en Markdown (`&download` lo adjunta) |
| `PATCH /api/seo/projects/:id` | Cambia la ficha. Al cambiar el sitio se descartan su sitemap y su auditoría |
| `DELETE /api/seo/projects/:id` | Borra el proyecto; sus estudios se conservan |
| `POST /api/seo/projects/:id/targets` | `{ name, audience?, page?, keywords?, studies?, country?, language? }`. Con `keywords` crea el estudio del target (≈5 s por keyword) |
| `PATCH /api/seo/projects/:id/targets/:targetId` | Cambia nombre, público, página o estudios |
| `DELETE /api/seo/projects/:id/targets/:targetId` | Quita el target; sus estudios se conservan |
| `POST /api/seo/projects/:id/site-audit` | Audita el sitio por su sitemap (`{ pages? }`) y guarda sus URLs |

`view` contiene:

```json
{
  "totals": { "targets": 3, "studies": 3, "keywords": 167, "volume": 12900, "urls": 34 },
  "targets": [{
    "id": "…", "name": "Automatización", "priority": 1, "priorityScore": 95,
    "priorityParts": { "demand": 100, "ease": 87, "value": 100 },
    "totals": { "keywords": 60, "volume": 5770 }, "quickWins": 1, "avgCompetition": 0.25, "avgCpc": 5.85,
    "mainKeywords": ["…"], "topOpportunities": [{ "keyword": "…", "volume": 720, "score": 89 }],
    "page": "http://localhost:3000/servicios/…", "pageSource": "detected", "coverage": 25, "gaps": ["…"],
    "studies": [{ "filename": "seo_report_full_….json", "name": "…" }], "missingStudies": [], "trends": null
  }],
  "overlaps": [{ "keyword": "…", "volume": 260, "targets": ["A", "B"], "suggestedOwner": "A" }],
  "pages": [{ "url": "…", "path": "/…", "shared": false, "targets": [{ "name": "A", "keywords": ["…"] }] }],
  "calendar": [{ "month": 9, "year": 2026, "publish": [{ "target": "A", "keyword": "…" }], "campaigns": [], "peaks": [] }],
  "findings": [{ "level": "success", "title": "…", "text": "…" }],
  "plan": [{ "priority": 1, "area": "Arquitectura", "target": "A", "impact": "alto", "effort": "medio", "title": "…", "why": "…", "how": "…" }]
}
```

`page` es `null` cuando ninguna URL del sitemap trata las keywords principales del target; `coverage` es `null`
mientras no se haya auditado el sitio.

## Análisis

### `GET /api/seo/report/:filename/insights`
`insights`: `keywords` (todas, con `type`, `parent`, `intent`, `volume`, `competition`, `cpc`, `score`, `offTarget`),
`totals`, `opportunities`, `quickWins`, `intents`, `lengthBuckets`, `clusters`, `questions` y `recommendations`.

- `score` va de 0 a 100: demanda 50 %, poca competencia 35 %, CPC 15 %.
- `offTarget` marca keywords que nombran un lugar distinto al de las keywords principales; no cuentan como oportunidad.

### `GET /api/seo/report/:filename/plan` (`?format=md`)
`plan`: tareas con `priority`, `area`, `impact`, `effort`, `title`, `why`, `how` y `keywords`. Tiene en cuenta las
auditorías guardadas y el mapa de keywords.

### `GET /api/seo/report/:filename/brief?keyword=…` (`?format=md`)
`brief` para escribir la página de una keyword: `intent`, `pageType`, `wordCount`, `titleIdeas`, `h1`, `outline`,
`secondaryKeywords`, `questions`, `terms`, `internalLinks`, `schema`, `checklist`. Vale cualquier keyword; si no está
en el estudio, `inStudy` es `false` y no hay métricas.

### `GET /api/seo/report/:filename/keyword-map` (`?refresh`)
Cruza las keywords principales y las mejores oportunidades con las URLs del sitemap del sitio del cliente. Requiere
`site` en la ficha. La primera llamada lee el sitemap (hasta 500 URLs); `?refresh` lo vuelve a leer.

```json
{
  "success": true,
  "site": "tienda.com",
  "urlCount": 500,
  "map": [
    { "keyword": "zapatillas running", "url": "https://tienda.com/zapatillas-running", "coverage": 1, "alternatives": [] },
    { "keyword": "zapatillas para correr", "url": null, "coverage": 0, "alternatives": [] }
  ]
}
```

`url: null` es un hueco de contenido; `alternatives` lista otras páginas igual de específicas que compiten.

### `GET /api/seo/report/:filename/trends` (`?refresh`, `?retry`, `?format=md`)

Google Trends de las keywords principales y las más buscadas del resto (máximo 10, cinco años). La primera llamada
consulta y guarda; las siguientes devuelven lo guardado. `?refresh` vuelve a pedirlo todo y `?retry` solo lo que
Google dejó a medias. Si Google limita las peticiones responde `502`.

```json
{
  "success": true,
  "trends": { "fetchedAt": "…", "geo": "ES", "items": [{ "keyword": "…", "role": "main", "series": [{ "month": "2026-09", "value": 73 }], "top": [], "rising": [] }] },
  "insights": {
    "items": [{ "keyword": "…", "analysis": { "pattern": "seasonal", "profile": [114, 101], "peakMonths": [11], "yearChange": 0, "next": { "peak": 11, "monthsUntil": 2, "publishBy": 8, "campaignFrom": 10, "status": "urgent" } } }],
    "calendar": [{ "month": 9, "year": 2026, "publish": [], "campaigns": [], "peaks": [] }],
    "findings": [{ "level": "warning", "title": "…", "text": "…" }],
    "newQueries": [{ "query": "…", "value": 5000, "breakout": true, "from": "…" }],
    "coverage": { "covered": 5, "total": 19, "percent": 26 }
  }
}
```

Los meses van de 0 (enero) a 11. `POST` a la misma ruta con `{ "keywords": ["…"] }` añade keywords concretas.

## Auditorías

El resultado de una auditoría tiene siempre esta forma:

```json
{
  "score": 79,
  "verdict": "Aceptable, con mejoras claras",
  "stats": { "words": 290, "keywordDensity": 1.38, "readability": 73 },
  "checks": [
    { "id": "length", "group": "Contenido", "label": "Extensión del texto", "weight": 3, "status": "fail", "detail": "290 palabras…" }
  ],
  "related": { "used": ["mujer"], "missing": ["hombre", "trail"], "keywordsUsed": [] }
}
```

`status` es `ok`, `warn`, `fail` o `skip` (no evaluada; no cuenta en la nota).

### `POST /api/seo/audit/text`
Audita un texto sin guardarlo.

```json
{ "text": "# Título\n\n…", "keyword": "zapatillas running", "title": "…", "metaDescription": "…", "filename": "seo_report_full_….json" }
```

Solo `text` es obligatorio (plano, Markdown o HTML; máximo 200.000 caracteres). Con `filename`, el campo semántico
sale de ese estudio.

### `POST /api/seo/audit/url`
`{ "url": "https://…", "keyword": "…", "filename": "…" }`. Descarga la página y la audita: respuesta del servidor,
HTTPS, indexabilidad, canónica, viewport, idioma, datos estructurados, Open Graph, contenido frente a la keyword,
enlaces internos, autor y fecha, robots.txt, sitemap, rastreadores de IA y llms.txt.

- Solo `http`/`https`. Las direcciones locales (`localhost`, red privada) se aceptan cuando la petición llega desde el propio equipo o la red privada y sin pasar por un proxy; si no, 400. `SEO_ALLOW_PRIVATE_URLS=1` o `0` lo fija para toda la instancia. Las direcciones de metadatos de nube (169.254.x.x) se rechazan siempre.
- En un sitio local (`environment: "local"`) no se evalúan HTTPS ni el tiempo de respuesta.
- No ejecuta JavaScript ni mide Core Web Vitals.
- Los listados de productos (por sus datos estructurados) no se evalúan como prosa; `pageType` vale `listado` o `contenido`.

### `POST /api/seo/audit/site`

`{ "site": "ejemplo.com" | "localhost:3000", "pages": 40 }`. Lee el sitemap, comprueba hasta `pages` URLs (máximo 100)
y devuelve `{ score, checked, sitemap: { sources, total, issues }, issues: [{ id, severity, title, count, urls, why, fix }], pages }`.
Los sitios locales siguen la misma regla que `/audit/url`: solo si quien llama está en la red local.

### `POST /api/seo/report/:filename/site-audit`

Lo mismo para el sitio del estudio. Guarda el resultado en `study.siteAudit` (con `changes` respecto a la pasada
anterior), renueva el mapa de keywords y devuelve la ficha completa en `study`.

### Auditorías guardadas en un estudio
```
GET    /api/seo/report/:filename/audits          → { audits, pageAudits }
POST   /api/seo/report/:filename/audits          texto: mismo cuerpo que /audit/text, más "name"
POST   /api/seo/report/:filename/page-audits     página: { "url", "keyword" }
DELETE /api/seo/report/:filename/audits/:id      quita una auditoría de texto o de página
```

Las guardadas salen en el informe y generan tareas en el plan de acción. Una nueva auditoría de la misma URL y
keyword sustituye a la anterior y trae `changes`: `previousScore`, `scoreDelta`, `improved` y `worsened` (comprobaciones que han cambiado de estado).

## Entregables

| Endpoint | Formato |
|---|---|
| `GET /api/seo/report/:filename/pdf` | Informe para el cliente en PDF |
| `GET /api/seo/report/:filename/markdown` (`?download`) | El mismo informe en Markdown |
| `GET /api/seo/report/:filename/keywords.csv` | Todas las keywords con tipo, intención y puntuación |
| `GET /api/seo/download/:filename` | El JSON del estudio o su CSV de resumen (`seo_report_summary_<fecha>.csv`) |

El informe incluye portada, resumen ejecutivo, plan de acción, matriz y ranking de oportunidades, intención y temas,
brief de cada keyword principal, mapa de keywords, auditorías y metodología. Usa los datos de la ficha del estudio.

## Ejemplos

```bash
# Crear un estudio
curl -X POST http://localhost:3000/api/seo/analyze \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["zapatillas running"], "country": "ES", "language": "es", "site": "tienda.com"}'

# Plan de acción en Markdown
curl "http://localhost:3000/api/seo/report/seo_report_full_2025-07-31T18-45-31-805.json/plan?format=md"

# Auditar una página y guardarla en el estudio
curl -X POST http://localhost:3000/api/seo/report/seo_report_full_2025-07-31T18-45-31-805.json/page-audits \
  -H "Content-Type: application/json" \
  -d '{"url": "https://tienda.com/zapatillas-running", "keyword": "zapatillas running"}'

# Descargar el informe
curl -OJ http://localhost:3000/api/seo/report/seo_report_full_2025-07-31T18-45-31-805.json/pdf

# Con acceso restringido
curl -u agencia:contraseña http://localhost:3000/api/seo/reports
```
