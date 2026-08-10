import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import ChargerLcdScreen from './ChargerLcdScreen.jsx';
import CanvasLabel from './CanvasLabel.jsx';

function SoftKey({
  position,
  w = 0.28,
  h = 0.14,
  color = '#dfe8e3',
  label,
  disabled,
  onClick,
  accent = false,
  danger = false,
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const zPush = pressed ? -0.012 : 0;
  const cap = danger ? '#c62828' : color;
  const labelColor = danger ? '#ffebee' : '#0a2218';

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[w + 0.04, h + 0.04, 0.025]} />
        <meshStandardMaterial color="#061610" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh
        position={[0, 0, 0.014 + zPush]}
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
        <boxGeometry args={[w, h, 0.032]} />
        <meshStandardMaterial
          color={cap}
          emissive={hovered && !disabled ? (danger ? '#ff1744' : accent ? '#1f7a55' : '#2a4a3a') : danger ? '#7f1010' : '#000'}
          emissiveIntensity={hovered && !disabled ? 0.35 : danger ? 0.12 : 0}
          metalness={0.18}
          roughness={0.48}
          transparent={disabled}
          opacity={disabled ? 0.4 : 1}
        />
      </mesh>
      <CanvasLabel
        text={label}
        position={[0, 0, 0.035 + zPush]}
        width={w * 0.9}
        height={0.055}
        fontSize={36}
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
        <cylinderGeometry args={[0.13, 0.14, 0.05, 28]} />
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
        <cylinderGeometry args={[0.11, 0.12, 0.06, 28]} />
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
      <CanvasLabel text="E-STOP" position={[0, -0.18, 0.02]} width={0.22} height={0.04} fontSize={30} color="#ffcdd2" />
    </group>
  );
}

