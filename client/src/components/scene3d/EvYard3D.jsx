import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import PierChargerMesh from './PierChargerMesh.jsx';

function StationPad({ bayCount = 1 }) {
  const w = Math.max(10, bayCount * 1.2 + 8);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, 12]} />
        <meshStandardMaterial color="#2c3036" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[Math.max(4.5, bayCount * 0.8 + 3.5), 3.2]} />
        <meshStandardMaterial color="#5c636a" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <circleGeometry args={[24, 32]} />
        <meshStandardMaterial color="#3f6b3f" roughness={1} />
      </mesh>
    </group>
  );
}

function Canopy({ bayCount = 1 }) {
  const w = Math.max(9, bayCount * 1.2 + 7);
  return (
    <group>
      <mesh position={[0, 5.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.14, 6]} />
        <meshStandardMaterial color="#eef3f6" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.95, 0]}>
        <boxGeometry args={[w - 0.4, 0.1, 5.6]} />
        <meshStandardMaterial color="#0c3328" metalness={0.25} roughness={0.45} />
      </mesh>
      {[
        [-w / 2 + 0.45, 2.45, -2.2],
        [w / 2 - 0.45, 2.45, -2.2],
        [-w / 2 + 0.45, 2.45, 2.2],
        [w / 2 - 0.45, 2.45, 2.2],
      ].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 5.0, 10]} />
          <meshStandardMaterial color="#cfd6dc" metalness={0.65} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function SimpleClouds() {
  const puffs = [
    [-8, 11, -14, 3.2, 0.7],
    [7, 12, -18, 4.0, 0.85],
    [14, 10, 2, 2.8, 0.65],
  ];
  return (
    <group>
      {puffs.map(([x, y, z, sx, sy], i) => (
        <mesh key={i} position={[x, y, z]} scale={[sx, sy, 1.2]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent(props) {
  const {
    connectors,
    activeConnector,
    selectedConnectors,
    online,
    connectionState,
    cpId,
    busy,
    onSelectOutlet,
    onToggleSelectOutlet,
    onOutletPlug,
    onStart,
    onStop,
    onEmergency,
    onClearFault,
    onTapCard,
  } = props;

  const guns = useMemo(() => connectors.filter((c) => c.number > 0), [connectors]);
  const bayCount = guns.length || 1;

  return (
    <>
      <color attach="background" args={['#87b7d9']} />
      <fog attach="fog" args={['#c5d8e8', 22, 52]} />

      <Sky
        distance={450000}
        sunPosition={[28, 22, 16]}
        inclination={0.48}
        azimuth={0.18}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        rayleigh={1.2}
        turbidity={2.5}
      />
      <mesh position={[28, 22, 16]}>
        <sphereGeometry args={[2.0, 12, 12]} />
        <meshBasicMaterial color="#ffe9a8" toneMapped={false} />
      </mesh>
      <SimpleClouds />

      <hemisphereLight args={['#eaf4ff', '#4a5c3a', 0.7]} />
      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        position={[14, 18, 10]}
        intensity={1.45}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={40}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        color="#fff3d6"
      />

      <StationPad bayCount={bayCount} />
      <Canopy bayCount={bayCount} />

      <PierChargerMesh
        connectors={connectors}
        activeConnector={activeConnector}
        selectedConnectors={selectedConnectors}
        online={online}
        charging={guns.some((c) => c.status === 'Charging')}
        connectionState={connectionState}
        cpId={cpId}
        busy={busy}
        onSelectOutlet={onSelectOutlet}
        onToggleSelectOutlet={onToggleSelectOutlet}
        onOutletPlug={onOutletPlug}
        onStart={onStart}
        onStop={onStop}
        onEmergency={onEmergency}
        onClearFault={onClearFault}
        onTapCard={onTapCard}
      />

      <OrbitControls
        makeDefault
        enablePan
        minPolarAngle={0.15}
        maxPolarAngle={1.4}
        minDistance={3.5}
        maxDistance={18}
        target={[0, 1.8, 0]}
      />
    </>
  );
}

export default function EvYard3D(props) {
  const { selectedConnectors = [], connectors = [] } = props;
  const guns = connectors.filter((c) => c.number > 0);
  const pluggedCount = guns.filter((c) => c.cablePlugged).length;
  const chargingCount = guns.filter((c) => c.status === 'Charging').length;

  return (
    <div className="ev-yard-3d roomy">
      <Canvas
        shadows
        dpr={[1, 1.25]}
        camera={{ position: [5.2, 3.6, 6.8], fov: 36 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <SceneContent {...props} />
      </Canvas>
      <div className="ev-yard-legend">
        <span>Drag orbit · scroll zoom</span>
        <span>Big screen + soft-keys on CP</span>
        <span>Click screen to cycle pages</span>
        <span className="yard-state">
          {selectedConnectors.length > 1
            ? `Selected C${selectedConnectors.join(', C')}`
            : `${pluggedCount} plugged · ${chargingCount} charging`}
        </span>
      </div>
    </div>
  );
}
