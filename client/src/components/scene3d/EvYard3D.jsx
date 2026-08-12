import { Component, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MassiveChargerMesh from './MassiveChargerMesh.jsx';

/** Front-facing framing — full pedestal + guns visible, HMI still readable */
const FRONT_CAM = [0, 1.15, 6.9];
const FRONT_TARGET = [0, 2.2, 0];

function FrontFacingCamera() {
  const { camera, controls, gl } = useThree();
  useEffect(() => {
    camera.position.set(...FRONT_CAM);
    camera.near = 0.1;
    camera.far = 80;
    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.lookAt(...FRONT_TARGET);
    gl.domElement.style.cursor = 'default';
    if (controls) {
      controls.target.set(...FRONT_TARGET);
      controls.minDistance = 5;
      controls.maxDistance = 13;
      controls.update();
    }
  }, [camera, controls, gl]);
  return null;
}

/** If HDR env fails/suspends oddly, keep the charger visible */
class EnvGuard extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* ignore — fall back to lights-only */
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** Simple pad under the charger — no canopy / tent / clouds */
function StationPad() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#3a3f48" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.15]} receiveShadow>
        <planeGeometry args={[3.2, 2.8]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[14, 32]} />
        <meshStandardMaterial color="#e5e7eb" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

function SceneLights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#a8b0bd', 0.45]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        castShadow
        position={[7.5, 13, 6.5]}
        intensity={2.05}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={24}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0002}
        color="#fff8f2"
      />
      <directionalLight position={[-7, 6, -5]} intensity={0.9} color="#e8f0ff" />
      <directionalLight position={[0, 8, 10]} intensity={0.75} color="#ffffff" />
      <spotLight
        position={[1.5, 9, 7]}
        angle={0.38}
        penumbra={0.45}
        intensity={1.35}
        color="#ffffff"
        castShadow={false}
      />
    </>
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
    hardware,
    tariff,
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
      <color attach="background" args={['#e8ecf2']} />
      <fog attach="fog" args={['#e4e8ef', 20, 48]} />

      <SceneLights />

      {/* Environment HDR is optional — never unmount the charger if it fails */}
      <EnvGuard>
        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>
      </EnvGuard>

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
        hardware={hardware}
        tariff={tariff}
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

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.22}
        scale={12}
        blur={2.2}
        far={6}
        resolution={128}
        frames={1}
        color="#1a1f28"
      />

      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.16}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        panSpeed={0.65}
        minPolarAngle={0.25}
        maxPolarAngle={1.45}
        minDistance={5}
        maxDistance={13}
        target={FRONT_TARGET}
      />
      <FrontFacingCamera />
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
        performance={{ min: 0.5 }}
        camera={{ position: FRONT_CAM, fov: 42, near: 0.5, far: 40 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.22,
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#e8ecf2');
          gl.domElement.style.cursor = 'default';
          gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
          camera.lookAt(...FRONT_TARGET);
        }}
      >
        <SceneContent {...props} />
      </Canvas>
      <div className="ev-yard-legend">
        <span>Hover the HMI for a larger readout</span>
        <span>Guns on the sides · double-click to plug</span>
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
