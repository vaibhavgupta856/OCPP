/**
 * Inbound OCPP 1.6 Core (+ related) handlers: CSMS → Charge Point
 */

import { ConnectorStatus, transition } from '../fsm.js';

export async function handleRemoteStartTransaction(cp, payload) {
  const idTag = payload.idTag;
  const connectorId = payload.connectorId ?? null;

  if (!idTag) {
    return { status: 'Rejected' };
  }

  let connector = null;
  if (connectorId && connectorId > 0) {
    connector = cp.getConnector(connectorId);
    if (!connector) return { status: 'Rejected' };
    if (connector.availability !== 'Operative') return { status: 'Rejected' };
    if (connector.status === ConnectorStatus.Faulted || connector.status === ConnectorStatus.Unavailable) {
      return { status: 'Rejected' };
    }
    if (connector.transactionId) return { status: 'Rejected' };
  } else {
    connector = cp.connectors.find(
      (c) =>
        c.number > 0 &&
        c.availability === 'Operative' &&
        !c.transactionId &&
        (c.status === ConnectorStatus.Available ||
          c.status === ConnectorStatus.Preparing ||
          c.status === ConnectorStatus.Reserved)
    );
    if (!connector) return { status: 'Rejected' };
  }

  if (cp.config.getBool('AuthorizeRemoteTxRequests', true)) {
    const auth = await cp.authorizeIdTag(idTag);
    if (auth !== 'Accepted') {
      return { status: 'Rejected' };
    }
  }

  // Auto-plug for remote start convenience (real EVSE may already be plugged)
  if (!connector.cablePlugged) {
    connector.cablePlugged = true;
  }

  cp.emitUi('remote_start', { connectorId: connector.number, idTag });

  // Fire and forget session start
  setImmediate(() => {
    cp.beginTransaction(connector.number, idTag, { reason: 'Remote' }).catch((err) => {
      cp.log('error', `RemoteStart failed: ${err.message}`);
    });
  });

  return { status: 'Accepted' };
}

export async function handleRemoteStopTransaction(cp, payload) {
  const txId = payload.transactionId;
  const connector = cp.connectors.find((c) => c.transactionId === txId);
  if (!connector) {
    return { status: 'Rejected' };
  }

  setImmediate(() => {
    cp.endTransaction(connector.number, 'Remote').catch((err) => {
      cp.log('error', `RemoteStop failed: ${err.message}`);
    });
  });

  return { status: 'Accepted' };
}

export async function handleReset(cp, payload) {
  const type = payload.type === 'Hard' ? 'Hard' : 'Soft';
  setImmediate(() => {
    cp.performReset(type).catch((err) => cp.log('error', `Reset failed: ${err.message}`));
  });
  return { status: 'Accepted' };
}

export async function handleUnlockConnector(cp, payload) {
  const connector = cp.getConnector(payload.connectorId);
  if (!connector || connector.number === 0) {
    return { status: 'NotSupported' };
  }
  connector.locked = false;
  cp.emitUi('unlock', { connectorId: connector.number });
  cp.broadcastState();
  return { status: 'Unlocked' };
}

export async function handleChangeAvailability(cp, payload) {
  const { connectorId, type } = payload;
  if (type !== 'Operative' && type !== 'Inoperative') {
    return { status: 'Rejected' };
  }

  if (connectorId === 0) {
    for (const c of cp.connectors) {
      if (c.number === 0) continue;
      c.availability = type;
      if (type === 'Inoperative' && !c.transactionId) {
        transition(c, ConnectorStatus.Unavailable, { force: true });
        await cp.sendStatusNotification(c.number);
      } else if (type === 'Operative' && c.status === ConnectorStatus.Unavailable && c.errorCode === 'NoError') {
        transition(c, ConnectorStatus.Available, { force: true });
        await cp.sendStatusNotification(c.number);
      }
    }
    cp.chargePointAvailability = type;
    cp.broadcastState();
    return { status: 'Accepted' };
  }

  const connector = cp.getConnector(connectorId);
  if (!connector) return { status: 'Rejected' };

  if (connector.transactionId) {
    connector.availability = type;
    cp.broadcastState();
    return { status: 'Scheduled' };
  }

  connector.availability = type;
  if (type === 'Inoperative') {
    transition(connector, ConnectorStatus.Unavailable, { force: true });
  } else if (connector.status === ConnectorStatus.Unavailable && connector.errorCode === 'NoError') {
    transition(connector, ConnectorStatus.Available, { force: true });
  }
  await cp.sendStatusNotification(connector.number);
  cp.broadcastState();
  return { status: 'Accepted' };
}

export async function handleGetConfiguration(cp, payload) {
  return cp.config.get(payload.key);
}

export async function handleChangeConfiguration(cp, payload) {
  const status = cp.config.change(payload.key, payload.value);
  if (status === 'Accepted') {
    if (payload.key === 'HeartbeatInterval') {
      cp.restartHeartbeat();
    }
    if (payload.key === 'MeterValueSampleInterval') {
      cp.restartMeterLoops();
    }
    cp.broadcastState();
  }
  return { status };
}

