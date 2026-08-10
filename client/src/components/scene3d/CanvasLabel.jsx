import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Fit label text on a canvas texture — no clipping / no CDN fonts
 */
export default function CanvasLabel({
  text,
  position = [0, 0, 0],
  width = 0.2,
  height = 0.06,
  fontSize = 42,
  color = '#0a2218',
  bg = null,
  maxWidthRatio = 0.9,
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    } else {
      ctx.clearRect(0, 0, c.width, c.height);
    }

    const label = String(text ?? '');
    let size = fontSize;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxPx = c.width * maxWidthRatio;
    do {
      ctx.font = `700 ${size}px system-ui, Segoe UI, Arial, sans-serif`;
      if (ctx.measureText(label).width <= maxPx || size <= 18) break;
      size -= 2;
    } while (size > 18);

    ctx.fillStyle = color;
    ctx.fillText(label, c.width / 2, c.height / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [text, fontSize, color, bg, maxWidthRatio]);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
