const statusColor = {
  Available: 'avail',
  Preparing: 'prep',
  Charging: 'chg',
  SuspendedEV: 'sus',
  SuspendedEVSE: 'sus',
  Finishing: 'fin',
  Reserved: 'res',
  Unavailable: 'unavail',
  Faulted: 'fault',
};

export default function ConnectorBay({
  connector,
  selected,
  busy,
  onSelect,
  onTogglePlug,
  onQuickStart,
  onQuickStop,
}) {
  const tone = statusColor[connector.status] || 'avail';
  const isTx = !!connector.transactionId;

  return (
    <div
      className={`connector-bay ${tone} ${selected ? 'selected' : ''} ${connector.cablePlugged ? 'plugged' : ''}`}
    >
      <button
        type="button"
        className="gun-hit"
        title={`Select charge point C${connector.number}`}
        onClick={onSelect}
      >
        <div className="gun-housing">
          <div className={`gun-handle ${connector.status === 'Charging' ? 'charging' : ''}`}>
            <div className="gun-pins" />
          </div>
          {connector.cablePlugged && <div className="cable-line" />}
        </div>
        <div className="bay-label">
          <strong>C{connector.number}</strong>
          <span>{connector.type}</span>
          <span className="bay-status">{connector.status}</span>
        </div>
        <div className={`bay-led ${tone}`} />
      </button>

      <div className="bay-hotspots">
        <button
          type="button"
          className="hotspot plug"
          disabled={busy || (isTx && connector.cablePlugged)}
          title={connector.cablePlugged ? 'Unplug' : 'Plug cable'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlug();
          }}
        >
          {connector.cablePlugged ? 'Unplug' : 'Plug'}
        </button>
        {isTx ? (
          <button
            type="button"
            className="hotspot stop"
            disabled={busy}
            title="Stop charging"
            onClick={(e) => {
              e.stopPropagation();
              onQuickStop();
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="hotspot start"
            disabled={busy || connector.status === 'Faulted' || connector.status === 'Unavailable'}
            title="Plug (if needed) and start charging"
            onClick={(e) => {
              e.stopPropagation();
              onQuickStart();
            }}
          >
            Charge
          </button>
        )}
      </div>
    </div>
  );
}
