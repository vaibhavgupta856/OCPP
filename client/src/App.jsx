import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import ConnectionDock from './components/ConnectionDock.jsx';
import ChargerStage from './components/ChargerStage.jsx';
import ActionBar from './components/ActionBar.jsx';
import MessageTrace from './components/MessageTrace.jsx';
import PanelChrome from './components/PanelChrome.jsx';
import { usePanelLayout } from './hooks/usePanelLayout.js';
import './styles/console.css';

const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
};

export default function App() {
  const [chargers, setChargers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeConnector, setActiveConnector] = useState(1);
  const [selectedConnectors, setSelectedConnectors] = useState([1]);
  const [idTag, setIdTag] = useState('CARD-7F2A91');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [benchOpen, setBenchOpen] = useState(true);
  const {
    layout,
    setLeftWidth,
    setRightWidth,
    setTraceHeight,
    setTraceOpen,
    setFloat,
    moveFloat,
    dock,
  } = usePanelLayout();

  const leftFloating = !!layout.floats.left;
  const rightFloating = !!layout.floats.right;
  const traceFloating = !!layout.floats.trace;

  const selected = useMemo(
    () => chargers.find((c) => c.cpId === selectedId) || null,
    [chargers, selectedId]
  );

  const gridColumns = useMemo(() => {
    const parts = [];
    if (!leftFloating) parts.push(`${layout.leftWidth}px`);
    parts.push('minmax(0, 1fr)');
    if (benchOpen && !rightFloating) parts.push(`${layout.rightWidth}px`);
    return parts.join(' ');
  }, [leftFloating, rightFloating, benchOpen, layout.leftWidth, layout.rightWidth]);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });

    socket.on('cp:snapshot', (payload) => {
      setChargers(payload.chargers || []);
      if (!selectedId && payload.chargers?.[0]) {
        setSelectedId(payload.chargers[0].cpId);
      }
    });

    socket.on('cp:state', (state) => {
      setChargers((prev) => {
        const idx = prev.findIndex((c) => c.cpId === state.cpId);
        if (idx === -1) return [...prev, state];
        const next = [...prev];
        next[idx] = state;
        return next;
      });
    });

    socket.on('cp:removed', ({ cpId }) => {
      setChargers((prev) => prev.filter((c) => c.cpId !== cpId));
      setSelectedId((cur) => (cur === cpId ? null : cur));
    });

    socket.on('cp:message', (msg) => {
      if (msg.kind === 'ocpp') {
        setMessages((prev) => [...prev.slice(-199), msg]);
      }
    });

    socket.on('cp:log', (entry) => {
      setLogs((prev) => [...prev.slice(-99), entry]);
    });

    api('/api/chargers')
      .then((data) => {
        setChargers(data.chargers || []);
        if (data.chargers?.[0]) setSelectedId(data.chargers[0].cpId);
      })
      .catch(() => {});

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const guns = selected.connectors.filter((c) => c.number > 0).map((c) => c.number);
    if (!guns.length) return;
    if (!guns.includes(activeConnector)) {
      setActiveConnector(guns[0]);
      setSelectedConnectors([guns[0]]);
      return;
    }
    setSelectedConnectors((prev) => {
      const next = prev.filter((n) => guns.includes(n));
      return next.length ? next : [activeConnector];
    });
  }, [selected, activeConnector]);

  const selectConnector = (n) => {
    setActiveConnector(n);
    setSelectedConnectors([n]);
  };

  const toggleSelectConnector = (n) => {
    setSelectedConnectors((prev) => {
      const has = prev.includes(n);
      let next;
      if (has) {
        next = prev.filter((x) => x !== n);
        if (!next.length) next = [n];
      } else {
        next = [...prev, n];
      }
      setActiveConnector(n);
      return next;
    });
  };

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      return { ok: true, result };
    } catch (err) {
      setError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setBusy(false);
    }
  }, []);

  const addCharger = (form) =>
    run(async () => {
      const data = await api('/api/chargers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSelectedId(data.charger.cpId);
      setActiveConnector(1);
      setSelectedConnectors([1]);
    });

  const removeCharger = (cpId) =>
    run(async () => {
      await api(`/api/chargers/${encodeURIComponent(cpId)}`, { method: 'DELETE' });
    });

  const act = (path, body) =>
    run(async () => {
      if (!selectedId) throw new Error('No charger selected');
      await api(`/api/chargers/${encodeURIComponent(selectedId)}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    });

  return (
    <div className="console-shell yard-first">
      <header className="console-top">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden>
            <span />
          </div>
          <div>
            <h1 className="brand-name">Massive Mobility</h1>
            <p className="brand-sub">Charging Simulator · Workspace: Massive Charging · ui-c50da2f</p>
          </div>
        </div>
        <div className="top-meta">
          <span className="meta-pill">{chargers.length} charger{chargers.length === 1 ? '' : 's'}</span>
          {selected && (
            <span className={`meta-pill link-${selected.connectionState}`}>
              {selected.connectionState}
            </span>
          )}
          <button type="button" className="ghost-btn" onClick={() => setBenchOpen((v) => !v)}>
            {benchOpen ? 'Hide bench' : 'Bench controls'}
          </button>
        </div>
      </header>

      <div className="console-body with-panels" style={{ gridTemplateColumns: gridColumns }}>
        {!leftFloating && (
          <PanelChrome
            id="left"
            className="rail"
            width={layout.leftWidth}
            resizeEdge="right"
            onResizeWidth={(dx) => setLeftWidth((w) => w + dx)}
            onFloat={(pos) => setFloat('left', pos)}
            onMove={(dx, dy) => moveFloat('left', dx, dy)}
            onDock={() => dock('left')}
          >
            <ConnectionDock
              chargers={chargers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={addCharger}
              onRemove={removeCharger}
              busy={busy}
            />
          </PanelChrome>
        )}

        <main className="stage-wrap roomy">
          {selected ? (
            <ChargerStage
              charger={selected}
              activeConnector={activeConnector}
              selectedConnectors={selectedConnectors}
              onSelectConnector={selectConnector}
              onToggleSelectConnector={toggleSelectConnector}
              busy={busy}
              idTag={idTag}
              onIdTagChange={setIdTag}
              onPlug={(connectorId, plugged) => act('/plug', { connectorId, plugged })}
              onStart={(connectorId, tag) => act('/start', { connectorId, idTag: tag })}
              onStop={(connectorId, reason) => act('/stop', { connectorId, reason })}
              onEmergency={(connectorId) => act('/emergency-stop', { connectorId })}
              onClearFault={(connectorId) => act('/clear-fault', { connectorId })}
              onPower={(connectorId, powerKw) => act('/power', { connectorId, powerKw })}
              onAuthMode={(authMode) => act('/auth-mode', { authMode })}
              onAddTag={(tag) => act('/local-tag', { idTag: tag })}
            />
          ) : (
            <div className="empty-stage">
              <h2>No charger on the bench</h2>
              <p>Commission a charge point from the left rail to open the yard.</p>
            </div>
          )}
        </main>

        {benchOpen && !rightFloating && (
          <PanelChrome
            id="right"
            className="controls-rail"
            width={layout.rightWidth}
            resizeEdge="left"
            onResizeWidth={(dx) => setRightWidth((w) => w + dx)}
            onFloat={(pos) => setFloat('right', pos)}
            onMove={(dx, dy) => moveFloat('right', dx, dy)}
            onDock={() => dock('right')}
          >
            <ActionBar
              charger={selected}
              connectorId={activeConnector}
              selectedConnectors={selectedConnectors}
              busy={busy}
              idTag={idTag}
              onIdTagChange={setIdTag}
              onPlug={(plugged) => act('/plug', { connectorId: activeConnector, plugged })}
              onStart={(tag) => act('/start', { connectorId: activeConnector, idTag: tag })}
              onStop={(reason) => act('/stop', { connectorId: activeConnector, reason })}
              onEmergency={() => act('/emergency-stop', { connectorId: activeConnector })}
              onFault={(errorCode) => act('/fault', { connectorId: activeConnector, errorCode })}
              onClearFault={() => act('/clear-fault', { connectorId: activeConnector })}
              onSuspend={(who) => act('/suspend', { connectorId: activeConnector, who })}
              onType={(type) => act('/connector-type', { connectorId: activeConnector, type })}
              onName={(name) => act('/connector-name', { connectorId: activeConnector, name })}
              onPower={(powerKw) => act('/power', { connectorId: activeConnector, powerKw })}
              onSoc={(cfg) =>
                act('/soc', {
                  connectorId: activeConnector,
                  energyKwh: cfg.energyKwh,
                  batteryKwh: cfg.batteryKwh,
                  fillMode: cfg.fillMode,
                  fillEnergyKwh: cfg.fillEnergyKwh,
                  fillMoney: cfg.fillMoney,
                  fillMinutes: cfg.fillMinutes,
                })
              }
              onReconnect={(requireSubprotocol) => act('/reconnect', { requireSubprotocol })}
              onReset={(type) => act('/reset', { type })}
              onAddTag={(tag) => act('/local-tag', { idTag: tag })}
              onAuthMode={(authMode) => act('/auth-mode', { authMode })}
              onTariff={(tariff) => act('/tariff', tariff)}
            />
          </PanelChrome>
        )}
      </div>

      {error && (
        <div className="toast-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>
            dismiss
          </button>
        </div>
      )}

      {!traceFloating && (
        <PanelChrome
          id="trace"
          className="trace-dock"
          resizeEdge="top"
          onResizeHeight={(dy) => {
            if (!layout.traceOpen) setTraceOpen(true);
            setTraceHeight((h) => h + dy);
          }}
          onFloat={(pos) => setFloat('trace', { ...pos, w: 520, h: layout.traceHeight })}
          onMove={(dx, dy) => moveFloat('trace', dx, dy)}
          onDock={() => dock('trace')}
        >
          <MessageTrace
            messages={messages.filter((m) => !selectedId || m.cpId === selectedId)}
            logs={logs.filter((l) => !selectedId || l.cpId === selectedId)}
            connectors={selected?.connectors || []}
            activeConnector={activeConnector}
            open={layout.traceOpen}
            onOpenChange={setTraceOpen}
            bodyHeight={layout.traceHeight}
            onClear={() => {
              setMessages([]);
              setLogs([]);
            }}
          />
        </PanelChrome>
      )}

      {leftFloating && (
        <PanelChrome
          id="left"
          className="rail rail-float"
          floating
          position={layout.floats.left}
          width={layout.leftWidth}
          onResizeWidth={(dx) => setLeftWidth((w) => w + dx)}
          onFloat={(pos) => setFloat('left', pos)}
          onMove={(dx, dy) => moveFloat('left', dx, dy)}
          onDock={() => dock('left')}
        >
          <ConnectionDock
            chargers={chargers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addCharger}
            onRemove={removeCharger}
            busy={busy}
          />
        </PanelChrome>
      )}

      {benchOpen && rightFloating && (
        <PanelChrome
          id="right"
          className="controls-rail rail-float"
          floating
          position={layout.floats.right}
          width={layout.rightWidth}
          onResizeWidth={(dx) => setRightWidth((w) => w + dx)}
          onFloat={(pos) => setFloat('right', pos)}
          onMove={(dx, dy) => moveFloat('right', dx, dy)}
          onDock={() => dock('right')}
        >
          <ActionBar
            charger={selected}
            connectorId={activeConnector}
            selectedConnectors={selectedConnectors}
            busy={busy}
            idTag={idTag}
            onIdTagChange={setIdTag}
            onPlug={(plugged) => act('/plug', { connectorId: activeConnector, plugged })}
            onStart={(tag) => act('/start', { connectorId: activeConnector, idTag: tag })}
            onStop={(reason) => act('/stop', { connectorId: activeConnector, reason })}
            onEmergency={() => act('/emergency-stop', { connectorId: activeConnector })}
            onFault={(errorCode) => act('/fault', { connectorId: activeConnector, errorCode })}
            onClearFault={() => act('/clear-fault', { connectorId: activeConnector })}
            onSuspend={(who) => act('/suspend', { connectorId: activeConnector, who })}
            onType={(type) => act('/connector-type', { connectorId: activeConnector, type })}
            onName={(name) => act('/connector-name', { connectorId: activeConnector, name })}
            onPower={(powerKw) => act('/power', { connectorId: activeConnector, powerKw })}
            onSoc={(cfg) =>
              act('/soc', {
                connectorId: activeConnector,
                energyKwh: cfg.energyKwh,
                batteryKwh: cfg.batteryKwh,
                fillMode: cfg.fillMode,
                fillEnergyKwh: cfg.fillEnergyKwh,
                fillMoney: cfg.fillMoney,
                fillMinutes: cfg.fillMinutes,
              })
            }
            onReconnect={(requireSubprotocol) => act('/reconnect', { requireSubprotocol })}
            onReset={(type) => act('/reset', { type })}
            onAddTag={(tag) => act('/local-tag', { idTag: tag })}
            onAuthMode={(authMode) => act('/auth-mode', { authMode })}
            onTariff={(tariff) => act('/tariff', tariff)}
          />
        </PanelChrome>
      )}

      {traceFloating && (
        <PanelChrome
          id="trace"
          className="trace-dock rail-float"
          floating
          position={layout.floats.trace}
          width={layout.floats.trace?.w || 520}
          height={(layout.floats.trace?.h || layout.traceHeight) + 100}
          onResizeWidth={(dx) =>
            setFloat('trace', (pos) => ({
              ...(pos || { x: 24, y: 72 }),
              w: Math.max(320, (pos?.w || 520) + dx),
              h: pos?.h || layout.traceHeight,
            }))
          }
          onResizeHeight={(dy) => {
            if (!layout.traceOpen) setTraceOpen(true);
            setTraceHeight((h) => h + dy);
            setFloat('trace', (pos) => ({
              ...(pos || { x: 24, y: 72 }),
              w: pos?.w || 520,
              h: Math.max(72, (pos?.h || layout.traceHeight) + dy),
            }));
          }}
          onMove={(dx, dy) => moveFloat('trace', dx, dy)}
          onDock={() => dock('trace')}
        >
          <MessageTrace
            messages={messages.filter((m) => !selectedId || m.cpId === selectedId)}
            logs={logs.filter((l) => !selectedId || l.cpId === selectedId)}
            connectors={selected?.connectors || []}
            activeConnector={activeConnector}
            open={layout.traceOpen}
            onOpenChange={setTraceOpen}
            bodyHeight={layout.floats.trace?.h || layout.traceHeight}
            onClear={() => {
              setMessages([]);
              setLogs([]);
            }}
          />
        </PanelChrome>
      )}
    </div>
  );
}
