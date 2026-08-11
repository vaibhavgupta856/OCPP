import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ChargerLcdScreen from './ChargerLcdScreen.jsx';
import CanvasLabel from './CanvasLabel.jsx';

function makeKeyTexture(label, {
  fill = '#e8f0ec',
  text = '#1a1012',
  disabled = false,
} = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = disabled ? '#6a7a72' : fill;
  ctx.fillRect(0, 0, c.width, c.height);

  // soft inner edge
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

  const title = String(label ?? '');
  let size = 92;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `800 ${size}px system-ui, Segoe UI, Arial, sans-serif`;
    if (ctx.measureText(title).width <= c.width * 0.86 || size <= 36) break;
    size -= 4;
  } while (size > 36);

  ctx.fillStyle = disabled ? 'rgba(10,34,24,0.35)' : text;
  ctx.fillText(title, c.width / 2, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function SoftKey({
  position,
  w = 0.38,
  h = 0.18,
  color = '#e8f0ec',
  label,
  disabled,
  onClick,
  accent = false,
  danger = false,
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const zPush = pressed ? -0.012 : 0;
  const fill = danger ? '#c62828' : color;
  const textColor = danger ? '#ffffff' : '#1a1012';

  const texture = useMemo(
    () => makeKeyTexture(label, { fill, text: textColor, disabled: !!disabled }),
    [label, fill, textColor, disabled]
  );

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.014]}>
        <boxGeometry args={[w + 0.05, h + 0.05, 0.032]} />
        <meshStandardMaterial color="#12151a" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh
        position={[0, 0, 0.012 + zPush]}
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
        <boxGeometry args={[w, h, 0.036]} />
        <meshStandardMaterial
          color={fill}
          emissive={
            hovered && !disabled
              ? danger
                ? '#ff1744'
                : accent
                  ? '#c02434'
                  : '#6b7280'
              : danger
                ? '#7f1010'
                : '#000000'
          }
          emissiveIntensity={hovered && !disabled ? 0.28 : danger ? 0.1 : 0}
          metalness={0.08}
          roughness={0.55}
          transparent={disabled}
          opacity={disabled ? 0.55 : 1}
        />
      </mesh>
      {/* Label on front face only — always readable */}
      <mesh position={[0, 0, 0.034 + zPush]} renderOrder={2}>
        <planeGeometry args={[w * 0.94, h * 0.82]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
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

function RfidPad({ position, disabled, onClick }) {
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(
    () =>
      makeKeyTexture('TAP RFID / NFC', {
        fill: '#3a1a22',
        text: '#ffb3bb',
        disabled: !!disabled,
      }),
    [disabled]
  );

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[1.35, 0.42, 0.05]} />
        <meshStandardMaterial color="#1a1012" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, 0, 0.02]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick?.(e);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!disabled) setHovered(true);
          document.body.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={[1.22, 0.34, 0.04]} />
        <meshStandardMaterial
          color="#3a1a22"
          emissive={hovered && !disabled ? '#c02434' : '#9b1c2a'}
          emissiveIntensity={hovered && !disabled ? 0.45 : 0.25}
          metalness={0.25}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0, 0.045]} renderOrder={3}>
        <planeGeometry args={[1.12, 0.28]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Large CP cabinet — full title, touch HMI, clean physical controls
 */
export default function MassiveChargerMesh({
  connectors = [],
  activeConnector = 1,
  selectedConnectors = [],
  online = false,
  charging = false,
  connectionState = 'offline',
  cpId = '',
  identity = null,
  firmwareStatus = 'Idle',
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
  const cabinet = '#2b3038';
  const accent = '#c02434';
  const deep = '#171a1f';
  const white = '#f7f8fa';
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
    <group position={[0, 0, 0]} scale={[1.72, 1.72, 1.72]}>
      {/* Foundation */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.7, 0.24, 1.35]} />
        <meshStandardMaterial color={deep} metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.08, 1.15]} />
        <meshStandardMaterial color={silver} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Main cabinet */}
      <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 2.95, 1.05]} />
        <meshStandardMaterial color={cabinet} metalness={0.48} roughness={0.3} />
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
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.28} />
      </mesh>
      <CanvasLabel
        text="MASSIVE STATION"
        position={[0, 3.15, 0.63]}
        width={Math.min(width - 0.55, 1.85)}
        height={0.11}
        fontSize={56}
        color="#ffffff"
      />
      <mesh ref={ledRef} position={[Math.min(width / 2 - 0.28, 1.15), 3.15, 0.62]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial
          color={charging ? '#ffb3bb' : online ? '#c02434' : '#6b7280'}
          emissive={charging ? '#ffb3bb' : online ? '#c02434' : '#000'}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Touch-screen bezel + glass — large for visibility */}
      <mesh position={[0, 2.2, 0.57]} castShadow>
        <boxGeometry args={[2.05, 1.55, 0.06]} />
        <meshStandardMaterial color="#12151a" metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.2, 0.595]}>
        <boxGeometry args={[1.94, 1.44, 0.02]} />
        <meshStandardMaterial color="#1a1012" metalness={0.2} roughness={0.55} />
      </mesh>
      <ChargerLcdScreen
        connector={active}
        connectors={connectors}
        connectionState={connectionState}
        cpId={cpId}
        identity={identity}
        firmwareStatus={firmwareStatus}
        position={[0, 2.2, 0.62]}
        size={[1.84, 1.34]}
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
        position={[0, 1.45, 0.63]}
        width={0.55}
        height={0.05}
        fontSize={28}
        color="#5a7a6a"
      />

      {/* Physical keys — equal size, all readable */}
      <group position={[0, 1.18, 0.64]}>
        <SoftKey
          position={[-0.72, 0, 0]}
          w={0.42}
          h={0.2}
          label={active?.cablePlugged ? 'UNPLUG' : 'PLUG'}
          color="#eef6f2"
          disabled={busy}
          onClick={() => onOutletPlug?.(active?.number, !active?.cablePlugged)}
        />
        <SoftKey
          position={[-0.24, 0, 0]}
          w={0.42}
          h={0.2}
          label="START"
          color="#b6f0d2"
          accent
          disabled={busy || isTx}
          onClick={() => onStart?.(active?.number)}
        />
        <SoftKey
          position={[0.24, 0, 0]}
          w={0.42}
          h={0.2}
          label="STOP"
          color="#e8eef2"
          disabled={busy || !isTx}
          onClick={() => onStop?.(active?.number)}
        />
        <SoftKey
          position={[0.72, 0, 0]}
          w={0.42}
          h={0.2}
          label="CLEAR"
          color="#ffe8a8"
          disabled={busy || active?.status !== 'Faulted'}
          onClick={() => onClearFault?.(active?.number)}
        />
      </group>

      {/* Dedicated large RFID pad — clear of keys and holsters */}
      <RfidPad
        position={[0, 0.82, 0.64]}
        disabled={busy}
        onClick={() => onTapCard?.(active?.number)}
      />

      {/* E-stop + active status */}
      <MushroomStop
        position={[width / 2 - 0.42, 0.38, 0.64]}
        disabled={busy || !isTx}
        onClick={() => onEmergency?.(active?.number)}
      />
      <CanvasLabel
        text={`C${active?.number || 1} · ${active?.status || ''}`}
        position={[-width / 2 + 0.65, 0.38, 0.64]}
        width={0.7}
        height={0.07}
        fontSize={32}
        color="#e8a3aa"
      />

      {/* Holsters lower so they don't cover RFID */}
      {guns.map((c, idx) => {
        const spread =
          count === 1 ? 0 : (idx - (count - 1) / 2) * Math.min(0.75, (width - 1.0) / Math.max(count - 1, 1));
        const selected = selectedSet.has(c.number);
        const focused = c.number === activeConnector;
        const plugged = !!c.cablePlugged;
        const isCharging = c.status === 'Charging';
        return (
          <group key={c.number} position={[spread, 0.22, 0.72]}>
            <mesh position={[0, 0.14, -0.08]} castShadow>
              <boxGeometry args={[0.34, 0.42, 0.2]} />
              <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
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
              <cylinderGeometry args={[0.1, 0.115, 0.3, 18]} />
              <meshStandardMaterial
                color={focused ? white : selected ? '#e8a3aa' : '#3a1f24'}
                emissive={isCharging ? '#ffb3bb' : selected ? '#c02434' : '#000'}
                emissiveIntensity={isCharging ? 0.6 : selected ? 0.28 : 0}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, -0.22, 0.08]} rotation={[1.1, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.045, 0.22, 12]} />
              <meshStandardMaterial color={plugged ? '#ffb3bb' : silver} metalness={0.55} />
            </mesh>
            <CanvasLabel text={`C${c.number}`} position={[0, -0.4, 0.12]} width={0.2} height={0.05} fontSize={40} color={white} />
            <CanvasLabel text={`${c.powerKw} kW`} position={[0, -0.48, 0.12]} width={0.24} height={0.04} fontSize={28} color="#e8a3aa" />
          </group>
        );
      })}

      {/* Vents */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -width / 2 + 0.35 + i * ((width - 0.7) / 5);
        return (
          <mesh key={i} position={[x, 3.3, 0.05]}>
            <boxGeometry args={[0.16, 0.06, 0.7]} />
            <meshStandardMaterial color={deep} />
          </mesh>
        );
      })}
    </group>
  );
}
