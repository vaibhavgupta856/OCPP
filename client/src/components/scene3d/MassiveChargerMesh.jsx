import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ChargerLcdScreen from './ChargerLcdScreen.jsx';
import CanvasLabel from './CanvasLabel.jsx';

/** Procedural brushed / powder-coat maps for shinier realistic panels */
function makeSurfaceMaps({
  base = '#2b3038',
  style = 'brushed', // brushed | paint | chrome | plastic
  size = 512,
} = {}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (style === 'brushed') {
    for (let y = 0; y < size; y += 1) {
      const a = 0.035 + Math.random() * 0.05;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random() * 1.5);
      ctx.lineTo(size, y + Math.random() * 1.5);
      ctx.stroke();
      if (y % 7 === 0) {
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    }
  } else if (style === 'paint') {
    for (let i = 0; i < 1800; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.4 + Math.random() * 1.8;
      ctx.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // soft vignette / panel wear
    const g = ctx.createRadialGradient(size * 0.45, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (style === 'chrome') {
    for (let y = 0; y < size; y += 2) {
      const shade = 180 + Math.floor(Math.sin(y * 0.08) * 40 + Math.random() * 20);
      ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 8})`;
      ctx.fillRect(0, y, size, 2);
    }
  } else {
    // plastic
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  // Roughness variation map (darker = glossier in Three.js)
  const rc = document.createElement('canvas');
  rc.width = size;
  rc.height = size;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = style === 'chrome' ? '#101010' : style === 'paint' ? '#2a2a2a' : '#242424';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i += 1) {
    const v = style === 'chrome' ? 8 + Math.random() * 28 : 28 + Math.random() * 40;
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }
  if (style === 'brushed') {
    for (let y = 0; y < size; y += 3) {
      const v = 18 + Math.random() * 36;
      rctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      rctx.fillRect(0, y, size, 1);
    }
  }
  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 4;
  roughnessMap.needsUpdate = true;

  return { map, roughnessMap };
}

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
        <meshStandardMaterial color="#12151a" metalness={0.85} roughness={0.28} envMapIntensity={1.8} />
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
        <meshPhysicalMaterial
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
          metalness={0.35}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1.55}
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
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.22} envMapIntensity={1.85} />
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
        <meshPhysicalMaterial
          color="#c62828"
          emissive={hovered && !disabled ? '#ff1744' : '#8b0000'}
          emissiveIntensity={hovered && !disabled ? 0.5 : 0.22}
          metalness={0.45}
          roughness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.7}
          transparent={disabled}
          opacity={disabled ? 0.4 : 1}
        />
      </mesh>
      <CanvasLabel text="E-STOP" position={[0, -0.2, 0.02]} width={0.28} height={0.05} fontSize={34} color="#ffcdd2" />
    </group>
  );
}

function RfidPad({ position, disabled, onClick, w = 0.78, h = 0.22 }) {
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
        <boxGeometry args={[w + 0.08, h + 0.06, 0.04]} />
        <meshStandardMaterial color="#1a1012" metalness={0.75} roughness={0.28} envMapIntensity={1.7} />
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
        <boxGeometry args={[w, h, 0.035]} />
        <meshPhysicalMaterial
          color="#3a1a22"
          emissive={hovered && !disabled ? '#c02434' : '#9b1c2a'}
          emissiveIntensity={hovered && !disabled ? 0.45 : 0.25}
          metalness={0.7}
          roughness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.8}
        />
      </mesh>
      <mesh position={[0, 0, 0.04]} renderOrder={3}>
        <planeGeometry args={[w * 0.92, h * 0.78]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function EvGunHolster({
  side = 1,
  bodyW,
  bodyD,
  y = 1.15,
  cabinet,
  deep,
  label,
  powerKw,
  focused,
  selected,
  plugged,
  charging,
  silver,
  white,
  accent,
  bodyMap,
  onSelect,
  onToggle,
  onPlug,
}) {
  const grip = focused ? white : selected ? '#d4dbe3' : '#3a414c';
  const nose = charging ? '#ffb3bb' : plugged ? accent : silver;

  // Keep wing fully OUTSIDE the cabinet with a tiny air gap to prevent z-fighting
  const wingW = 0.34;
  const wingD = bodyD * 0.86;
  const gap = 0.012;
  const x = side * (bodyW / 2 + gap + wingW / 2);
  const frontZ = wingD / 2 + 0.01;

  return (
    <group position={[x, y, 0]}>
      {/* Side dock panel — abuts cabinet, does not intersect it */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[wingW, 1.5, wingD]} />
        <meshPhysicalMaterial
          map={bodyMap}
          color={cabinet}
          metalness={0.82}
          roughness={0.18}
          clearcoat={0.65}
          envMapIntensity={1.55}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Inner seam strip facing the cabinet (decorative join, still outside) */}
      <mesh position={[-side * (wingW / 2 - 0.012), 0, 0]} castShadow>
        <boxGeometry args={[0.02, 1.48, wingD * 0.95]} />
        <meshStandardMaterial color={deep} metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Foot on plinth */}
      <mesh position={[0, -0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[wingW + 0.04, 0.14, wingD * 0.92]} />
        <meshStandardMaterial color={deep} metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Front face plate — pushed forward so it never shares a plane with the body */}
      <mesh position={[0, 0.02, frontZ]} castShadow>
        <boxGeometry args={[wingW - 0.06, 1.35, 0.035]} />
        <meshPhysicalMaterial
          color="#eceff3"
          metalness={0.22}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.45}
        />
      </mesh>

      {/* Holster pocket */}
      <mesh position={[0, 0.2, frontZ + 0.04]} castShadow>
        <boxGeometry args={[0.2, 0.4, 0.1]} />
        <meshStandardMaterial color={deep} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.0, frontZ + 0.07]} castShadow>
        <boxGeometry args={[0.22, 0.05, 0.07]} />
        <meshStandardMaterial color={accent} metalness={0.65} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.4, frontZ + 0.07]} castShadow>
        <boxGeometry args={[0.22, 0.045, 0.07]} />
        <meshStandardMaterial color={deep} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Gun in pocket */}
      <group
        position={[0, 0.18, frontZ + 0.1]}
        rotation={[0.1, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey || e.ctrlKey || e.metaKey) onToggle?.();
          else onSelect?.();
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent?.preventDefault?.();
          onToggle?.();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onPlug?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshPhysicalMaterial
            color={grip}
            emissive={charging ? '#ffb3bb' : selected ? accent : '#000'}
            emissiveIntensity={charging ? 0.4 : selected ? 0.18 : 0}
            metalness={0.5}
            roughness={0.28}
            clearcoat={0.65}
            envMapIntensity={1.5}
          />
        </mesh>
        <mesh position={[0, 0.16, 0.01]} rotation={[0.2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.058, 0.13, 18]} />
          <meshPhysicalMaterial
            color={nose}
            metalness={0.95}
            roughness={0.1}
            clearcoat={0.85}
            envMapIntensity={1.9}
          />
        </mesh>
        <mesh position={[0, 0.25, 0.03]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.038, 0.055, 14]} />
          <meshStandardMaterial color="#0e1116" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      {/* Cable guide on front of wing */}
      <mesh position={[0, 0.52, frontZ + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.045, 14]} />
        <meshStandardMaterial color="#11151a" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.12, frontZ + 0.04]} castShadow>
        <boxGeometry args={[0.055, 0.65, 0.04]} />
        <meshStandardMaterial color={deep} metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, frontZ + 0.07]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.32, 10]} />
        <meshStandardMaterial color={plugged ? '#8b1e2a' : '#1e242c'} metalness={0.25} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.05, frontZ + 0.08]} castShadow>
        <cylinderGeometry args={[0.028, 0.026, 0.4, 10]} />
        <meshStandardMaterial color={plugged ? '#9a2432' : '#252b34'} metalness={0.25} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.35, frontZ + 0.06]} rotation={[0.85, 0, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.03, 0.24, 10]} />
        <meshStandardMaterial color={plugged ? '#8b1e2a' : '#1e242c'} metalness={0.25} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.52, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.14, 0.07, 0.12]} />
        <meshStandardMaterial color={deep} metalness={0.8} roughness={0.28} />
      </mesh>

      <CanvasLabel
        text={label}
        position={[0, -0.68, frontZ + 0.05]}
        width={0.24}
        height={0.05}
        fontSize={40}
        color="#1a1f28"
      />
      <CanvasLabel
        text={`${powerKw} kW`}
        position={[0, -0.78, frontZ + 0.05]}
        width={0.26}
        height={0.04}
        fontSize={28}
        color={accent}
      />
    </group>
  );
}

/**
 * Tall EV charge pedestal — HMI face + side gun holsters (not a battery brick)
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
  tariff = null,
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
  const stripRef = useRef();
  const [page, setPage] = useState('home');
  const cabinet = '#2a2f36';
  const accent = '#c02434';
  const deep = '#14181e';
  const white = '#f2f4f7';
  const silver = '#c8d0d8';

  const surfaces = useMemo(() => {
    const body = makeSurfaceMaps({ base: cabinet, style: 'brushed', size: 512 });
    body.map.repeat.set(1.4, 3.2);
    body.roughnessMap.repeat.set(1.4, 3.2);

    const face = makeSurfaceMaps({ base: white, style: 'paint', size: 512 });
    face.map.repeat.set(1.2, 2.6);
    face.roughnessMap.repeat.set(1.2, 2.6);

    const trim = makeSurfaceMaps({ base: silver, style: 'chrome', size: 256 });
    const accentMap = makeSurfaceMaps({ base: accent, style: 'paint', size: 256 });
    return { body, face, trim, accentMap };
  }, [cabinet, white, silver, accent]);

  const guns = connectors.filter((c) => c.number > 0);
  const count = Math.max(1, guns.length);
  // Tall slender pedestal — width grows only slightly with outlets
  const bodyW = Math.max(1.05, 0.95 + Math.min(count, 2) * 0.08);
  const bodyD = 0.72;
  const bodyH = 2.55;
  const bodyY = 1.55;
  const active = guns.find((c) => c.number === activeConnector) || guns[0];
  const selectedSet = new Set(selectedConnectors.length ? selectedConnectors : [activeConnector]);
  const isTx = !!active?.transactionId;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ledRef.current) {
      const mat = ledRef.current.material;
      if (charging) {
        // Green blinking charge indicator
        const on = Math.sin(t * 7) > 0;
        mat.color.set(on ? '#22c55e' : '#14532d');
        mat.emissive.set('#22c55e');
        mat.emissiveIntensity = on ? 0.95 : 0.12;
      } else {
        // Steady (no blink) when not charging
        mat.color.set(online ? '#c02434' : '#6b7280');
        mat.emissive.set(online ? '#c02434' : '#111111');
        mat.emissiveIntensity = online ? 0.28 : 0.06;
      }
    }
    if (stripRef.current) {
      const mat = stripRef.current.material;
      if (charging) {
        // Red side stripe while charging
        mat.color.set('#c02434');
        mat.emissive.set('#c02434');
        mat.emissiveIntensity = 0.65;
      } else {
        // White side stripe when idle
        mat.color.set('#f4f6f8');
        mat.emissive.set('#e8ecf2');
        mat.emissiveIntensity = 0.18;
      }
    }
  });

  return (
    <group position={[0, 0, 0]} scale={[1.55, 1.55, 1.55]}>
      {/* Ground plinth — smaller footprint than old battery block */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[bodyW + 1.05, 0.12, bodyD + 0.45]} />
        <meshStandardMaterial color={deep} metalness={0.9} roughness={0.25} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[bodyW + 0.75, 0.06, bodyD + 0.22]} />
        <meshPhysicalMaterial
          map={surfaces.trim.map}
          color={silver}
          metalness={1}
          roughness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={2}
        />
      </mesh>

      {/* Main tall cabinet body */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshPhysicalMaterial
          map={surfaces.body.map}
          roughnessMap={surfaces.body.roughnessMap}
          color={cabinet}
          metalness={0.82}
          roughness={0.16}
          clearcoat={0.75}
          clearcoatRoughness={0.12}
          envMapIntensity={1.75}
        />
      </mesh>

      {/* Slightly inset glossy white HMI face */}
      <mesh position={[0, bodyY + 0.08, bodyD / 2 - 0.02]} castShadow>
        <boxGeometry args={[bodyW - 0.1, bodyH - 0.35, 0.05]} />
        <meshPhysicalMaterial
          map={surfaces.face.map}
          roughnessMap={surfaces.face.roughnessMap}
          color={white}
          metalness={0.28}
          roughness={0.07}
          clearcoat={1}
          clearcoatRoughness={0.04}
          sheen={0.4}
          sheenColor="#ffffff"
          envMapIntensity={1.65}
        />
      </mesh>

      {/* Top cap + light bar (charger roof lip) */}
      <mesh position={[0, bodyY + bodyH / 2 + 0.06, 0]} castShadow>
        <boxGeometry args={[bodyW + 0.08, 0.1, bodyD + 0.08]} />
        <meshPhysicalMaterial
          color={deep}
          metalness={0.9}
          roughness={0.18}
          clearcoat={0.7}
          envMapIntensity={1.7}
        />
      </mesh>
      <mesh position={[0, bodyY + bodyH / 2 + 0.12, bodyD / 2 - 0.08]} castShadow>
        <boxGeometry args={[bodyW - 0.12, 0.06, 0.14]} />
        <meshPhysicalMaterial
          map={surfaces.accentMap.map}
          color={accent}
          emissive={accent}
          emissiveIntensity={0.2}
          metalness={0.65}
          roughness={0.12}
          clearcoat={1}
          envMapIntensity={1.8}
        />
      </mesh>
      <CanvasLabel
        text="MASSIVE"
        position={[0, bodyY + bodyH / 2 + 0.12, bodyD / 2 + 0.02]}
        width={0.7}
        height={0.07}
        fontSize={52}
        color="#ffffff"
      />
      <mesh ref={ledRef} position={[bodyW / 2 - 0.12, bodyY + bodyH / 2 + 0.12, bodyD / 2 + 0.01]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshPhysicalMaterial
          color={online ? '#c02434' : '#6b7280'}
          emissive={online ? '#c02434' : '#111111'}
          emissiveIntensity={0.25}
          metalness={0.3}
          roughness={0.15}
          clearcoat={1}
        />
      </mesh>

      {/* Vertical status light strip (typical DC charger cue) */}
      <mesh ref={stripRef} position={[-(bodyW / 2 - 0.03), bodyY + 0.15, bodyD / 2 + 0.01]} castShadow>
        <boxGeometry args={[0.04, 1.8, 0.03]} />
        <meshPhysicalMaterial
          color="#f4f6f8"
          emissive="#e8ecf2"
          emissiveIntensity={0.18}
          metalness={0.35}
          roughness={0.22}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Side cooling vents */}
      {[-1, 1].map((side) =>
        Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={`vent-${side}-${i}`}
            position={[side * (bodyW / 2 + 0.005), bodyY - 0.55 + i * 0.18, 0]}
            castShadow
          >
            <boxGeometry args={[0.02, 0.06, bodyD * 0.55]} />
            <meshStandardMaterial color={deep} metalness={0.75} roughness={0.35} />
          </mesh>
        ))
      )}

      {/* Recessed screen bezel */}
      <mesh position={[0, 2.35, bodyD / 2 + 0.01]} castShadow>
        <boxGeometry args={[0.88, 0.68, 0.06]} />
        <meshPhysicalMaterial
          color="#0c0f14"
          metalness={1}
          roughness={0.08}
          clearcoat={0.9}
          envMapIntensity={2}
        />
      </mesh>
      <mesh position={[0, 2.35, bodyD / 2 + 0.035]}>
        <boxGeometry args={[0.82, 0.62, 0.02]} />
        <meshPhysicalMaterial
          color="#1a1014"
          metalness={0.25}
          roughness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.02}
          transparent
          opacity={0.9}
          envMapIntensity={1.5}
        />
      </mesh>
      <ChargerLcdScreen
        connector={active}
        connectors={connectors}
        connectionState={connectionState}
        cpId={cpId}
        identity={identity}
        firmwareStatus={firmwareStatus}
        tariff={tariff}
        position={[0, 2.35, bodyD / 2 + 0.055]}
        size={[0.78, 0.585]}
        page={page}
        busy={busy}
        onPageChange={setPage}
        onStart={onStart}
        onStop={onStop}
        onPlug={onOutletPlug}
        onTapCard={onTapCard}
        onClearFault={onClearFault}
        onSelectOutlet={onSelectOutlet}
      />

      {/* Physical page keys — SESSION / OUTLETS always reachable */}
      <group position={[0, 1.95, bodyD / 2 + 0.04]}>
        <SoftKey
          position={[-0.36, 0, 0]}
          w={0.2}
          h={0.1}
          label="HOME"
          color={page === 'home' ? '#f7d4d8' : '#eef2f6'}
          accent={page === 'home'}
          onClick={() => setPage('home')}
        />
        <SoftKey
          position={[-0.12, 0, 0]}
          w={0.2}
          h={0.1}
          label="SESSION"
          color={page === 'session' ? '#f7d4d8' : '#eef2f6'}
          accent={page === 'session'}
          onClick={() => setPage('session')}
        />
        <SoftKey
          position={[0.12, 0, 0]}
          w={0.2}
          h={0.1}
          label="OUTLETS"
          color={page === 'connectors' ? '#f7d4d8' : '#eef2f6'}
          accent={page === 'connectors'}
          onClick={() => setPage('connectors')}
        />
        <SoftKey
          position={[0.36, 0, 0]}
          w={0.2}
          h={0.1}
          label="INFO"
          color={page === 'info' ? '#f7d4d8' : '#eef2f6'}
          accent={page === 'info'}
          onClick={() => setPage('info')}
        />
      </group>

      {/* Soft keys under screen */}
      <group position={[0, 1.72, bodyD / 2 + 0.04]}>
        <SoftKey
          position={[-0.36, 0, 0]}
          w={0.22}
          h={0.12}
          label={active?.cablePlugged ? 'UNPLUG' : 'PLUG'}
          color="#eef2f6"
          disabled={busy}
          onClick={() => onOutletPlug?.(active?.number, !active?.cablePlugged)}
        />
        <SoftKey
          position={[-0.12, 0, 0]}
          w={0.22}
          h={0.12}
          label="START"
          color="#f7d4d8"
          accent
          disabled={busy || isTx}
          onClick={() => onStart?.(active?.number)}
        />
        <SoftKey
          position={[0.12, 0, 0]}
          w={0.22}
          h={0.12}
          label="STOP"
          color="#e8eef2"
          disabled={busy || !isTx}
          onClick={() => onStop?.(active?.number)}
        />
        <SoftKey
          position={[0.36, 0, 0]}
          w={0.22}
          h={0.12}
          label="CLEAR"
          color="#ffe8a8"
          disabled={busy || active?.status !== 'Faulted'}
          onClick={() => onClearFault?.(active?.number)}
        />
      </group>

      <RfidPad
        position={[0, 1.42, bodyD / 2 + 0.04]}
        w={0.78}
        h={0.2}
        disabled={busy}
        onClick={() => onTapCard?.(active?.number)}
      />

      {/* Brand kick plate */}
      <mesh position={[0, 0.55, bodyD / 2 + 0.01]} castShadow>
        <boxGeometry args={[bodyW - 0.2, 0.28, 0.04]} />
        <meshPhysicalMaterial
          map={surfaces.accentMap.map}
          color={accent}
          metalness={0.7}
          roughness={0.14}
          clearcoat={0.9}
          envMapIntensity={1.7}
        />
      </mesh>
      <CanvasLabel
        text="EV CHARGER"
        position={[0, 0.55, bodyD / 2 + 0.04]}
        width={0.55}
        height={0.08}
        fontSize={40}
        color="#ffffff"
      />
      <CanvasLabel
        text={`C${active?.number || 1} · ${active?.status || ''}`}
        position={[0, 0.35, bodyD / 2 + 0.04]}
        width={0.7}
        height={0.06}
        fontSize={28}
        color="#e8a3aa"
      />

      <MushroomStop
        position={[bodyW / 2 - 0.18, 0.95, bodyD / 2 + 0.04]}
        disabled={busy || !isTx}
        onClick={() => onEmergency?.(active?.number)}
      />

      {/* Side wings fused to cabinet — guns sit in cradles */}
      {guns.map((c, idx) => {
        const selected = selectedSet.has(c.number);
        const focused = c.number === activeConnector;
        const plugged = !!c.cablePlugged;
        const isCharging = c.status === 'Charging';
        const pair = idx % 2 === 0 ? -1 : 1;
        const tier = Math.floor(idx / 2);
        const y = 1.15 - tier * 0.92;

        return (
          <EvGunHolster
            key={c.number}
            side={pair}
            bodyW={bodyW}
            bodyD={bodyD}
            y={y}
            cabinet={cabinet}
            deep={deep}
            label={`C${c.number}`}
            powerKw={c.powerKw}
            focused={focused}
            selected={selected}
            plugged={plugged}
            charging={isCharging}
            silver={silver}
            white={white}
            accent={accent}
            bodyMap={surfaces.body.map}
            onSelect={() => onSelectOutlet?.(c.number)}
            onToggle={() => onToggleSelectOutlet?.(c.number)}
            onPlug={() => onOutletPlug?.(c.number, !plugged)}
          />
        );
      })}
    </group>
  );
}
