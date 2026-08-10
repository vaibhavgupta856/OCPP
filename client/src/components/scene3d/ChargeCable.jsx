import { useMemo } from 'react';
import * as THREE from 'three';
import { QuadraticBezierLine } from '@react-three/drei';

/**
 * Cable from charger outlet bay → matching car bay
 * Charger group is at z=-1.35 with scale 1.12
 */
export default function ChargeCable({
  plugged,
  charging,
  outletIndex = 0,
  outletCount = 1,
  chargerZ = -1.35,
  chargerScale = 1.12,
}) {
  const start = useMemo(() => {
    const width = Math.max(1.7, 1.05 + outletCount * 0.72);
    const localSpread =
      outletCount === 1
        ? 0
        : (outletIndex - (outletCount - 1) / 2) * Math.min(0.85, (width - 0.55) / Math.max(outletCount - 1, 1));
    return new THREE.Vector3(
      localSpread * chargerScale,
      1.0 * chargerScale,
      chargerZ + 0.68 * chargerScale
    );
  }, [outletIndex, outletCount, chargerZ, chargerScale]);

  const end = useMemo(() => {
    const carSpread = outletCount === 1 ? 0 : (outletIndex - (outletCount - 1) / 2) * 2.6;
    // Charge port on car after ~PI rotation faces charger (+Z world-ish)
    return new THREE.Vector3(carSpread - 0.08, 0.55, 2.55 + 0.48);
  }, [outletIndex, outletCount]);

  const mid = useMemo(() => {
    const a = start.clone().lerp(end, 0.45);
    a.y = plugged ? 0.22 : 0.4;
    a.z += 0.12;
    return a;
  }, [start, end, plugged]);

  if (!plugged) {
    const restEnd = start.clone().add(new THREE.Vector3(0.04, -0.5, 0.18));
    const restMid = start.clone().add(new THREE.Vector3(0.06, -0.22, 0.22));
    return (
      <QuadraticBezierLine
        start={start}
        end={restEnd}
        mid={restMid}
        color="#0f3d2e"
        lineWidth={3}
      />
    );
  }

  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={mid}
      color={charging ? '#7dffb3' : '#145c45'}
      lineWidth={4}
    />
  );
}
