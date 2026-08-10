export default function EvseDisplay({
  charger,
  connector,
  onTapStart,
  onTapStop,
  canStart,
  canStop,
}) {
  if (!connector) {
    return <div className="evse-lcd empty">NO CONNECTOR</div>;
  }

  const kwh = ((connector.meterWh || 0) / 1000).toFixed(3);
  const kw = ((connector.powerW || 0) / 1000).toFixed(2);
  const isTx = !!connector.transactionId;

  return (
    <div className="evse-lcd">
      <div className="lcd-scan" aria-hidden />
      <div className="lcd-row lcd-title">
        <span>CONNECTOR {connector.number}</span>
        <span className="lcd-link">{charger.connectionState.toUpperCase()}</span>
      </div>
      <div className="lcd-status">{connector.status}</div>
      <div className="lcd-grid">
        <div>
          <small>ENERGY</small>
          <strong className="lcd-digits">{kwh}</strong>
          <small>kWh</small>
        </div>
        <div>
          <small>POWER</small>
          <strong className="lcd-digits">{kw}</strong>
          <small>kW</small>
        </div>
        <div>
          <small>TX</small>
          <strong className="lcd-digits">{connector.transactionId ?? '—'}</strong>
        </div>
        <div>
          <small>SoC</small>
          <strong className="lcd-digits">
            {connector.soc !== null && connector.soc !== undefined ? `${connector.soc}%` : '—'}
          </strong>
        </div>
      </div>

      <div className="lcd-soft-keys">
        <button type="button" disabled={!canStart} onClick={onTapStart}>
          {isTx ? '—' : 'START'}
        </button>
        <button type="button" disabled={!canStop} onClick={onTapStop}>
          STOP
        </button>
      </div>

      <div className="lcd-footer">
        <span>{connector.errorCode}</span>
        <span>{connector.idTag || 'NO TAG'}</span>
      </div>
    </div>
  );
}
