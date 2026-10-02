import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import RetroCanvas from 'trama-ui/RetroCanvas';

// Fondo persistente de la app: una sola escena 3D con el filtro ASCII de puntos de trama-ui. Va en su propio
// chunk (three.js pesa) y se carga después del contenido. Las figuras son propias de esta app, una por vista,
// en lugar de las de `RetroShapes`.

const material = <meshStandardMaterial color="#ffffff" roughness={0.65} metalness={0.05} flatShading />;

// Gira despacio el grupo que envuelve: el fondo acompaña, no llama la atención
function Spin({ speed = 0.12, tilt = [0, 0, 0], sway = 0, children }) {
  const group = useRef(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!group.current) return;
    group.current.rotation.y = sway ? Math.sin(t * speed * 2) * sway : t * speed;
  });
  return (
    <group rotation={tilt}>
      <group ref={group}>{children}</group>
    </group>
  );
}

// Inicio: planeta facetado con anillos y una luna
function Planet() {
  return (
    <Spin speed={0.1} tilt={[0.42, 0, -0.3]}>
      <mesh>
        <icosahedronGeometry args={[1.25, 2]} />
        {material}
      </mesh>
      {[[1.75, 2.0], [2.12, 2.5]].map(([inner, outer]) => (
        <mesh key={inner} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[inner, outer, 96]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} side={2} />
        </mesh>
      ))}
      <mesh position={[3.05, 0.25, 0]}>
        <icosahedronGeometry args={[0.22, 1]} />
        {material}
      </mesh>
    </Spin>
  );
}

// Detalle de un reporte: una lupa, el icono de búsqueda
function Magnifier() {
  return (
    <Spin speed={0.22} sway={0.7} tilt={[0.15, 0, 0.5]}>
      <mesh position={[0, 0.55, 0]}>
        <torusGeometry args={[1.15, 0.17, 12, 64]} />
        {material}
      </mesh>
      <mesh position={[0, -1.55, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 1.7, 14]} />
        {material}
      </mesh>
    </Spin>
  );
}

// Análisis gráfico: barras de un gráfico sobre su base
const BARS = [0.7, 1.3, 0.95, 1.9, 1.5, 2.5];
function Bars() {
  return (
    <Spin speed={0.18} sway={0.5} tilt={[0.3, 0.5, 0]}>
      <group position={[0, -1.2, 0]}>
        {BARS.map((height, index) => (
          <mesh key={index} position={[(index - (BARS.length - 1) / 2) * 0.62, height / 2, 0]}>
            <boxGeometry args={[0.42, height, 0.42]} />
            {material}
          </mesh>
        ))}
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[BARS.length * 0.62 + 0.3, 0.1, 0.9]} />
          {material}
        </mesh>
      </group>
    </Spin>
  );
}

// Página no encontrada: el globo de meridianos y paralelos del icono «web»
function WebGlobe() {
  return (
    <Spin speed={0.15} tilt={[0.25, 0, 0.2]}>
      {[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle) => (
        <mesh key={angle} rotation={[0, angle, 0]}>
          <torusGeometry args={[1.5, 0.05, 8, 72]} />
          {material}
        </mesh>
      ))}
      {[[0, 1.5], [0.85, 1.24], [-0.85, 1.24]].map(([y, radius]) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.05, 8, 72]} />
          {material}
        </mesh>
      ))}
    </Spin>
  );
}

// Estrategia: una diana
function Target() {
  return (
    <Spin speed={0.2} sway={0.6} tilt={[0.1, 0, 0]}>
      {[0.5, 1.05, 1.6].map((radius) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, 0.1, 10, 64]} />
          {material}
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.18, 12, 12]} />
        {material}
      </mesh>
    </Spin>
  );
}

// Auditoría de textos: una hoja con sus renglones
const LINES = [0.95, 0.55, 0.15, -0.25, -0.65];
function Page() {
  return (
    <Spin speed={0.2} sway={0.55} tilt={[0.12, 0, -0.08]}>
      <mesh>
        <boxGeometry args={[2.3, 3.1, 0.08]} />
        {material}
      </mesh>
      {LINES.map((y, index) => (
        <mesh key={y} position={[index === LINES.length - 1 ? -0.35 : 0, y, 0.1]}>
          <boxGeometry args={[index === LINES.length - 1 ? 1.1 : 1.8, 0.14, 0.12]} />
          {material}
        </mesh>
      ))}
    </Spin>
  );
}

const MODELS = { planet: Planet, magnifier: Magnifier, bars: Bars, web: WebGlobe, target: Target, page: Page };

// En el tema claro se suavizan scanlines y viñeta: sobre papel oscurecen la página en vez de darle profundidad.
export default function Backdrop({ model, ramp, offset, dark }) {
  const Model = MODELS[model] || WebGlobe;

  return (
    <RetroCanvas mode="ascii" ramp={ramp} cellSize={7} cellAspect={1.4} scanlines={dark ? 0.3 : 0.08} vignette={dark ? 0.5 : 0.06} glow={0} flicker={0} fov={35} cameraZ={9}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, -2, 2]} intensity={0.5} />
      <group position={offset} scale={0.8}>
        <Model />
      </group>
    </RetroCanvas>
  );
}
