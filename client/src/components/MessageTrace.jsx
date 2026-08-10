import { useState } from 'react';

export default function MessageTrace({ messages, logs, onClear }) {
  const [tab, setTab] = useState('ocpp');
  const [open, setOpen] = useState(true);

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
            OCPP ({messages.length})
          </button>
          <button
            type="button"
            className={tab === 'log' ? 'active' : ''}
            onClick={() => setTab('log')}
          >
            System ({logs.length})
          </button>
        </div>
        <button type="button" className="ghost-btn" onClick={onClear}>
          Clear
        </button>
      </div>

      {open && (
        <div className="trace-body">
          {tab === 'ocpp' ? (
            <ul className="trace-list">
              {messages.length === 0 && <li className="empty-list">Waiting for OCPP frames…</li>}
              {[...messages].reverse().map((m) => (
                <li key={`${m.seq}-${m.ts}`} className={`trace-item ${m.direction}`}>
                  <span className="dir">{m.direction === 'out' ? '→ CMS' : '← CMS'}</span>
                  <span className="act">{m.action}</span>
                  <code>{JSON.stringify(m.payload)}</code>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="trace-list">
              {logs.length === 0 && <li className="empty-list">No system logs</li>}
              {[...logs].reverse().map((l, i) => (
                <li key={`${l.ts}-${i}`} className={`trace-item log-${l.level}`}>
                  <span className="dir">{l.level}</span>
                  <span className="act">{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </footer>
  );
}
