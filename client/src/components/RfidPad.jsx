import { useState } from 'react';

export default function RfidPad({ value, onChange, presets = [], onAddTag }) {
  const [custom, setCustom] = useState('');

  return (
    <section className="rfid-pad">
      <h3>Card reader</h3>
      <div className="rfid-face">
        <div className="rfid-ring" />
        <div className="rfid-core">TAP</div>
      </div>
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
