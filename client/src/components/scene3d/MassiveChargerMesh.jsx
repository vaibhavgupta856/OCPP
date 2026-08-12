import { useEffect, useMemo, useRef, useState } from 'react';
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

function makeNfcPadTexture({ disabled = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, disabled ? '#2a2e34' : '#1c1014');
  g.addColorStop(0.55, disabled ? '#1a1d22' : '#2a1218');
  g.addColorStop(1, disabled ? '#12151a' : '#12080c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  // subtle top sheen
  const sheen = ctx.createLinearGradient(0, 0, 0, 70);
  sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, c.width, 70);

  const cx = c.width * 0.22;
  const cy = c.height * 0.5;
  const stroke = disabled ? 'rgba(180,190,200,0.28)' : 'rgba(255,170,180,0.7)';
  ctx.strokeStyle = stroke;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const r = 18 + i * 16;
    ctx.lineWidth = 3.5 - i * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
  }
  ctx.fillStyle = disabled ? 'rgba(200,210,220,0.35)' : '#ffb3bb';
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = disabled ? 'rgba(200,210,220,0.4)' : '#ffe4e8';
  ctx.font = '800 52px system-ui, Segoe UI, Arial, sans-serif';
  ctx.fillText('TAP', 170, cy - 14);
  ctx.fillStyle = disabled ? 'rgba(200,210,220,0.28)' : 'rgba(255,179,187,0.78)';
  ctx.font = '700 28px system-ui, Segoe UI, Arial, sans-serif';
  ctx.letterSpacing = '0.18em';
  ctx.fillText('RFID  ·  NFC', 170, cy + 28);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
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
          document.body.style.cursor = disabled ? 'not-allowed' : 'default';
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

