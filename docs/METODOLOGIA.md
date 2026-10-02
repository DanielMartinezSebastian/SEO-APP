# Metodología: cruzar los datos para decidir

SEO App reúne cinco fuentes de datos sobre un mismo proyecto. Por separado dicen poco; la metodología consiste en
hacerles siempre las mismas preguntas, en el mismo orden, y dejar que cada respuesta corrija a la anterior.

| Fuente | Qué aporta | Qué no dice |
|---|---|---|
| Volumen, competencia y CPC (keywordsur) | Cuánto se busca de media, cuánto se disputa, cuánto vale | Cuándo se busca ni hacia dónde va |
| Autocompletado de Google | Cómo formula la gente la búsqueda: sugerencias, preguntas, comparativas | Cuánta demanda tiene cada formulación |
| Google Trends | En qué meses se busca, si crece o cae, qué consultas están en auge | Volumen absoluto (es un índice de 0 a 100 por keyword) |
| Sitemap y auditoría del sitio | Qué páginas existen y en qué estado están | Si posicionan |
| Auditorías de página y de texto | Si una página concreta está lista para su keyword | Enlaces entrantes, Core Web Vitals |

## Google Trends: qué se puede usar y con qué límites

- **No hay API pública.** La oficial está en alfa con acceso por solicitud. SEO App usa los mismos endpoints que la
  web de Trends (exploración, serie temporal y consultas relacionadas). Funcionan, pero Google los limita: por eso
  se consultan como mucho 10 keywords por estudio, con pausa, y **el resultado se guarda** en la ficha.
- Si Google corta a media consulta, lo que falta queda marcado y «Reintentar» (`seo trends --retry`) pide solo eso.
- Las consultas relacionadas (más afines y en auge) se piden solo para las keywords principales.
- Por debajo de unos cientos de búsquedas al mes Trends devuelve ceros: la app lo indica en lugar de inventar un patrón.
- Para vender la herramienta como servicio hace falta una fuente contratada (la API oficial cuando abra, o un
  proveedor como DataForSEO). Para uso interno de una agencia o un desarrollador, lo actual es suficiente.

### Cómo se calcula

- **Perfil del año:** cada mes se compara con la media de *su* año, y se promedian los cinco años. 100 = media. Así
  un crecimiento de fondo no se confunde con temporada.
- **Estacional:** el mejor mes supera en un 30 % al peor (el doble = «muy estacional») **y** el dibujo se repite
  cada año (correlación media ≥ 0,5). Si hay picos pero no se repiten, son sucesos puntuales, no temporada.
- **Tendencia:** los últimos doce meses completos frente a los doce anteriores. ±15 % marca crecimiento o descenso.
- **Calendario:** contenido publicado tres meses antes del pico; campañas de pago, correo y redes, un mes antes.
  Son plazos orientativos: un sitio con autoridad posiciona antes; uno nuevo, después.

## Las seis preguntas

### 1. ¿Estamos hablando como habla el público? (reevaluar el target)

Cruce: keywords del estudio × consultas más relacionadas de Trends.

- **Cobertura** (pestaña Tendencias → «Encaje con el público»): qué porcentaje de las consultas más afines ya está
  en el estudio. Por debajo del 40 %, las keywords elegidas no describen cómo busca la gente: hay que ampliar o
  cambiar las principales.
- **Intención de lo relacionado:** si el proyecto vende y la mayoría de lo que se busca alrededor es informativo,
  falta contenido para la fase previa a la compra.
- **Marcas y distribuidores** entre las relacionadas («bialetti», «carrefour») dicen contra quién se compite y
  dónde compra el público.

Decisión: confirmar las keywords principales, o crear un estudio nuevo con las que faltan.

### 2. ¿Dónde hay demanda que se puede ganar?

Cruce: volumen × competencia × CPC (puntuación de oportunidad) × tendencia.

