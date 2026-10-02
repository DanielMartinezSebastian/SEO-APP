# SEO App para agentes de IA

Un agente puede usar SEO App de tres maneras. Las tres llaman a la misma lógica (`src/services/studyService.js`).

| Vía | Cuándo |
|---|---|
| **MCP** (`seo mcp`) | El agente admite servidores MCP. Es la más cómoda: las herramientas se describen solas |
| **CLI con `--json`** | El agente ejecuta órdenes de terminal |
| **API REST** | Hay un servidor en marcha y el agente hace peticiones HTTP |

## MCP

```json
{
  "mcpServers": {
    "seo-app": { "command": "node", "args": ["bin/seo.js", "mcp"], "cwd": "/ruta/a/SEO-APP" }
  }
}
```

El servidor habla por stdio. Todo lo que no es protocolo (progreso del análisis, avisos) va a stderr.

| Herramienta | Qué devuelve |
|---|---|
| `list_studies` | Estudios guardados, del más reciente al más antiguo |
| `create_study` | Analiza de 1 a 25 keywords (≈5 s cada una) y devuelve resumen, conclusiones y mejores oportunidades |
| `get_insights` | Conclusiones, ranking, victorias rápidas, intención y temas |
| `get_keywords` | Keywords con sus datos; filtros por tipo e intención |
| `keyword_map` | Qué URL del sitemap del cliente cubre cada keyword; huecos y páginas que compiten |
| `site_audit` | Audita un sitio por su sitemap (publicado, localhost o red interna) y agrupa los problemas; con estudio, compara con la pasada anterior |
| `get_trends` | Google Trends: estacionalidad, tendencia, calendario de campañas, consultas en auge y encaje con el público |
| `content_brief` | Brief en Markdown para escribir la página de una keyword |
| `audit_text` | Nota 0-100 de un texto y lista de comprobaciones; `save` lo guarda en el estudio |
| `audit_url` | Auditoría de una página, pública o local; `save` la guarda en el estudio y la compara con la anterior |
| `action_plan` | Tareas priorizadas en Markdown |
| `client_report` | Informe completo en Markdown |
| `update_study` | Cambia la ficha: nombre, cliente, sitio, autor, notas |

`study` acepta el nombre de archivo o `latest`. Un fallo se devuelve como resultado con `isError: true` y el motivo
en texto, para que el agente pueda corregir la llamada.

### Flujos habituales

**Estudio nuevo para un cliente**

1. `create_study` con las keywords, el país y `site`.
2. `get_insights` para decidir prioridades.
3. `keyword_map` para saber qué páginas existen ya.
4. `audit_url` (con `save: true`) de la portada y de la página de cada keyword principal.
5. `action_plan` y `client_report`.

**Redactar una página**

1. `content_brief` de la keyword.
2. Redactar siguiendo el brief.
3. `audit_text` con el borrador, el título y la meta descripción.
4. Corregir lo que salga como `fail` y `warn` y repetir el paso 3 hasta que no queden fallos.
5. `audit_text` con `save: true` para que conste en el informe.

La auditoría devuelve, por cada comprobación, `status` (`ok`, `warn`, `fail`, `skip`), el dato medido y el umbral:
es lo que el agente necesita para saber qué cambiar. `related.missing` lista los términos del estudio que el texto
aún no usa.

Antes de publicar un sitio: `site_audit` con `site: "localhost:3000"` → corregir → repetir hasta que no queden
problemas de gravedad alta → `audit_url` de las páginas clave.

Para planificar: `get_trends` → leer `findings` y `calendar` → `action_plan` (ya incluye las tareas de temporada).
`get_trends` guarda su resultado; no lo llames en bucle, Google limita las peticiones. La metodología completa está
en [METODOLOGIA.md](METODOLOGIA.md).

## CLI

Todos los comandos aceptan `--json`. La salida estándar es entonces un único documento JSON; el progreso va a
stderr y el código de salida es 1 si algo falla (con `{"error": "…"}` en la salida).

```bash
node bin/seo.js new "pan casero" --name "Blog de recetas" --json
node bin/seo.js insights --json
node bin/seo.js brief "como hacer pan casero"            # Markdown; con --json, el objeto
node bin/seo.js audit text borrador.md --keyword "como hacer pan casero" --study latest --json
cat borrador.md | node bin/seo.js audit text - --keyword "…" --json
node bin/seo.js audit url https://ejemplo.com/pan --keyword "pan casero" --json
node bin/seo.js plan --json
node bin/seo.js report --format md                       # a la salida estándar
node bin/seo.js report --format pdf --out informe.pdf --json
```

## API REST

Con el servidor en marcha (`npm start`), las mismas operaciones están en `/api/seo/…`. Referencia en
[API_DOCS.md](../API_DOCS.md). Para un agente son especialmente útiles:

```
GET  /api/seo/report/:archivo/insights
GET  /api/seo/report/:archivo/plan?format=md
GET  /api/seo/report/:archivo/brief?keyword=…&format=md
GET  /api/seo/report/:archivo/keyword-map
POST /api/seo/audit/text        { "text", "keyword", "title", "metaDescription", "filename" }
POST /api/seo/audit/url         { "url", "keyword", "filename" }
GET  /api/seo/report/:archivo/markdown
```

Si la instancia tiene `SEO_AUTH`, hay que enviar `Authorization: Basic …` en cada petición.

## Límites que el agente debe conocer

- Un estudio admite 25 keywords y tarda unos 5 segundos por cada una.
- La auditoría de URL no ejecuta JavaScript: una página que se pinta entera en el navegador se verá vacía (y lo señala).
- Por MCP y por CLI se pueden auditar sitios en desarrollo (`http://localhost:3000/…`); con `save`, la respuesta trae `changes` con lo que mejoró y empeoró desde la auditoría anterior de esa URL. Sirve para comprobar un cambio antes de darlo por bueno.
- «Sin dato» de volumen significa que la fuente no lo mide, no que la búsqueda no exista.
- Las keywords llegan del autocompletado sin tildes; al usarlas en un texto hay que escribirlas bien.
