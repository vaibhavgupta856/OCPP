import { useState } from 'react';

const DEFAULT_URL = '';

export default function ConnectionDock({
  chargers,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  busy,
}) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState({
    cpId: '',
    baseUrl: DEFAULT_URL,
    powerKw: 22,
    connectorCount: 1,
    connectorPowers: [22],
    connectorNames: ['Connector 1'],
    requireSubprotocol: true,
    username: '',
    password: '',
  });

  const setConnectorCount = (n) => {
    const count = Number(n);
    setForm((prev) => {
      const powers = [...(prev.connectorPowers || [])];
      const names = [...(prev.connectorNames || [])];
      while (powers.length < count) powers.push(Number(prev.powerKw) || 22);
      while (names.length < count) names.push(`Connector ${names.length + 1}`);
      return {
        ...prev,
        connectorCount: count,
        connectorPowers: powers.slice(0, count),
        connectorNames: names.slice(0, count),
      };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.cpId.trim() || !form.baseUrl.trim()) return;
    const count = Number(form.connectorCount);
    const powers = Array.from({ length: count }, (_, i) =>
      Number(form.connectorPowers?.[i] ?? form.powerKw) || 22
    );
    const connectorNames = Array.from({ length: count }, (_, i) =>
      String(form.connectorNames?.[i] || '').trim() || `Connector ${i + 1}`
    );
    onAdd({
      cpId: form.cpId.trim(),
      baseUrl: form.baseUrl.trim(),
      powerKw: powers[0],
      connectorCount: count,
      connectorPowers: powers,
      connectorNames,
      requireSubprotocol: form.requireSubprotocol,
      basicAuth:
        form.username.trim()
          ? { username: form.username.trim(), password: form.password }
          : null,
    });
  };

  return (
    <div className="dock">
      <div className="dock-head">
        <h2>Stations</h2>
        <button type="button" className="ghost-btn" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide form' : 'Commission'}
        </button>
      </div>

      {open && (
        <form className="dock-form" onSubmit={submit}>
          <label>
            Charge Point ID
            <input
              value={form.cpId}
              onChange={(e) => setForm({ ...form, cpId: e.target.value })}
              placeholder="EVSE-LAB-001"
              required
            />
          </label>
          <label>
            CSMS WebSocket base
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="wss://csms.example.com/ocpp/1.6"
              required
            />
          </label>
          <div className="form-row">
            <label>
              Default kW
              <input
                type="number"
                min="1"
                max="350"
                step="0.1"
                value={form.powerKw}
                onChange={(e) =>
                  setForm({
                    ...form,
                    powerKw: e.target.value,
                    connectorPowers: (form.connectorPowers || []).map(() => Number(e.target.value) || 22),
                  })
                }
              />
            </label>
            <label>
              Connectors
              <select
                value={form.connectorCount}
                onChange={(e) => setConnectorCount(e.target.value)}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {Number(form.connectorCount) > 0 && (
            <div className="per-conn-powers">
              {Array.from({ length: Number(form.connectorCount) }, (_, i) => (
                <label key={`kw-${i}`}>
                  C{i + 1} kW
                  <input
                    type="number"
                    min="1"
                    max="350"
                    step="0.1"
                    value={form.connectorPowers?.[i] ?? form.powerKw}
                    onChange={(e) => {
                      const next = [...(form.connectorPowers || [])];
                      next[i] = e.target.value;
                      setForm({ ...form, connectorPowers: next });
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {Number(form.connectorCount) > 0 && (
            <div className="per-conn-names">
              {Array.from({ length: Number(form.connectorCount) }, (_, i) => (
                <label key={`name-${i}`}>
                  C{i + 1} name
                  <input
                    value={form.connectorNames?.[i] ?? `Connector ${i + 1}`}
                    onChange={(e) => {
                      const next = [...(form.connectorNames || [])];
                      next[i] = e.target.value;
                      setForm({ ...form, connectorNames: next });
                    }}
                    placeholder={`Connector ${i + 1}`}
                    maxLength={40}
                  />
                </label>
              ))}
            </div>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.requireSubprotocol}
              onChange={(e) => setForm({ ...form, requireSubprotocol: e.target.checked })}
            />
            Require <code>ocpp1.6</code> subprotocol
          </label>
          <details className="auth-details">
            <summary>Basic Auth (optional)</summary>
            <label>
              Username
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="off"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="off"
              />
            </label>
          </details>
          <button type="submit" className="primary-btn" disabled={busy}>
            Connect EVSE
          </button>
        </form>
      )}

      <ul className="station-list">
        {chargers.length === 0 && <li className="empty-list">No stations yet</li>}
        {chargers.map((c) => (
          <li key={c.cpId}>
            <button
              type="button"
              className={`station-item ${selectedId === c.cpId ? 'active' : ''}`}
              onClick={() => onSelect(c.cpId)}
            >
              <span className={`dot ${c.connectionState}`} />
              <span className="station-meta">
                <strong>{c.cpId}</strong>
                <small>
                  {c.powerKw} kW · {c.connectionState}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="icon-x"
              title="Remove"
              onClick={() => onRemove(c.cpId)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
