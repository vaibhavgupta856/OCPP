import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const BODY_COLORS = ['#c62828', '#1a237e', '#f5f5f5', '#212121', '#00695c'];

/**
 * Cooler EV hatch/sedan — one instance per connector bay
 */
export default function EvCarMesh({
  plugged = false,
  charging = false,
  bayIndex = 0,
  bayCount = 1,
  label = 'C1',
  onTogglePlug,
}) {
  const portRef = useRef();
  const bodyColor = BODY_COLORS[bayIndex % BODY_COLORS.length];
  const white = '#f5f5f5';
  const glass = '#9ec9ff';

  const spread = bayCount === 1 ? 0 : (bayIndex - (bayCount - 1) / 2) * 2.6;
  const accent = plugged ? '#ffffff' : '#e0e0e0';

  useFrame(({ clock }) => {
    if (!portRef.current) return;
    if (charging) {
      portRef.current.material.emissiveIntensity = 0.55 + Math.sin(clock.getElapsedTime() * 5) * 0.4;
    } else {
      portRef.current.material.emissiveIntensity = plugged ? 0.3 : 0.05;
    }
  });

  return (
    <group
      position={[spread, 0, 2.55]}
      rotation={[0, Math.PI + 0.08, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePlug?.();
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Lower body */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 0.48, 1.05]} />
        <meshStandardMaterial color={bodyColor} metalness={0.72} roughness={0.22} />
      </mesh>

      {/* Sculpted hood */}
      <mesh position={[0.78, 0.58, 0]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[0.7, 0.16, 0.98]} />
        <meshStandardMaterial color={bodyColor} metalness={0.72} roughness={0.22} />
      </mesh>

      {/* Cabin */}
      <mesh position={[-0.15, 0.82, 0]} castShadow>
        <boxGeometry args={[1.25, 0.42, 0.95]} />
        <meshStandardMaterial color={bodyColor === '#f5f5f5' ? '#eceff1' : white} metalness={0.35} roughness={0.35} />
      </mesh>

      {/* Glass panoramic */}
      <mesh position={[0.38, 0.84, 0]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[0.42, 0.36, 0.9]} />
        <meshStandardMaterial color={glass} transparent opacity={0.35} metalness={0.95} roughness={0.05} />
      </mesh>
      <mesh position={[-0.55, 0.86, 0.42]}>
        <boxGeometry args={[0.7, 0.28, 0.04]} />
        <meshStandardMaterial color={glass} transparent opacity={0.3} metalness={0.9} roughness={0.08} />
      </mesh>
      <mesh position={[-0.55, 0.86, -0.42]}>
        <boxGeometry args={[0.7, 0.28, 0.04]} />
        <meshStandardMaterial color={glass} transparent opacity={0.3} metalness={0.9} roughness={0.08} />
      </mesh>

      {/* Roof spoiler */}
      <mesh position={[-0.55, 1.08, 0]}>
        <boxGeometry args={[0.55, 0.04, 0.85]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Side skirt stripe */}
      <mesh position={[0.05, 0.32, 0.53]}>
        <boxGeometry args={[1.9, 0.05, 0.02]} />
        <meshStandardMaterial color={white} />
      </mesh>
      <mesh position={[0.05, 0.32, -0.53]}>
        <boxGeometry args={[1.9, 0.05, 0.02]} />
        <meshStandardMaterial color={white} />
      </mesh>

      {/* Wheels + calipers */}
      {[
        [-0.72, 0.24, 0.52],
        [-0.72, 0.24, -0.52],
        [0.78, 0.24, 0.52],
        [0.78, 0.24, -0.52],
      ].map((p, i) => (
        <group key={i} position={p}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.16, 28]} />
            <meshStandardMaterial color="#111" roughness={0.85} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.17, 18]} />
            <meshStandardMaterial color="#cfd8dc" metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh position={[i % 2 === 0 ? 0.06 : -0.06, 0, 0]}>
            <boxGeometry args={[0.04, 0.1, 0.06]} />
            <meshStandardMaterial color="#c62828" metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Light bar */}
      <mesh position={[1.16, 0.48, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.85]} />
        <meshStandardMaterial color={white} emissive={white} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[-1.16, 0.55, 0]}>
        <boxGeometry args={[0.05, 0.06, 0.9]} />
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.35} />
      </mesh>

      {/* Charge port */}
      <mesh ref={portRef} position={[-0.15, 0.55, 0.54]}>
        <boxGeometry args={[0.14, 0.18, 0.05]} />
        <meshStandardMaterial
          color={charging ? '#ffeb3b' : accent}
          emissive={charging ? '#ffeb3b' : plugged ? '#ffffff' : '#000'}
          emissiveIntensity={0.2}
        />
      </mesh>
      {plugged && (
        <mesh position={[-0.15, 0.68, 0.6]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.14, 0.1, 0.02]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )}

      {/* Bay marker */}
      <mesh position={[0, 0.08, -0.7]}>
        <boxGeometry args={[0.5, 0.02, 0.12]} />
        <meshStandardMaterial color={plugged ? '#7dffb3' : '#90a4ae'} />
      </mesh>
    </group>
  );
}
