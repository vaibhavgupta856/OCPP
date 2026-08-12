import { useState } from 'react';

export default function RfidPad({ value, onChange, presets = [], onAddTag, onTap, busy = false }) {
  const [custom, setCustom] = useState('');
  const [outcome, setOutcome] = useState(null); // 'ok' | 'fail' | 'pending'

  const handleTap = async () => {
    if (busy || !onTap || outcome === 'pending') return;
    setOutcome('pending');
    try {
      const result = await onTap(value);
      const accepted = result == null || result === true || result?.ok === true;
      setOutcome(accepted ? 'ok' : 'fail');
    } catch {
      setOutcome('fail');
    }
    window.setTimeout(() => setOutcome(null), 1800);
  };

  const faceClass = [
    'rfid-face',
    outcome === 'pending' ? 'pending' : '',
    outcome === 'ok' ? 'accepted' : '',
    outcome === 'fail' ? 'rejected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const status =
    outcome === 'pending' ? 'WAIT' : outcome === 'ok' ? 'OK' : outcome === 'fail' ? 'NO' : 'TAP';

  return (
    <section className="rfid-pad">
      <h3>Card reader</h3>
      <button
        type="button"
        className={faceClass}
        disabled={busy || !onTap || outcome === 'pending'}
        onClick={handleTap}
        title="Tap RFID / NFC to authorize and start"
      >
        <span className="rfid-waves" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="rfid-copy">
          <span className="rfid-core">{status}</span>
          <span className="rfid-sub">RFID · NFC</span>
        </span>
      </button>
      <label>
        idTag
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="preset-row">
        {presets.slice(0, 6).map((tag) => (
          <button key={tag} type="button" className="chip" onClick={() => onChange(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <div className="inline-apply">
        <input
          placeholder="Add local tag"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (!custom.trim()) return;
            onAddTag(custom.trim());
            onChange(custom.trim());
            setCustom('');
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}
