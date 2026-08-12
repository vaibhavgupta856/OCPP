import { useEffect, useState } from 'react';
import RfidPad from './RfidPad.jsx';

const ERROR_CODES = [
  'ConnectorLockFailure',
  'EVCommunicationError',
  'GroundFailure',
  'HighTemperature',
  'InternalError',
  'OverCurrentFailure',
  'OverVoltage',
  'PowerMeterFailure',
  'PowerSwitchFailure',
  'ReaderFailure',
  'UnderVoltage',
  'WeakSignal',
  'OtherError',
];

const STOP_REASONS = [
  'Local',
  'EVDisconnected',
  'EmergencyStop',
  'PowerLoss',
  'DeAuthorized',
  'Other',
];

const CONNECTOR_TYPES = [
  'Mennekes T2',
  'CCS Combo 2',
  'Schuko AC',
  'J1772 T1',
  'GB/T DC',
  'NACS',
  'CHAdeMO',
];

export default function ActionBar({
  charger,
  connectorId,
  busy,
  idTag = 'CARD-7F2A91',
  onIdTagChange,
  onPlug,
  onStart,
  onStop,
  onEmergency,
  onFault,
  onClearFault,
  onSuspend,
  onType,
  onName,
  onPower,
  onSoc,
  onReconnect,
  onReset,
  onAddTag,
  onAuthMode,
  onTariff,
}) {
  const [stopReason, setStopReason] = useState('Local');
  const [faultCode, setFaultCode] = useState('OverCurrentFailure');
  const [power, setPower] = useState(
    charger?.connectors?.find((c) => c.number === connectorId)?.powerKw ?? charger?.powerKw ?? 22
  );
  const [connName, setConnName] = useState(`Connector ${connectorId}`);
  const [energyIn, setEnergyIn] = useState(12);
  const [battery, setBattery] = useState(60);
  const [fillMode, setFillMode] = useState('full'); // full | energy | money | time
  const [fillEnergy, setFillEnergy] = useState(10);
  const [fillMoney, setFillMoney] = useState(200);
  const [fillMinutes, setFillMinutes] = useState(30);
  const [rate, setRate] = useState(charger?.energyRatePerKwh ?? 18.5);

  const connector = charger?.connectors?.find((c) => c.number === connectorId);
  const setIdTag = onIdTagChange || (() => {});
  const sym = charger?.currencySymbol || '₹';
  const packKwh = Math.max(0.1, Number(battery) || 0.1);
  const inKwh = Math.max(0, Math.min(packKwh, Number(energyIn) || 0));
  const toFullKwh = Math.max(0, packKwh - inKwh);
  const socPct = (inKwh / packKwh) * 100;
  const tariff = Math.max(0, Number(rate) || 0);
  const plannedKwh =
    fillMode === 'full'
      ? toFullKwh
      : fillMode === 'energy'
        ? Math.min(toFullKwh, Math.max(0, Number(fillEnergy) || 0))
        : fillMode === 'money'
          ? tariff > 0
            ? Math.min(toFullKwh, Math.max(0, Number(fillMoney) || 0) / tariff)
            : 0
          : Math.min(
              toFullKwh,
              Math.max(0, Number(connector?.powerKw) || 0) * (Math.max(0, Number(fillMinutes) || 0) / 60)
            );
  const plannedCost = plannedKwh * tariff;
  const plannedMins =
    fillMode === 'time'
      ? Math.max(0, Number(fillMinutes) || 0)
      : connector?.powerKw
        ? Math.round((plannedKwh / Math.max(0.1, connector.powerKw)) * 60)
        : null;

  useEffect(() => {
    if (connector?.powerKw != null) setPower(connector.powerKw);
  }, [connectorId, connector?.powerKw]);

  useEffect(() => {
    setConnName(connector?.name || `Connector ${connectorId}`);
  }, [connectorId, connector?.name]);

  useEffect(() => {
    if (charger?.energyRatePerKwh != null) setRate(charger.energyRatePerKwh);
  }, [charger?.energyRatePerKwh]);

  if (!charger) {
    return (
      <div className="action-bar muted">
        <h2>Bench controls</h2>
        <p>Commission a charger to drive the Massive cabinet.</p>
      </div>
    );
  }

  return (
    <div className="action-bar">
      <h2>Bench controls</h2>
      <p className="action-sub">
        Outlet {connectorId}
        {connector?.name ? ` · ${connector.name}` : ''} · {connector?.status || '—'} ·{' '}
        {connector?.powerKw ?? '—'} kW · {((connector?.meterWh || 0) / 1000).toFixed(2)} kWh ·{' '}
        {sym}
        {Number(connector?.sessionCost ?? 0).toFixed(2)}
        {connector?.smartLimitW != null
          ? ` · smart limit ${(connector.smartLimitW / 1000).toFixed(1)} kW`
          : ''}
        {charger?.diagnosticsStatus && charger.diagnosticsStatus !== 'Idle'
          ? ` · diagnostics ${charger.diagnosticsStatus}`
          : ''}
        <br />
        <span className="action-tip">Primary controls are on the 3D charger face</span>
      </p>

      <RfidPad
        value={idTag}
        onChange={setIdTag}
        presets={charger.localAuthTags || []}
        onAddTag={onAddTag}
        busy={busy}
        onTap={(tag) => onStart(tag)}
      />

      <section className="ctrl-section">
        <h3>Auth mode</h3>
        <p className="action-tip">
          CMS rejected demo tags → use Local or CMS (default) or a real CMS RFID
        </p>
        <select
          value={charger.authMode || 'local_or_csms'}
          onChange={(e) => onAuthMode(e.target.value)}
        >
          <option value="local_or_csms">Local or CMS (recommended)</option>
          <option value="local">Local list only</option>
          <option value="csms">CMS only (strict)</option>
        </select>
      </section>

      <section className="ctrl-section">
        <h3>Cable</h3>
        <div className="btn-row">
          <button type="button" disabled={busy} onClick={() => onPlug(true)}>
            Plug in
          </button>
          <button type="button" disabled={busy} onClick={() => onPlug(false)}>
            Unplug
          </button>
        </div>
      </section>

      <section className="ctrl-section">
        <h3>Session</h3>
        <div className="btn-row">
          <button type="button" className="accent" disabled={busy} onClick={() => onStart(idTag)}>
            Start charge
          </button>
          <button type="button" disabled={busy} onClick={() => onStop(stopReason)}>
            Stop
          </button>
        </div>
        <label>
          Stop reason
          <select value={stopReason} onChange={(e) => setStopReason(e.target.value)}>
            {STOP_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="danger" disabled={busy} onClick={onEmergency}>
          Emergency stop
        </button>
      </section>

      <section className="ctrl-section car-config-section">
        <h3>Car configuration</h3>
        <div className="car-config">
          <label>
            1. Energy already in car (kWh)
            <input
              type="number"
              min="0"
              max="500"
              step="0.1"
              value={energyIn}
              onChange={(e) => setEnergyIn(e.target.value)}
            />
          </label>

          <label>
            2. Car battery capacity (kWh)
            <input
              type="number"
              min="0.1"
              max="500"
              step="0.1"
              value={battery}
              onChange={(e) => setBattery(e.target.value)}
            />
          </label>

          <fieldset className="fill-goal">
            <legend>3. How much to fill</legend>
            <label className="fill-option">
              <input
                type="radio"
                name={`fill-${connectorId}`}
                checked={fillMode === 'full'}
                onChange={() => setFillMode('full')}
              />
              <span>Full pack</span>
              <span />
            </label>
            <label className="fill-option">
              <input
                type="radio"
                name={`fill-${connectorId}`}
                checked={fillMode === 'energy'}
                onChange={() => setFillMode('energy')}
              />
              <span>By energy (kWh)</span>
              <input
                type="number"
                min="0"
                max="500"
                step="0.1"
                value={fillEnergy}
                disabled={fillMode !== 'energy'}
                onChange={(e) => setFillEnergy(e.target.value)}
              />
            </label>
            <label className="fill-option">
              <input
                type="radio"
                name={`fill-${connectorId}`}
                checked={fillMode === 'money'}
                onChange={() => setFillMode('money')}
              />
              <span>By money ({sym})</span>
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                value={fillMoney}
                disabled={fillMode !== 'money'}
                onChange={(e) => setFillMoney(e.target.value)}
              />
            </label>
            <label className="fill-option">
              <input
                type="radio"
                name={`fill-${connectorId}`}
                checked={fillMode === 'time'}
                onChange={() => setFillMode('time')}
              />
              <span>By time (minutes)</span>
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                value={fillMinutes}
                disabled={fillMode !== 'time'}
                onChange={(e) => setFillMinutes(e.target.value)}
              />
            </label>
          </fieldset>

          <small className="hint">
            SoC ~ {socPct.toFixed(0)}% · room left {toFullKwh.toFixed(2)} kWh
            <br />
            Will deliver ~ {plannedKwh.toFixed(2)} kWh · ~ {sym}
            {plannedCost.toFixed(2)}
            {fillMode === 'time'
              ? ` · stop after ${plannedMins} min`
              : plannedMins != null
                ? ` · ~${plannedMins} min at ${connector?.powerKw ?? '—'} kW`
                : ''}
          </small>

          <button
            type="button"
            className="car-config-set"
            disabled={busy}
            onClick={() =>
              onSoc?.({
                energyKwh: inKwh,
                batteryKwh: packKwh,
                fillMode,
                fillEnergyKwh: fillMode === 'energy' ? Number(fillEnergy) : undefined,
                fillMoney: fillMode === 'money' ? Number(fillMoney) : undefined,
                fillMinutes: fillMode === 'time' ? Number(fillMinutes) : undefined,
              })
            }
          >
            Set car config
          </button>
        </div>
      </section>

      <section className="ctrl-section">
        <h3>Suspend</h3>
        <div className="btn-row">
          <button type="button" disabled={busy} onClick={() => onSuspend('EV')}>
            EV pause
          </button>
          <button type="button" disabled={busy} onClick={() => onSuspend('EVSE')}>
            EVSE pause
          </button>
          <button type="button" disabled={busy} onClick={() => onSuspend(null)}>
            Resume
          </button>
        </div>
      </section>

      <section className="ctrl-section">
        <h3>Faults</h3>
        <select value={faultCode} onChange={(e) => setFaultCode(e.target.value)}>
          {ERROR_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="btn-row">
          <button type="button" disabled={busy} onClick={() => onFault(faultCode)}>
            Inject fault
          </button>
          <button type="button" disabled={busy} onClick={onClearFault}>
            Clear
          </button>
        </div>
      </section>

      <section className="ctrl-section">
        <h3>Hardware</h3>
        <label>
          Connector name
          <div className="inline-apply">
            <input
              value={connName}
              onChange={(e) => setConnName(e.target.value)}
              maxLength={40}
              placeholder={`Connector ${connectorId}`}
            />
            <button
              type="button"
              disabled={busy || !onName}
              onClick={() => onName?.(connName)}
            >
              Apply
            </button>
          </div>
        </label>
        <label>
          Connector type
          <select
            value={connector?.type || 'Mennekes T2'}
            onChange={(e) => onType(e.target.value)}
          >
            {CONNECTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          This outlet power (kW)
          <div className="inline-apply">
            <input
              type="number"
              min="1"
              max="350"
              step="0.1"
              value={power}
              onChange={(e) => setPower(e.target.value)}
            />
            <button type="button" disabled={busy} onClick={() => onPower(Number(power))}>
              Apply
            </button>
          </div>
        </label>
        <label>
          Energy tariff ({sym}/kWh)
          <div className="inline-apply">
            <input
              type="number"
              min="0"
              max="9999"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !onTariff}
              onClick={() => onTariff?.({ energyRatePerKwh: Number(rate) })}
            >
              Apply
            </button>
          </div>
        </label>
      </section>

      <section className="ctrl-section">
        <h3>Link</h3>
        <div className="btn-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => onReconnect(charger.requireSubprotocol)}
          >
            Reconnect
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReconnect(!charger.requireSubprotocol)}
          >
            Reconnect {charger.requireSubprotocol ? 'without' : 'with'} subprotocol
          </button>
        </div>
        <div className="btn-row">
          <button type="button" disabled={busy} onClick={() => onReset('Soft')}>
            Soft reset
          </button>
          <button type="button" disabled={busy} onClick={() => onReset('Hard')}>
            Hard reset
          </button>
        </div>
        {charger.lastError && <p className="link-error">{charger.lastError}</p>}
      </section>
    </div>
  );
}
