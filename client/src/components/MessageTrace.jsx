import { useMemo, useState } from 'react';

function connectorLabel(id) {
  if (id === 0) return 'Station (C0)';
  if (id == null || id === '') return 'Station / CP';
  return `C${id}`;
}

function resolveConnectorId(entry) {
  if (entry?.connectorId === 0) return 0;
  if (entry?.connectorId != null && entry?.connectorId !== '') {
    const n = Number(entry.connectorId);
    if (Number.isFinite(n)) return n;
  }
  const fromPayload = entry?.payload?.connectorId;
  if (fromPayload === 0) return 0;
  if (fromPayload != null && fromPayload !== '') {
    const n = Number(fromPayload);
    if (Number.isFinite(n)) return n;
  }
  const text = entry?.text || entry?.action || '';
  const m = String(text).match(/\bC(\d+)\b/i);
  if (m) return Number(m[1]);
  return null;
}

function scopeOf(entry) {
  const id = resolveConnectorId(entry);
  if (id === 0) return 0;
  if (id == null) return 'station';
  return id;
}

export default function MessageTrace({
  messages,
  logs,
  connectors = [],
  activeConnector = 1,
  onClear,
}) {
  const [tab, setTab] = useState('ocpp');
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState('all'); // all | station | number

  const gunIds = useMemo(() => {
    const fromState = (connectors || []).filter((c) => c.number > 0).map((c) => c.number);
    const fromMsgs = messages.map((m) => resolveConnectorId(m)).filter((n) => n != null && n > 0);
    const fromLogs = logs.map((l) => resolveConnectorId(l)).filter((n) => n != null && n > 0);
    return [...new Set([...fromState, ...fromMsgs, ...fromLogs])].sort((a, b) => a - b);
  }, [connectors, messages, logs]);

  const filterByScope = (list) => {
    if (scope === 'all') return list;
    if (scope === 'station') {
      return list.filter((e) => {
        const s = scopeOf(e);
        return s === 'station' || s === 0;
      });
    }
    const n = Number(scope);
    return list.filter((e) => Number(scopeOf(e)) === n);
  };

  const visibleMessages = filterByScope(messages);
  const visibleLogs = filterByScope(logs);

  const groupedMessages = useMemo(() => {
    if (scope !== 'all') return null;
    const map = new Map();
    for (const m of visibleMessages) {
      const key = scopeOf(m);
      const label = key === 'station' || key === 0 ? 'Station / CP' : `Connector C${key}`;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(m);
    }
    // stable order: Station first, then C1..Cn
    return [...map.entries()].sort(([a], [b]) => {
      if (a.startsWith('Station')) return -1;
      if (b.startsWith('Station')) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [visibleMessages, scope]);

  const groupedLogs = useMemo(() => {
    if (scope !== 'all') return null;
    const map = new Map();
    for (const l of visibleLogs) {
      const key = scopeOf(l);
      const label = key === 'station' || key === 0 ? 'Station / CP' : `Connector C${key}`;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(l);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a.startsWith('Station')) return -1;
      if (b.startsWith('Station')) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [visibleLogs, scope]);

  const renderOcppItem = (m) => (
    <li key={`${m.seq}-${m.ts}`} className={`trace-item ${m.direction}`}>
      <span className="dir">{m.direction === 'out' ? '→ CMS' : '← CMS'}</span>
      <span className="act">
        <span className="trace-conn">{connectorLabel(resolveConnectorId(m))}</span>
        {m.action}
      </span>
      <code>{JSON.stringify(m.payload)}</code>
    </li>
  );

  const renderLogItem = (l, i) => (
    <li key={`${l.ts}-${i}`} className={`trace-item log-${l.level}`}>
      <span className="dir">{l.level}</span>
      <span className="act">
        <span className="trace-conn">{connectorLabel(resolveConnectorId(l))}</span>
        {l.text}
      </span>
    </li>
  );

  return (
    <footer className={`trace-drawer ${open ? 'open' : ''}`}>
      <div className="trace-head">
        <button type="button" className="ghost-btn" onClick={() => setOpen((v) => !v)}>
          {open ? '▾' : '▴'} Message Trace
        </button>
        <div className="trace-tabs">
          <button
            type="button"
            className={tab === 'ocpp' ? 'active' : ''}
            onClick={() => setTab('ocpp')}
          >
            OCPP ({visibleMessages.length})
          </button>
          <button
            type="button"
            className={tab === 'log' ? 'active' : ''}
            onClick={() => setTab('log')}
          >
            System ({visibleLogs.length})
          </button>
        </div>
        <button type="button" className="ghost-btn" onClick={onClear}>
          Clear
        </button>
      </div>

      {open && (
        <>
          <div className="trace-scope-row" role="tablist" aria-label="Connector filter">
            <button
              type="button"
              className={`trace-scope ${scope === 'all' ? 'active' : ''}`}
              onClick={() => setScope('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`trace-scope ${scope === 'station' ? 'active' : ''}`}
              onClick={() => setScope('station')}
            >
              Station / CP
            </button>
            {gunIds.map((n) => (
              <button
                key={n}
                type="button"
                className={`trace-scope ${String(scope) === String(n) ? 'active' : ''} ${
                  n === activeConnector ? 'focus' : ''
                }`}
                onClick={() => setScope(n)}
              >
                C{n}
              </button>
            ))}
          </div>

          <div className="trace-body">
            {tab === 'ocpp' ? (
              visibleMessages.length === 0 ? (
                <ul className="trace-list">
                  <li className="empty-list">Waiting for OCPP frames…</li>
                </ul>
              ) : scope === 'all' && groupedMessages ? (
                groupedMessages.map(([label, items]) => (
                  <div key={label} className="trace-group">
                    <h4 className="trace-group-title">
                      {label} <span>({items.length})</span>
                    </h4>
                    <ul className="trace-list">
                      {[...items].reverse().map(renderOcppItem)}
                    </ul>
                  </div>
                ))
              ) : (
                <ul className="trace-list">
                  {[...visibleMessages].reverse().map(renderOcppItem)}
                </ul>
              )
            ) : visibleLogs.length === 0 ? (
              <ul className="trace-list">
                <li className="empty-list">No system logs</li>
              </ul>
            ) : scope === 'all' && groupedLogs ? (
              groupedLogs.map(([label, items]) => (
                <div key={label} className="trace-group">
                  <h4 className="trace-group-title">
                    {label} <span>({items.length})</span>
                  </h4>
                  <ul className="trace-list">
                    {[...items].reverse().map(renderLogItem)}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="trace-list">{[...visibleLogs].reverse().map(renderLogItem)}</ul>
            )}
          </div>
        </>
      )}
    </footer>
  );
}
