import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Large CP HMI — home / session / help / connectors views
 */
export default function ChargerLcdScreen({
  connector,
  connectors = [],
  connectionState,
  cpId,
  position = [0, 2.15, 0.52],
  size = [1.35, 0.95],
  page = 'home',
  onPageChange,
}) {
  const meshRef = useRef();
  const pageRef = useRef(page);
  pageRef.current = page;

  const { texture, ctx, canvas } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 720;
    const context = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, ctx: context, canvas: c };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (!ctx || !canvas) return;
    const c = connector;
    const guns = (connectors || []).filter((x) => x.number > 0);
    const online = connectionState === 'online';
    const kwh = ((c?.meterWh || 0) / 1000).toFixed(2);
    const kw = ((c?.powerW || 0) / 1000).toFixed(1);
    const rated = c?.powerKw ?? '—';
    const view = pageRef.current;

    // background
    ctx.fillStyle = '#061810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // top bar
    ctx.fillStyle = '#0d2f24';
    ctx.fillRect(0, 0, canvas.width, 72);
    ctx.fillStyle = '#7dffb3';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('PIER CHARGE POINT', 28, 46);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = online ? '#7dffb3' : '#ffb74d';
    ctx.fillText(online ? 'ONLINE' : String(connectionState || 'OFFLINE').toUpperCase(), 780, 46);
    ctx.fillStyle = '#9ecfb8';
    ctx.font = '18px monospace';
    ctx.fillText(String(cpId || 'CP').slice(0, 18), 520, 46);

    // soft-key legend strip
    ctx.fillStyle = '#0a241c';
    ctx.fillRect(0, canvas.height - 64, canvas.width, 64);
    ctx.fillStyle = '#8fd9b4';
    ctx.font = '16px system-ui, sans-serif';
    const soft = ['HOME', 'SESSION', 'OUTLETS', 'HELP', 'START', 'STOP'];
    soft.forEach((label, i) => {
      const x = 40 + i * 165;
      ctx.fillStyle = view === label.toLowerCase() || (view === 'home' && i === 0) || (view === 'session' && i === 1) || (view === 'connectors' && i === 2) || (view === 'help' && i === 3)
        ? '#7dffb3'
        : '#6aa888';
      ctx.fillText(label, x, canvas.height - 28);
    });

    if (view === 'help') {
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillText('How to charge', 40, 140);
      ctx.fillStyle = '#c8e6d8';
      ctx.font = '24px system-ui, sans-serif';
      const lines = [
        '1. Park and open charge port',
        '2. Take cable from holster / plug in',
        '3. Tap RFID card or press START',
        '4. Wait until display shows CHARGING',
        '5. Press STOP or unplug when finished',
        '6. Return connector to holster',
        '',
        'E-STOP: emergency power cut only',
        'Use operator panel below for multi-outlet control',
      ];
      lines.forEach((line, i) => ctx.fillText(line, 40, 200 + i * 42));
    } else if (view === 'connectors') {
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillText('Outlets', 40, 140);
      guns.forEach((g, i) => {
        const y = 180 + i * 100;
        ctx.fillStyle = '#12352a';
        ctx.fillRect(40, y, 944, 84);
        ctx.fillStyle = g.status === 'Charging' ? '#7dffb3' : '#e8f5ef';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(`C${g.number}`, 60, y + 52);
        ctx.font = '22px system-ui, sans-serif';
        ctx.fillStyle = '#b7dfc8';
        ctx.fillText(`${g.status} · ${g.powerKw} kW · ${g.cablePlugged ? 'PLUGGED' : 'IDLE'}`, 160, y + 52);
      });
      if (!guns.length) {
        ctx.fillStyle = '#b7dfc8';
        ctx.fillText('No connectors configured', 40, 200);
      }
    } else if (view === 'session') {
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.fillText((c?.status || '—').toUpperCase(), 40, 160);
      ctx.fillStyle = '#c8e6d8';
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillText(`Outlet C${c?.number ?? '—'}`, 40, 220);
      ctx.fillText(`Rated ${rated} kW`, 320, 220);

      ctx.fillStyle = '#12352a';
      ctx.fillRect(40, 260, 430, 160);
      ctx.fillRect(500, 260, 430, 160);
      ctx.fillStyle = '#7dffb3';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText('ENERGY', 60, 310);
      ctx.fillText('POWER', 520, 310);
      ctx.font = 'bold 52px monospace';
      ctx.fillText(`${kwh}`, 60, 380);
      ctx.fillText(`${kw}`, 520, 380);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = '#8fd9b4';
      ctx.fillText('kWh', 280, 380);
      ctx.fillText('kW', 740, 380);

      ctx.fillStyle = '#c8e6d8';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText(`Transaction  ${c?.transactionId ?? '—'}`, 40, 480);
      ctx.fillText(`idTag  ${c?.idTag || '—'}`, 40, 530);
      ctx.fillText(`SoC  ${c?.soc != null ? `${c.soc}%` : '—'}`, 40, 580);
      ctx.fillText(`Error  ${c?.errorCode || 'NoError'}`, 420, 580);
    } else {
      // home
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText('Ready to charge', 40, 150);
      ctx.fillStyle = '#c8e6d8';
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillText('Tap card · press START · or use app remote start', 40, 210);

      ctx.fillStyle = '#12352a';
      ctx.fillRect(40, 250, 944, 140);
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillText((c?.status || 'Available').toUpperCase(), 70, 320);
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = '#b7dfc8';
      ctx.fillText(`Focused outlet  C${c?.number ?? '—'}  ·  ${rated} kW`, 70, 365);

      ctx.fillStyle = '#0d2f24';
      ctx.fillRect(40, 420, 300, 120);
      ctx.fillRect(360, 420, 300, 120);
      ctx.fillRect(680, 420, 300, 120);
      ctx.fillStyle = '#8fd9b4';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('ENERGY', 60, 460);
      ctx.fillText('POWER', 380, 460);
      ctx.fillText('OUTLETS', 700, 460);
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 36px monospace';
      ctx.fillText(`${kwh} kWh`, 60, 515);
      ctx.fillText(`${kw} kW`, 380, 515);
      ctx.fillText(String(guns.length), 700, 515);
    }

    texture.needsUpdate = true;
  });

  const hitPage = (e) => {
    e.stopPropagation();
    // Simple left/right thirds cycle for demo interaction on screen
    const order = ['home', 'session', 'connectors', 'help'];
    const idx = order.indexOf(pageRef.current);
    const next = order[(idx + 1) % order.length];
    onPageChange?.(next);
  };

  return (
    <mesh ref={meshRef} position={position} onClick={hitPage}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
