# Arquitectura

Una sola lógica y cuatro entradas. Todo lo que hace la interfaz web se puede hacer igual desde la API, la CLI o un
agente por MCP, porque las cuatro llaman a `src/services/studyService.js`.

```
 Interfaz web ──┐
 API REST ──────┼──► studyService ──► shared/ (lógica pura) ──► data/results/*.json
 CLI (bin/seo) ─┤         │
 MCP (seo mcp) ─┘         ├──► keywordService ──► Google Suggest · keywordsur.fr
                          ├──► pageAuditService ─► la página del cliente, robots.txt, sitemap
                          └──► pdfService · markdownService (entregables)
```

## Carpetas

| Ruta | Contenido |
|---|---|
| `shared/` | Lógica sin dependencias ni E/S, usada por el servidor y por el navegador: `insights.js` (puntuación, intención, temas, conclusiones), `brief.js`, `plan.js`, `contentAnalysis.js` (auditoría de texto), `keywordMap.js`, `text.js` |
| `src/api/` | Clientes de las fuentes externas. Sustituir la fuente de datos es cambiar `keywordsur.js` |
| `src/services/` | `studyService` (estudios y auditorías guardadas), `keywordService` (análisis), `pageAuditService` (descarga y auditoría de URL, con protección frente a direcciones internas), `deliverable` + `pdfService` + `markdownService` (informes) |
| `src/server/` | Express: rutas finas sobre `studyService`, entrega de la interfaz compilada, acceso con `SEO_AUTH` |
| `src/mcp/` | Servidor MCP por stdio |
| `src/utils/validation.js` | Validación de entrada y de nombres de archivo |
| `bin/seo.js` | CLI |
| `web/` | Interfaz: React + Vite + trama-ui. `pages/Study.jsx` y `pages/study/*` son las pestañas de un estudio |
| `tests/` | `node --test`: lógica compartida, API (servidor real sobre carpeta temporal), MCP (cliente real) y problemas clásicos |

## Datos de un estudio

Tres archivos por estudio en `data/results/` (o en `SEO_RESULTS_DIR`):

- `seo_report_full_<fecha>.json` — las keywords con sus datos. Es el identificador del estudio.
- `seo_report_study_<fecha>.json` — la ficha: cliente, sitio, autor, notas, auditorías de texto y de página, sitemap leído.
- `seo_report_summary_<fecha>.csv` — resumen de las keywords principales.

Lo demás (puntuaciones, temas, plan, brief, informe) se calcula al pedirlo: no hay nada que pueda quedar desfasado.
