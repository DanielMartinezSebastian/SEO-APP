---
name: seo-app
description: Audita y mejora el SEO de una web con SEO App, sobre todo durante el desarrollo (localhost o red interna) y antes de publicar. Úsala cuando el usuario pida auditar el SEO de un sitio o una página, revisar el sitemap, decidir qué keywords o públicos atacar, planificar la arquitectura de una web con varios servicios o categorías, preparar contenido para posicionar, o comprobar que un cambio no ha empeorado el SEO.
---

# SEO App: auditar y mejorar una web durante el desarrollo

SEO App es una herramienta local que estudia keywords, audita páginas y sitios enteros (también en `localhost`) y
convierte los hallazgos en un plan de acción. Tú pones el criterio y haces los cambios en el código; ella mide.

## Antes de empezar

1. **Localiza la herramienta.** Prueba `seo help`. Si no existe, usa `node <ruta>/SEO-APP/bin/seo.js help` (pregunta
   la ruta al usuario si no la conoces). Si tienes las herramientas MCP `seo-app` (`site_audit`, `audit_url`…), hacen
   lo mismo que la CLI y puedes usarlas en su lugar.
2. **Usa siempre `--json`** para leer resultados; sin él la salida es para personas.
3. **El sitio debe estar servido.** Arranca el servidor de desarrollo del proyecto si no lo está y anota el puerto.
   `localhost` es el equipo donde corre SEO App.
4. **Sin JavaScript.** SEO App lee el HTML tal como llega del servidor, igual que muchos rastreadores y los
   buscadores con IA. Una página que se pinta en el navegador le llega vacía, y eso ya es un hallazgo.

## El método

Sigue las fases en orden. No saltes a escribir contenido con el sitio roto, ni a auditar páginas sin saber para
qué keyword es cada una.

### Fase 1 · Estado del sitio (siempre, y tras cada cambio de estructura)

```bash
seo site --site localhost:3000 --json
```

Lee `score`, `sitemap.issues` e `issues` (cada uno con `severity`, `why`, `fix` y `urls`).

- Corrige primero la gravedad **alta**: URLs del sitemap que no responden, páginas sin contenido en el HTML,
  páginas sin título.
- Después la **media**: redirecciones en el sitemap, canónicas a otra URL, títulos repetidos, H1, contenido escaso.
- Repite el comando hasta que no queden altas. Si no hay sitemap, crearlo es la primera tarea.
- En local es normal que el sitemap y las canónicas usen el dominio de producción, y que haya `noindex` de
  entorno: no los «arregles» sin confirmar con el usuario que también ocurren en producción.

### Fase 2 · ¿Para quién es el sitio? (si no hay estudio todavía)

Pregunta al usuario qué ofrece y a quién. Después:

- **Un solo público** → un estudio: `seo new "kw1, kw2, kw3" --site localhost:3000 --name "…"`.
- **Varios públicos** (varios servicios, categorías de tienda, tipos de cliente) → un proyecto con un target por
  público:

```bash
seo project new "Nombre" --site localhost:3000
seo project target "Nombre del target" --keywords "kw1, kw2, kw3" --audience "a quién va y qué problema tiene"
seo project site            # sitúa cada target en las páginas del sitio
seo project show --json
```

Reglas para elegir keywords: de 2 a 6 por estudio o target; las que escribiría **ese público**, no el nombre
interno del servicio (quien tiene un problema busca el problema); en el idioma y país del mercado
(`--country ES --language es`). Cada keyword tarda unos 5 segundos.

### Fase 3 · Decidir qué atacar

```bash
seo insights --json         # oportunidades, victorias rápidas, intención, temas
seo trends --json           # temporada, tendencia, consultas en auge, cobertura
seo project show --json     # con varios targets: prioridad, solapes, páginas
```

Qué mirar:

- `quickWins`: demanda por encima de la mediana y competencia baja. Es por donde empezar.
- `coverage.percent` en tendencias: si es menor de 40, las keywords elegidas no son las que usa el público.
  Propón al usuario rehacer el estudio con `coverage.missing` antes de seguir.
