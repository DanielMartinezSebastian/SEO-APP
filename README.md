# SEO App

Herramienta para **preparar y entregar estudios de posicionamiento**: investiga keywords, dice por dónde empezar,
genera el brief de cada página, audita textos y páginas reales, y produce un informe para el cliente.

Se usa de cuatro formas, todas sobre la misma lógica:

| Forma | Para quién | Cómo |
|---|---|---|
| Interfaz web | Consultores y agencias | `npm start` → `http://localhost:3000` |
| CLI | Terminal, scripts, automatizaciones | `node bin/seo.js …` (o `seo …` tras `npm link`) |
| Servidor MCP | Agentes de IA | `seo mcp` |
| API REST | Integraciones propias | `/api/seo/…` ([API_DOCS.md](API_DOCS.md)) |

## Qué resuelve

| Problema | Qué hace la app |
|---|---|
| «¿Qué busca la gente sobre esto?» | De cada keyword saca sugerencias de Google, preguntas, comparativas y keywords similares, con búsquedas, competencia y CPC |
| «¿Por dónde empiezo?» | Puntúa cada keyword de 0 a 100, separa las victorias rápidas y dibuja la matriz demanda/competencia |
| «¿Cómo organizo el sitio?» | Agrupa las keywords en temas y clasifica su intención (compra, comparativa, informativa, local) |
| «¿Qué página del cliente cubre cada keyword?» | Cruza las keywords con el sitemap: página propia, hueco de contenido o páginas que compiten |
| «¿Qué tiene que escribir el redactor?» | Brief por keyword: tipo de página, extensión, títulos, esquema, vocabulario, preguntas |
| «¿Está bien este texto?» | Auditoría con nota de 0 a 100, en vivo, frente a la keyword y al campo semántico del estudio |
| «¿Está la web en condiciones, también antes de publicarla?» | Auditoría de URL, pública o en `localhost`: servidor, indexabilidad, título y meta, encabezados, datos estructurados, enlaces, robots.txt, sitemap, rastreadores de IA |
| «¿Qué le entrego al cliente?» | Informe PDF con resumen, plan de acción priorizado, oportunidades, briefs y auditorías; también en Markdown y CSV |

### Qué no hace

