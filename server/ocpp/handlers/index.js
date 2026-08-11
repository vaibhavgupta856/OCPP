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

  const mode = cp.authMode || 'local_or_csms';
  const localOk = cp.localAuthList.get(idTag)?.status === 'Accepted';

  // Auth for RemoteStart:
  // - local mode: must be on local list
  // - local_or_csms: local list OK, OR trust CSMS (it already chose this idTag)
  // - csms: trust CSMS RemoteStart (do not round-trip Authorize — that was rejecting Massive starts)
  if (mode === 'local') {
    if (!localOk) {
      cp.log('warn', `RemoteStart rejected — idTag "${idTag}" not on local list`);
      return { status: 'Rejected' };
    }
  } else if (cp.config.getBool('AuthorizeRemoteTxRequests', true) && !localOk && mode === 'csms') {
    // Optional soft Authorize for strict CMS mode only when tag isn't local
    try {
      const auth = await cp.authorizeIdTag(idTag);
      if (auth !== 'Accepted') {
        // Still trust RemoteStart from CSMS — they initiated it with this idTag
        cp.log(
          'warn',
          `RemoteStart: CMS Authorize=${auth} for "${idTag}" — accepting because CSMS requested RemoteStart`
        );
      }
    } catch (err) {
      cp.log('warn', `RemoteStart Authorize skipped/failed: ${err.message} — trusting CSMS`);
    }
  } else {
    cp.log('info', `RemoteStart accepted for "${idTag}" (mode=${mode}, local=${localOk})`);
  }

  // Ensure tag is on local list so StartTransaction lab override can apply if CMS returns Invalid
  if (!cp.localAuthList.has(idTag)) {
    cp.localAuthList.set(idTag, { status: 'Accepted' });
    cp.log('info', `RemoteStart: added "${idTag}" to local auth list for this session`);
  }

  // Auto-plug for remote start convenience (real EVSE may already be plugged)
  if (!connector.cablePlugged) {
    connector.cablePlugged = true;
  }

  cp.emitUi('remote_start', { connectorId: connector.number, idTag });

  // Begin tx AFTER RemoteStart.conf is on the wire (same pattern as TriggerMessage → Boot)
  const targetConnectorId = connector.number;
  const startIdTag = idTag;
  return {
    status: 'Accepted',
    __after: async (inst) => {
      try {
        await inst.beginTransaction(targetConnectorId, startIdTag, { reason: 'Remote' });
      } catch (err) {
        inst.log('error', `RemoteStart failed: ${err.message}`);
        const c = inst.getConnector(targetConnectorId);
        if (c && !c.transactionId && c.status === ConnectorStatus.Preparing) {
          transition(c, ConnectorStatus.Available, { force: true });
          await inst.sendStatusNotification(c.number).catch(() => {});
          inst.broadcastState();
        }
      }
    },
  };
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
  // CMS UIs sometimes send alternate spellings
  let key = payload.key;
  let value = payload.value;
  if (typeof key === 'string') {
    const aliases = {
      heartbeatinterval: 'HeartbeatInterval',
      heartbeat_interval: 'HeartbeatInterval',
      heartbeatsinterval: 'HeartbeatInterval',
      metervaluesampleinterval: 'MeterValueSampleInterval',
      meter_value_sample_interval: 'MeterValueSampleInterval',
    };
    const mapped = aliases[key.toLowerCase().replace(/\s+/g, '')];
    if (mapped) key = mapped;
  }

  const status = cp.config.change(key, value);
  if (status === 'Accepted') {
    if (key === 'HeartbeatInterval') {
      cp.restartHeartbeat();
    }
    if (key === 'MeterValueSampleInterval') {
      cp.restartMeterLoops();
    }
    cp.broadcastState();
  }
  return { status };
}

