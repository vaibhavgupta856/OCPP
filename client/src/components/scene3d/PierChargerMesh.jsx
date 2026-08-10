import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import ChargerLcdScreen from './ChargerLcdScreen.jsx';
import CanvasLabel from './CanvasLabel.jsx';

function SoftKey({
  position,
  w = 0.32,
  h = 0.15,
  color = '#e8f0ec',
  label,
  disabled,
  onClick,
  accent = false,
  danger = false,
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const zPush = pressed ? -0.014 : 0;
  const cap = danger ? '#c62828' : color;
  const labelColor = danger ? '#ffebee' : '#0a2218';

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[w + 0.045, h + 0.045, 0.03]} />
        <meshStandardMaterial color="#071a14" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh
        position={[0, 0, 0.016 + zPush]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!disabled) setHovered(true);
          document.body.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setPressed(false);
          document.body.style.cursor = 'default';
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) setPressed(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setPressed(false);
          if (!disabled) onClick?.(e);
        }}
      >
        <boxGeometry args={[w, h, 0.034]} />
        <meshStandardMaterial
          color={cap}
          emissive={
            hovered && !disabled
              ? danger
                ? '#ff1744'
                : accent
                  ? '#1f7a55'
                  : '#2a4a3a'
              : danger
                ? '#7f1010'
                : '#000'
          }
          emissiveIntensity={hovered && !disabled ? 0.35 : danger ? 0.12 : 0}
          metalness={0.15}
          roughness={0.5}
          transparent={disabled}
          opacity={disabled ? 0.4 : 1}
        />
      </mesh>
      <CanvasLabel
        text={label}
        position={[0, 0, 0.038 + zPush]}
        width={w * 0.92}
        height={Math.min(0.07, h * 0.55)}
        fontSize={44}
        color={labelColor}
      />
    </group>
  );
}

function MushroomStop({ position, disabled, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const z = pressed ? -0.01 : 0;

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.15, 0.05, 28]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh
        position={[0, 0, 0.03 + z]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!disabled) setHovered(true);
          document.body.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setPressed(false);
          document.body.style.cursor = 'default';
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) setPressed(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setPressed(false);
          if (!disabled) onClick?.(e);
        }}
      >
        <cylinderGeometry args={[0.115, 0.125, 0.06, 28]} />
        <meshStandardMaterial
          color="#c62828"
          emissive={hovered && !disabled ? '#ff1744' : '#8b0000'}
          emissiveIntensity={hovered && !disabled ? 0.5 : 0.22}
          metalness={0.25}
          roughness={0.4}
          transparent={disabled}
          opacity={disabled ? 0.4 : 1}
        />
      </mesh>
      <CanvasLabel text="E-STOP" position={[0, -0.2, 0.02]} width={0.28} height={0.05} fontSize={34} color="#ffcdd2" />
    </group>
  );
}

/**
 * Large CP cabinet — full title, touch HMI, clean physical controls
 */
