import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const W = 1280;
const H = 960;

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
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = fill || '#5a2030';
  ctx.fill();
  if (active) {
    ctx.strokeStyle = '#ffb3bb';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.fillStyle = text || '#fff5f6';
  ctx.font = 'bold 50px system-ui, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function formatMem(mb) {
  const n = Number(mb) || 0;
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} GB`;
  return `${Math.round(n)} MB`;
}

function formatUptime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Touch-screen HMI for the charge point — pages + on-screen soft keys only
 * (no duplicate physical buttons on the cabinet face).
 */
export default function ChargerLcdScreen({
  connector,
  connectors = [],
  connectionState,
  cpId,
  identity = null,
  hardware = null,
  firmwareStatus = 'Idle',
  tariff = null,
  position = [0, 2.15, 0.52],
  size = [1.55, 1.15],
  page = 'home',
  busy = false,
  /** Soft keys + action row on the live HMI; preview panels omit them */
  showButtons = true,
  /** When false, mesh is display-only (no hit testing) */
  interactive = true,
  visible = true,
  onHoverChange,
  onPageChange,
  onStart,
  onStop,
  onPlug,
  onClearFault,
  onSelectOutlet,
}) {
  const meshRef = useRef();
  const pageRef = useRef(page);
  const hitZonesRef = useRef([]);
  const identityRef = useRef(identity);
  const hardwareRef = useRef(hardware);
  const fwStatusRef = useRef(firmwareStatus);
  const tariffRef = useRef(tariff);
  const showButtonsRef = useRef(showButtons);
  pageRef.current = page;
  identityRef.current = identity;
  hardwareRef.current = hardware;
  fwStatusRef.current = firmwareStatus;
  tariffRef.current = tariff;
  showButtonsRef.current = showButtons;

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
    let rate = Number(tariffRef.current?.energyRatePerKwh);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1e5) rate = 18.5;
    const costRaw =
      c?.sessionCost != null
        ? Number(c.sessionCost)
        : Number((((c?.meterWh || 0) / 1000) * rate).toFixed(2));
    const costNum = Number.isFinite(costRaw) && Math.abs(costRaw) < 1e9 ? costRaw : 0;
    const costText = `${sym}${costNum.toFixed(2)}`;
    const view = pageRef.current;
    const isTx = !!c?.transactionId;
    const plugged = !!c?.cablePlugged;
    const txDisplay = isTx
      ? String(c.transactionId)
      : c?.lastTransactionId != null
        ? String(c.lastTransactionId)
        : '—';
    const tagDisplay = isTx
      ? String(c.idTag || '—')
      : c?.lastIdTag
        ? String(c.lastIdTag)
        : '—';
    const txLabel = isTx ? 'Transaction' : 'Last transaction';
    const tagLabel = isTx ? 'idTag' : 'Last idTag';
    const zones = [];

    ctx.fillStyle = '#1a1012';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#5a2030';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    // top status bar
    ctx.fillStyle = '#2a1218';
    ctx.fillRect(20, 20, W - 40, 100);
    ctx.fillStyle = '#ffb3bb';
    ctx.font = 'bold 54px system-ui, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MASSIVE CHARGE POINT', 44, 70);
    ctx.font = '34px monospace';
    ctx.fillStyle = '#e8a3aa';
    const id = String(cpId || 'CP');
    ctx.fillText(id.length > 18 ? `${id.slice(0, 16)}…` : id, 560, 70);
    ctx.font = 'bold 36px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = online ? '#ffb3bb' : '#ffb74d';
    ctx.textAlign = 'right';
    ctx.fillText(online ? 'ONLINE' : String(connectionState || 'OFFLINE').toUpperCase(), W - 48, 70);

    const withButtons = showButtonsRef.current;
    const contentTop = 140;
    const contentBottom = withButtons ? H - 240 : H - 48;

    if (view === 'info') {
      const idn = identityRef.current || {};
      const hw = hardwareRef.current || {};
      const mode = hw.chargeMode || 'AC';
      const modeLabel =
        mode === 'DC' ? 'DC fast charger' : mode === 'AC/DC' ? 'AC/DC mixed charger' : 'AC charger';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 48px system-ui, Segoe UI, sans-serif';
      ctx.fillText('System / Hardware', 48, contentTop + 40);

      ctx.fillStyle = '#f7e4e6';
      ctx.font = '32px system-ui, Segoe UI, sans-serif';
      const leftLines = [
        `Vendor   ${idn.chargePointVendor || 'Massive Mobility'}`,
        `Model    ${idn.chargePointModel || 'Massive-CP-Sim-16'}`,
        `Serial   ${idn.chargePointSerialNumber || cpId || '—'}`,
        `Firmware ${idn.firmwareVersion || 'Massive-CPS-16.3.2.1'}`,
        `FW state ${fwStatusRef.current || 'Idle'}`,
        `Type     ${modeLabel}`,
        `Supply   ${hw.supply || '—'}`,
        `CPU      ${hw.cpuModel || '—'}`,
      ];
      leftLines.forEach((line, i) => ctx.fillText(line, 48, contentTop + 86 + i * 40));

      const tileY = contentTop + 420;
      const tiles = [
        { x: 48, label: 'CPU LIVE', value: `${hw.cpuPercent != null ? hw.cpuPercent : '—'}%` },
        {
          x: 460,
          label: 'RAM',
          value: `${formatMem(hw.ramUsedMb)}/${formatMem(hw.ramTotalMb)}`,
        },
        {
          x: 872,
          label: 'CABINET',
          value: `${hw.tempC != null ? `${hw.tempC}°C` : '—'}`,
        },
      ];
      tiles.forEach((t) => {
        ctx.fillStyle = '#3a1a22';
        roundRect(ctx, t.x, tileY, 360, 100, 14);
        ctx.fill();
        ctx.fillStyle = '#e8a3aa';
        ctx.font = '28px system-ui, Segoe UI, sans-serif';
        ctx.fillText(t.label, t.x + 22, tileY + 34);
        ctx.fillStyle = '#ffb3bb';
        ctx.font = 'bold 42px monospace';
        ctx.fillText(t.value, t.x + 22, tileY + 76);
      });

      ctx.fillStyle = '#e8a3aa';
      ctx.font = '30px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        `ROM ${formatMem(hw.romUsedMb)} / ${formatMem(hw.romTotalMb)}  ·  Module ${
          hw.moduleTempC != null ? `${hw.moduleTempC}°C` : '—'
        }  ·  Uptime ${formatUptime(hw.uptimeSec)}`,
        48,
        tileY + 128
      );
      ctx.fillText(
        `Cooling ${hw.cooling || '—'}  ·  OCPP 1.6J  ·  ${(tariffRef.current?.currencySymbol || '₹')}${rate.toFixed(2)}/kWh`,
        48,
        tileY + 164
      );
    } else if (view === 'connectors') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 58px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Outlets', 48, contentTop + 52);
      ctx.fillStyle = '#e8a3aa';
      ctx.font = '34px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        withButtons ? 'Tap a row to focus that connector' : 'Connector status overview',
        48,
        contentTop + 102
      );
      guns.forEach((g, i) => {
        const y = contentTop + 128 + i * 108;
        if (y + 94 > contentBottom) return;
        const focused = g.number === c?.number;
        ctx.fillStyle = focused ? '#5a2030' : '#3a1a22';
        roundRect(ctx, 48, y, W - 96, 96, 14);
        ctx.fill();
        if (focused) {
          ctx.strokeStyle = '#ffb3bb';
          ctx.lineWidth = 4;
          roundRect(ctx, 48, y, W - 96, 96, 14);
          ctx.stroke();
        }
        ctx.fillStyle = g.status === 'Charging' ? '#ffb3bb' : '#fff5f6';
        ctx.font = 'bold 48px system-ui, Segoe UI, sans-serif';
        ctx.fillText(`C${g.number}`, 72, y + 58);
        ctx.font = '36px system-ui, Segoe UI, sans-serif';
        ctx.fillStyle = '#e8b0b6';
        ctx.fillText(
          `${g.name || `Connector ${g.number}`} · ${g.status} · ${g.powerKw} kW · ${g.cablePlugged ? 'PLUGGED' : 'IDLE'}`,
          180,
          y + 58
        );
      });
    } else if (view === 'session') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 68px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || '—').toUpperCase(), 48, contentTop + 62);
      ctx.fillStyle = '#f0d0d4';
      ctx.font = '40px system-ui, Segoe UI, sans-serif';
      ctx.fillText(`Outlet C${c?.number ?? '—'} · Rated ${rated} kW`, 48, contentTop + 124);

      const tileW = 360;
      const tileH = 178;
      const tileY = contentTop + 156;
      [
        { x: 48, label: 'ENERGY', value: `${kwh} kWh` },
        { x: 460, label: 'POWER', value: `${kw} kW` },
        { x: 872, label: 'COST', value: costText },
      ].forEach((t) => {
        ctx.fillStyle = '#3a1a22';
        roundRect(ctx, t.x, tileY, tileW, tileH, 16);
        ctx.fill();
        ctx.fillStyle = '#e8a3aa';
        ctx.font = '34px system-ui, Segoe UI, sans-serif';
        ctx.fillText(t.label, t.x + 28, tileY + 50);
        ctx.fillStyle = '#ffb3bb';
        ctx.font = 'bold 64px monospace';
        ctx.fillText(t.value, t.x + 28, tileY + 126);
      });

      ctx.fillStyle = '#3a1a22';
      roundRect(ctx, 48, contentTop + 358, W - 96, 158, 16);
      ctx.fill();
      ctx.fillStyle = '#e8a3aa';
      ctx.font = '32px system-ui, Segoe UI, sans-serif';
      ctx.fillText(txLabel, 72, contentTop + 402);
      ctx.fillText(tagLabel, 72, contentTop + 458);
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 48px monospace';
      ctx.fillText(txDisplay, 340, contentTop + 402);
      ctx.fillText(tagDisplay, 340, contentTop + 458);

      ctx.fillStyle = '#f0d0d4';
      ctx.font = '34px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        `Rate  ${sym}${rate.toFixed(2)}/kWh  ·  SoC  ${c?.soc != null ? `${c.soc}%` : '—'}`,
        48,
        contentTop + 545
      );
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 66px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Ready to charge', 48, contentTop + 56);
      ctx.fillStyle = '#f0d0d4';
      ctx.font = '38px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        withButtons
          ? 'Use the touch buttons below · or the RFID pad'
          : 'Outlet status and session meters',
        48,
        contentTop + 116
      );

      ctx.fillStyle = '#3a1a22';
      roundRect(ctx, 48, contentTop + 156, W - 96, 150, 16);
      ctx.fill();
      ctx.fillStyle = '#ffb3bb';
      ctx.font = 'bold 56px system-ui, Segoe UI, sans-serif';
      ctx.fillText((c?.status || 'Available').toUpperCase(), 80, contentTop + 226);
      ctx.fillStyle = '#e8b0b6';
      ctx.font = '36px system-ui, Segoe UI, sans-serif';
      ctx.fillText(
        `${c?.name || `Outlet C${c?.number ?? '—'}`} · C${c?.number ?? '—'} · ${rated} kW`,
        80,
        contentTop + 274
      );

      const tiles = [
        { x: 48, label: 'ENERGY', value: `${kwh} kWh` },
        { x: 460, label: 'POWER', value: `${kw} kW` },
        { x: 872, label: 'COST', value: costText },
      ];
      tiles.forEach((t) => {
        ctx.fillStyle = '#2a1218';
        roundRect(ctx, t.x, contentTop + 332, 360, 140, 14);
        ctx.fill();
        ctx.fillStyle = '#e8a3aa';
        ctx.font = '32px system-ui, Segoe UI, sans-serif';
        ctx.fillText(t.label, t.x + 28, contentTop + 380);
        ctx.fillStyle = '#ffb3bb';
        ctx.font = 'bold 52px monospace';
        ctx.fillText(t.value, t.x + 28, contentTop + 438);
      });

      const fw = identityRef.current?.firmwareVersion || 'Massive-CPS-16.3.2.1';
      ctx.fillStyle = '#8aa89a';
      ctx.font = '32px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FW ${fw}`, 48, contentBottom - 10);
    }

    if (withButtons) {
      // touch nav — only navigation (no duplicate physical page keys)
      const navY = H - 220;
      const nav = [
        { id: 'home', label: 'HOME' },
        { id: 'session', label: 'SESSION' },
        { id: 'connectors', label: 'OUTLETS' },
        { id: 'info', label: 'INFO' },
      ];
      const navGap = 14;
      const navPad = 32;
      const navW = (W - navPad * 2 - navGap * (nav.length - 1)) / nav.length;
      nav.forEach((item, i) => {
        const x = navPad + i * (navW + navGap);
        const active = view === item.id;
        drawBtn(ctx, x, navY, navW, 82, item.label, {
          fill: active ? '#c02434' : '#9b1c2a',
          text: '#ffffff',
          active,
        });
        zones.push({ id: `page:${item.id}`, x: x - 4, y: navY - 4, w: navW + 8, h: 90 });
      });

      // action touch row — PLUG / START / STOP / CLEAR (RFID is the physical pad only)
      const actY = H - 118;
      const actions = [
        { id: 'plug', label: plugged ? 'UNPLUG' : 'PLUG', fill: '#6b3038', w: 280 },
        { id: 'start', label: 'START', fill: '#c02434', disabled: busy || isTx, w: 280 },
        { id: 'stop', label: 'STOP', fill: '#4b5563', disabled: busy || !isTx, w: 280 },
        {
          id: 'clear',
          label: 'CLEAR',
          fill: '#b45309',
          disabled: busy || c?.status !== 'Faulted',
          w: 280,
        },
      ];
      let ax = 36;
      const gap = (W - 72 - actions.reduce((s, a) => s + a.w, 0)) / (actions.length - 1);
      actions.forEach((item) => {
        const bw = item.w;
        const disabled = !!item.disabled;
        drawBtn(ctx, ax, actY, bw, 86, item.label, {
          fill: disabled ? '#3f3f46' : item.fill,
          text: disabled ? '#a1a1aa' : '#ffffff',
        });
        if (!disabled) zones.push({ id: item.id, x: ax - 2, y: actY - 2, w: bw + 4, h: 90 });
        ax += bw + gap;
      });

      if (view === 'connectors') {
        guns.forEach((g, i) => {
          const y = contentTop + 128 + i * 108;
          if (y + 94 > contentBottom) return;
          zones.push({ id: `outlet:${g.number}`, x: 44, y: y - 2, w: W - 88, h: 100 });
        });
      }
    }

    hitZonesRef.current = zones;
    texture.needsUpdate = true;
  });

  const handleHit = (e) => {
    if (!interactive || !showButtons) return;
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
    if (hit.id === 'clear') onClearFault?.(n);
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      visible={visible}
      onPointerDown={interactive ? handleHit : undefined}
      onClick={interactive ? handleHit : undefined}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = interactive ? 'pointer' : 'default';
        onHoverChange?.(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
        onHoverChange?.(false);
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