export async function handleTriggerMessage(cp, payload) {
  const requested = payload.requestedMessage;
  const connectorId = payload.connectorId;

  switch (requested) {
    case 'BootNotification':
      setImmediate(() => cp.sendBootNotification().catch(() => {}));
      return { status: 'Accepted' };
    case 'Heartbeat':
      setImmediate(() => cp.sendHeartbeat().catch(() => {}));
      return { status: 'Accepted' };
    case 'StatusNotification': {
      if (connectorId !== undefined && connectorId !== null) {
        const c = cp.getConnector(connectorId);
        if (!c) return { status: 'Rejected' };
        setImmediate(() => cp.sendStatusNotification(connectorId).catch(() => {}));
      } else {
        setImmediate(() => cp.sendAllStatusNotifications().catch(() => {}));
      }
      return { status: 'Accepted' };
    }
    case 'MeterValues': {
      const id = connectorId && connectorId > 0 ? connectorId : 1;
      const c = cp.getConnector(id);
      if (!c || !c.transactionId) return { status: 'Rejected' };
      setImmediate(() => cp.sendMeterValues(id).catch(() => {}));
      return { status: 'Accepted' };
    }
    case 'DiagnosticsStatusNotification':
      return { status: 'NotImplemented' };
    case 'FirmwareStatusNotification':
      setImmediate(() => {
        cp.sendFirmwareStatusNotification(cp.firmware?.status || 'Idle').catch(() => {});
      });
      return { status: 'Accepted' };
    default:
      return { status: 'NotImplemented' };
  }
}

export async function handleClearCache(cp) {
  cp.authCache.clear();
  return { status: 'Accepted' };
}

export async function handleGetLocalListVersion(cp) {
  return { listVersion: cp.localAuthListVersion };
}

export async function handleSendLocalList(cp, payload) {
  const version = payload.listVersion;
  const updateType = payload.updateType;
  const list = payload.localAuthorizationList || [];

  if (typeof version !== 'number') {
    return { status: 'Failed' };
  }

  if (updateType === 'Full') {
    cp.localAuthList.clear();
    for (const entry of list) {
      if (entry.idTag) {
        cp.localAuthList.set(entry.idTag, entry.idTagInfo || { status: 'Accepted' });
      }
    }
  } else if (updateType === 'Differential') {
    for (const entry of list) {
      if (!entry.idTag) continue;
      if (!entry.idTagInfo) {
        cp.localAuthList.delete(entry.idTag);
      } else {
        cp.localAuthList.set(entry.idTag, entry.idTagInfo);
      }
    }
  } else {
    return { status: 'Failed' };
  }

  cp.localAuthListVersion = version;
  cp.broadcastState();
  return { status: 'Accepted' };
}

export async function handleDataTransfer(cp, payload) {
  cp.emitUi('data_transfer', {
    vendorId: payload.vendorId,
    messageId: payload.messageId,
    data: payload.data,
  });
  // Accept by default so CMS vendor extensions do not fail the CP
  return { status: 'Accepted', data: payload.data ?? '' };
}

export async function handleReserveNow(cp, payload) {
  const connector = cp.getConnector(payload.connectorId);
  if (!connector || connector.number === 0) {
    return { status: 'Rejected' };
  }
  if (
    connector.status !== ConnectorStatus.Available &&
    connector.status !== ConnectorStatus.Reserved
  ) {
    return { status: 'Occupied' };
  }
  if (connector.availability !== 'Operative') {
    return { status: 'Unavailable' };
  }

  connector.reservationId = payload.reservationId;
  connector.reservedIdTag = payload.idTag;
  transition(connector, ConnectorStatus.Reserved);
  await cp.sendStatusNotification(connector.number);

  // Auto-expire
  const expiry = new Date(payload.expiryDate).getTime();
  const delay = Math.max(0, expiry - Date.now());
  const timer = setTimeout(() => {
    if (connector.reservationId === payload.reservationId && connector.status === ConnectorStatus.Reserved) {
      connector.reservationId = null;
      connector.reservedIdTag = null;
      transition(connector, ConnectorStatus.Available, { force: true });
      cp.sendStatusNotification(connector.number).catch(() => {});
      cp.broadcastState();
    }
  }, delay);
  cp.reservationTimers.set(payload.reservationId, timer);

  cp.broadcastState();
  return { status: 'Accepted' };
}

export async function handleUpdateFirmware(cp, payload) {
  if (!payload?.location) {
    throw new Error('UpdateFirmware.location is required');
  }
  cp.beginFirmwareUpdate({
    location: payload.location,
    retrieveDate: payload.retrieveDate,
    retries: payload.retries,
    retryInterval: payload.retryInterval,
  });
  // UpdateFirmware.conf is empty object
  return {};
}

export async function handleCancelReservation(cp, payload) {
  const connector = cp.connectors.find((c) => c.reservationId === payload.reservationId);
  if (!connector) {
    return { status: 'Rejected' };
  }
  const timer = cp.reservationTimers.get(payload.reservationId);
  if (timer) {
    clearTimeout(timer);
    cp.reservationTimers.delete(payload.reservationId);
  }
  connector.reservationId = null;
  connector.reservedIdTag = null;
  if (connector.status === ConnectorStatus.Reserved) {
    transition(connector, ConnectorStatus.Available, { force: true });
    await cp.sendStatusNotification(connector.number);
  }
  cp.broadcastState();
  return { status: 'Accepted' };
}

export async function handleChangeConfigurationKeys(cp, payload) {
  return handleChangeConfiguration(cp, payload);
}

/** Dispatch map */
export const inboundHandlers = {
  RemoteStartTransaction: handleRemoteStartTransaction,
  RemoteStopTransaction: handleRemoteStopTransaction,
  Reset: handleReset,
  UnlockConnector: handleUnlockConnector,
  ChangeAvailability: handleChangeAvailability,
  GetConfiguration: handleGetConfiguration,
  ChangeConfiguration: handleChangeConfiguration,
  TriggerMessage: handleTriggerMessage,
  ClearCache: handleClearCache,
  GetLocalListVersion: handleGetLocalListVersion,
  SendLocalList: handleSendLocalList,
  DataTransfer: handleDataTransfer,
  ReserveNow: handleReserveNow,
  CancelReservation: handleCancelReservation,
  UpdateFirmware: handleUpdateFirmware,
};