function RfidPad({ position, disabled, onClick, w = 0.5, h = 0.12 }) {
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(() => makeNfcPadTexture({ disabled: !!disabled }), [disabled]);

  return (
    <group position={position}>
      {/* Slim bezel */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[w + 0.045, h + 0.035, 0.028]} />
        <meshStandardMaterial color="#101418" metalness={0.88} roughness={0.22} envMapIntensity={1.4} />
      </mesh>
      {/* Soft glow halo */}
      <mesh position={[0, 0, 0.002]}>
        <boxGeometry args={[w + 0.02, h + 0.016, 0.01]} />
        <meshStandardMaterial
          color="#c02434"
          emissive="#c02434"
          emissiveIntensity={hovered && !disabled ? 0.55 : disabled ? 0.05 : 0.22}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.016]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick?.(e);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!disabled) setHovered(true);
          document.body.style.cursor = disabled ? 'not-allowed' : 'default';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={[w, h, 0.024]} />
        <meshPhysicalMaterial
          color={disabled ? '#2a2e34' : '#241016'}
          emissive={hovered && !disabled ? '#c02434' : '#7a1520'}
          emissiveIntensity={hovered && !disabled ? 0.4 : 0.18}
          metalness={0.55}
          roughness={0.18}
          clearcoat={0.85}
          clearcoatRoughness={0.1}
          envMapIntensity={1.35}
          transparent={disabled}
          opacity={disabled ? 0.55 : 1}
        />
      </mesh>
      <mesh position={[0, 0, 0.032]} renderOrder={3}>
        <planeGeometry args={[w * 0.94, h * 0.82]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.05} depthWrite={false} toneMapped={false} />
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
  const gunRef = useRef();
  const motion = useRef(plugged || charging ? 1 : 0);
  const gripMatRef = useRef();
  const shellMatRef = useRef();
  const headMatRef = useRef();
  const ledMatRef = useRef();
  const blinkPhase = useRef(0);
  const cableTint = useMemo(() => new THREE.Color('#1e242c'), []);

  const grip = focused ? '#f4f6f8' : selected ? '#cfd6de' : '#2a3038';
  const shell = plugged && !charging ? '#c02434' : '#b8c0c8';
  const led = plugged && !charging ? '#ffb020' : focused ? '#5ad0ff' : '#3a4450';

  const wingW = 0.38;
  const wingD = bodyD * 0.9;
  const gap = 0.02;
  const x = side * (bodyW / 2 + gap + wingW / 2);
  // Recessed body front so the faceplate never shares a depth plane with the wing box
  const wingBodyD = wingD - 0.08;
  const wingBodyZ = -0.03;
  const frontZ = wingD / 2 + 0.05;
  const s = side;

  const dockedPos = useMemo(() => new THREE.Vector3(0, 0.14, frontZ + 0.22), [frontZ]);
  const outPos = useMemo(() => new THREE.Vector3(s * 0.08, 0.08, frontZ + 0.42), [frontZ, s]);
  const dockedEuler = useMemo(() => new THREE.Euler(0.18, 0, 0), []);
  const outEuler = useMemo(() => new THREE.Euler(0.52, s * 0.28, s * 0.1), [s]);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpQuatA = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuatB = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const glandPt = useMemo(() => new THREE.Vector3(0, 0.58, frontZ + 0.16), [frontZ]);
  const attachLocal = useMemo(() => new THREE.Vector3(0, 0.02, -0.05), []);
  const attachWorld = useMemo(() => new THREE.Vector3(), []);
  const mid1 = useMemo(() => new THREE.Vector3(), []);
  const mid2 = useMemo(() => new THREE.Vector3(), []);
  const mid3 = useMemo(() => new THREE.Vector3(), []);
  const cablePts = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    []
  );
  const cableCurve = useMemo(() => new THREE.CatmullRomCurve3(cablePts), [cablePts]);
  const sampleA = useMemo(() => new THREE.Vector3(), []);
  const sampleB = useMemo(() => new THREE.Vector3(), []);
  const segDir = useMemo(() => new THREE.Vector3(), []);
  const segY = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const cableSegRefs = useRef([]);
  const CABLE_SEGS = 18;
  const cableColor = useMemo(() => new THREE.Color('#1e242c'), []);
  const cableColorOut = useMemo(() => new THREE.Color('#8b1e2a'), []);
  const greenHi = useMemo(() => new THREE.Color('#39ff88'), []);
  const greenLo = useMemo(() => new THREE.Color('#0d3d24'), []);
  const greenMid = useMemo(() => new THREE.Color('#1fa855'), []);
  const shellIdle = useMemo(() => new THREE.Color('#b8c0c8'), []);
  const shellPlug = useMemo(() => new THREE.Color('#c02434'), []);
  const silverCol = useMemo(() => new THREE.Color(silver || '#c8d0d8'), [silver]);
  const blinkTmp = useMemo(() => new THREE.Color(), []);

  // Seed docked cable path once so segments have a valid curve on first frame
  useEffect(() => {
    const end = dockedPos.clone().add(attachLocal);
    cablePts[0].copy(glandPt);
    cablePts[1].set(s * 0.02, 0.35, frontZ + 0.18);
    cablePts[2].set(s * 0.03, 0.05, frontZ + 0.2);
    cablePts[3].lerpVectors(glandPt, end, 0.75);
    cablePts[4].copy(end);
  }, [attachLocal, cablePts, dockedPos, frontZ, glandPt, s]);

  useFrame((_, delta) => {
    const target = charging ? 1 : plugged ? 0.72 : 0;
    const dt = Math.min(delta, 0.05);
    // Single damp only — double smoothstep warped mid-travel and looked kinked
    motion.current = THREE.MathUtils.damp(motion.current, target, 2.35, dt);
    const t = motion.current;
    // Pull straight out first, then tilt — avoids twisty mid-path distortion
    const tPos = t;
    const tRot = t * t * (3 - 2 * t);

    if (gunRef.current) {
      tmpPos.lerpVectors(dockedPos, outPos, tPos);
      gunRef.current.position.copy(tmpPos);
      tmpQuatA.setFromEuler(dockedEuler);
      tmpQuatB.setFromEuler(outEuler);
      tmpQuat.slerpQuaternions(tmpQuatA, tmpQuatB, tRot);
      gunRef.current.quaternion.copy(tmpQuat);

      attachWorld.copy(attachLocal).applyQuaternion(tmpQuat).add(tmpPos);
    } else {
      attachWorld.copy(dockedPos).add(attachLocal);
    }

    // Soft green pulse on gun/LED only (avoid blasting nearby panel reflections)
    blinkPhase.current += dt;
    if (charging) {
      const pulse = 0.5 + 0.5 * Math.sin(blinkPhase.current * 5.5);
      blinkTmp.copy(greenLo).lerp(greenHi, pulse);
      if (shellMatRef.current) {
        shellMatRef.current.emissive.copy(greenMid);
        shellMatRef.current.emissiveIntensity = 0.12 + pulse * 0.35;
      }
      if (headMatRef.current) {
        headMatRef.current.emissive.copy(greenHi);
        headMatRef.current.emissiveIntensity = 0.08 + pulse * 0.28;
      }
      if (gripMatRef.current) {
        gripMatRef.current.emissive.copy(greenMid);
        gripMatRef.current.emissiveIntensity = 0.05 + pulse * 0.18;
      }
      if (ledMatRef.current) {
        ledMatRef.current.color.copy(blinkTmp);
        ledMatRef.current.emissive.copy(greenHi);
        ledMatRef.current.emissiveIntensity = 0.55 + pulse * 0.9;
      }
    } else {
      if (shellMatRef.current) {
        shellMatRef.current.color.copy(plugged ? shellPlug : shellIdle);
        shellMatRef.current.emissive.set('#000000');
        shellMatRef.current.emissiveIntensity = 0;
      }
      if (headMatRef.current) {
        headMatRef.current.color.copy(silverCol);
        headMatRef.current.emissive.set('#000000');
        headMatRef.current.emissiveIntensity = 0;
      }
      if (gripMatRef.current) {
        gripMatRef.current.emissive.set(selected ? accent : '#000000');
        gripMatRef.current.emissiveIntensity = selected ? 0.15 : 0;
      }
      if (ledMatRef.current) {
        const ledC = plugged ? '#ffb020' : focused ? '#5ad0ff' : '#3a4450';
        ledMatRef.current.color.set(ledC);
        ledMatRef.current.emissive.set(ledC);
        ledMatRef.current.emissiveIntensity = plugged ? 0.7 : focused ? 0.55 : 0.15;
      }
    }

    // Keep cable in front of the pocket so segments never z-fight the cradle
    const sag = THREE.MathUtils.lerp(0.16, 0.03, t);
    const cableZMin = frontZ + 0.12;
    mid1.lerpVectors(glandPt, attachWorld, 0.3);
    mid1.y -= sag * 0.4;
    mid1.x += s * 0.028 * (1 - t * 0.35);
    mid1.z = Math.max(mid1.z + 0.04, cableZMin);

    mid2.lerpVectors(glandPt, attachWorld, 0.55);
    mid2.y -= sag * 0.85;
    mid2.x += s * 0.04;
    mid2.z = Math.max(mid2.z + THREE.MathUtils.lerp(0.05, 0.1, t), cableZMin);

    mid3.lerpVectors(glandPt, attachWorld, 0.8);
    mid3.y -= sag * 0.25;
    mid3.x += s * 0.025;
    mid3.z = Math.max(mid3.z + 0.03, cableZMin);

    cablePts[0].copy(glandPt);
    cablePts[1].copy(mid1);
    cablePts[2].copy(mid2);
    cablePts[3].copy(mid3);
    cablePts[4].copy(attachWorld);

    const tint = cableTint.copy(cableColor).lerp(cableColorOut, t);

    // Pose fixed cylinder segments along the curve — stable meshes, no TubeGeometry thrash
    for (let i = 0; i < CABLE_SEGS; i += 1) {
      const mesh = cableSegRefs.current[i];
      if (!mesh) continue;
      const u0 = i / CABLE_SEGS;
      const u1 = (i + 1) / CABLE_SEGS;
      cableCurve.getPointAt(u0, sampleA);
      cableCurve.getPointAt(u1, sampleB);
      segDir.subVectors(sampleB, sampleA);
      const len = segDir.length();
      if (len < 1e-5) continue;
      tmpPos.lerpVectors(sampleA, sampleB, 0.5);
      mesh.position.copy(tmpPos);
      mesh.scale.set(1, len, 1);
      segDir.multiplyScalar(1 / len);
      mesh.quaternion.setFromUnitVectors(segY, segDir);
      if (mesh.material?.color) mesh.material.color.copy(tint);
    }
  });

  const gunHandlers = {
    onClick: (e) => {
      e.stopPropagation();
      if (e.shiftKey || e.ctrlKey || e.metaKey) onToggle?.();
      else onSelect?.();
    },
    onContextMenu: (e) => {
      e.stopPropagation();
      e.nativeEvent?.preventDefault?.();
      onToggle?.();
    },
    onDoubleClick: (e) => {
      e.stopPropagation();
      onPlug?.();
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = 'default';
    },
    onPointerOut: () => {
      document.body.style.cursor = 'default';
    },
  };

  return (
    <group position={[x, y, 0]}>
      {/* Wing shell — shorter in Z so front face stays behind the white plate */}
      <mesh position={[0, 0, wingBodyZ]} castShadow receiveShadow>
        <boxGeometry args={[wingW, 1.55, wingBodyD]} />
        <meshStandardMaterial
          map={bodyMap}
          color={cabinet}
          metalness={0.72}
          roughness={0.28}
          envMapIntensity={1.15}
        />
      </mesh>

      {/* Outer / inner edge trims sit OUTSIDE the wing (no coplanar z-fight) */}
      <mesh position={[s * (wingW / 2 + 0.014), 0.05, wingBodyZ]} castShadow>
        <boxGeometry args={[0.028, 1.4, wingBodyD * 0.9]} />
        <meshStandardMaterial color={deep} metalness={0.75} roughness={0.32} />
      </mesh>

      <mesh position={[-s * (wingW / 2 + 0.01), 0.02, wingBodyZ]} castShadow>
        <boxGeometry args={[0.02, 1.5, wingBodyD * 0.94]} />
        <meshStandardMaterial color="#0a0c10" metalness={0.65} roughness={0.4} />
      </mesh>

      <mesh position={[0, -0.88, wingBodyZ]} castShadow receiveShadow>
        <boxGeometry args={[wingW + 0.06, 0.14, wingBodyD * 0.92]} />
        <meshStandardMaterial color={deep} metalness={0.88} roughness={0.28} />
      </mesh>

      {/* Faceplate split around the gun pocket — no coplanar sheet behind the connector */}
      {(() => {
        const fw = wingW - 0.05;
        const fh = 1.34;
        const fy = 0.05;
        const pw = 0.28;
        const ph = 0.56;
        const py = 0.2;
        const topH = (fh / 2 + fy) - (py + ph / 2);
        const botH = (py - ph / 2) - (fy - fh / 2);
        const sideW = (fw - pw) / 2;
        const mkFace = (key, pos, args) => (
          <mesh key={key} position={pos} castShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial
              color="#eef1f5"
              metalness={0.12}
              roughness={0.22}
              envMapIntensity={0.85}
            />
          </mesh>
        );
        return (
          <group>
            {mkFace('face-top', [0, py + ph / 2 + topH / 2, frontZ], [fw, Math.max(topH, 0.02), 0.022])}
            {mkFace('face-bot', [0, py - ph / 2 - botH / 2, frontZ], [fw, Math.max(botH, 0.02), 0.022])}
            {mkFace('face-l', [-(pw / 2 + sideW / 2), py, frontZ], [Math.max(sideW, 0.02), ph, 0.022])}
            {mkFace('face-r', [pw / 2 + sideW / 2, py, frontZ], [Math.max(sideW, 0.02), ph, 0.022])}
          </group>
        );
      })()}

      {/* Pocket back wall — deep behind the face opening */}
      <mesh position={[0, 0.2, frontZ - 0.035]} castShadow>
        <boxGeometry args={[0.26, 0.54, 0.02]} />
        <meshStandardMaterial color="#0b0e12" metalness={0.35} roughness={0.75} />
      </mesh>
      {/* Pocket side / top / bottom walls (frame only — no nested solid boxes) */}
      <mesh position={[-0.13, 0.2, frontZ - 0.01]} castShadow>
        <boxGeometry args={[0.02, 0.54, 0.05]} />
        <meshStandardMaterial color="#12161c" metalness={0.45} roughness={0.55} />
      </mesh>
      <mesh position={[0.13, 0.2, frontZ - 0.01]} castShadow>
        <boxGeometry args={[0.02, 0.54, 0.05]} />
        <meshStandardMaterial color="#12161c" metalness={0.45} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.46, frontZ - 0.01]} castShadow>
        <boxGeometry args={[0.28, 0.02, 0.05]} />
        <meshStandardMaterial color="#12161c" metalness={0.45} roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.06, frontZ - 0.01]} castShadow>
        <boxGeometry args={[0.28, 0.02, 0.05]} />
        <meshStandardMaterial color="#12161c" metalness={0.45} roughness={0.55} />
      </mesh>
      {/* Slim front rim proud of the faceplate */}
      <mesh position={[0, 0.46, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.016]} />
        <meshStandardMaterial color="#1a1f26" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.06, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.016]} />
        <meshStandardMaterial color="#1a1f26" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[-0.14, 0.2, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.02, 0.54, 0.016]} />
        <meshStandardMaterial color="#1a1f26" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0.14, 0.2, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.02, 0.54, 0.016]} />
        <meshStandardMaterial color="#1a1f26" metalness={0.55} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0.42, frontZ + 0.055]} castShadow>
        <boxGeometry args={[0.24, 0.035, 0.05]} />
        <meshStandardMaterial color={silver} metalness={0.9} roughness={0.16} />
      </mesh>
      <mesh position={[0, -0.02, frontZ + 0.055]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.05]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.65}
          roughness={0.22}
          emissive={charging ? accent : '#000'}
          emissiveIntensity={charging ? 0.25 : 0}
        />
      </mesh>

      <mesh position={[0, 0.55, frontZ + 0.04]}>
        <boxGeometry args={[0.12, 0.035, 0.02]} />
        <meshStandardMaterial
          ref={ledMatRef}
          color={led}
          emissive={led}
          emissiveIntensity={plugged ? 0.7 : focused ? 0.55 : 0.15}
          metalness={0.2}
          roughness={0.35}
        />
      </mesh>

      <mesh position={[0, 0.58, frontZ + 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.05, 16]} />
        <meshStandardMaterial color="#0e1218" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.58, frontZ + 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.04, 14]} />
        <meshStandardMaterial color="#1c222c" metalness={0.4} roughness={0.55} />
      </mesh>

      <group ref={gunRef} {...gunHandlers}>
        {/* Cable boot / strain relief where cable enters gun */}
        <mesh position={[0, 0.02, -0.05]} rotation={[1.15, 0, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.04, 0.07, 12]} />
          <meshStandardMaterial color="#14181e" metalness={0.35} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.02, -0.01]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.085, 0.2, 0.08]} />
          <meshPhysicalMaterial
            ref={gripMatRef}
            color={grip}
            emissive={selected ? accent : '#000'}
            emissiveIntensity={selected ? 0.15 : 0}
            metalness={0.35}
            roughness={0.4}
            clearcoat={0.45}
            envMapIntensity={1.35}
          />
        </mesh>
        <mesh position={[0, 0.02, 0.03]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.035, 0.01, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#0d1014" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.12, 0.03]} castShadow>
          <boxGeometry args={[0.11, 0.14, 0.09]} />
          <meshPhysicalMaterial
            ref={shellMatRef}
            color={shell}
            metalness={0.75}
            roughness={0.18}
            clearcoat={0.9}
            envMapIntensity={1.75}
          />
        </mesh>
        <mesh position={[0, 0.22, 0.05]} rotation={[0.25, 0, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.062, 0.09, 20]} />
          <meshPhysicalMaterial
            ref={headMatRef}
            color={silver}
            metalness={0.95}
            roughness={0.08}
            clearcoat={1}
            envMapIntensity={2}
          />
        </mesh>
        <mesh position={[0, 0.28, 0.06]} rotation={[0.25, 0, 0]}>
          <cylinderGeometry args={[0.038, 0.042, 0.03, 16]} />
          <meshStandardMaterial color="#0a0c10" metalness={0.7} roughness={0.35} />
        </mesh>
        {[-0.015, 0.015].map((px) => (
          <mesh key={px} position={[px, 0.3, 0.065]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.02, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.15} />
          </mesh>
        ))}
        <mesh position={[0, 0.16, 0.085]} castShadow>
          <boxGeometry args={[0.04, 0.03, 0.03]} />
          <meshStandardMaterial color="#e8edf2" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Stable cable segments (no per-frame TubeGeometry — that flickered the wing panels) */}
      <group>
        {Array.from({ length: CABLE_SEGS }, (_, i) => (
          <mesh
            key={`cable-seg-${i}`}
            ref={(el) => {
              cableSegRefs.current[i] = el;
            }}
            castShadow
          >
            <cylinderGeometry args={[0.027, 0.027, 1, 8]} />
            <meshStandardMaterial color="#1e242c" metalness={0.2} roughness={0.72} />
          </mesh>
        ))}
      </group>

      {/* Dock cable clip (holds slack when gun is seated) */}
      <mesh position={[0, -0.35, frontZ + 0.06]} castShadow>
        <boxGeometry args={[0.14, 0.06, 0.08]} />
        <meshStandardMaterial color={deep} metalness={0.82} roughness={0.28} />
      </mesh>

      <mesh position={[0, -0.62, frontZ + 0.02]} castShadow>
        <boxGeometry args={[0.28, 0.14, 0.018]} />
        <meshStandardMaterial color="#ffffff" metalness={0.08} roughness={0.35} />
      </mesh>
      <CanvasLabel
        text={label}
        position={[0, -0.58, frontZ + 0.04]}
        width={0.26}
        height={0.05}
        fontSize={42}
        color="#12161c"
      />
      <CanvasLabel
        text={`${powerKw} kW`}
        position={[0, -0.68, frontZ + 0.04]}
        width={0.26}
        height={0.04}
        fontSize={30}
        color={accent}
      />
      <CanvasLabel
        text={charging ? 'CHARGING' : plugged ? 'IN USE' : 'READY'}
        position={[0, -0.78, frontZ + 0.04]}
        width={0.28}
        height={0.035}
        fontSize={24}
        color={charging ? '#1a7a40' : plugged ? accent : '#5a6570'}
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

      {/* Slightly proud glossy white HMI face (clear of cabinet front plane) */}
      <mesh position={[0, bodyY + 0.08, bodyD / 2 + 0.028]} castShadow>
        <boxGeometry args={[bodyW - 0.12, bodyH - 0.38, 0.04]} />
        <meshStandardMaterial
          map={surfaces.face.map}
          roughnessMap={surfaces.face.roughnessMap}
          color={white}
          metalness={0.18}
          roughness={0.14}
          envMapIntensity={1.1}
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

      {/* Recessed screen bezel — larger HMI */}
      <mesh position={[0, 2.42, bodyD / 2 + 0.055]} castShadow>
        <boxGeometry args={[1.02, 0.88, 0.06]} />
        <meshPhysicalMaterial
          color="#0c0f14"
          metalness={1}
          roughness={0.08}
          clearcoat={0.9}
          envMapIntensity={2}
        />
      </mesh>
      <mesh position={[0, 2.42, bodyD / 2 + 0.085]}>
        <boxGeometry args={[0.96, 0.82, 0.02]} />
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
        position={[0, 2.42, bodyD / 2 + 0.105]}
        size={[0.92, 0.78]}
        page={page}
        busy={busy}
        onPageChange={setPage}
        onStart={onStart}
        onStop={onStop}
        onPlug={onOutletPlug}
        onClearFault={onClearFault}
        onSelectOutlet={onSelectOutlet}
      />

      {/* RFID pad only — page/action buttons live on the touch screen (no duplicates) */}
      <RfidPad
        position={[0, 1.78, bodyD / 2 + 0.075]}
        w={0.5}
        h={0.12}
        disabled={busy}
        onClick={() => onTapCard?.(active?.number)}
      />

      {/* Brand kick plate */}
      <mesh position={[0, 0.55, bodyD / 2 + 0.055]} castShadow>
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
        position={[0, 0.55, bodyD / 2 + 0.085]}
        width={0.55}
        height={0.08}
        fontSize={40}
        color="#ffffff"
      />
      <CanvasLabel
        text={`C${active?.number || 1} · ${active?.status || ''}`}
        position={[0, 0.35, bodyD / 2 + 0.085]}
        width={0.7}
        height={0.06}
        fontSize={28}
        color="#e8a3aa"
      />

      <MushroomStop
        position={[bodyW / 2 - 0.18, 0.95, bodyD / 2 + 0.08]}
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
