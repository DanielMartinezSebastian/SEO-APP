import { Prose } from 'trama-ui';
import { VARIANT } from '../components/ui.jsx';

// La guía vive en la propia app para que quien la use (o quien la reciba de una agencia) no dependa del repositorio.
const GUIDE = `# Guía de uso

SEO App sirve para **preparar y entregar un estudio de posicionamiento**: qué busca la gente, por dónde conviene empezar, qué hay que escribir, en qué estado están las páginas del cliente y qué tareas salen de todo ello.

## El flujo de trabajo

1. **Crea un estudio** con las keywords principales del proyecto (de 2 a 6 suele bastar) y, si lo tienes, el dominio del cliente.
2. **Resumen**: las conclusiones y el plan de acción. Es lo que contarías al cliente en cinco minutos.
3. **Keywords**: todas las búsquedas encontradas, con filtros. Úsalo para elegir y para exportar a hoja de cálculo.
4. **Oportunidades**: qué keywords atacar primero, qué temas forman y qué intención tienen.
5. **Tendencias**: en qué meses se busca, qué crece y qué cae, y cuándo publicar y lanzar campañas.
6. **Contenido**: genera el brief de cada página y audita el texto cuando esté escrito.
7. **Auditoría web**: comprueba las páginas reales del cliente y el sitio entero por su sitemap.
8. **Informe**: completa la ficha y descarga el PDF.

## Cómo leer los datos

| Dato | Qué es | Cuidado con |
|---|---|---|
| Búsquedas | Media mensual estimada de la keyword exacta en el país | Sirve para comparar keywords, no para prometer tráfico |
| Competencia | Índice de 0 a 100 % de la fuente de datos | Refleja la disputa entre anunciantes, no la dificultad orgánica |
| CPC | Coste por clic medio en Google Ads | Alto = la búsqueda tiene valor comercial |
| Puntuación | 0-100: demanda 50 %, poca competencia 35 %, CPC 15 % | Es una ayuda para ordenar, no una predicción |
| Intención | Deducida de las palabras de la keyword | «General» significa que no hay palabra que la delate |

> [!NOTE] Qué no hace
> No mide posiciones en Google, enlaces entrantes ni Core Web Vitals. Para eso siguen haciendo falta Search Console y PageSpeed Insights. Lo que sí hace es decirte qué buscar, qué escribir y qué corregir en la página.

## Las auditorías

La nota va de 0 a 100. Cada comprobación sale como **correcto**, **mejorable** o **falla**, con el dato y el umbral.

- **De texto**: extensión, keyword al principio y densidad, título y meta descripción, encabezados, legibilidad, respuestas directas (lo que citan los resúmenes con IA) y términos del estudio que cubre.
- **De página**: lo anterior sobre el contenido real, más respuesta del servidor, indexabilidad, URL canónica, adaptación a móvil, datos estructurados, enlaces internos, robots.txt, sitemap y acceso de los rastreadores de IA.

Los umbrales son buenas prácticas habituales, no reglas publicadas por Google.

### Antes de publicar

La auditoría de página también funciona con una web en desarrollo: escribe \`http://localhost:3000/pagina\` (el equipo donde corre SEO App). En local no se evalúan HTTPS ni la velocidad, y «Volver a auditar» te dice qué ha mejorado y qué ha empeorado desde la pasada anterior. Si la página se pinta con JavaScript y el HTML llega vacío, la auditoría lo señala.

### El sitio entero

En «Auditoría web», **Auditar el sitio** lee el sitemap y revisa hasta 40 páginas de una vez: rotas, redirigidas, con noindex, con títulos repetidos, sin contenido… El sitio del estudio puede ser uno en desarrollo: escribe \`localhost:3000\` o una IP de tu red (\`192.168.1.20:8080\`) en la ficha. Cada pasada se compara con la anterior.

## Tendencias y temporadas

El volumen de una keyword es una media: no dice si se busca sobre todo en diciembre. La pestaña **Tendencias** consulta Google Trends (cinco años) y responde a cuatro preguntas:

- **¿Cuándo?** El perfil del año marca la temporada alta. El calendario dice cuándo publicar (tres meses antes) y cuándo lanzar la campaña (un mes antes).
- **¿Hacia dónde?** Qué keywords crecen y cuáles pierden interés respecto al año anterior.
- **¿Qué hay de nuevo?** Las consultas en auge que el estudio no contempla: contenido nuevo y pistas de producto.
- **¿Acertamos con el público?** Qué parte de lo que más se busca alrededor está en el estudio. Si es poca, hay que revisar las keywords principales.

> [!NOTE] Límites
> El índice de Trends va de 0 a 100 por keyword: no es volumen ni sirve para comparar keywords. Google limita las consultas, así que el resultado se guarda; si se corta, «Reintentar» pide solo lo que falta. Las búsquedas muy pequeñas no tienen datos.

## Desde terminal

Todo lo que hace la interfaz se puede hacer con la orden \`seo\`:

\`\`\`bash terminal
seo new "zapatillas running, zapatillas trail" --site tienda.com --client "Deportes Sur"
seo show                 # resumen del último estudio
seo insights             # oportunidades, intención y temas
seo trends               # temporadas, tendencia y calendario
seo site                 # audita el sitio por su sitemap
seo plan                 # plan de acción
seo brief "zapatillas trail"
seo audit url https://tienda.com/zapatillas --keyword "zapatillas running" --study latest --save
seo report --format pdf --out informe.pdf
\`\`\`

Con \`--json\` la salida es JSON limpio, para scripts.

## Con agentes de IA

SEO App incluye un servidor **MCP**: un agente puede crear estudios, pedir briefs, auditar lo que escribe y generar el informe.

\`\`\`json mcp.json
{
  "mcpServers": {
    "seo-app": { "command": "node", "args": ["bin/seo.js", "mcp"], "cwd": "/ruta/a/SEO-APP" }
  }
}
\`\`\`

Un ciclo típico para un agente: \`create_study\` → \`get_insights\` → \`content_brief\` → redactar → \`audit_text\` hasta que no queden fallos → \`client_report\`.

La API REST (\`/api/seo/…\`) hace lo mismo para integraciones propias; está documentada en \`API_DOCS.md\`.
`;

export default function Guide() {
  return (
    <section className="dmx__section dmx__section--tight">
      <div className={`ui-surface ui-s ui-s--${VARIANT} surface`}>
        <Prose markdown={GUIDE} size="sm" measure="wide" variant={VARIANT} codeVariant={VARIANT} />
      </div>
    </section>
  );
}