No mide posiciones en Google, enlaces entrantes ni Core Web Vitals: para eso siguen haciendo falta Search Console y
PageSpeed Insights. La «competencia» es el índice de la fuente de datos (refleja sobre todo la disputa entre
anunciantes), no la dificultad orgánica. Los datos de demanda vienen de una fuente no oficial (ver [Limitaciones](#limitaciones)).

## Empezar

```bash
npm install
npm start          # compila la interfaz y arranca en http://localhost:3000
```

Requiere Node.js 20 o superior.

### Un estudio de principio a fin

1. **Nuevo estudio**: las keywords principales del proyecto (de 2 a 6 suele bastar), país, idioma y, si lo tienes, el dominio del cliente.
2. **Resumen**: conclusiones y plan de acción.
3. **Keywords**: todas las búsquedas, con filtros y exportación a CSV.
4. **Oportunidades**: ranking, victorias rápidas, matriz, temas e intención.
5. **Contenido**: brief de cada keyword y auditoría del texto escrito.
6. **Auditoría web**: mapa de keywords frente al sitemap y auditoría de las páginas del cliente.
7. **Informe**: ficha del cliente y descarga en PDF, Markdown, CSV o JSON.

La guía completa, con cómo leer cada dato, está dentro de la app (**Guía**).

## CLI

```bash
seo new "zapatillas running, zapatillas trail" --site tienda.com --client "Deportes Sur"
seo studies                      # estudios guardados
seo show                         # resumen del último estudio
seo keywords --intent transactional --top 20
seo insights                     # oportunidades, intención y temas
seo map                          # qué URL del sitio cubre cada keyword
seo trends                       # estacionalidad, tendencia, consultas en auge y calendario (Google Trends)
seo site                         # audita el sitio del estudio por su sitemap
seo site --site localhost:3000   # lo mismo para cualquier sitio, sin estudio
seo brief "zapatillas trail"     # brief en Markdown
seo audit text borrador.md --keyword "zapatillas trail" --study latest --save
seo audit url https://tienda.com/zapatillas-running --keyword "zapatillas running" --study latest --save
seo plan                         # plan de acción
seo report --format pdf --out informe.pdf
```

- Sin instalar globalmente: `node bin/seo.js …` o `npm run seo -- …`. Con `npm link`, la orden `seo` queda disponible.
- `[estudio]` es el nombre de archivo; si se omite se usa el más reciente.
- `--json` da JSON limpio por la salida estándar; el progreso y los errores van a stderr. El código de salida es 1 si algo falla.
- `seo help` lista todos los comandos.

## Sitios en desarrollo

La auditoría de URL también vale para una web que todavía no está publicada: `http://localhost:3000/pagina`, una
IP de la red local o un dominio `.test`/`.local`.

```bash
seo audit url localhost:3000/zapatillas --keyword "zapatillas running"
seo audit url localhost:3000/zapatillas --keyword "zapatillas running" --study latest --save   # compara con la pasada anterior
seo audit url localhost:3000/zapatillas --keyword "zapatillas running" --watch 5               # repite y avisa cuando algo cambia
```

- En un sitio local no se evalúan HTTPS ni el tiempo de respuesta, un `noindex` es solo un aviso, y una canónica que apunta a la misma ruta en el dominio de producción se da por buena (los enlaces a ese dominio cuentan como internos).
- Al guardar la auditoría de una página ya auditada se indica qué comprobaciones han mejorado y cuáles han empeorado. En la interfaz, «Volver a auditar» hace lo mismo.
- La auditoría no ejecuta JavaScript. Un servidor de desarrollo que entrega la página vacía y la pinta en el navegador (una SPA sin renderizado en servidor) sale como «Contenido en el HTML: falla»; audita entonces la versión compilada o con SSR.
- «localhost» es siempre el equipo donde corre SEO App, no el del navegador desde el que se usa.

**Quién puede auditar direcciones locales.** La CLI y el servidor MCP, siempre. La interfaz y la API, solo si la
petición llega desde el propio equipo o desde la red privada, y nunca a través de un proxy inverso: así una
instancia publicada en internet no sirve para leer la red interna del servidor. `SEO_ALLOW_PRIVATE_URLS=1` lo permite
siempre y `SEO_ALLOW_PRIVATE_URLS=0` nunca. Las direcciones de metadatos de las nubes (169.254.x.x) no se piden en ningún caso.

### El sitio entero, por su sitemap

El sitio de un estudio puede ser un dominio (`ejemplo.com`) o un sitio en desarrollo (`localhost:3000`,
`192.168.1.20:8080`, `miweb.test`). `seo site` —o «Auditar el sitio» en la pestaña «Auditoría web»— lee el sitemap
declarado en robots.txt (o `/sitemap.xml`, siguiendo índices), descarga hasta 40 URLs y agrupa lo que se repite:
páginas rotas, redirecciones, noindex, canónicas, títulos y descripciones repetidos, H1, contenido escaso y páginas
vacías sin JavaScript. En local, las URLs del sitemap que ya llevan el dominio de producción se comprueban en local
por la misma ruta. Cada pasada se compara con la anterior y los problemas pasan al plan de acción y al informe.

## Tendencias y calendario

`seo trends` (pestaña «Tendencias») consulta Google Trends para las keywords principales y las más buscadas del
resto: patrón estacional, meses de temporada alta, tendencia del último año, calendario de publicación y campañas a
doce meses, consultas en auge que el estudio no contempla y qué parte de lo que se busca alrededor recoge el estudio.
Google limita estas consultas: el resultado se guarda y `--retry` pide solo lo que falló.
Cómo cruzar todo esto para decidir está en [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Agentes de IA (MCP)

`seo mcp` arranca un servidor [Model Context Protocol](https://modelcontextprotocol.io) por stdio. Configuración
para cualquier cliente compatible:

```json
{
  "mcpServers": {
    "seo-app": { "command": "node", "args": ["bin/seo.js", "mcp"], "cwd": "/ruta/a/SEO-APP" }
  }
}
```

Herramientas: `list_studies`, `create_study`, `get_insights`, `get_keywords`, `keyword_map`, `site_audit`, `get_trends`, `content_brief`,
`audit_text`, `audit_url`, `action_plan`, `client_report`, `update_study`. Flujos de trabajo y ejemplos en
[docs/AGENTES.md](docs/AGENTES.md).

## Despliegue privado

Pensada para correr en el equipo del consultor o en un servidor de la agencia.

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | `3000` |
| `HOST` | Interfaz de red; `127.0.0.1` la limita al propio equipo | todas |
| `SEO_AUTH` | `usuario:contraseña`. Si se define, la interfaz y la API piden esas credenciales (HTTP Basic) | sin control de acceso |
| `SEO_RESULTS_DIR` | Carpeta donde se guardan los estudios | `data/results` |
| `SEO_ALLOW_PRIVATE_URLS` | `1` permite siempre auditar direcciones locales; `0`, nunca | según quién llama (ver [Sitios en desarrollo](#sitios-en-desarrollo)) |

```bash
SEO_AUTH="agencia:una-contraseña-larga" PORT=8080 npm start
```

- Con `SEO_AUTH`, sirve la app detrás de HTTPS (un proxy inverso): Basic envía la contraseña en cada petición.
- No hay usuarios ni permisos: quien entra ve todos los estudios. Para separar clientes, una instancia (o una carpeta `SEO_RESULTS_DIR`) por equipo.
- Los estudios son archivos JSON en `data/results`: la copia de seguridad es copiar la carpeta.
- La marca del informe se ajusta por estudio: nombre de la agencia y color de acento del PDF.

## Desarrollo

```bash
npm run server:dev   # API con recarga automática
npm run dev:web      # interfaz con Vite en http://localhost:5173 (usa la API anterior)
npm run build        # compila la interfaz en web/dist
npm test             # 50 tests; api.test.js necesita red
```

```
SEO-APP/
├── bin/seo.js         # CLI
├── shared/            # Lógica pura, común a servidor e interfaz: oportunidades, brief, plan, auditoría de texto, mapa
├── src/
│   ├── api/           # Clientes de las fuentes de datos
│   ├── services/      # Estudios, auditoría de URL, PDF, Markdown
│   ├── server/        # Express: API y entrega de la interfaz
│   ├── mcp/           # Servidor MCP
│   └── utils/         # Validación
├── web/               # Interfaz (React + Vite + trama-ui)
├── tests/
├── docs/              # AGENTES.md, EVALUACION.md
└── data/results/      # Estudios (no versionados)
```

La interfaz usa [trama-ui](https://github.com/DanielMartinezSebastian/trama) (variante `dotmatrix`, tema claro y oscuro).

## Limitaciones

- **Fuente de datos no oficial.** Volumen, competencia, CPC, similares y datos de dominio salen de `keywordsur.fr`, consultado como lo hace su extensión. Puede cambiar o dejar de responder sin aviso y su uso puede no estar permitido por sus condiciones. Para un producto comercial conviene sustituirla por una API con contrato (el cliente está aislado en `src/api/keywordsur.js`).
- **Las búsquedas muy concretas no tienen volumen.** La fuente solo mide una parte de la cola larga: es normal que muchas ideas salgan «sin dato».
- **El análisis es síncrono.** Unos 5 segundos por keyword y un máximo de 25 por estudio.
- **La intención y el mapa de keywords son heurísticos.** La intención se deduce de las palabras; el mapa, de las palabras de cada URL.
- **Las auditorías aplican buenas prácticas, no reglas de Google.** Los umbrales están en `shared/contentAnalysis.js`.

Evaluación de la herramienta frente a casos reales, con lo que resuelve y lo que no: [docs/EVALUACION.md](docs/EVALUACION.md).
Hallazgos de la auditoría del código original y su estado: [AUDITORIA.md](AUDITORIA.md).
