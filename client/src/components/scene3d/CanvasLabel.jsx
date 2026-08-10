import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Tiny on-mesh label via canvas texture — no CDN font / no Suspense hang
 */
export default function CanvasLabel({
  text,
  position = [0, 0, 0],
  width = 0.2,
  height = 0.06,
  fontSize = 42,
  color = '#0a2218',
  bg = null,
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    } else {
      ctx.clearRect(0, 0, c.width, c.height);
    }
    ctx.fillStyle = color;
    ctx.font = `700 ${fontSize}px system-ui, Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [text, fontSize, color, bg]);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
