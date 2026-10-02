# Auditoría de SEO-APP

Fecha: 2026-10-02 · Alcance: backend (`src/`), frontend anterior (`public/`), tests y documentación.

Estado tras las correcciones: **30 de 32 hallazgos corregidos, 2 parciales** (11 y 13, que dependen de decisiones
de producto o de terceros). Los hallazgos marcados «comprobado» se reprodujeron contra el servidor en marcha antes de
corregirlos; las correcciones de seguridad y validación están cubiertas por `tests/suggestions-integration.test.js`.

Este documento audita el código original. La aplicación se ha replanteado después (estudios, auditorías de URL, CLI,
servidor MCP, informes): su estado actual y lo que queda por hacer están en `docs/EVALUACION.md`.

## Pendiente (parcial)

### 11. Peticiones largas — Parcial
Corregido: máximo 25 keywords por análisis, `timeout` de 15 s en todas las llamadas externas y keywords consultadas
por lotes de 10 (antes una por segundo). Pendiente: `POST /analyze` sigue respondiendo al final (unos 5 s por keyword,
hasta ~2 minutos), sin progreso ni límite de peticiones simultáneas. Requiere un sistema de trabajos en segundo plano.

### 13. Dependencia de una API no oficial — Sin cambios
`keywordsur.fr` se consulta falseando `Origin` y `Referer` de Google (`utils/headers.js`). Puede dejar de funcionar sin
aviso y probablemente incumple sus condiciones de uso. No tiene arreglo en el código: hay que decidir si se sustituye
por una fuente con API oficial.

## Corregido

### Críticos

1. **Lectura de archivos arbitrarios por path traversal** (comprobado). `GET /download/..%2F..%2Fpackage.json` devolvía
   el `package.json`; `/report` leía cualquier JSON. Ahora los cuatro endpoints con nombre de archivo solo aceptan el
   patrón exacto que genera la app (`utils/validation.js`) y responden 400 al resto.
2. **Borrado de archivos arbitrarios** (comprobado). `DELETE /report/seo_report_%2F..%2F..%2F..%2Farchivo` borraba fuera
   de `data/results`. Misma validación. Además se ha quitado CORS: la API ya no acepta llamadas desde otras webs.
3. **Reportes guardados según el directorio de trabajo** (comprobado). `ExportService` y las rutas usan ahora la misma
   ruta absoluta (`config.js`).
4. **Métricas de otra keyword** (comprobado). Se usaba `Object.values(keywordData)[0]`; para «zapatos» salían los datos
   de «zapatos de novia». La UI nueva busca por clave.
5. **XSS almacenado** por `innerHTML` y manejadores `onclick` con la keyword interpolada. La UI nueva usa React.

### Altos

9. **El dominio analizado era una suposición** (`<keyword>.es`). Ya no se adivina: el sitio del cliente se indica en la
   ficha del estudio, y con él se consultan sus datos de dominio, se lee su sitemap y se auditan sus páginas reales.

6. **Fechas «Invalid Date»** (comprobado). `GET /reports` devuelve ahora `timestamp` en ISO 8601.
7. **Sugerencias reanalizadas siempre**. Criterio único en servidor y cliente: pendiente = sin entrada en `keywordData`.
   Las que la fuente no conoce se guardan con `no_data`. El análisis actualiza el mismo reporte en vez de duplicarlo.
8. **País e idioma perdidos**. Se guardan en cada keyword del reporte y el análisis de sugerencias los reutiliza; las
   sugerencias de Google reciben `hl` y `gl`.
10. **Un fallo abortaba el análisis de la keyword**. Cada paso (sugerencias, datos, dominio, URL) es independiente y
    anota su error. Las respuestas inesperadas de las APIs ya no lanzan `TypeError`.
12. **Validación de entrada** (comprobado). Keywords, país e idioma se validan y devuelven 400; el JSON mal formado
    también (antes 500).

### Medios

14. **Tests rotos**: 26 de 26 pasan. Los de integración levantan la app sobre una carpeta temporal y ya no dependen de
    un reporte de ejemplo sin versionar. `api.test.js` sigue necesitando red (prueba las APIs reales).
15. `report-details.js` cargado dos veces — UI nueva.
16. Favicons PNG inexistentes — el manifest y el HTML usan solo `favicon.svg`.
17. La tabla de resultados desaparecía a los 10 s — UI nueva.
18. Ordenar por «Keyword» o «Tipo» no ordenaba — UI nueva.
19. Ocultar una keyword ocultaba todas las homónimas — UI nueva (identificador por tipo y keyword principal).
20. Chart.js sin versión fija y CDN sin SRI — ya no se usa ningún CDN.
21. Cambio de tema incompleto en gráficos — UI nueva.
22. CSV exportado sin escapar comillas — UI nueva.
23. **Listado N+1**: `GET /reports` incluye keywords, país y número de errores; el frontend hace una sola petición.
24. `/reports` exponía `data/results` como estático — eliminado; solo queda `download`, con validación.

### Bajos

25. Código muerto de arranque en `app.js` — eliminado.
26. Mensaje de arranque con el puerto fijo y carácter corrupto — el servidor imprime su URL real al escuchar.
27. Error de `listen` sin manejar — mensaje claro si el puerto está ocupado.
28. Spinners de `ora` en el log y `dotenv`/`cors` sin uso — dependencias eliminadas.
29. `files` con rutas de Windows — devuelve solo los nombres de archivo.
30. Errores sin `success: false` y 404 global — forma única de error; el 404 en JSON se limita a `/api`.
31. Documentación desfasada — `arquitectura.md`, `API_DOCS.md` y `README.md` actualizados.
32. Scripts `debug-*.js` — `debug-endpoint.js` y `debug-suggestions.js` reescritos sobre la lógica actual (el primero
    acepta el reporte como argumento y no escribe nada).

## Cambios de comportamiento a tener en cuenta

- **Sin CORS**: una web en otro origen ya no puede llamar a la API desde el navegador. `curl` y scripts siguen igual.
- **«Analizar sugerencias» ya no crea un reporte nuevo**: actualiza el existente y su CSV.
- **`/reports/<archivo>` ya no existe**; usa `/api/seo/download/<archivo>`.
- **Límite de 25 keywords** por análisis (`MAX_KEYWORDS` en `src/config.js`).
- **Reportes antiguos**: no tienen país ni dominio guardados; se tratan como `ES` y `<keyword>.es`, como antes.
- El servidor sigue escuchando en todas las interfaces; `HOST=127.0.0.1` lo limita a este equipo.

## Notas sobre trama-ui (0.2.0) vistas durante la migración

- `Table` parte el CSV con `split(",")` sin comillas: cualquier coma en una celda («0,31 €», un título) descuadra las
  columnas. En la app se sustituye por «‚» (`web/src/lib/format.js`). No admite celdas con contenido ni cabeceras ordenables.
- `Panel` no acepta `children`; `AsciiChart` recorta espacios de las etiquetas y en `hbars` solo rellena a 4 caracteres,
  así que las barras no se alinean con etiquetas largas; además redondea los valores (CPC 0,31 → 0).
- `SectionHeader`, `Panel`, etc. muestran textos de demostración si se omite una prop (`kicker`): hay que pasar `""`.
- Varios componentes fijan `width: min(100%, Npx)` (Panel 420, Alert 460, CodeBlock 640), pensado para landings.
- `Select` devuelve la etiqueta visible; no hay par valor/etiqueta.