/**
 * Large DC charge point cabinet — big HMI + real operator controls
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
  const width = Math.max(2.6, 2.1 + count * 0.35);
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
    <group position={[0, 0, 0]} scale={[1.35, 1.35, 1.35]}>
      {/* Foundation */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.7, 0.24, 1.35]} />
        <meshStandardMaterial color={deepGreen} metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.08, 1.15]} />
        <meshStandardMaterial color={silver} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Main cabinet body */}
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 2.85, 1.05]} />
        <meshStandardMaterial color={darkGreen} metalness={0.48} roughness={0.3} />
      </mesh>

      {/* White face plate */}
      <mesh position={[0, 1.7, 0.54]} castShadow>
        <boxGeometry args={[width - 0.18, 2.65, 0.06]} />
        <meshStandardMaterial color={white} metalness={0.1} roughness={0.4} />
      </mesh>

      {/* Side accent fins */}
      <mesh position={[-(width / 2 - 0.06), 1.7, 0.2]} castShadow>
        <boxGeometry args={[0.1, 2.7, 0.7]} />
        <meshStandardMaterial color={white} />
      </mesh>
      <mesh position={[width / 2 - 0.06, 1.7, 0.2]} castShadow>
        <boxGeometry args={[0.1, 2.7, 0.7]} />
        <meshStandardMaterial color={white} />
      </mesh>

      {/* Brand + status LED */}
      <mesh position={[0, 3.05, 0.58]}>
        <boxGeometry args={[Math.min(1.4, width - 0.5), 0.1, 0.03]} />
        <meshStandardMaterial color={midGreen} emissive={midGreen} emissiveIntensity={0.25} />
      </mesh>
      <CanvasLabel text="PIER STATION" position={[0, 3.05, 0.62]} width={0.95} height={0.08} fontSize={46} color={white} />
      <mesh ref={ledRef} position={[Math.min(0.85, width / 2 - 0.35), 3.05, 0.6]}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial
          color={charging ? '#7dffb3' : online ? '#3ddc97' : '#4a6b5c'}
          emissive={charging ? '#7dffb3' : online ? '#3ddc97' : '#000'}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Screen bezel + big HMI */}
      <mesh position={[0, 2.2, 0.575]} castShadow>
        <boxGeometry args={[1.55, 1.15, 0.05]} />
        <meshStandardMaterial color="#04140c" metalness={0.4} roughness={0.35} />
      </mesh>
      <ChargerLcdScreen
        connector={active}
        connectors={connectors}
        connectionState={connectionState}
        cpId={cpId}
        position={[0, 2.2, 0.61]}
        size={[1.42, 1.0]}
        page={page}
        onPageChange={setPage}
      />

      {/* Screen-edge soft menu keys (real CP style) */}
      <group position={[0, 1.55, 0.6]}>
        <SoftKey position={[-0.72, 0, 0]} w={0.26} h={0.12} label="HOME" color="#e8f5ef" disabled={busy} onClick={() => setPage('home')} />
        <SoftKey position={[-0.42, 0, 0]} w={0.26} h={0.12} label="SESSION" color="#e8f5ef" disabled={busy} onClick={() => setPage('session')} />
        <SoftKey position={[-0.12, 0, 0]} w={0.26} h={0.12} label="OUTLETS" color="#e8f5ef" disabled={busy} onClick={() => setPage('connectors')} />
        <SoftKey position={[0.18, 0, 0]} w={0.26} h={0.12} label="HELP" color="#e8f5ef" disabled={busy} onClick={() => setPage('help')} />
        <SoftKey position={[0.48, 0, 0]} w={0.26} h={0.12} label="INFO" color="#d4fff0" accent disabled={busy} onClick={() => setPage('session')} />
        <SoftKey position={[0.78, 0, 0]} w={0.26} h={0.12} label="LANG" color="#e8f5ef" disabled={busy} onClick={() => setPage('home')} />
      </group>

      {/* Primary charge controls */}
      <group position={[0, 1.28, 0.6]}>
        <SoftKey
          position={[-0.72, 0, 0]}
          w={0.3}
          h={0.14}
          label={active?.cablePlugged ? 'UNPLUG' : 'PLUG'}
          color="#eef6f2"
          disabled={busy}
          onClick={() => onOutletPlug?.(active?.number, !active?.cablePlugged)}
        />
        <SoftKey
          position={[-0.36, 0, 0]}
          w={0.3}
          h={0.14}
          label="START"
          color="#b6f0d2"
          accent
          disabled={busy || isTx}
          onClick={() => onStart?.(active?.number)}
        />
        <SoftKey
          position={[0, 0, 0]}
          w={0.3}
          h={0.14}
          label="STOP"
          color="#e8eef2"
          disabled={busy || !isTx}
          onClick={() => onStop?.(active?.number)}
        />
        <SoftKey
          position={[0.36, 0, 0]}
          w={0.3}
          h={0.14}
          label="CARD"
          color="#d4fff0"
          accent
          disabled={busy}
          onClick={() => onTapCard?.(active?.number)}
        />
        <SoftKey
          position={[0.72, 0, 0]}
          w={0.3}
          h={0.14}
          label="CLEAR"
          color="#ffe8a8"
          disabled={busy || active?.status !== 'Faulted'}
          onClick={() => onClearFault?.(active?.number)}
        />
      </group>

      {/* RFID + payment / QR + accessibility row */}
      <group position={[0, 0.95, 0.6]}>
        <mesh
          position={[-0.55, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onTapCard?.(active?.number);
          }}
        >
          <boxGeometry args={[0.55, 0.28, 0.05]} />
          <meshStandardMaterial color={deepGreen} emissive="#1a5c3a" emissiveIntensity={0.28} metalness={0.3} roughness={0.45} />
        </mesh>
        <CanvasLabel text="TAP RFID / NFC" position={[-0.55, 0, 0.04]} width={0.48} height={0.06} fontSize={32} color="#7dffb3" />

        <mesh position={[0.1, 0, 0]}>
          <boxGeometry args={[0.5, 0.28, 0.05]} />
          <meshStandardMaterial color="#102820" metalness={0.35} roughness={0.4} />
        </mesh>
        <CanvasLabel text="QR / PAY" position={[0.1, 0, 0.04]} width={0.4} height={0.055} fontSize={30} color="#b8ffd8" />

        <SoftKey
          position={[0.7, 0, 0]}
          w={0.36}
          h={0.16}
          label="ACCESS"
          color="#cfd8dc"
          disabled={busy}
          onClick={() => setPage('help')}
        />
      </group>

      {/* Emergency stop */}
      <MushroomStop
        position={[width / 2 - 0.45, 0.55, 0.62]}
        disabled={busy || !isTx}
        onClick={() => onEmergency?.(active?.number)}
      />
      <CanvasLabel
        text={`C${active?.number || 1} ${active?.status || ''}`}
        position={[-width / 2 + 0.55, 0.55, 0.6]}
        width={0.55}
        height={0.06}
        fontSize={30}
        color="#a8e6cf"
      />

      {/* Connector holsters along lower face */}
      {guns.map((c, idx) => {
        const spread =
          count === 1 ? 0 : (idx - (count - 1) / 2) * Math.min(0.7, (width - 0.9) / Math.max(count - 1, 1));
        const selected = selectedSet.has(c.number);
        const focused = c.number === activeConnector;
        const plugged = !!c.cablePlugged;
        const isCharging = c.status === 'Charging';
        return (
          <group key={c.number} position={[spread, 0.55, 0.72]}>
            <mesh position={[0, 0.18, -0.08]} castShadow>
              <boxGeometry args={[0.36, 0.55, 0.22]} />
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
              <cylinderGeometry args={[0.11, 0.125, 0.36, 18]} />
              <meshStandardMaterial
                color={focused ? white : selected ? '#a8e6cf' : '#1a4a3a'}
                emissive={isCharging ? '#7dffb3' : selected ? '#2a6b48' : '#000'}
                emissiveIntensity={isCharging ? 0.6 : selected ? 0.28 : 0}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, -0.28, 0.08]} rotation={[1.1, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.05, 0.28, 12]} />
              <meshStandardMaterial color={plugged ? '#7dffb3' : silver} metalness={0.55} />
            </mesh>
            <CanvasLabel text={`C${c.number}`} position={[0, -0.48, 0.12]} width={0.18} height={0.05} fontSize={40} color={white} />
            <CanvasLabel text={`${c.powerKw} kW`} position={[0, -0.56, 0.12]} width={0.22} height={0.04} fontSize={28} color="#a8e6cf" />
          </group>
        );
      })}

      {/* Top vents */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -width / 2 + 0.35 + i * ((width - 0.7) / 5);
        return (
          <mesh key={i} position={[x, 3.2, 0.05]}>
            <boxGeometry args={[0.16, 0.06, 0.7]} />
            <meshStandardMaterial color={deepGreen} />
          </mesh>
        );
      })}
    </group>
  );
}
