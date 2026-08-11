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
  ctx.fillStyle = fill || '#5a2030';
  ctx.fill();
  if (active) {
    ctx.strokeStyle = '#ffb3bb';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = text || '#fff5f6';
  ctx.font = 'bold 28px system-ui, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

/**
 * Touch-screen HMI for the charge point — pages + on-screen soft keys
 */
export default function ChargerLcdScreen({
  connector,
  connectors = [],
  connectionState,
  cpId,
  identity = null,
  firmwareStatus = 'Idle',
  tariff = null,
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
  onSelectOutlet,
}) {
  const meshRef = useRef();
  const pageRef = useRef(page);
  const hitZonesRef = useRef([]);
  const identityRef = useRef(identity);
  const fwStatusRef = useRef(firmwareStatus);
  const tariffRef = useRef(tariff);
  pageRef.current = page;
  identityRef.current = identity;
  fwStatusRef.current = firmwareStatus;
  tariffRef.current = tariff;

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
    const sym = tariffRef.current?.currencySymbol || '₹';
    const rate = tariffRef.current?.energyRatePerKwh ?? 18.5;
    const costNum =
      c?.sessionCost != null
        ? Number(c.sessionCost)
        : Number((((c?.meterWh || 0) / 1000) * rate).toFixed(2));
    const costText = `${sym}${costNum.toFixed(2)}`;
    const view = pageRef.current;
    const isTx = !!c?.transactionId;
    const plugged = !!c?.cablePlugged;
    const zones = [];

    // glass background
    ctx.fillStyle = '#1a1012';
    ctx.fillRect(0, 0, W, H);

    // subtle inner border
    ctx.strokeStyle = '#5a2030';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // top status bar
    ctx.fillStyle = '#2a1218';
    ctx.fillRect(16, 16, W - 32, 70);
    ctx.fillStyle = '#ffb3bb';
    ctx.font = 'bold 30px system-ui, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MASSIVE CHARGE POINT', 36, 52);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#e8a3aa';
    const id = String(cpId || 'CP');
    ctx.fillText(id.length > 22 ? `${id.slice(0, 20)}…` : id, 360, 52);
    ctx.font = 'bold 20px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = online ? '#ffb3bb' : '#ffb74d';
    ctx.textAlign = 'right';
    ctx.fillText(online ? 'ONLINE' : String(connectionState || 'OFFLINE').toUpperCase(), W - 40, 52);

    // content area
    const contentTop = 106;
    const contentBottom = H - 210;

    if (view === 'info') {
      const idn = identityRef.current || {};
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 34px system-ui, Segoe UI, sans-serif';
      ctx.fillText('System / Firmware', 40, contentTop + 36);
      ctx.fillStyle = '#f7e4e6';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      [
        `Vendor   ${idn.chargePointVendor || 'Massive Mobility'}`,
        `Model    ${idn.chargePointModel || 'Massive-CP-Sim-16'}`,
        `Serial   ${idn.chargePointSerialNumber || cpId || '—'}`,
        `Firmware ${idn.firmwareVersion || 'Massive-CPS-16.3.2.1'}`,
        `FW state ${fwStatusRef.current || 'Idle'}`,
        'Protocol OCPP 1.6J',
        `Tariff  ${(tariffRef.current?.currencySymbol || '₹')}${Number(tariffRef.current?.energyRatePerKwh ?? 18.5).toFixed(2)}/kWh`,
      ].forEach((line, i) => ctx.fillText(line, 40, contentTop + 90 + i * 42));
      ctx.fillStyle = '#e8a3aa';
      ctx.font = '20px system-ui, Segoe UI, sans-serif';
      ctx.fillText('How to charge: plug → RFID/START → Charging → STOP → unplug', 40, contentTop + 380);
    } else if (view === 'connectors') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 34px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Outlets', 40, contentTop + 36);
      ctx.fillStyle = '#e8a3aa';
      ctx.font = '20px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Tap a row to focus that connector', 40, contentTop + 70);
      guns.forEach((g, i) => {
        const y = contentTop + 90 + i * 88;
        if (y + 70 > contentBottom) return;
        const focused = g.number === c?.number;
        ctx.fillStyle = focused ? '#5a2030' : '#3a1a22';
        roundRect(ctx, 40, y, W - 80, 76, 12);
        ctx.fill();
        if (focused) {
          ctx.strokeStyle = '#ffb3bb';
          ctx.lineWidth = 3;
          roundRect(ctx, 40, y, W - 80, 76, 12);
          ctx.stroke();
        }
        ctx.fillStyle = g.status === 'Charging' ? '#ffb3bb' : '#fff5f6';
        ctx.font = 'bold 28px system-ui, Segoe UI, sans-serif';
        ctx.fillText(`C${g.number}`, 60, y + 46);
        ctx.font = '22px system-ui, Segoe UI, sans-serif';
        ctx.fillStyle = '#e8b0b6';
        ctx.fillText(
          `${g.name || `Connector ${g.number}`} · ${g.status} · ${g.powerKw} kW · ${g.cablePlugged ? 'PLUGGED' : 'IDLE'}`,
          150,
          y + 46
        );
      });
    } else if (view === 'session') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 44px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || '—').toUpperCase(), 40, contentTop + 50);
      ctx.fillStyle = '#f0d0d4';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`Outlet C${c?.number ?? '—'} · Rated ${rated} kW`, 40, contentTop + 100);

      ctx.fillStyle = '#3a1a22';
      roundRect(ctx, 40, contentTop + 130, 300, 150, 14);
      ctx.fill();
      roundRect(ctx, 360, contentTop + 130, 300, 150, 14);
      ctx.fill();
      roundRect(ctx, 680, contentTop + 130, 300, 150, 14);
      ctx.fill();
      ctx.fillStyle = '#e8a3aa';
      ctx.font = '20px system-ui, Segoe UI, sans-serif';
      ctx.fillText('ENERGY', 60, contentTop + 170);
      ctx.fillText('POWER', 380, contentTop + 170);
      ctx.fillText('COST', 700, contentTop + 170);
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 42px monospace';
      ctx.fillText(`${kwh} kWh`, 60, contentTop + 240);
      ctx.fillText(`${kw} kW`, 380, contentTop + 240);
      ctx.fillText(costText, 700, contentTop + 240);

      ctx.fillStyle = '#f0d0d4';
      ctx.font = '22px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`Transaction  ${c?.transactionId ?? '—'}`, 40, contentTop + 340);
      ctx.fillText(`idTag  ${c?.idTag || '—'}`, 40, contentTop + 380);
      ctx.fillText(
        `Rate  ${sym}${Number(rate).toFixed(2)}/kWh  ·  SoC  ${c?.soc != null ? `${c.soc}%` : '—'}`,
        40,
        contentTop + 420
      );
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 42px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Ready to charge', 40, contentTop + 44);
      ctx.fillStyle = '#f0d0d4';
      ctx.font = '24px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Use touch buttons below · or tap RFID on the reader', 40, contentTop + 92);

      ctx.fillStyle = '#3a1a22';
      roundRect(ctx, 40, contentTop + 130, W - 80, 120, 14);
      ctx.fill();
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 36px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || 'Available').toUpperCase(), 70, contentTop + 185);
      ctx.fillStyle = '#e8b0b6';
      ctx.font = '22px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        `${c?.name || `Outlet C${c?.number ?? '—'}`} · C${c?.number ?? '—'} · ${rated} kW`,
        70,
        contentTop + 225
      );

      const tiles = [
        { x: 40, label: 'ENERGY', value: `${kwh} kWh` },
        { x: 360, label: 'POWER', value: `${kw} kW` },
        { x: 680, label: 'COST', value: costText },
      ];
      tiles.forEach((t) => {
        ctx.fillStyle = '#2a1218';
        roundRect(ctx, t.x, contentTop + 280, 290, 110, 12);
        ctx.fill();
        ctx.fillStyle = '#e8a3aa';
        ctx.font = '18px system-ui, Segoe UI, sans-serif';
        ctx.fillText(t.label, t.x + 24, contentTop + 320);
        ctx.fillStyle = '#ffb3bb';
        ctx.font = 'bold 32px monospace';
        ctx.fillText(t.value, t.x + 24, contentTop + 365);
      });

      const fw = identityRef.current?.firmwareVersion || 'Massive-CPS-16.3.2.1';
      ctx.fillStyle = '#8aa89a';
      ctx.font = '18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FW ${fw}`, 40, contentBottom - 8);
    }

    // touch nav row — 4 equal tabs with generous hit targets
    const navY = H - 200;
    const nav = [
      { id: 'home', label: 'HOME' },
      { id: 'session', label: 'SESSION' },
      { id: 'connectors', label: 'OUTLETS' },
      { id: 'info', label: 'INFO' },
    ];
    const navGap = 12;
    const navPad = 28;
    const navW = (W - navPad * 2 - navGap * (nav.length - 1)) / nav.length;
    nav.forEach((item, i) => {
      const x = navPad + i * (navW + navGap);
      const active = view === item.id;
      drawBtn(ctx, x, navY, navW, 68, item.label, {
        fill: active ? '#c02434' : '#9b1c2a',
        text: '#ffffff',
        active,
      });
      zones.push({ id: `page:${item.id}`, x: x - 4, y: navY - 4, w: navW + 8, h: 76 });
    });

    // action touch row
    const actY = H - 110;
    const actions = [
      { id: 'plug', label: plugged ? 'UNPLUG' : 'PLUG', fill: '#6b3038', w: 168 },
      { id: 'start', label: 'START', fill: '#c02434', disabled: busy || isTx, w: 168 },
      { id: 'stop', label: 'STOP', fill: '#4b5563', disabled: busy || !isTx, w: 168 },
      { id: 'card', label: 'RFID', fill: '#c02434', w: 220 },
      {
        id: 'clear',
        label: 'CLEAR',
        fill: '#b45309',
        disabled: busy || c?.status !== 'Faulted',
        w: 168,
      },
    ];
    let ax = 24;
    actions.forEach((item) => {
      const bw = item.w || 176;
      const disabled = !!item.disabled;
      drawBtn(ctx, ax, actY, bw, 72, item.label, {
        fill: disabled ? '#3f3f46' : item.fill,
        text: disabled ? '#a1a1aa' : '#ffffff',
      });
      if (!disabled) zones.push({ id: item.id, x: ax - 2, y: actY - 2, w: bw + 4, h: 76 });
      ax += bw + 12;
    });

    // On OUTLETS page, each connector row is tappable to focus that outlet
    if (view === 'connectors') {
      guns.forEach((g, i) => {
        const y = contentTop + 90 + i * 88;
        if (y + 70 > contentBottom) return;
        zones.push({ id: `outlet:${g.number}`, x: 36, y: y - 2, w: W - 72, h: 80 });
      });
    }

    hitZonesRef.current = zones;
    texture.needsUpdate = true;
  });

  const handleHit = (e) => {
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
    if (hit.id.startsWith('outlet:')) {
      const num = Number(hit.id.slice(7));
      if (Number.isFinite(num)) onSelectOutlet?.(num);
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
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={handleHit}
      onClick={handleHit}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
