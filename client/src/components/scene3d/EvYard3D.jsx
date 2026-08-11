import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MassiveChargerMesh from './MassiveChargerMesh.jsx';

/** Simple pad under the charger — no canopy / tent / clouds */
function StationPad() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#3a3f48" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.15]} receiveShadow>
        <planeGeometry args={[4.2, 3.6]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[14, 32]} />
        <meshStandardMaterial color="#e5e7eb" roughness={1} />
      </mesh>
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
    identity,
    firmwareStatus,
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

  return (
    <>
      <color attach="background" args={['#eef1f5']} />
      <fog attach="fog" args={['#e8ecf1', 18, 42]} />

      <hemisphereLight args={['#ffffff', '#c4c9d2', 0.7]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        castShadow
        position={[8, 14, 8]}
        intensity={1.25}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        color="#fff8f6"
      />

      <StationPad />

      <MassiveChargerMesh
        connectors={connectors}
        activeConnector={activeConnector}
        selectedConnectors={selectedConnectors}
        online={online}
        charging={guns.some((c) => c.status === 'Charging')}
        connectionState={connectionState}
        cpId={cpId}
        identity={identity}
        firmwareStatus={firmwareStatus}
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
        minPolarAngle={0.2}
        maxPolarAngle={1.45}
        minDistance={4}
        maxDistance={18}
        target={[0, 2.4, 0]}
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
        dpr={[1, 1.5]}
        camera={{ position: [6.8, 4.6, 8.2], fov: 38 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <SceneContent {...props} />
      </Canvas>
      <div className="ev-yard-legend">
        <span>Touch the CP screen</span>
        <span>Physical keys below screen</span>
        <span>Drag orbit · scroll zoom</span>
        <span className="yard-state">
          {selectedConnectors.length > 1
            ? `Selected C${selectedConnectors.join(', C')}`
            : `${pluggedCount} plugged · ${chargingCount} charging`}
        </span>
      </div>
    </div>
  );
}
