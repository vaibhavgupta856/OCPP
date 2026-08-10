import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const W = 1024;
const H = 768;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBtn(ctx, x, y, w, h, label, { fill, text, active } = {}) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = fill || '#1a4a3a';
  ctx.fill();
  if (active) {
    ctx.strokeStyle = '#7dffb3';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = text || '#e8f5ef';
  ctx.font = 'bold 22px system-ui, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

/**
 * Touch-screen HMI for the charge point — pages + on-screen soft keys
 */
export default function ChargerLcdScreen({
  connector,
  connectors = [],
  connectionState,
  cpId,
  position = [0, 2.15, 0.52],
  size = [1.55, 1.15],
  page = 'home',
  busy = false,
  onPageChange,
  onStart,
  onStop,
  onPlug,
  onTapCard,
  onClearFault,
}) {
  const meshRef = useRef();
  const pageRef = useRef(page);
  const hitZonesRef = useRef([]);
  pageRef.current = page;

  const { texture, ctx, canvas } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
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
    const isTx = !!c?.transactionId;
    const plugged = !!c?.cablePlugged;
    const zones = [];

    // glass background
    ctx.fillStyle = '#05140e';
    ctx.fillRect(0, 0, W, H);

    // subtle inner border
    ctx.strokeStyle = '#1f4a3a';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // top status bar
    ctx.fillStyle = '#0c2a20';
    ctx.fillRect(16, 16, W - 32, 70);
    ctx.fillStyle = '#7dffb3';
    ctx.font = 'bold 30px system-ui, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('PIER CHARGE POINT', 36, 52);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#9ecfb8';
    const id = String(cpId || 'CP');
    ctx.fillText(id.length > 22 ? `${id.slice(0, 20)}…` : id, 360, 52);
    ctx.font = 'bold 20px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = online ? '#7dffb3' : '#ffb74d';
    ctx.textAlign = 'right';
    ctx.fillText(online ? 'ONLINE' : String(connectionState || 'OFFLINE').toUpperCase(), W - 40, 52);

    // content area
    const contentTop = 106;
    const contentBottom = H - 210;

    if (view === 'help') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 34px system-ui, Segoe UI, sans-serif';
      ctx.fillText('How to charge', 40, contentTop + 36);
      ctx.fillStyle = '#d5eee2';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      [
        '1. Select outlet on the cabinet',
        '2. Plug cable into the vehicle',
        '3. Tap RFID or press START on screen',
        '4. Wait until status shows CHARGING',
        '5. Press STOP when finished',
        '6. Unplug and return connector',
      ].forEach((line, i) => ctx.fillText(line, 40, contentTop + 90 + i * 42));
    } else if (view === 'connectors') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 34px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Outlets', 40, contentTop + 36);
      guns.forEach((g, i) => {
        const y = contentTop + 70 + i * 88;
        if (y + 70 > contentBottom) return;
        ctx.fillStyle = '#12352a';
        roundRect(ctx, 40, y, W - 80, 76, 12);
        ctx.fill();
        ctx.fillStyle = g.status === 'Charging' ? '#7dffb3' : '#e8f5ef';
        ctx.font = 'bold 28px system-ui, Segoe UI, sans-serif';
        ctx.fillText(`C${g.number}`, 60, y + 46);
        ctx.font = '22px system-ui, Segoe UI, sans-serif';
        ctx.fillStyle = '#b7dfc8';
        ctx.fillText(
          `${g.name || `Connector ${g.number}`} · ${g.status} · ${g.powerKw} kW · ${g.cablePlugged ? 'PLUGGED' : 'IDLE'}`,
          150,
          y + 46
        );
      });
    } else if (view === 'session') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 44px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || '—').toUpperCase(), 40, contentTop + 50);
      ctx.fillStyle = '#c8e6d8';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`Outlet C${c?.number ?? '—'} · Rated ${rated} kW`, 40, contentTop + 100);

      ctx.fillStyle = '#12352a';
      roundRect(ctx, 40, contentTop + 130, 450, 150, 14);
      ctx.fill();
      roundRect(ctx, 520, contentTop + 130, 450, 150, 14);
      ctx.fill();
      ctx.fillStyle = '#8fd9b4';
      ctx.font = '20px system-ui, Segoe UI, sans-serif';
      ctx.fillText('ENERGY', 60, contentTop + 170);
      ctx.fillText('POWER', 540, contentTop + 170);
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 48px monospace';
      ctx.fillText(`${kwh} kWh`, 60, contentTop + 240);
      ctx.fillText(`${kw} kW`, 540, contentTop + 240);

      ctx.fillStyle = '#c8e6d8';
      ctx.font = '22px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`Transaction  ${c?.transactionId ?? '—'}`, 40, contentTop + 340);
      ctx.fillText(`idTag  ${c?.idTag || '—'}`, 40, contentTop + 380);
      ctx.fillText(`SoC  ${c?.soc != null ? `${c.soc}%` : '—'}  ·  ${c?.errorCode || 'NoError'}`, 40, contentTop + 420);
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 42px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Ready to charge', 40, contentTop + 44);
      ctx.fillStyle = '#c8e6d8';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Use touch buttons below · or tap RFID on the reader', 40, contentTop + 92);

      ctx.fillStyle = '#12352a';
      roundRect(ctx, 40, contentTop + 130, W - 80, 120, 14);
      ctx.fill();
      ctx.fillStyle = '#7dffb3';
      ctx.font = 'bold 36px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || 'Available').toUpperCase(), 70, contentTop + 185);
      ctx.fillStyle = '#b7dfc8';
      ctx.font = '22px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        `${c?.name || `Outlet C${c?.number ?? '—'}`} · C${c?.number ?? '—'} · ${rated} kW`,
        70,
        contentTop + 225
      );

      const tiles = [
        { x: 40, label: 'ENERGY', value: `${kwh} kWh` },
        { x: 360, label: 'POWER', value: `${kw} kW` },
        { x: 680, label: 'OUTLETS', value: String(guns.length) },
      ];
      tiles.forEach((t) => {
        ctx.fillStyle = '#0c2a20';
        roundRect(ctx, t.x, contentTop + 280, 290, 110, 12);
        ctx.fill();
        ctx.fillStyle = '#8fd9b4';
        ctx.font = '18px system-ui, Segoe UI, sans-serif';
        ctx.fillText(t.label, t.x + 24, contentTop + 320);
        ctx.fillStyle = '#7dffb3';
        ctx.font = 'bold 32px monospace';
        ctx.fillText(t.value, t.x + 24, contentTop + 365);
      });
    }

    // touch nav row
    const navY = H - 190;
    const nav = [
      { id: 'home', label: 'HOME' },
      { id: 'session', label: 'SESSION' },
      { id: 'connectors', label: 'OUTLETS' },
      { id: 'help', label: 'HELP' },
    ];
    nav.forEach((item, i) => {
      const x = 36 + i * 240;
      const active = view === item.id;
      drawBtn(ctx, x, navY, 220, 56, item.label, {
        fill: active ? '#1f7a55' : '#145c45',
        text: '#f4fff8',
        active,
      });
      zones.push({ id: `page:${item.id}`, x, y: navY, w: 220, h: 56 });
    });

    // action touch row
    const actY = H - 110;
    const actions = [
      { id: 'plug', label: plugged ? 'UNPLUG' : 'PLUG', fill: '#2a5a4a' },
      { id: 'start', label: 'START', fill: '#1f7a55', disabled: busy || isTx },
      { id: 'stop', label: 'STOP', fill: '#3a4a45', disabled: busy || !isTx },
      { id: 'card', label: 'RFID', fill: '#145c45' },
      {
        id: 'clear',
        label: 'CLEAR',
        fill: '#6b5a22',
        disabled: busy || c?.status !== 'Faulted',
      },
    ];
    actions.forEach((item, i) => {
      const x = 36 + i * 192;
      const disabled = !!item.disabled;
      drawBtn(ctx, x, actY, 176, 64, item.label, {
        fill: disabled ? '#243830' : item.fill,
        text: disabled ? '#6a8878' : '#f4fff8',
      });
      if (!disabled) zones.push({ id: item.id, x, y: actY, w: 176, h: 64 });
    });

    hitZonesRef.current = zones;
    texture.needsUpdate = true;
  });

  const onPointerDown = (e) => {
    e.stopPropagation();
    const uv = e.uv;
    if (!uv) return;
    const x = uv.x * W;
    const y = (1 - uv.y) * H;
    const hit = hitZonesRef.current.find(
      (z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h
    );
    if (!hit) return;

    if (hit.id.startsWith('page:')) {
      onPageChange?.(hit.id.slice(5));
      return;
    }
    const n = connector?.number;
    if (hit.id === 'plug') onPlug?.(n, !connector?.cablePlugged);
    if (hit.id === 'start') onStart?.(n);
    if (hit.id === 'stop') onStop?.(n);
    if (hit.id === 'card') onTapCard?.(n);
    if (hit.id === 'clear') onClearFault?.(n);
  };

  return (
    <mesh ref={meshRef} position={position} onPointerDown={onPointerDown}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
