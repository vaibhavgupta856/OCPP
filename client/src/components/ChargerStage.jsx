import { lazy, Suspense, useMemo, useState } from 'react';

const EvYard3D = lazy(() => import('./scene3d/EvYard3D.jsx'));

const DEFAULT_TAG = 'CARD-7F2A91';

function YardFallback() {
  return (
    <div className="ev-yard-3d roomy yard-loading">
      <div className="yard-loading-card">
        <div className="yard-loading-spinner" />
        <p>Loading station view…</p>
      </div>
    </div>
  );
}

export default function ChargerStage({
  charger,
  activeConnector,
  selectedConnectors,
  onSelectConnector,
  onToggleSelectConnector,
  busy,
  idTag,
  onIdTagChange,
  onPlug,
  onStart,
  onStop,
  onEmergency,
  onClearFault,
  onPower,
}) {
  const guns = charger.connectors.filter((c) => c.number > 0);
  const selected = selectedConnectors?.length ? selectedConnectors : [activeConnector];
  const active = guns.find((c) => c.number === activeConnector) || guns[0];
  const reconnecting =
    charger.connectionState === 'reconnecting' || charger.connectionState === 'connecting';
  const [hint, setHint] = useState('Use CP screen soft-keys · or the 2D operator panel below');

  const targets = useMemo(() => {
    const set = new Set(selected);
    return guns.filter((g) => set.has(g.number));
  }, [guns, selected]);

  if (!active) {
    return (
      <div className="empty-stage">
        <h2>No connectors</h2>
      </div>
    );
  }

  const tag = idTag || DEFAULT_TAG;
  const anyTx = targets.some((c) => !!c.transactionId);
  const allPlugged = targets.every((c) => c.cablePlugged);
  const anyFault = targets.some((c) => c.status === 'Faulted');
  const targetLabel =
    targets.length > 1 ? `C${targets.map((t) => t.number).join(', C')}` : `C${active.number}`;

  const tagsInUse = useMemo(() => {
    const used = new Set();
    for (const g of guns) {
      if (g.transactionId && g.idTag) used.add(g.idTag);
    }
    return used;
  }, [guns]);

  /** Prefer current idTag; if already charging elsewhere, pick another local tag */
  const freeTagFor = (connectorNumber) => {
    const usedElsewhere = new Set();
    for (const g of guns) {
      if (g.number !== connectorNumber && g.transactionId && g.idTag) usedElsewhere.add(g.idTag);
    }
    if (tag && !usedElsewhere.has(tag)) return tag;
    for (const t of charger.localAuthTags || []) {
      if (!usedElsewhere.has(t)) return t;
    }
    return tag;
  };

  const runOnTargets = async (fn) => {
    for (const c of targets) {
      // eslint-disable-next-line no-await-in-loop
      await fn(c.number);
    }
  };

  return (
    <div className={`charger-stage roomy ${reconnecting ? 'is-reconnecting' : ''}`}>
      <div className="stage-toolbar">
        <p className="stage-hint">{hint}</p>
        <span className="meta-pill" title="Charge point firmware">
          FW {charger.identity?.firmwareVersion || 'Massive-CPS-16.3.2.1'}
          {charger.firmwareStatus && charger.firmwareStatus !== 'Idle'
            ? ` · ${charger.firmwareStatus}`
            : ''}
        </span>
        <div className="multi-chips">
          {guns.map((c) => {
            const on = selected.includes(c.number);
            return (
              <button
                key={c.number}
                type="button"
                className={`chip-select ${on ? 'on' : ''} ${c.number === activeConnector ? 'focus' : ''}`}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey) onToggleSelectConnector(c.number);
                  else onSelectConnector(c.number);
                }}
              >
                C{c.number} · {c.powerKw} kW
                <span className="chip-status">{c.status}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Suspense fallback={<YardFallback />}>
        <EvYard3D
          connectors={charger.connectors}
          activeConnector={activeConnector}
          selectedConnectors={selected}
          online={charger.connectionState === 'online'}
          connectionState={charger.connectionState}
          cpId={charger.cpId}
          identity={charger.identity}
          firmwareStatus={charger.firmwareStatus}
          busy={busy}
          onSelectOutlet={(n) => {
            onSelectConnector(n);
            setHint(`Focus C${n}`);
          }}
          onToggleSelectOutlet={(n) => {
            onToggleSelectConnector(n);
            setHint(`Multi-select toggled C${n}`);
          }}
          onOutletPlug={(n, plugged) => {
            onSelectConnector(n);
            onPlug(n, plugged);
            setHint(`${plugged ? 'Plugged' : 'Unplugged'} C${n}`);
          }}
          onStart={(n) => {
            const t = freeTagFor(n);
            if (t !== tag) onIdTagChange(t);
            onStart(n, t);
            setHint(`Start C${n} with ${t}`);
          }}
          onStop={(n) => {
            onStop(n, 'Local');
            setHint(`Stop C${n}`);
          }}
          onEmergency={(n) => {
            onEmergency(n);
            setHint(`E-Stop C${n}`);
          }}
          onClearFault={(n) => {
            onClearFault(n);
            setHint(`Cleared fault C${n}`);
          }}
          onTapCard={(n) => {
            const t = freeTagFor(n);
            if (t !== tag) onIdTagChange(t);
            onStart(n, t);
            setHint(`Card tap → C${n} with ${t}`);
          }}
        />
      </Suspense>

      <section className="cp-2d-panel" aria-label="Charge point controls">
        <header className="cp-2d-head">
          <div>
            <h3>Operator panel</h3>
            <p>
              Acting on <strong>{targetLabel}</strong>
              {active.transactionId ? ` · Tx #${active.transactionId}` : ''}
              {` · ${active.status}`}
            </p>
          </div>
          <label className="stage-tag inline">
            idTag
            <input
              value={idTag}
              onChange={(e) => onIdTagChange(e.target.value)}
              list="stage-tags"
              placeholder={DEFAULT_TAG}
            />
            <datalist id="stage-tags">
              {(charger.localAuthTags || []).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
        </header>
        {tagsInUse.size > 0 ? (
          <p className="cp-2d-tip">
            In use now:{' '}
            {guns
              .filter((g) => g.transactionId && g.idTag)
              .map((g) => `C${g.number}=${g.idTag}`)
              .join(' · ')}
            . Each connector needs its own CMS-accepted RFID for parallel charging.
          </p>
        ) : null}

        <div className="cp-2d-actions">
          <button
            type="button"
            className="cp-btn"
            disabled={busy}
            onClick={() =>
              runOnTargets((id) => {
                const g = guns.find((x) => x.number === id);
                return onPlug(id, !g?.cablePlugged);
              }).then(() => setHint(`${allPlugged ? 'Unplugged' : 'Plugged'} ${targetLabel}`))
            }
          >
            {allPlugged ? 'Unplug' : 'Plug'} cable
          </button>
          <button
            type="button"
            className="cp-btn accent"
            disabled={busy || anyTx}
            onClick={() =>
              runOnTargets((id) => onStart(id, freeTagFor(id))).then(() =>
                setHint(`Start ${targetLabel}`)
              )
            }
          >
            Start charge
          </button>
          <button
            type="button"
            className="cp-btn"
            disabled={busy || !anyTx}
            onClick={() =>
              runOnTargets((id) => onStop(id, 'Local')).then(() => setHint(`Stop ${targetLabel}`))
            }
          >
            Stop charge
          </button>
          <button
            type="button"
            className="cp-btn accent"
            disabled={busy}
            onClick={() =>
              runOnTargets((id) => onStart(id, freeTagFor(id))).then(() =>
                setHint(`Card auth → ${targetLabel}`)
              )
            }
          >
            Tap RFID / Card
          </button>
          <button
            type="button"
            className="cp-btn danger"
            disabled={busy || !anyTx}
            onClick={() =>
              runOnTargets((id) => onEmergency(id)).then(() => setHint(`E-Stop ${targetLabel}`))
            }
          >
            Emergency stop
          </button>
          {anyFault ? (
            <button
              type="button"
              className="cp-btn warn"
              disabled={busy}
              onClick={() =>
                runOnTargets((id) => onClearFault(id)).then(() => setHint(`Cleared ${targetLabel}`))
              }
            >
              Clear fault
            </button>
          ) : null}
        </div>

        <div className="cp-2d-meta">
          <div className="per-power-row">
            {targets.map((c) => (
              <label key={c.number} className="per-power">
                C{c.number} kW
                <input
                  type="number"
                  min="1"
                  max="350"
                  step="0.1"
                  defaultValue={c.powerKw}
                  key={`${c.number}-${c.powerKw}`}
                  disabled={busy}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== c.powerKw) onPower(c.number, v);
                  }}
                />
              </label>
            ))}
          </div>
          <p className="cp-2d-tip">
            Shift/Ctrl-click outlet chips above to multi-select · 3D soft-keys control the focused
            connector
          </p>
        </div>
      </section>
    </div>
  );
}