- Victoria rápida **y** en crecimiento → primera de la lista.
- Mucho volumen pero en descenso sostenido → comprobar en las consultas en auge si el público ha cambiado de
  palabra antes de invertir.
- Keyword pequeña que crece más de un 15 % anual con poca competencia → posicionar ahora es más barato que después.

### 3. ¿Cuándo hay que estar?

Cruce: perfil del año × fecha de hoy.

- **Faltan 3 meses o más:** contenido nuevo, publicado en el mes que indica el calendario.
- **Faltan 1 o 2 meses:** ya no hay margen para posicionar algo nuevo: reforzar lo que existe (fechas, precios,
  enlaces internos desde la portada) y preparar la campaña de pago.
- **En temporada:** no tocar la estructura; vigilar disponibilidad, velocidad y conversión.
- **Valle:** es cuando se rehacen páginas, se migra y se prueba.

El volumen medio engaña en keywords estacionales: 10.000 búsquedas de media con un perfil de 160 en diciembre y
50 en junio son 16.000 y 5.000. El presupuesto de campañas debería seguir ese perfil.

### 4. ¿Tiene el sitio dónde recibir esa demanda?

Cruce: keywords prioritarias × sitemap (mapa de keywords) × auditoría de sitio.

- Keyword prioritaria **sin página** → hueco de contenido: crear, con el brief.
- Varias páginas para la misma keyword → elegir una y enlazar las demás hacia ella.
- Página existente con problemas de sitio (rota, noindex, vacía sin JavaScript, título repetido) → arreglar antes
  de escribir nada más.

En desarrollo, todo esto se hace contra `localhost` o la red interna antes de publicar: el sitio del estudio puede
ser `localhost:3000` y la auditoría de sitio compara cada pasada con la anterior.

### 5. ¿Está cada página a la altura de su keyword?

Cruce: brief × auditoría de página o de texto. Se repite hasta que no queden fallos; en local, con
`seo audit url … --watch`.

### 6. ¿Hay negocio más allá del SEO?

Cruce: consultas en auge × CPC × intención × estacionalidad.

- **Consulta disparada que el estudio no contempla** → producto, servicio o variante que el mercado empieza a
  pedir («sin alcohol», «para inducción», «eléctrica»). Crear un estudio con ellas mide si hay volumen detrás.
- **CPC alto con competencia baja** → búsqueda con valor comercial poco trabajada: candidata a página de venta y
  a campaña de pago rentable.
- **Estacionalidad complementaria:** si todas las keywords tienen el pico en el mismo mes, el negocio depende de
  una temporada; las keywords relacionadas con pico en otros meses indican con qué línea se puede compensar.
- **Intención local** concentrada en ciudades donde el cliente no opera → zonas de expansión o de colaboración.
- **Preguntas recurrentes** sobre uso, limpieza o averías → contenido de posventa, y a veces un servicio
  (recambios, mantenimiento, formación).

## El ciclo

1. **Estudio** con 2 a 6 keywords principales (`seo new`).
2. **Tendencias** (`seo trends`): comprobar cobertura y temporada. Si la cobertura es baja, volver a 1.
3. **Oportunidades y plan** (`seo insights`, `seo plan`): el plan ya mezcla demanda, temporada, sitio y auditorías.
4. **Sitio** (`seo site`, `seo map`): qué existe, qué falta, qué está roto.
5. **Contenido**: brief → redacción → auditoría hasta que pase.
6. **Informe** al cliente (`seo report`), con el calendario.
7. **Revisión**: volver a consultar tendencias cada trimestre y antes de cada temporada; repetir la auditoría de
   sitio tras cada despliegue.

## Lo que esta metodología no cubre

Posiciones y clics reales (Search Console), enlaces entrantes, Core Web Vitals y quién ocupa hoy los resultados de
cada keyword. Son el siguiente cruce que merece la pena añadir: sin ellos, «oportunidad» significa demanda
alcanzable, no posición garantizada.