export async function handleTriggerMessage(cp, payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  // Massive / some CMS UIs may vary key casing
  const raw =
    body.requestedMessage ??
    body.RequestedMessage ??
    body.requestedmessage ??
    body.REQUESTEDMESSAGE ??
    Object.entries(body).find(([k]) => k.toLowerCase() === 'requestedmessage')?.[1];
  const requested = String(raw ?? '').trim();
  const connectorId =
    body.connectorId ??
    body.ConnectorId ??
    Object.entries(body).find(([k]) => k.toLowerCase() === 'connectorid')?.[1];

  // Normalize in case CMS sends odd casing / spacing / dashes
  const key = requested.toLowerCase().replace(/[\s_-]+/g, '');

  cp.log('info', `TriggerMessage requested="${requested}" key="${key}"`, { payload: body });

  if (key === 'bootnotification') {
    return {
      status: 'Accepted',
      chargePointVendor: cp.identity?.chargePointVendor || null,
      chargePointModel: cp.identity?.chargePointModel || null,
      chargePointSerialNumber: cp.identity?.chargePointSerialNumber || null,
      firmwareVersion: cp.identity?.firmwareVersion || null,
      // Run AFTER TriggerMessage.conf is on the wire — otherwise Massive often never logs Boot
      __after: async (inst) => {
        const conf = await inst.sendBootNotification();
        inst.log('info', `TriggerMessage → BootNotification done (${conf?.status})`);
        await inst.sendAllStatusNotifications();
      },
    };
  }
  if (key === 'heartbeat') {
    return {
      status: 'Accepted',
      __after: async (inst) => {
        await inst.sendHeartbeat();
        inst.log('info', 'TriggerMessage → Heartbeat sent');
      },
    };
  }
  if (key === 'statusnotification') {
    if (connectorId !== undefined && connectorId !== null && connectorId !== '') {
      const c = cp.getConnector(Number(connectorId));
      if (!c) return { status: 'Rejected' };
      return {
        status: 'Accepted',
        __after: async (inst) => {
          await inst.sendStatusNotification(Number(connectorId));
          inst.log('info', `TriggerMessage → StatusNotification C${connectorId} sent`);
        },
      };
    }
    return {
      status: 'Accepted',
      __after: async (inst) => {
        await inst.sendAllStatusNotifications();
        inst.log('info', 'TriggerMessage → StatusNotification (all) sent');
      },
    };
  }
  if (key === 'metervalues') {
    const id = connectorId && Number(connectorId) > 0 ? Number(connectorId) : 1;
    const c = cp.getConnector(id);
    if (!c || !c.transactionId) return { status: 'Rejected' };
    return {
      status: 'Accepted',
      __after: async (inst) => {
        await inst.sendMeterValues(id);
        inst.log('info', `TriggerMessage → MeterValues C${id} sent`);
      },
    };
  }
  if (key === 'diagnosticsstatusnotification' || key === 'diagnosticsstatus') {
    const details = cp.getDiagnosticsDetails();
    return {
      status: 'Accepted',
      diagnosticsStatus: details.status,
      fileName: details.fileName,
      location: details.location,
      startTime: details.startTime,
      stopTime: details.stopTime,
      __after: async (inst) => {
        await inst.sendDiagnosticsStatusNotification(details.status);
        inst.log('info', `TriggerMessage → DiagnosticsStatusNotification (${details.status}) sent`);
      },
    };
  }
  if (key === 'firmwarestatusnotification' || key === 'firmwarestatus') {
    const details = cp.getFirmwareDetails();
    return {
      status: 'Accepted',
      firmwareStatus: details.status,
      firmwareVersion: details.firmwareVersion,
      location: details.location,
      retrieveDate: details.retrieveDate,
      __after: async (inst) => {
        await inst.sendFirmwareStatusNotification(details.status);
        inst.log('info', `TriggerMessage → FirmwareStatusNotification (${details.status}) sent`);
      },
    };
  }

  cp.log('warn', `TriggerMessage not implemented for "${requested}" payload=${JSON.stringify(body)}`);
  return { status: 'NotImplemented' };
}

export async function handleClearCache(cp) {
  cp.authCache.clear();
  return { status: 'Accepted' };
}

export async function handleGetLocalListVersion(cp) {
  // OCPP 1.6 GetLocalListVersion.conf only requires listVersion.
  // There is no GetLocalList — CMS pushes tags via SendLocalList.
  // Extra fields below are for Massive CMS / lab visibility of what this CP holds.
  const localAuthorizationList = [...cp.localAuthList.entries()].map(([idTag, idTagInfo]) => ({
    idTag,
    idTagInfo: idTagInfo || { status: 'Accepted' },
  }));
  return {
    listVersion: cp.localAuthListVersion,
    localAuthorizationList,
    idTags: localAuthorizationList.map((e) => e.idTag),
  };
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
  // UpdateFirmware.conf is empty per OCPP; progress comes via FirmwareStatusNotification
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

export async function handleGetDiagnostics(cp, payload) {
  if (!payload?.location) {
    return {};
  }
  const result = cp.beginDiagnosticsUpload({
    location: payload.location,
    retries: payload.retries,
    retryInterval: payload.retryInterval,
    startTime: payload.startTime,
    stopTime: payload.stopTime,
  });
  // OCPP GetDiagnostics.conf: fileName is the standard field
  return { fileName: result.fileName };
}

export async function handleSetChargingProfile(cp, payload) {
  const connectorId = payload.connectorId;
  if (typeof connectorId !== 'number') {
    return { status: 'Rejected' };
  }
  return cp.setChargingProfile(connectorId, payload.csChargingProfiles);
}

export async function handleClearChargingProfile(cp, payload = {}) {
  return cp.clearChargingProfile({
    id: payload.id,
    connectorId: payload.connectorId,
    chargingProfilePurpose: payload.chargingProfilePurpose,
    stackLevel: payload.stackLevel,
  });
}

export async function handleGetCompositeSchedule(cp, payload) {
  if (typeof payload.connectorId !== 'number' || typeof payload.duration !== 'number') {
    return { status: 'Rejected' };
  }
  return cp.getCompositeSchedule(payload.connectorId, payload.duration, payload.chargingRateUnit);
}

export async function handleChangeConfigurationKeys(cp, payload) {
  return handleChangeConfiguration(cp, payload);
}

/** Dispatch map — full OCPP 1.6 CSMS → CP set */
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
  GetDiagnostics: handleGetDiagnostics,
  SetChargingProfile: handleSetChargingProfile,
  ClearChargingProfile: handleClearChargingProfile,
  GetCompositeSchedule: handleGetCompositeSchedule,
};