- `findings` de tendencias: temporada cercana (prioriza), keyword principal en descenso (replantea).
- En proyectos, `overlaps` (la misma keyword en dos targets: asígnala a uno) y `targets[].page`
  (`null` = ese público no tiene página de aterrizaje: hay que crearla).

**Un target = una intención = una página.** La portada reparte hacia cada target; no intenta posicionar todos.

`seo trends` consulta Google Trends, que limita las peticiones: llámalo una vez por estudio (el resultado se
guarda). Si devuelve un 429, espera unos minutos y usa `seo trends --retry`. No lo metas en un bucle.

### Fase 4 · Situar cada keyword en una página

```bash
seo map --json              # keyword → URL del sitemap, huecos y páginas que compiten
```

- `url: null` → hueco: hay que crear la página. Pide su brief: `seo brief "<keyword>"`.
- `alternatives` no vacío → dos páginas compiten por la misma keyword: decide la principal y enlaza la otra a ella.

### Fase 5 · Página a página, mientras desarrollas

```bash
seo audit url http://localhost:3000/ruta --keyword "<keyword>" --study latest --save --json
```

Lee `score` y `checks` (cada uno con `status`: `ok`, `warn`, `fail`, `skip`; `label`; `detail`). Con `--save`, la
respuesta trae `changes` respecto a la pasada anterior (`improved`, `worsened`).

Ciclo: auditar → corregir en el código los `fail` (de mayor `weight` a menor) → volver a auditar → parar cuando no
queden `fail` y `changes.worsened` esté vacío. No persigas el 100: los `warn` son mejoras, no bloqueos.

Para textos que aún no están en una página:

```bash
seo audit text borrador.md --keyword "<keyword>" --title "…" --meta "…" --study latest --json
```

### Fase 6 · Cerrar

```bash
seo plan                    # o: seo project plan
seo report --format md      # informe del estudio; --format pdf --out informe.pdf para el cliente
seo project report          # informe del proyecto en Markdown
```

Resume al usuario: qué has corregido, la nota antes y después, qué queda pendiente y por qué, y qué no se puede
comprobar en local.

## Después de publicar

Repite la fase 1 y la 5 contra el dominio real: en local no se evalúan HTTPS ni el tiempo de respuesta.

## Lo que no debes hacer

- **No inventes datos.** Volumen, competencia y tendencia salen de la herramienta; si no hay dato, dilo.
- **No prometas posiciones ni tráfico.** «Búsquedas» es una media mensual estimada; «competencia» refleja la
  disputa entre anunciantes, no la dificultad orgánica; el índice de Trends no es volumen.
- **No des por medido lo que no mide:** posiciones en Google, enlaces entrantes, Core Web Vitals, contenido que
  solo aparece con JavaScript. Para eso, Search Console y PageSpeed Insights.
- **No rellenes de keywords** para subir la nota: la auditoría penaliza la densidad excesiva y el texto es para personas.
- **No borres estudios ni proyectos** (`seo delete`, `seo project delete`) sin que el usuario lo pida.
- **No audites sitios de terceros en masa**: una pasada de sitio descarga decenas de páginas.

## Referencia rápida

| Quiero… | Comando |
|---|---|
| Estado de todo el sitio | `seo site --site <host[:puerto]>` |
| Estado del sitio del estudio, guardado y comparado | `seo site` |
| Auditar una página | `seo audit url <url> --keyword "…"` |
| Vigilar una página mientras edito | `seo audit url <url> --keyword "…" --watch 5` |
| Estudiar keywords | `seo new "kw1, kw2" --site <sitio>` |
| Oportunidades | `seo insights` |
| Temporadas y tendencia | `seo trends` |
| Keyword → página | `seo map` |
| Qué escribir | `seo brief "<keyword>"` |
| Varios públicos | `seo project new`, `seo project target`, `seo project show` |
| Tareas priorizadas | `seo plan`, `seo project plan` |
| Informe | `seo report --format md|pdf`, `seo project report` |

`[estudio]` y `[proyecto]` se pueden omitir: se usa el más reciente. Todos los comandos aceptan `--json`; los
errores salen por stderr con código de salida 1.
