/**
 * Per-connector finite state machine for OCPP 1.6 Charge Point status
 */

export const ConnectorStatus = {
  Available: 'Available',
  Preparing: 'Preparing',
  Charging: 'Charging',
  SuspendedEV: 'SuspendedEV',
  SuspendedEVSE: 'SuspendedEVSE',
  Finishing: 'Finishing',
  Reserved: 'Reserved',
  Unavailable: 'Unavailable',
  Faulted: 'Faulted',
};

const TRANSITIONS = {
  [ConnectorStatus.Available]: new Set([
    ConnectorStatus.Preparing,
    ConnectorStatus.Reserved,
    ConnectorStatus.Unavailable,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.Preparing]: new Set([
    ConnectorStatus.Available,
    ConnectorStatus.Charging,
    ConnectorStatus.Faulted,
    ConnectorStatus.Unavailable,
  ]),
  [ConnectorStatus.Charging]: new Set([
    ConnectorStatus.SuspendedEV,
    ConnectorStatus.SuspendedEVSE,
    ConnectorStatus.Finishing,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.SuspendedEV]: new Set([
    ConnectorStatus.Charging,
    ConnectorStatus.Finishing,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.SuspendedEVSE]: new Set([
    ConnectorStatus.Charging,
    ConnectorStatus.Finishing,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.Finishing]: new Set([
    ConnectorStatus.Available,
    ConnectorStatus.Preparing,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.Reserved]: new Set([
    ConnectorStatus.Available,
    ConnectorStatus.Preparing,
    ConnectorStatus.Unavailable,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.Unavailable]: new Set([
    ConnectorStatus.Available,
    ConnectorStatus.Faulted,
  ]),
  [ConnectorStatus.Faulted]: new Set([
    ConnectorStatus.Available,
    ConnectorStatus.Unavailable,
  ]),
};

export function canTransition(from, to) {
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function createConnectorState(number, type = 'Mennekes T2', powerKw = 22, name = '') {
  return {
    number,
    type,
    name: name || (number === 0 ? 'Charge Point' : `Connector ${number}`),
    powerKw,
    status: ConnectorStatus.Available,
    errorCode: 'NoError',
    info: '',
    vendorErrorCode: '',
    cablePlugged: false,
    locked: false,
    transactionId: null,
    idTag: null,
    lastTransactionId: null,
    lastIdTag: null,
    meterWh: 0,
    powerW: 0,
    lastSessionCost: null,
    lastSessionKwh: null,
    currentA: 0,
    voltageV: 0,
    soc: null,
    reservationId: null,
    reservedIdTag: null,
    availability: 'Operative',
    previousStatus: null,
  };
}

/**
 * Attempt a status transition. Returns { ok, status } — if invalid, keeps current.
 * Force=true bypasses the table (used after HardReset / availability restore).
 */
export function transition(connector, nextStatus, { force = false } = {}) {
  if (!force && !canTransition(connector.status, nextStatus)) {
    return { ok: false, status: connector.status, reason: `Illegal: ${connector.status} → ${nextStatus}` };
  }
  connector.previousStatus = connector.status;
  connector.status = nextStatus;
  return { ok: true, status: nextStatus };
}