export default function PierChargerMesh({
  connectors = [],
  activeConnector = 1,
  selectedConnectors = [],
  online = false,
  charging = false,
  connectionState = 'offline',
  cpId = '',
  busy = false,
  onSelectOutlet,
  onToggleSelectOutlet,
  onOutletPlug,
  onStart,
  onStop,
  onEmergency,
  onClearFault,
  onTapCard,
}) {
  const ledRef = useRef();
  const [page, setPage] = useState('home');
  const darkGreen = '#0c3328';
  const midGreen = '#126b4f';
  const deepGreen = '#071f18';
  const white = '#f2f6f4';
  const silver = '#d7dde2';

  const guns = connectors.filter((c) => c.number > 0);
  const count = Math.max(1, guns.length);
  const width = Math.max(2.85, 2.2 + count * 0.4);
  const active = guns.find((c) => c.number === activeConnector) || guns[0];
  const selectedSet = new Set(selectedConnectors.length ? selectedConnectors : [activeConnector]);
  const isTx = !!active?.transactionId;

  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const t = clock.getElapsedTime();
    ledRef.current.material.emissiveIntensity = charging
      ? 0.55 + Math.sin(t * 5.5) * 0.4
      : online
        ? 0.32
        : 0.06;
  });

  return (
    <group position={[0, 0, 0]} scale={[1.28, 1.28, 1.28]}>
      {/* Foundation */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.7, 0.24, 1.35]} />
        <meshStandardMaterial color={deepGreen} metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.08, 1.15]} />
        <meshStandardMaterial color={silver} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Main cabinet */}
      <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 2.95, 1.05]} />
        <meshStandardMaterial color={darkGreen} metalness={0.48} roughness={0.3} />
      </mesh>

      {/* White face */}
      <mesh position={[0, 1.75, 0.54]} castShadow>
        <boxGeometry args={[width - 0.16, 2.75, 0.06]} />
        <meshStandardMaterial color={white} metalness={0.1} roughness={0.4} />
      </mesh>

      {/* Side fins */}
      <mesh position={[-(width / 2 - 0.06), 1.75, 0.2]} castShadow>
        <boxGeometry args={[0.1, 2.8, 0.7]} />
        <meshStandardMaterial color={white} />
      </mesh>
      <mesh position={[width / 2 - 0.06, 1.75, 0.2]} castShadow>
        <boxGeometry args={[0.1, 2.8, 0.7]} />
        <meshStandardMaterial color={white} />
      </mesh>

      {/* Full brand title bar */}
      <mesh position={[0, 3.15, 0.58]} castShadow>
        <boxGeometry args={[Math.min(width - 0.35, 2.2), 0.16, 0.04]} />
        <meshStandardMaterial color={midGreen} emissive={midGreen} emissiveIntensity={0.28} />
      </mesh>
      <CanvasLabel
        text="PIER STATION"
        position={[0, 3.15, 0.63]}
        width={Math.min(width - 0.55, 1.85)}
        height={0.11}
        fontSize={56}
        color="#ffffff"
      />
      <mesh ref={ledRef} position={[Math.min(width / 2 - 0.28, 1.15), 3.15, 0.62]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial
          color={charging ? '#7dffb3' : online ? '#3ddc97' : '#4a6b5c'}
          emissive={charging ? '#7dffb3' : online ? '#3ddc97' : '#000'}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Touch-screen bezel + glass */}
      <mesh position={[0, 2.15, 0.57]} castShadow>
        <boxGeometry args={[1.78, 1.38, 0.06]} />
        <meshStandardMaterial color="#030d09" metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.15, 0.595]}>
        <boxGeometry args={[1.68, 1.28, 0.02]} />
        <meshStandardMaterial color="#0a1f18" metalness={0.2} roughness={0.55} />
      </mesh>
      <ChargerLcdScreen
        connector={active}
        connectors={connectors}
        connectionState={connectionState}
        cpId={cpId}
        position={[0, 2.15, 0.62]}
        size={[1.58, 1.18]}
        page={page}
        busy={busy}
        onPageChange={setPage}
        onStart={onStart}
        onStop={onStop}
        onPlug={onOutletPlug}
        onTapCard={onTapCard}
        onClearFault={onClearFault}
      />
      <CanvasLabel
        text="TOUCH SCREEN"
        position={[0, 1.48, 0.61]}
        width={0.55}
        height={0.05}
        fontSize={28}
        color="#5a7a6a"
      />

      {/* Physical backup keys (aligned, readable) */}
      <group position={[0, 1.22, 0.6]}>
        <SoftKey
          position={[-0.7, 0, 0]}
          w={0.34}
          h={0.15}
          label={active?.cablePlugged ? 'UNPLUG' : 'PLUG'}
          color="#eef6f2"
          disabled={busy}
          onClick={() => onOutletPlug?.(active?.number, !active?.cablePlugged)}
        />
        <SoftKey
          position={[-0.28, 0, 0]}
          w={0.34}
          h={0.15}
          label="START"
          color="#b6f0d2"
          accent
          disabled={busy || isTx}
          onClick={() => onStart?.(active?.number)}
        />
        <SoftKey
          position={[0.14, 0, 0]}
          w={0.34}
          h={0.15}
          label="STOP"
          color="#e8eef2"
          disabled={busy || !isTx}
          onClick={() => onStop?.(active?.number)}
        />
        <SoftKey
          position={[0.56, 0, 0]}
          w={0.34}
          h={0.15}
          label="RFID"
          color="#d4fff0"
          accent
          disabled={busy}
          onClick={() => onTapCard?.(active?.number)}
        />
      </group>

      {/* RFID reader plate */}
      <mesh
        position={[-0.45, 0.88, 0.6]}
        onClick={(e) => {
          e.stopPropagation();
          onTapCard?.(active?.number);
        }}
      >
        <boxGeometry args={[0.7, 0.26, 0.05]} />
        <meshStandardMaterial color={deepGreen} emissive="#1a5c3a" emissiveIntensity={0.28} metalness={0.3} roughness={0.45} />
      </mesh>
      <CanvasLabel text="TAP RFID / NFC" position={[-0.45, 0.88, 0.64]} width={0.62} height={0.07} fontSize={36} color="#7dffb3" />

      <SoftKey
        position={[0.45, 0.88, 0.6]}
        w={0.42}
        h={0.16}
        label="CLEAR"
        color="#ffe8a8"
        disabled={busy || active?.status !== 'Faulted'}
        onClick={() => onClearFault?.(active?.number)}
      />

      {/* E-stop + active status */}
      <MushroomStop
        position={[width / 2 - 0.42, 0.52, 0.62]}
        disabled={busy || !isTx}
        onClick={() => onEmergency?.(active?.number)}
      />
      <CanvasLabel
        text={`C${active?.number || 1} · ${active?.status || ''}`}
        position={[-width / 2 + 0.65, 0.52, 0.6]}
        width={0.7}
        height={0.07}
        fontSize={32}
        color="#a8e6cf"
      />

      {/* Holsters */}
      {guns.map((c, idx) => {
        const spread =
          count === 1 ? 0 : (idx - (count - 1) / 2) * Math.min(0.75, (width - 1.0) / Math.max(count - 1, 1));
        const selected = selectedSet.has(c.number);
        const focused = c.number === activeConnector;
        const plugged = !!c.cablePlugged;
        const isCharging = c.status === 'Charging';
        return (
          <group key={c.number} position={[spread, 0.42, 0.72]}>
            <mesh position={[0, 0.16, -0.08]} castShadow>
              <boxGeometry args={[0.34, 0.48, 0.2]} />
              <meshStandardMaterial color={midGreen} metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh
              castShadow
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey || e.ctrlKey || e.metaKey) onToggleSelectOutlet?.(c.number);
                else onSelectOutlet?.(c.number);
              }}
              onContextMenu={(e) => {
                e.stopPropagation();
                e.nativeEvent?.preventDefault?.();
                onToggleSelectOutlet?.(c.number);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOutletPlug?.(c.number, !plugged);
              }}
            >
              <cylinderGeometry args={[0.1, 0.115, 0.34, 18]} />
              <meshStandardMaterial
                color={focused ? white : selected ? '#a8e6cf' : '#1a4a3a'}
                emissive={isCharging ? '#7dffb3' : selected ? '#2a6b48' : '#000'}
                emissiveIntensity={isCharging ? 0.6 : selected ? 0.28 : 0}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, -0.26, 0.08]} rotation={[1.1, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.045, 0.26, 12]} />
              <meshStandardMaterial color={plugged ? '#7dffb3' : silver} metalness={0.55} />
            </mesh>
            <CanvasLabel text={`C${c.number}`} position={[0, -0.45, 0.12]} width={0.2} height={0.05} fontSize={40} color={white} />
            <CanvasLabel text={`${c.powerKw} kW`} position={[0, -0.53, 0.12]} width={0.24} height={0.04} fontSize={28} color="#a8e6cf" />
          </group>
        );
      })}

      {/* Vents */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -width / 2 + 0.35 + i * ((width - 0.7) / 5);
        return (
          <mesh key={i} position={[x, 3.3, 0.05]}>
            <boxGeometry args={[0.16, 0.06, 0.7]} />
            <meshStandardMaterial color={deepGreen} />
          </mesh>
        );
      })}
    </group>
  );
}
