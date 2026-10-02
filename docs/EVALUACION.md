# Evaluación de la herramienta

Fecha: 2 de octubre de 2026. La pregunta es si SEO App sirve para trabajo real de SEO, no si el código funciona.
Se probó contra cuatro problemas clásicos con datos reales, se anotó lo que fallaba, se corrigió y se volvió a probar.

## Qué se le pide a una herramienta así en 2026

De la revisión de guías recientes de SEO (ver [Fuentes](#fuentes)):

- La investigación de keywords ya no termina en una lista: el resultado esperado es **intención, temas y una arquitectura de contenido** (páginas pilar y subtemas enlazados).
- El on-page que importa sigue siendo estable: título, un H1, jerarquía de encabezados, keyword al principio, enlazado interno, datos estructurados.
- Se suma la **optimización para buscadores con IA**: respuestas directas de 40-60 palabras bajo cada subtítulo, preguntas frecuentes, autor y fecha, acceso de los rastreadores de IA en robots.txt.
- Un informe para cliente necesita **resumen ejecutivo y plan de acción priorizado por impacto y esfuerzo**, con los problemas explicados en lenguaje llano.

## Casos probados

### A. Negocio local — «fontanero madrid», «fontanero urgente»

| | Primera pasada | Tras corregir |
|---|---|---|
| Intención local | 1 de 40 keywords | 30 de 40 (reconoce ciudades y «24 horas») |
| Mejor oportunidad | «fontanero urgente sevilla» (otra ciudad) | «fontanero urgente» |
| Temas | «fontaneros», «urgencia», «urgencias», «urgente» por separado | plurales unidos; el término de la keyword principal ya no forma tema |
| Preguntas | «fontanero madrid que es» | ninguna (solo cuentan interrogativos al principio) |
| Plan | genérico | incluye ficha de Google Business y páginas por zona |

**Cambios:** lista de lugares para detectar intención local, descarte de búsquedas de otra zona (siguen en el
listado, no cuentan como oportunidad), agrupación por raíz de palabra y concordancias de número en los textos.

**Sigue sin resolver:** la lista de lugares cubre capitales españolas y grandes ciudades, no municipios pequeños.
No hay datos de Google Business ni de reseñas.

### B. Tienda online — «zapatillas running», «zapatillas trail» (99 keywords)

- Toda la competencia es del 100 %: **cero victorias rápidas**. La app lo dice y redirige a cola larga y temas; no inventa oportunidades.
- **Auditoría de URL** de dos categorías reales (runnea.com y sprintersports.com): 93/100 cada una, con hallazgos concretos (título de 69 caracteres, falta Open Graph, respuesta de 1,2 s).
- Primera pasada: marcaba como «relleno de keyword» una categoría con 81 apariciones. **Corregido**: detecta listados de productos por sus datos estructurados y no les aplica las comprobaciones de prosa.
- Primera pasada: «no hay H1» en una página que lo tiene en la cabecera. **Corregido**: el H1 se cuenta en todo el documento.
- **Mapa de keywords** contra el sitemap de sprintersports.com (500 URLs): 13 de 15 keywords con página, 2 huecos («zapatillas para correr», «running shoes»).

**Sigue sin resolver:** no ejecuta JavaScript (una tienda que se pinta en el navegador se vería vacía) y no mide
Core Web Vitals.

### C. Blog — «pan casero» (49 keywords)

- 5 victorias rápidas reales, entre ellas «como hacer pan casero» (3.600 búsquedas, competencia 18 %).
- El **brief** de esa keyword sale utilizable: intención informativa, 1.200-1.800 palabras, subtemas (receta, levadura, rápido), preguntas y vocabulario.
- Primera pasada: el brief repetía la keyword como encabezado («Zapatillas running mejor»). **Corregido**: cada subtema se titula con su keyword más buscada.
- El autocompletado devuelve las keywords sin tildes; el brief lo avisa en sus comprobaciones.

### D. Agente de IA por MCP

Un cliente MCP real (`tests/mcp.test.js`) arranca el servidor y recorre el ciclo: lista estudios, pide estrategia,
pide el brief, audita un borrador flojo (menos de 40) y uno corregido (75 o más), lo guarda y obtiene el informe.

- Destapó que el campo semántico solo funcionaba para keywords principales. **Corregido**: vale para cualquier keyword del estudio.
- Los errores vuelven como resultado legible (`isError`), no como excepción.

### E. Web en desarrollo — auditar antes de publicar

Se auditó una web servida en `localhost:3000` (un Next.js en desarrollo) y la propia interfaz de SEO App (una SPA).

- El sitio con renderizado en servidor se audita igual que uno público; se omiten HTTPS y velocidad, que en local no dicen nada.
- La SPA entrega el HTML vacío: la auditoría lo detecta y lo explica («Contenido en el HTML: falla») en lugar de dar una lista de fallos de contenido sin sentido.
- Volver a auditar la misma URL devuelve qué comprobaciones han cambiado; con `--watch` desde la CLI se ve al guardar cada cambio.

**Sigue sin resolver:** al no ejecutar JavaScript, una SPA solo se puede auditar compilada con SSR o generación estática.

### F. Sitio entero en desarrollo — sitemap en localhost

Se auditó por su sitemap un sitio Next.js servido en `localhost:3000` (34 URLs).

- Nota 88/100: una página llega vacía sin JavaScript (`/contacto`) y tres fichas de proyecto tienen menos de 150 palabras. Ninguna de las dos cosas salía auditando la portada.
- Primera pasada: una URL que redirige contaba además como «título repetido» con su destino. **Corregido**: lo que redirige solo cuenta como redirección.
- Con un sitemap que ya usa el dominio de producción (caso habitual), las URLs se comprueban en local por la misma ruta y la canónica a producción se da por buena.
- El sitio del estudio admite `host:puerto`; para un sitio local no se consultan datos de dominio.

**Sigue sin resolver:** se comprueban como mucho 100 URLs por pasada y no se rastrean enlaces: una página que no esté en el sitemap no se ve.

### G. Tendencias — «cafetera italiana» (Google Trends, 5 años)

- Detecta la temporada (pico en diciembre, valle en mayo-junio) y avisa de que a dos meses ya no cabe contenido nuevo, solo reforzar y preparar campaña.
- «moka cafetera» (+45 %) y «mejor cafetera italiana» (+51 %) crecen: el volumen medio se queda corto.
- Cobertura del 26 %: de las 19 consultas más afines, el estudio recoge 5. La gente busca «hacer café en cafetera italiana», no «cafetera italiana cómo usar». Es exactamente la señal para reevaluar el target.
- Primera pasada: se pedían las mejores oportunidades, casi todas de cola larga sin datos en Trends. **Corregido**: se piden las de más volumen.
- Google respondió 429 a mitad de consulta varias veces. **Corregido**: reintento con cookie nueva, conservación de lo ya obtenido y «Reintentar» solo lo que falta.

**Sigue sin resolver:** los endpoints no son oficiales y pueden dejar de responder; el índice no es volumen; las keywords pequeñas no tienen datos.

### H. Un sitio con varios públicos — programador freelance orientado a negocio

Proyecto con tres targets sobre un sitio en `localhost:3000`: desarrollo web, automatización de procesos y consultoría.

- Prioridad: automatización (95) por delante de desarrollo web (91) y consultoría (78): menos volumen por keyword, pero menos competencia y CPC más alto.
- Detecta la página de cada target por su URL (`/servicios/software-de-gestion-a-medida`, `/servicios/diseno-web-a-medida`) y que consultoría no tiene ninguna.
- 10 keywords repetidas entre «desarrollo web» y «consultoría» (todas las variantes de «programador freelance»): la herramienta avisa de que quizá sean el mismo público. Es justo la decisión que hay que tomar antes de crear páginas.
- Primera pasada: el plan repetía «crear la página» dos veces para el target sin página. **Corregido.**

**Sigue sin resolver:** la página de cada target se deduce de las palabras de la URL; si la URL no nombra el servicio hay que indicarla a mano (`--page`). El informe del proyecto sale en Markdown, no en PDF. La prioridad comprime mucho la demanda (escala logarítmica): dos targets con volúmenes parecidos quedan casi empatados.

## Veredicto

**Sirve para:** preparar un estudio de keywords con criterio (qué atacar, cómo agruparlo, qué intención tiene),
producir briefs, comprobar textos y páginas contra buenas prácticas actuales, localizar huecos de contenido y
entregar un informe con plan de acción. Un estudio de dos keywords con auditorías e informe se completó en los casos
de prueba en pocos minutos, y un agente puede recorrer el ciclo brief-redacción-auditoría con las herramientas MCP.

**No sustituye a:** Search Console (posiciones y clics reales), una herramienta de enlaces, ni PageSpeed Insights.
No analiza a los competidores ni los resultados de Google de cada keyword.

**Riesgo principal para venderla:** la fuente de datos de demanda no es oficial. Mientras sea así, la app es
adecuada para uso interno de una agencia o un desarrollador; para ofrecerla como servicio hay que contratar una
fuente con API.

## Objetivos y estado

| Objetivo | Estado |
|---|---|
| Gráficos que se entiendan | Barras con etiqueta y valor, matriz con cuadrantes rotulados y leyenda numerada, temas en bloques |
| Navegación útil | Barra con Estudios, Auditar URL, Guía y «Nuevo estudio»; pestañas dentro del estudio en orden de trabajo |
| Uso desde terminal y por agentes | CLI con `--json`, servidor MCP con 18 herramientas y una skill para Claude, API REST |
| Informe entregable | PDF generado (no impresión de página): portada, resumen, plan, matriz, briefs, mapa, auditorías, metodología; marca por estudio. También Markdown y CSV |
| Probada contra problemas reales | Cuatro casos, con las correcciones anteriores |
| Usable en privado por una agencia | Acceso con contraseña (`SEO_AUTH`), estudios en archivos, sin servicios externos propios |
| Sitios con varios públicos | Proyectos con un target por público: prioridad, solapes, página de cada uno, plan conjunto |
| Dominio del cliente real, no adivinado | La ficha del estudio lleva el sitio; se consultan sus datos y su sitemap |

## Pendiente, por orden de valor

1. **Fuente de datos con API oficial** (Google Ads, DataForSEO o similar), también para tendencias. Es lo único que impide venderla como servicio.
2. **Resultados de Google por keyword** (quién posiciona, qué tipo de página): validaría la intención y permitiría análisis de competidores.
3. **Core Web Vitals** con la API de PageSpeed Insights.
4. **Análisis en segundo plano con progreso**, para estudios de más de 25 keywords.
5. **Usuarios y permisos** si varias personas comparten instancia con clientes distintos.
6. **Seguimiento en el tiempo**: repetir un estudio y comparar.
7. **Logotipo de la agencia** en el PDF (hoy: nombre y color).

## Fuentes

- [SEO Checklist 2026 — The Stacc](https://thestacc.com/es/blog/seo-checklist-2026/)
- [The Complete On-Page SEO Checklist for 2026 — eSEOspace](https://eseospace.com/blog/the-complete-on-page-seo-checklist-for-2026-25-factors-that-still-matter/)
- [Keyword Research Guide: Search Intent, Topic Clusters and AI Optimization for 2026 — Systems Architect](https://systemsarchitect.net/keyword-research-guide-search-intent-topic-clusters-and-ai-optimization-for-2026/)
- [Generative Engine Optimization: The 2026 Guide — LLMrefs](https://llmrefs.com/generative-engine-optimization)
- [Agency SEO audit — Incremys](https://incremys.com/en/resources/blog/agency-seo-audit)
