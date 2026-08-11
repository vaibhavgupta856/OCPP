/**
 * Simulated OCPP 1.6 Charge Point (EVSE client)
 */

import WebSocket from 'ws';
import {
  createCall,
  createCallResult,
  createCallError,
  parseMessage,
  stringifyFrame,
  utcNowIso,
  MessageType,
} from './protocol.js';
import { ConfigStore } from './configStore.js';
import { MeterSimulator } from './meter.js';
import {
  ConnectorStatus,
  createConnectorState,
  transition,
} from './fsm.js';
import { inboundHandlers } from './handlers/index.js';
import { SmartChargingStore } from './smartCharging.js';

let nextTransactionId = 1000;

export class ChargePoint {
  constructor(options, { onState, onMessage, onLog } = {}) {
    this.cpId = options.cpId;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.websocketUrl = `${this.baseUrl}/${this.cpId}`;
    this.powerKw = options.powerKw ?? 22;
    this.connectorCount = Math.max(1, Math.min(4, options.connectorCount ?? 1));
    this.requireSubprotocol = options.requireSubprotocol !== false;
    this.basicAuth = options.basicAuth || null;
    this.identity = {
      chargePointVendor: options.vendor || 'Massive Mobility',
      chargePointModel: options.model || 'Massive-CP-Sim-16',
      chargePointSerialNumber: options.serial || `MASSIVE-CPS-${this.cpId}`,
      // BootNotification firmwareVersion — Massive Mobility CP simulator firmware
      firmwareVersion: options.firmware || 'Massive-CPS-16.3.2.1',
    };
    this.firmware = {
      status: 'Idle', // OCPP FirmwareStatusNotification status
      location: null,
      retrieveDate: null,
      updateTimer: null,
    };
    this.diagnostics = {
      status: 'Idle', // Idle | Uploading | Uploaded | UploadFailed
      location: null,
      fileName: null,
      uploadTimer: null,
    };
    this.smartCharging = new SmartChargingStore();

    this.onState = onState || (() => {});
    this.onMessage = onMessage || (() => {});
    this.onLog = onLog || (() => {});

    this.config = new ConfigStore({
      NumberOfConnectors: String(this.connectorCount),
      HeartbeatInterval: String(options.heartbeatInterval ?? 60),
      MeterValueSampleInterval: String(options.meterInterval ?? 2),
    });
    this.smartCharging.configureFromConfig(this.config);

    this.connectors = [
      createConnectorState(0, 'ChargePoint', this.powerKw, 'Charge Point'),
      ...Array.from({ length: this.connectorCount }, (_, i) => {
        const rated =
          options.connectorPowers?.[i] ??
          options.connectorTypes?.[i]?.powerKw ??
          this.powerKw;
        const type =
          (typeof options.connectorTypes?.[i] === 'string'
            ? options.connectorTypes[i]
            : options.connectorTypes?.[i]?.type) ||
          (rated >= 40 ? 'CCS Combo 2' : 'Mennekes T2');
        const name =
          options.connectorNames?.[i] ||
          (typeof options.connectorTypes?.[i] === 'object'
            ? options.connectorTypes[i]?.name
            : null) ||
          `Connector ${i + 1}`;
        return createConnectorState(i + 1, type, Number(rated) || this.powerKw, name);
      }),
    ];

    this.meters = new Map();
    for (const c of this.connectors) {
      if (c.number === 0) continue;
      this.meters.set(
        c.number,
        new MeterSimulator({
          maxPowerKw: c.powerKw,
          batteryKwh: options.batteryKwh ?? 60,
          initialSoc: options.initialSoc ?? 20,
        })
      );
    }

    this.ws = null;
    this.connectionState = 'offline'; // offline | connecting | online | reconnecting
    this.shouldRun = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.meterTimers = new Map();
    this.pending = new Map();
    this.authCache = new Map();
    this.localAuthList = new Map([
      ['CARD-7F2A91', { status: 'Accepted' }],
      ['FOB-ORBIT-44', { status: 'Accepted' }],
      ['TOKEN-MASSIVE-09', { status: 'Accepted' }],
    ]);
    this.localAuthListVersion = 1;
    // csms = trust CMS only | local = local list only | local_or_csms = accept either (simulator default)
    this.authMode = options.authMode || 'local_or_csms';
    this.reservationTimers = new Map();
    this.chargePointAvailability = 'Operative';
    this.messageSeq = 0;
    this.lastError = null;
    this.bootAccepted = false;
    // Session billing display (lab tariff — not sent as standard OCPP)
    this.energyRatePerKwh = Number(options.energyRatePerKwh ?? 18.5);
    this.currency = options.currency || 'INR';
    this.currencySymbol = options.currencySymbol || '₹';
  }

  /* ---------- public API for UI / registry ---------- */

  getConnector(id) {
    return this.connectors.find((c) => c.number === id) || null;
  }

  getPublicState() {
    return {
      cpId: this.cpId,
      websocketUrl: this.websocketUrl,
      baseUrl: this.baseUrl,
      powerKw: this.powerKw,
      connectionState: this.connectionState,
      bootAccepted: this.bootAccepted,
      requireSubprotocol: this.requireSubprotocol,
      identity: this.identity,
      firmwareStatus: this.firmware.status,
      diagnosticsStatus: this.diagnostics.status,
      diagnosticsFileName: this.diagnostics.fileName,
      chargingProfiles: this.smartCharging.list(),
      config: this.config.snapshot(),
      localAuthListVersion: this.localAuthListVersion,
      localAuthTags: [...this.localAuthList.keys()],
      authMode: this.authMode,
      lastError: this.lastError,
      energyRatePerKwh: this.energyRatePerKwh,
      currency: this.currency,
      currencySymbol: this.currencySymbol,
      connectors: this.connectors.map((c) => {
        const meter = this.meters.get(c.number)?.snapshot() || null;
        const meterWh = meter?.meterWh ?? c.meterWh ?? 0;
        const energyKwh = meterWh / 1000;
        const sessionCost = Number((energyKwh * this.energyRatePerKwh).toFixed(2));
        return {
          number: c.number,
          type: c.type,
          name: c.name || (c.number === 0 ? 'Charge Point' : `Connector ${c.number}`),
          status: c.status,
          errorCode: c.errorCode,
          info: c.info,
          cablePlugged: c.cablePlugged,
          locked: c.locked,
          transactionId: c.transactionId,
          idTag: c.idTag,
          reservationId: c.reservationId,
          availability: c.availability,
          powerKw: c.powerKw ?? this.powerKw,
          meterWh,
          powerW: meter?.powerW ?? c.powerW,
          currentA: meter?.currentA ?? 0,
          voltageV: meter?.voltageV ?? 0,
          soc: meter?.soc ?? null,
          energyKwh: Number(energyKwh.toFixed(3)),
          sessionCost,
          lastSessionCost: c.lastSessionCost ?? null,
          lastSessionKwh: c.lastSessionKwh ?? null,
          smartLimitW: c.smartLimitW ?? null,
          smartLimitA: c.smartLimitA ?? null,
        };
      }),
    };
  }

  broadcastState() {
    this.onState(this.getPublicState());
  }

  emitUi(event, data) {
    this.onMessage({
      kind: 'ui_event',
      event,
      data,
      cpId: this.cpId,
      connectorId: data?.connectorId ?? null,
      ts: Date.now(),
    });
  }

  _inferConnectorId(text = '', payload = null) {
    if (payload && payload.connectorId != null && payload.connectorId !== '') {
      const n = Number(payload.connectorId);
      if (Number.isFinite(n)) return n;
    }
    const raw = String(text || '');
    const m =
      raw.match(/\bC(\d+)\b/i) ||
      raw.match(/\bconnector(?:Id)?\s*[:=]?\s*(\d+)\b/i) ||
      raw.match(/\bon C(\d+)\b/i);
    if (m) return Number(m[1]);
    return null;
  }

  log(level, text, meta = {}) {
    const connectorId =
      meta.connectorId != null ? Number(meta.connectorId) : this._inferConnectorId(text);
    this.onLog({
      level,
      text,
      cpId: this.cpId,
      connectorId: Number.isFinite(connectorId) ? connectorId : null,
      ts: Date.now(),
    });
  }

  /* ---------- connection lifecycle ---------- */

  async start() {
    this.shouldRun = true;
    await this.connect();
  }

  async stop({ silent = false } = {}) {
    this.shouldRun = false;
    this._clearReconnect();
    this._stopHeartbeat();
    this._stopAllMeters();
    if (this.firmware?.updateTimer) {
      clearTimeout(this.firmware.updateTimer);
      this.firmware.updateTimer = null;
    }
    for (const t of this.reservationTimers.values()) clearTimeout(t);
    this.reservationTimers.clear();

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.connectionState = 'offline';
    this.bootAccepted = false;
    if (!silent) this.broadcastState();
  }

  async connect() {
    if (!this.shouldRun) return;

    this.connectionState = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    this.lastError = null;
    this.broadcastState();

    const headers = {};
    if (this.basicAuth?.username) {
      const token = Buffer.from(
        `${this.basicAuth.username}:${this.basicAuth.password || ''}`
      ).toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    const wsOptions = {
      headers,
      handshakeTimeout: 15000,
    };

    this.log('info', `Connecting to ${this.websocketUrl}${this.requireSubprotocol ? ' [ocpp1.6]' : ' [no subprotocol]'}`);

    try {
      await new Promise((resolve, reject) => {
        // `ws` takes protocols as the 2nd arg (not options.protocol)
        const ws = this.requireSubprotocol
          ? new WebSocket(this.websocketUrl, 'ocpp1.6', wsOptions)
          : new WebSocket(this.websocketUrl, wsOptions);

        const onFail = (err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        const cleanup = () => {
          ws.off('open', onOpen);
          ws.off('error', onFail);
          ws.off('unexpected-response', onUnexpected);
        };

        const onUnexpected = (_req, res) => {
          let body = '';
          res.on('data', (c) => {
            body += c;
          });
          res.on('end', () => {
            onFail(
              new Error(
                `HTTP ${res.statusCode} during WS handshake${body ? `: ${body.slice(0, 200)}` : ''}`
              )
            );
          });
        };

        const onOpen = () => {
          cleanup();
          this.ws = ws;
          this.connectionState = 'online';
          this.reconnectAttempt = 0;
          this.log('info', 'WebSocket open');
          this.broadcastState();

          ws.on('message', (data) => this._onWsMessage(data));
          ws.on('close', (code, reason) => this._onWsClose(code, reason?.toString?.() || ''));
          ws.on('error', (err) => {
            this.lastError = err.message;
            this.log('error', `WS error: ${err.message}`);
          });

          resolve();
        };

        ws.on('open', onOpen);
        ws.on('error', onFail);
        ws.on('unexpected-response', onUnexpected);
      });
    } catch (err) {
      this.lastError = err.message;
      this.connectionState = 'offline';
      this.log('error', `Connect failed: ${err.message}`);
      this.broadcastState();
      this._scheduleReconnect();
      return;
    }

    try {
      await this.sendBootNotification();
      this.normalizeIdleStatuses();
      await this.sendAllStatusNotifications();
      await this.announceConnectors();
      this.restartHeartbeat();
    } catch (err) {
      this.lastError = err.message;
      this.log('error', `Post-connect bootstrap failed: ${err.message}`);
    }
  }

  _onWsClose(code, reason) {
    this.log('warn', `WebSocket closed (${code}) ${reason}`);
    this.ws = null;
    this.bootAccepted = false;
    this._stopHeartbeat();
    this._stopAllMeters();
    this.connectionState = this.shouldRun ? 'reconnecting' : 'offline';
    this.broadcastState();
    if (this.shouldRun) this._scheduleReconnect();
  }

  _scheduleReconnect() {
    this._clearReconnect();
    if (!this.shouldRun) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
    this.reconnectAttempt += 1;
    this.log('info', `Reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  _clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /* ---------- OCPP send / receive ---------- */

  async sendCall(action, payload, { timeoutMs = 30000 } = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    const call = createCall(action, payload);
    const frame = stringifyFrame(call.raw);
    const connectorId = this._inferConnectorId('', payload);

    this._trace('out', action, call.messageId, payload, { connectorId });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(call.messageId);
        reject(new Error(`Timeout waiting for ${action} conf`));
      }, timeoutMs);

      this.pending.set(call.messageId, {
        action,
        connectorId,
        resolve: (payloadIn) => {
          clearTimeout(timer);
          resolve(payloadIn);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.ws.send(frame, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(call.messageId);
          reject(err);
        }
      });
    });
  }

  async _sendResult(messageId, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const frame = stringifyFrame(createCallResult(messageId, payload));
    this.ws.send(frame);
  }

  async _sendError(messageId, code, description) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const frame = stringifyFrame(createCallError(messageId, code, description));
    this.ws.send(frame);
  }

  _trace(direction, action, messageId, payload, extra = {}) {
    this.messageSeq += 1;
    let connectorId = extra.connectorId;
    if (connectorId == null) connectorId = this._inferConnectorId('', payload);
    const n = connectorId == null || connectorId === '' ? null : Number(connectorId);
    const resolved = Number.isFinite(n) ? n : null;
    this.onMessage({
      kind: 'ocpp',
      direction,
      action,
      messageId,
      payload,
      seq: this.messageSeq,
      cpId: this.cpId,
      connectorId: resolved,
      ts: Date.now(),
      ...extra,
      connectorId: resolved,
    });
  }

  async _onWsMessage(data) {
    const text = data.toString();
    let msg;
    try {
      msg = parseMessage(text);
    } catch (err) {
      this.log('error', `Bad frame: ${err.message}`);
      return;
    }

    if (msg.type === MessageType.CALLRESULT) {
      const pending = this.pending.get(msg.messageId);
      this._trace(
        'in',
        `${pending?.action || '?'}.conf`,
        msg.messageId,
        msg.payload,
        { connectorId: pending?.connectorId ?? this._inferConnectorId('', msg.payload) }
      );
      if (pending) {
        this.pending.delete(msg.messageId);
        pending.resolve(msg.payload);
      }
      return;
    }

    if (msg.type === MessageType.CALLERROR) {
      const pending = this.pending.get(msg.messageId);
      this._trace(
        'in',
        'CALLERROR',
        msg.messageId,
        {
          errorCode: msg.errorCode,
          errorDescription: msg.errorDescription,
          errorDetails: msg.errorDetails,
        },
        { connectorId: pending?.connectorId ?? null }
      );
      if (pending) {
        this.pending.delete(msg.messageId);
        pending.reject(new Error(`${msg.errorCode}: ${msg.errorDescription}`));
      }
      return;
    }

    // CALL from CSMS
    this._trace('in', msg.action, msg.messageId, msg.payload);
    const handler = inboundHandlers[msg.action];
    if (!handler) {
      this.log('warn', `Unhandled action ${msg.action}`);
      await this._sendError(msg.messageId, 'NotImplemented', `Action ${msg.action} not supported`);
      this._trace('out', 'CALLERROR', msg.messageId, { errorCode: 'NotImplemented' });
      return;
    }

    try {
      const result = await handler(this, msg.payload);
      // Optional post-conf work (e.g. TriggerMessage → BootNotification) must run
      // AFTER CALLRESULT is on the wire, or some CMS never log the follow-up.
      const after =
        result && typeof result === 'object' && typeof result.__after === 'function'
          ? result.__after
          : null;
      const conf =
        after && result && typeof result === 'object'
          ? Object.fromEntries(Object.entries(result).filter(([k]) => k !== '__after'))
          : result;

      await this._sendResult(msg.messageId, conf);
      this._trace('out', `${msg.action}.conf`, msg.messageId, conf);

      if (after) {
        setTimeout(() => {
          Promise.resolve()
            .then(() => after(this))
            .catch((err) => this.log('error', `Post-${msg.action} action failed: ${err.message}`));
        }, 75);
      }
    } catch (err) {
      this.log('error', `Handler ${msg.action} failed: ${err.message}`);
      await this._sendError(msg.messageId, 'InternalError', err.message);
      this._trace('out', 'CALLERROR', msg.messageId, { errorCode: 'InternalError' });
    }
  }

  /* ---------- outbound Core messages ---------- */

  async sendBootNotification() {
    const payload = {
      chargePointVendor: this.identity.chargePointVendor,
      chargePointModel: this.identity.chargePointModel,
      chargePointSerialNumber: this.identity.chargePointSerialNumber,
      chargeBoxSerialNumber: this.identity.chargePointSerialNumber,
      firmwareVersion: this.identity.firmwareVersion,
    };
    this.log('info', 'Sending BootNotification', payload);
    const conf = await this.sendCall('BootNotification', payload);

    if (conf.status === 'Accepted') {
      this.bootAccepted = true;
      if (typeof conf.interval === 'number' && conf.interval > 0) {
        this.config.keys.HeartbeatInterval = String(conf.interval);
      }
      this.restartHeartbeat();
      this.log('info', `BootNotification Accepted (interval=${conf.interval ?? '—'})`);
    } else {
      this.bootAccepted = false;
      this.log('warn', `BootNotification status: ${conf.status}`);
    }
    this.broadcastState();
    return conf;
  }

  async sendHeartbeat() {
    return this.sendCall('Heartbeat', {});
  }

  async sendFirmwareStatusNotification(status) {
    this.firmware.status = status;
    this.broadcastState();
    try {
      // OCPP 1.6 FirmwareStatusNotification.req only carries `status`
      await this.sendCall('FirmwareStatusNotification', { status });
      this.log('info', `FirmwareStatusNotification → ${status}`, this.getFirmwareDetails());
    } catch (err) {
      this.log('warn', `FirmwareStatusNotification failed: ${err.message}`);
    }
  }

  async sendDiagnosticsStatusNotification(status) {
    this.diagnostics.status = status;
    this.broadcastState();
    try {
      // OCPP 1.6 DiagnosticsStatusNotification.req only carries `status`
      await this.sendCall('DiagnosticsStatusNotification', { status });
      this.log('info', `DiagnosticsStatusNotification → ${status}`, this.getDiagnosticsDetails());
    } catch (err) {
      this.log('warn', `DiagnosticsStatusNotification failed: ${err.message}`);
    }
  }

  getFirmwareDetails() {
    return {
      status: this.firmware?.status || 'Idle',
      firmwareVersion: this.identity?.firmwareVersion || null,
      location: this.firmware?.location || null,
      retrieveDate: this.firmware?.retrieveDate || null,
    };
  }

  getDiagnosticsDetails() {
    return {
      status: this.diagnostics?.status || 'Idle',
      fileName: this.diagnostics?.fileName || null,
      location: this.diagnostics?.location || null,
      startTime: this.diagnostics?.startTime || null,
      stopTime: this.diagnostics?.stopTime || null,
    };
  }

  /**
   * Simulate GetDiagnostics upload to CMS-provided location (FTP/HTTP URI).
   * Does not actually upload bytes — advances OCPP status so Massive CMS completes the job.
   */
  beginDiagnosticsUpload({ location, retries = 1, retryInterval = 60, startTime, stopTime } = {}) {
    if (this.diagnostics.uploadTimer) {
      clearTimeout(this.diagnostics.uploadTimer);
      this.diagnostics.uploadTimer = null;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `diagnostics_${this.cpId}_${stamp}.log`;
    this.diagnostics.location = location || null;
    this.diagnostics.fileName = fileName;
    this.diagnostics.startTime = startTime || null;
    this.diagnostics.stopTime = stopTime || null;

    const retryCount = Number.isFinite(Number(retries)) ? Math.max(0, Number(retries)) : 1;
    const retrySec = Number.isFinite(Number(retryInterval)) ? Math.max(1, Number(retryInterval)) : 60;

    this.log('info', `Diagnostics upload requested → ${location} as ${fileName}`);

    const runAttempt = (attempt) => {
      this.sendDiagnosticsStatusNotification('Uploading').catch(() => {});
      // Simulated gather + upload latency
      this.diagnostics.uploadTimer = setTimeout(() => {
        this.diagnostics.uploadTimer = null;
        // Always succeed in lab (CMS only needs the status machine). Retries are simulated once if forced.
        const failOnce = false;
        if (failOnce && attempt < retryCount) {
          this.sendDiagnosticsStatusNotification('UploadFailed').catch(() => {});
          this.diagnostics.uploadTimer = setTimeout(() => runAttempt(attempt + 1), retrySec * 1000);
          return;
        }
        this.sendDiagnosticsStatusNotification('Uploaded').catch(() => {});
        this.diagnostics.uploadTimer = setTimeout(() => {
          this.diagnostics.uploadTimer = null;
          this.sendDiagnosticsStatusNotification('Idle').catch(() => {});
        }, 1500);
      }, 1800 + Math.min(attempt, 2) * 400);
    };

    setImmediate(() => runAttempt(0));
    return { fileName };
  }

  setChargingProfile(connectorId, csChargingProfiles) {
    this.smartCharging.configureFromConfig(this.config);
    const connector = this.getConnector(connectorId);
    if (connectorId !== 0 && !connector) {
      return { status: 'Rejected' };
    }

    const status = this.smartCharging.setProfile(connectorId, csChargingProfiles, {
      hasTransaction: !!(connector && connector.transactionId),
      transactionId: connector?.transactionId ?? null,
    });

    if (status === 'Accepted') {
      this.log(
        'info',
        `SetChargingProfile Accepted id=${csChargingProfiles?.chargingProfileId} purpose=${csChargingProfiles?.chargingProfilePurpose} connector=${connectorId}`
      );
      this.applySmartChargingLimits();
      this.broadcastState();
      this.emitUi('charging_profile', {
        action: 'set',
        connectorId,
        profileId: csChargingProfiles?.chargingProfileId,
      });
    }
    return { status };
  }

  clearChargingProfile(filters = {}) {
    const status = this.smartCharging.clearProfiles(filters);
    if (status === 'Accepted') {
      this.log('info', `ClearChargingProfile Accepted`, filters);
      this.applySmartChargingLimits();
      this.broadcastState();
      this.emitUi('charging_profile', { action: 'clear', ...filters });
    }
    return { status };
  }

  getCompositeSchedule(connectorId, duration, chargingRateUnit) {
    const connector =
      connectorId === 0 ? this.getConnector(1) : this.getConnector(connectorId);
    if (connectorId !== 0 && !this.getConnector(connectorId)) {
      return { status: 'Rejected' };
    }

    const target = this.getConnector(connectorId === 0 ? 0 : connectorId);
    const sample = connector || this.connectors.find((c) => c.number > 0);
    const meter = sample ? this.meters.get(sample.number) : null;
    const voltageV = meter?.voltageV || (sample?.powerKw >= 50 ? 400 : 230);
    const ratedKw =
      connectorId === 0
        ? this.powerKw
        : target?.powerKw ?? sample?.powerKw ?? this.powerKw;

    const schedule = this.smartCharging.buildCompositeSchedule({
      connectorId: connectorId === 0 ? 0 : connectorId,
      duration,
      chargingRateUnit: chargingRateUnit || 'W',
      connectorRatedKw: ratedKw,
      voltageV,
      transactionId: sample?.transactionId ?? null,
      transactionStartMs: sample?.transactionStartMs ?? null,
    });

    return {
      status: 'Accepted',
      connectorId,
      scheduleStart: schedule.startSchedule,
      chargingSchedule: schedule,
    };
  }

  /**
   * Apply active smart-charging limits to meters / SuspendedEVSE when limit is 0.
   */
  applySmartChargingLimits(onlyConnectorId = null) {
    const nowMs = Date.now();
    for (const c of this.connectors) {
      if (c.number === 0) continue;
      if (onlyConnectorId != null && c.number !== onlyConnectorId) continue;
      const meter = this.meters.get(c.number);
      if (!meter) continue;

      const voltageV = meter.voltageV || (c.powerKw >= 50 ? 400 : 230);
      const eff = this.smartCharging.getEffectiveLimit({
        connectorId: c.number,
        connectorRatedKw: c.powerKw ?? this.powerKw,
        voltageV,
        transactionId: c.transactionId,
        transactionStartMs: c.transactionStartMs ?? null,
        nowMs,
      });

      c.smartLimitW = Math.round(eff.limitW);
      c.smartLimitA = Math.round(eff.limitA * 10) / 10;

      const limitKw = Math.max(0, eff.limitW / 1000);
      meter.setMaxPowerKw(limitKw > 0 ? limitKw : 0);

      if (!c.transactionId) {
        c.smartChargingSuspended = false;
        continue;
      }

      if (eff.limitW <= 0.5) {
        if (c.status === ConnectorStatus.Charging || c.status === ConnectorStatus.SuspendedEV) {
          const prev = c.status;
          transition(c, ConnectorStatus.SuspendedEVSE, { force: true });
          meter.pause();
          c.smartChargingSuspended = true;
          if (prev !== ConnectorStatus.SuspendedEVSE && this.connectionState === 'online') {
            this.sendStatusNotification(c.number).catch(() => {});
          }
        } else if (c.status === ConnectorStatus.SuspendedEVSE) {
          meter.pause();
          c.smartChargingSuspended = true;
        }
      } else if (c.smartChargingSuspended && c.status === ConnectorStatus.SuspendedEVSE) {
        transition(c, ConnectorStatus.Charging, { force: true });
        meter.start();
        c.smartChargingSuspended = false;
        if (this.connectionState === 'online') {
          this.sendStatusNotification(c.number).catch(() => {});
        }
      }
    }
  }

  /**
   * Simulate OCPP UpdateFirmware: download → install → new FW version → Idle.
   * Location URL may end with a version token (e.g. .../Massive-CPS-16.3.2.2.bin).
   */
  beginFirmwareUpdate({ location, retrieveDate, retries = 1, retryInterval = 60 } = {}) {
    if (this.firmware.updateTimer) {
      clearTimeout(this.firmware.updateTimer);
      this.firmware.updateTimer = null;
    }

    this.firmware.location = location || null;
    this.firmware.retrieveDate = retrieveDate || null;
    const retryCount = Number.isFinite(Number(retries)) ? Math.max(0, Number(retries)) : 1;
    const retrySec = Number.isFinite(Number(retryInterval)) ? Math.max(1, Number(retryInterval)) : 60;

    const nextVersionFromLocation = (url) => {
      const base = String(url || '').split(/[?#]/)[0];
      const file = base.split('/').pop() || '';
      const match = file.match(/(Massive-CPS-16(?:\.\d+){1,3}|MM-CPS-16(?:\.\d+){1,3}|v?\d+\.\d+\.\d+)/i);
      if (match) {
        let v = match[1].replace(/^v/i, '');
        if (/^MM-CPS-16/i.test(v)) v = v.replace(/^MM-CPS-16/i, 'Massive-CPS-16');
        return /^Massive-CPS-16/i.test(v) ? v : `Massive-CPS-16.${v}`;
      }
      // bump patch of current FW
      const cur = String(this.identity.firmwareVersion || 'Massive-CPS-16.3.2.1');
      const parts = cur
        .replace(/^Massive-CPS-16\.?/i, '')
        .replace(/^MM-CPS-16\.?/i, '')
        .split('.')
        .map((n) => Number(n) || 0);
      while (parts.length < 3) parts.push(0);
      parts[parts.length - 1] += 1;
      return `Massive-CPS-16.${parts.join('.')}`;
    };

    const schedule = (fn, ms) => {
      this.firmware.updateTimer = setTimeout(fn, ms);
    };

    const fail = async (status, reason) => {
      this.log('error', `Firmware update ${status}: ${reason}`);
      await this.sendFirmwareStatusNotification(status);
      schedule(async () => {
        await this.sendFirmwareStatusNotification('Idle');
      }, 1500);
    };

    const runAttempt = (attempt) => {
      this.log('info', `Firmware update attempt ${attempt + 1} from ${location || '(no location)'}`);
      schedule(async () => {
        await this.sendFirmwareStatusNotification('Downloading');
        schedule(async () => {
          if (!location) {
            if (attempt < retryCount) {
              await this.sendFirmwareStatusNotification('DownloadFailed');
              schedule(() => runAttempt(attempt + 1), retrySec * 1000);
              return;
            }
            await fail('DownloadFailed', 'missing location');
            return;
          }
          await this.sendFirmwareStatusNotification('Downloaded');
          schedule(async () => {
            await this.sendFirmwareStatusNotification('Installing');
            schedule(async () => {
              const next = nextVersionFromLocation(location);
              this.identity.firmwareVersion = next;
              this.log('info', `Firmware installed: ${next}`);
              await this.sendFirmwareStatusNotification('Installed');
              this.broadcastState();
              schedule(async () => {
                await this.sendFirmwareStatusNotification('Idle');
                // Soft re-boot so CMS sees new firmwareVersion in BootNotification
                try {
                  await this.sendBootNotification();
                } catch (err) {
                  this.log('warn', `Post-FW BootNotification failed: ${err.message}`);
                }
              }, 1200);
            }, 2200);
          }, 1500);
        }, 1800);
      }, 400);
    };

    // Honor retrieveDate if far in the future; otherwise start soon
    let delayMs = 800;
    if (retrieveDate) {
      const when = Date.parse(retrieveDate);
      if (Number.isFinite(when)) {
        delayMs = Math.max(0, when - Date.now());
        // Cap lab delay so the UI doesn't wait hours
        delayMs = Math.min(delayMs, 15_000);
      }
    }
    schedule(() => runAttempt(0), delayMs);
  }

  restartHeartbeat() {
    this._stopHeartbeat();
    // OCPP allows small intervals; Massive / lab often want 1s for visibility.
    const sec = Math.max(1, this.config.getNumber('HeartbeatInterval', 60));
    this.log('info', `Heartbeat every ${sec}s`);
    const beat = () => {
      this.sendHeartbeat().catch((err) => this.log('warn', `Heartbeat: ${err.message}`));
    };
    // Immediate beat so ChangeConfiguration / Boot shows up in the UI right away
    beat();
    this.heartbeatTimer = setInterval(beat, sec * 1000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _connectorInfoString(c) {
    if (!c || c.number === 0) return c?.name || 'Charge Point';
    const name = c.name || `Connector ${c.number}`;
    const type = c.type || 'Unknown';
    const kw = c.powerKw ?? this.powerKw;
    const raw = `${name}|${type}|${kw}kW`;
    return raw.length <= 50 ? raw : raw.slice(0, 50);
  }

  async sendStatusNotification(connectorId, overrides = {}) {
    const c = this.getConnector(connectorId);
    if (!c) return null;
    const errorCode = overrides.errorCode ?? c.errorCode ?? 'NoError';
    let info = overrides.info ?? c.info ?? '';
    // When healthy, announce connector identity in info (OCPP 1.6 has no RenameConnector)
    if (!info && errorCode === 'NoError') {
      info = this._connectorInfoString(c);
    }
    const payload = {
      connectorId: c.number,
      errorCode,
      status: overrides.status ?? c.status,
      timestamp: utcNowIso(),
      info: info || undefined,
      vendorId: this.identity.chargePointVendor,
      vendorErrorCode: overrides.vendorErrorCode ?? c.vendorErrorCode ?? undefined,
    };
    // Strip undefined / empty optional fields
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined || payload[k] === '') delete payload[k];
    });
    return this.sendCall('StatusNotification', payload);
  }

  async sendAllStatusNotifications() {
    for (const c of this.connectors) {
      await this.sendStatusNotification(c.number);
    }
  }

  /** Clear stuck Finishing/Preparing with no active tx before announcing to CMS */
  normalizeIdleStatuses() {
    for (const c of this.connectors) {
      if (c.number === 0) continue;
      if (c.transactionId) continue;
      if (
        c.status === ConnectorStatus.Finishing ||
        c.status === ConnectorStatus.Preparing ||
        c.status === ConnectorStatus.SuspendedEV ||
        c.status === ConnectorStatus.SuspendedEVSE
      ) {
        c.cablePlugged = false;
        c.locked = false;
        c.idTag = null;
        const next =
          c.availability === 'Inoperative'
            ? ConnectorStatus.Unavailable
            : ConnectorStatus.Available;
        transition(c, next, { force: true });
        this.log('info', `Normalized C${c.number} → ${next}`);
      }
    }
    this.broadcastState();
  }

  /**
   * Vendor DataTransfer announcing gun names/types for CMS that accept ConnectorConfiguration.
   * Non-fatal if rejected — OCPP 1.6 has no standard rename API.
   */
  async announceConnectors() {
    const connectors = this.connectors
      .filter((c) => c.number > 0)
      .map((c) => ({
        connectorId: c.number,
        name: c.name || `Connector ${c.number}`,
        type: c.type,
        powerKw: c.powerKw ?? this.powerKw,
      }));
    try {
      const conf = await this.sendCall('DataTransfer', {
        vendorId: this.identity.chargePointVendor || 'MassiveMobility',
        messageId: 'ConnectorConfiguration',
        data: JSON.stringify({ connectors }),
      });
      const status = conf?.status || 'Unknown';
      this.log('info', `ConnectorConfiguration DataTransfer → ${status}`);
      return conf;
    } catch (err) {
      this.log('warn', `ConnectorConfiguration DataTransfer failed: ${err.message}`);
      return null;
    }
  }

  async setConnectorName(connectorId, name, { reannounce = true } = {}) {
    const c = this.getConnector(connectorId);
    if (!c || c.number === 0) throw new Error('Invalid connector');
    const trimmed = String(name || '').trim();
    c.name = trimmed || `Connector ${c.number}`;
    this.broadcastState();
    if (this.connectionState === 'online') {
      await this.sendStatusNotification(c.number);
      if (reannounce) await this.announceConnectors();
    }
    return { connectorId: c.number, name: c.name };
  }

  async authorizeIdTag(idTag) {
    const localEntry = this.localAuthList.get(idTag);
    const localStatus = localEntry?.status || null;
    const mode = this.authMode || 'local_or_csms';

    // Local-only mode: never block on CMS
    if (mode === 'local') {
      if (localStatus === 'Accepted') return 'Accepted';
      if (localStatus) return localStatus;
      return this.config.getBool('AllowOfflineTxForUnknownId', false) ? 'Accepted' : 'Invalid';
    }

    // local_or_csms: local whitelist wins (demo tags) — do not call CMS Authorize here
    // (calling CMS mid-handler can race with RemoteStart.conf / pending calls)
    if (mode === 'local_or_csms' && localStatus === 'Accepted') {
      return 'Accepted';
    }

    let remoteStatus = null;
    if (this.connectionState === 'online') {
      const cached = this.authCache.get(idTag);
      if (cached === 'Accepted' && mode === 'csms') {
        return 'Accepted';
      }
      try {
        const conf = await this.sendCall('Authorize', { idTag });
        remoteStatus = conf?.idTagInfo?.status || 'Invalid';
        if (this.config.getBool('AuthorizationCacheEnabled', true) && remoteStatus === 'Accepted') {
          this.authCache.set(idTag, remoteStatus);
        } else if (remoteStatus !== 'Accepted') {
          this.authCache.delete(idTag);
        }
      } catch (err) {
        this.log('warn', `Authorize call failed: ${err.message}`);
        if (mode === 'local_or_csms' && localStatus === 'Accepted') return 'Accepted';
        if (this.config.getBool('LocalAuthorizeOffline', true) && localStatus === 'Accepted') {
          return 'Accepted';
        }
        throw err;
      }
    } else {
      if (localStatus === 'Accepted') return 'Accepted';
      if (this.config.getBool('AllowOfflineTxForUnknownId', false)) return 'Accepted';
      return 'Invalid';
    }

    if (mode === 'csms') {
      return remoteStatus || 'Invalid';
    }

    // local_or_csms: accept if CMS or local whitelist allows it
    if (remoteStatus === 'Accepted' || localStatus === 'Accepted') {
      return 'Accepted';
    }
    return remoteStatus || localStatus || 'Invalid';
  }

  _tagsInUse(exceptConnectorId = null) {
    const used = new Set();
    for (const c of this.connectors) {
      if (c.number === 0) continue;
      if (exceptConnectorId != null && c.number === exceptConnectorId) continue;
      if (c.transactionId && c.idTag) used.add(c.idTag);
    }
    return used;
  }

  /**
   * Prefer the requested idTag, but if it is already charging on another outlet,
   * pick another free local tag (many CMS reject ConcurrentTx / Blocked for same RFID).
   */
  resolveIdTagForStart(connectorId, preferredIdTag) {
    const preferred = String(preferredIdTag || '').trim() || 'CARD-7F2A91';
    const inUse = this._tagsInUse(connectorId);
    if (!inUse.has(preferred)) return preferred;

    for (const tag of this.localAuthList.keys()) {
      if (!inUse.has(tag)) return tag;
    }
    // Last resort unique lab tag (may still fail on strict CMS auth)
    const fallback = `${preferred}-C${connectorId}`;
    if (!inUse.has(fallback)) {
      this.localAuthList.set(fallback, { status: 'Accepted' });
      return fallback;
    }
    const generated = `LAB-C${connectorId}-${Date.now().toString(36).toUpperCase()}`;
    this.localAuthList.set(generated, { status: 'Accepted' });
    return generated;
  }

  async beginTransaction(connectorId, idTag, { reason = 'Local' } = {}) {
    const connector = this.getConnector(connectorId);
    if (!connector || connector.number === 0) throw new Error('Invalid connector');
    if (connector.availability !== 'Operative') throw new Error('Connector inoperative');
    if (connector.status === ConnectorStatus.Faulted) throw new Error('Connector faulted');
    if (connector.transactionId) throw new Error('Transaction already active');

    // RemoteStart must keep the exact CMS idTag — swapping breaks Massive's session pairing
    let tag =
      reason === 'Remote'
        ? String(idTag || '').trim() || 'CARD-7F2A91'
        : this.resolveIdTagForStart(connectorId, idTag);
    if (tag !== idTag && reason !== 'Remote') {
      this.log(
        'warn',
        `idTag "${idTag}" already in use on another connector — using "${tag}" for C${connectorId}`,
        { connectorId }
      );
    }
    if (reason === 'Remote' && !this.localAuthList.has(tag)) {
      this.localAuthList.set(tag, { status: 'Accepted' });
    }

    if (connector.reservationId && connector.reservedIdTag && connector.reservedIdTag !== tag) {
      throw new Error('Reserved for another idTag');
    }

    const resetIfPreparing = async () => {
      if (connector.transactionId) return;
      if (connector.status === ConnectorStatus.Preparing) {
        transition(
          connector,
          connector.availability === 'Inoperative'
            ? ConnectorStatus.Unavailable
            : ConnectorStatus.Available,
          { force: true }
        );
        if (this.connectionState === 'online') {
          await this.sendStatusNotification(connector.number).catch(() => {});
        }
        this.broadcastState();
      }
    };

    const tryStartWithTag = async (candidate) => {
      // RemoteStart: CSMS already chose this idTag — do not round-trip Authorize
      // (Massive returns Invalid for demo tags and left the UI on Available).
      if (reason !== 'Remote') {
        const auth = await this.authorizeIdTag(candidate);
        if (auth !== 'Accepted') {
          return { ok: false, stage: 'Authorize', status: auth, tag: candidate };
        }
      } else {
        this.log('info', `RemoteStart: skipping Authorize for "${candidate}"`, { connectorId });
      }

      if (!connector.cablePlugged) {
        connector.cablePlugged = true;
      }

      transition(connector, ConnectorStatus.Preparing, { force: true });
      this.broadcastState();
      // Don't block session start on StatusNotification.conf (CMS can be slow)
      this.sendStatusNotification(connector.number).catch((err) =>
        this.log('warn', `Preparing StatusNotification: ${err.message}`, { connectorId })
      );

      const meter = this.meters.get(connectorId);
      if (!meter) throw new Error(`No meter for connector ${connectorId}`);
      meter.resetSession({ keepMeter: false });
      const meterStart = meter.snapshot().meterWh;

      const mode = this.authMode || 'local_or_csms';
      const localOk = this.localAuthList.get(candidate)?.status === 'Accepted';
      // Remote: always allow lab continue — CSMS asked us to start
      const mayLabContinue = reason === 'Remote' || ((mode === 'local' || mode === 'local_or_csms') && localOk);

      let conf;
      try {
        conf = await this.sendCall(
          'StartTransaction',
          {
            connectorId,
            idTag: candidate,
            meterStart,
            timestamp: utcNowIso(),
            reservationId: connector.reservationId || undefined,
          },
          { timeoutMs: 15000 }
        );
      } catch (err) {
        if (mayLabContinue) {
          this.log(
            'warn',
            `StartTransaction no conf (${err.message}) — starting locally for "${candidate}"`,
            { connectorId }
          );
          return {
            ok: true,
            conf: {
              transactionId: nextTransactionId++,
              idTagInfo: { status: 'Accepted' },
            },
            tag: candidate,
            meter,
            labOverride: true,
          };
        }
        await resetIfPreparing();
        throw err;
      }

      const st = conf.idTagInfo?.status;
      if (st && st !== 'Accepted') {
        if (mayLabContinue) {
          this.log(
            'warn',
            `CMS StartTransaction idTag ${st} for "${candidate}" — continuing session anyway (${reason}/${mode})`,
            { connectorId }
          );
          return {
            ok: true,
            conf: {
              ...conf,
              transactionId: conf.transactionId ?? nextTransactionId++,
            },
            tag: candidate,
            meter,
            labOverride: true,
          };
        }
        await resetIfPreparing();
        return { ok: false, stage: 'StartTransaction', status: st, tag: candidate, conf };
      }

      return { ok: true, conf, tag: candidate, meter };
    };

    let result;
    try {
      result = await tryStartWithTag(tag);

      // CMS often returns Blocked / ConcurrentTx when the same RFID is already charging elsewhere.
      // Retry once with other free local tags (local starts only — never swap RemoteStart tag).
      if (
        reason !== 'Remote' &&
        !result.ok &&
        result.stage === 'StartTransaction' &&
        (result.status === 'Blocked' || result.status === 'ConcurrentTx')
      ) {
        const inUse = this._tagsInUse(connectorId);
        inUse.add(result.tag);
        for (const alt of this.localAuthList.keys()) {
          if (inUse.has(alt)) continue;
          this.log('info', `Retry StartTransaction on C${connectorId} with alternate idTag "${alt}"`, {
            connectorId,
          });
          result = await tryStartWithTag(alt);
          if (result.ok) break;
          if (
            result.stage === 'StartTransaction' &&
            (result.status === 'Blocked' || result.status === 'ConcurrentTx')
          ) {
            inUse.add(result.tag);
            continue;
          }
          break;
        }
      }

      if (!result.ok) {
        await resetIfPreparing();
        if (result.stage === 'Authorize') {
          throw new Error(
            `Authorize ${result.status} for idTag "${result.tag}". Use a CMS-registered RFID, or set Auth mode to Local / Local or CMS.`
          );
        }
        const hint =
          result.status === 'Blocked' || result.status === 'ConcurrentTx'
            ? ` CMS rejected concurrent use of the same RFID. Use a different CMS-registered idTag for each connector (examples: ${[...this.localAuthList.keys()].slice(0, 3).join(', ')}).`
            : '';
        throw new Error(`StartTransaction idTag ${result.status} for "${result.tag}".${hint}`);
      }
    } catch (err) {
      await resetIfPreparing();
      throw err;
    }

    const { conf, meter } = result;
    tag = result.tag;

    connector.transactionId = conf.transactionId ?? nextTransactionId++;
    connector.idTag = tag;
    connector.locked = true;
    connector.transactionStartMs = Date.now();
    connector.smartChargingSuspended = false;
    if (connector.reservationId) {
      const t = this.reservationTimers.get(connector.reservationId);
      if (t) clearTimeout(t);
      this.reservationTimers.delete(connector.reservationId);
      connector.reservationId = null;
      connector.reservedIdTag = null;
    }

    transition(connector, ConnectorStatus.Charging, { force: true });
    await this.sendStatusNotification(connector.number);

    this.applySmartChargingLimits();
    if (connector.status === ConnectorStatus.Charging) {
      meter.start();
    }
    this._startMeterLoop(connectorId);

    this.log(
      'info',
      `Tx ${connector.transactionId} started on C${connectorId} with ${tag} (${reason}${result.labOverride ? ', labOverride' : ''})`,
      { connectorId }
    );
    this.broadcastState();
    return connector.transactionId;
  }

  async endTransaction(connectorId, reason = 'Local') {
    const connector = this.getConnector(connectorId);
    if (!connector || !connector.transactionId) throw new Error('No active transaction');

    const meter = this.meters.get(connectorId);
    meter.tick();
    meter.stop();
    this._stopMeterLoop(connectorId);

    const snap = meter.snapshot();
    const txId = connector.transactionId;
    const idTag = connector.idTag;

    await this.sendCall('StopTransaction', {
      transactionId: txId,
      idTag: idTag || undefined,
      timestamp: utcNowIso(),
      meterStop: snap.meterWh,
      reason,
      transactionData: [
        {
          timestamp: utcNowIso(),
          sampledValue: meter.sampledValues(),
        },
      ],
    });

    this.smartCharging.clearTxProfilesForTransaction(txId);
    this.smartCharging.clearTxProfilesForConnector(connectorId);

    connector.transactionId = null;
    connector.idTag = null;
    connector.transactionStartMs = null;
    connector.smartChargingSuspended = false;
    connector.smartLimitW = null;
    connector.smartLimitA = null;

    // Restore rated power cap after TxProfile cleared
    meter.setMaxPowerKw(connector.powerKw ?? this.powerKw);
    connector.locked = false;
    connector.meterWh = snap.meterWh;

    // Brief Finishing so CMS sees session end, then return to a usable state.
    transition(connector, ConnectorStatus.Finishing, { force: true });
    await this.sendStatusNotification(connector.number);

    // Lab behavior: after stop, release the session fully.
    // Real CPs often stay Finishing until cable unplug; that left Massive stuck on Finishing.
    if (reason !== 'EVDisconnected') {
      connector.cablePlugged = false;
    }

    if (connector.availability === 'Inoperative') {
      transition(connector, ConnectorStatus.Unavailable, { force: true });
    } else {
      transition(connector, ConnectorStatus.Available, { force: true });
    }
    await this.sendStatusNotification(connector.number);

    this.log('info', `Tx ${txId} stopped on C${connector.number} (${reason}) → ${connector.status}`, {
      connectorId: connector.number,
    });
    const kwh = (snap.meterWh || 0) / 1000;
    connector.lastSessionKwh = Number(kwh.toFixed(3));
    connector.lastSessionCost = Number((kwh * this.energyRatePerKwh).toFixed(2));
    this.broadcastState();
  }

  setTariff({ energyRatePerKwh, currency, currencySymbol } = {}) {
    if (energyRatePerKwh != null && Number.isFinite(Number(energyRatePerKwh))) {
      this.energyRatePerKwh = Math.max(0, Number(energyRatePerKwh));
    }
    if (currency) this.currency = String(currency).slice(0, 8).toUpperCase();
    if (currencySymbol) this.currencySymbol = String(currencySymbol).slice(0, 4);
    this.broadcastState();
    return {
      energyRatePerKwh: this.energyRatePerKwh,
      currency: this.currency,
      currencySymbol: this.currencySymbol,
    };
  }

  async sendMeterValues(connectorId, { alreadyTicked = false } = {}) {
    const connector = this.getConnector(connectorId);
    const meter = this.meters.get(connectorId);
    if (!connector || !meter) return null;
    if (!alreadyTicked) meter.tick();
    const snap = meter.snapshot();
    connector.meterWh = snap.meterWh;
    connector.powerW = snap.powerW;

    const payload = {
      connectorId,
      transactionId: connector.transactionId || undefined,
      meterValue: [
        {
          timestamp: utcNowIso(),
          sampledValue: meter.sampledValues(),
        },
      ],
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const conf = await this.sendCall('MeterValues', payload);
    this.broadcastState();
    return conf;
  }

  /**
   * Fast UI sim tick (~400ms) + OCPP MeterValues on MeterValueSampleInterval.
   * Keeps energy/power/cost live in the console without flooding the CMS.
   */
  _startMeterLoop(connectorId) {
    this._stopMeterLoop(connectorId);
    const ocppSec = Math.max(1, this.config.getNumber('MeterValueSampleInterval', 2));
    const uiMs = 400;
    let sinceOcppMs = 0;

    const timer = setInterval(() => {
      const c = this.getConnector(connectorId);
      if (!c?.transactionId) {
        this._stopMeterLoop(connectorId);
        return;
      }

      const meter = this.meters.get(connectorId);
      if (meter) {
        this.applySmartChargingLimits(connectorId);
        if (c.status === ConnectorStatus.Charging) {
          meter.tick();
        }
        const snap = meter.snapshot();
        c.meterWh = snap.meterWh;
        c.powerW = snap.powerW;
        this.broadcastState();
      }

      sinceOcppMs += uiMs;
      if (sinceOcppMs >= ocppSec * 1000) {
        sinceOcppMs = 0;
        this.sendMeterValues(connectorId, { alreadyTicked: true }).catch((err) =>
          this.log('warn', `MeterValues: ${err.message}`, { connectorId })
        );
      }
    }, uiMs);

    this.meterTimers.set(connectorId, timer);
  }

  _stopMeterLoop(connectorId) {
    const t = this.meterTimers.get(connectorId);
    if (t) {
      clearInterval(t);
      this.meterTimers.delete(connectorId);
    }
  }

  _stopAllMeters() {
    for (const id of [...this.meterTimers.keys()]) this._stopMeterLoop(id);
  }

  restartMeterLoops() {
    for (const c of this.connectors) {
      if (c.transactionId) this._startMeterLoop(c.number);
    }
  }

  /* ---------- operator actions ---------- */

  setConnectorType(connectorId, type) {
    const c = this.getConnector(connectorId);
    if (!c || c.number === 0) return;
    c.type = type;
    this.broadcastState();
    if (this.connectionState === 'online') {
      this.sendStatusNotification(c.number).catch(() => {});
    }
  }

  async plugCable(connectorId, plugged) {
    const c = this.getConnector(connectorId);
    if (!c || c.number === 0) throw new Error('Invalid connector');
    c.cablePlugged = !!plugged;

    if (plugged) {
      if (c.status === ConnectorStatus.Available || c.status === ConnectorStatus.Reserved) {
        transition(c, ConnectorStatus.Preparing);
        if (this.connectionState === 'online') await this.sendStatusNotification(c.number);
      }
    } else {
      if (c.transactionId) {
        const stopOnDisconnect = this.config.getBool('StopTransactionOnEVSideDisconnect', true);
        if (stopOnDisconnect) {
          await this.endTransaction(connectorId, 'EVDisconnected');
        }
      }
      if (c.status === ConnectorStatus.Preparing || c.status === ConnectorStatus.Finishing) {
        transition(c, ConnectorStatus.Available, { force: true });
        if (this.connectionState === 'online') await this.sendStatusNotification(c.number);
      }
    }
    this.broadcastState();
  }

  async localAuthorizeAndStart(connectorId, idTag) {
    const c = this.getConnector(connectorId);
    if (!c) throw new Error('Invalid connector');
    if (!c.cablePlugged) {
      await this.plugCable(connectorId, true);
    }
    return this.beginTransaction(connectorId, idTag, { reason: 'Local' });
  }

  async localStop(connectorId, reason = 'Local') {
    return this.endTransaction(connectorId, reason);
  }

  async emergencyStop(connectorId) {
    const c = this.getConnector(connectorId);
    if (c?.transactionId) {
      await this.endTransaction(connectorId, 'EmergencyStop');
    }
  }

  async injectFault(connectorId, errorCode, info = '') {
    const c = this.getConnector(connectorId);
    if (!c) throw new Error('Invalid connector');
    if (c.transactionId) {
      await this.endTransaction(connectorId, 'Other');
    }
    c.errorCode = errorCode || 'OtherError';
    c.info = info;
    transition(c, ConnectorStatus.Faulted, { force: true });
    if (this.connectionState === 'online') await this.sendStatusNotification(c.number);
    this.broadcastState();
  }

  async clearFault(connectorId) {
    const c = this.getConnector(connectorId);
    if (!c) throw new Error('Invalid connector');
    c.errorCode = 'NoError';
    c.info = '';
    c.vendorErrorCode = '';
    const next =
      c.availability === 'Inoperative' ? ConnectorStatus.Unavailable : ConnectorStatus.Available;
    transition(c, next, { force: true });
    if (this.connectionState === 'online') await this.sendStatusNotification(c.number);
    this.broadcastState();
  }

  async setSuspended(connectorId, who /* 'EV' | 'EVSE' | null */) {
    const c = this.getConnector(connectorId);
    if (!c?.transactionId) throw new Error('No transaction');
    const meter = this.meters.get(connectorId);
    if (!who) {
      transition(c, ConnectorStatus.Charging, { force: true });
      meter.start();
    } else if (who === 'EV') {
      transition(c, ConnectorStatus.SuspendedEV, { force: true });
      meter.pause();
    } else {
      transition(c, ConnectorStatus.SuspendedEVSE, { force: true });
      meter.pause();
    }
    if (this.connectionState === 'online') await this.sendStatusNotification(c.number);
    this.broadcastState();
  }

  updatePower(powerKw) {
    this.powerKw = powerKw;
    for (const c of this.connectors) {
      if (c.number === 0) continue;
      c.powerKw = powerKw;
      this.meters.get(c.number)?.setMaxPowerKw(powerKw);
    }
    this.broadcastState();
  }

  updateConnectorPower(connectorId, powerKw) {
    const c = this.getConnector(connectorId);
    if (!c || c.number === 0) throw new Error('Invalid connector');
    const kw = Number(powerKw);
    if (!Number.isFinite(kw) || kw <= 0) throw new Error('Invalid power');
    c.powerKw = kw;
    this.meters.get(connectorId)?.setMaxPowerKw(kw);
    this.broadcastState();
  }

  updateSocSettings(connectorId, { soc, batteryKwh } = {}) {
    const meter = this.meters.get(connectorId);
    if (!meter) return;
    if (soc !== undefined) meter.setSoc(soc);
    if (batteryKwh !== undefined) meter.setBatteryKwh(batteryKwh);
    this.broadcastState();
  }

  addLocalTag(idTag) {
    this.localAuthList.set(idTag, { status: 'Accepted' });
    this.authCache.delete(idTag);
    this.broadcastState();
  }

  setAuthMode(mode) {
    const allowed = new Set(['csms', 'local', 'local_or_csms']);
    if (!allowed.has(mode)) throw new Error('authMode must be csms, local, or local_or_csms');
    this.authMode = mode;
    this.authCache.clear();
    this.log('info', `Auth mode → ${mode}`);
    this.broadcastState();
  }

  clearAuthCache() {
    this.authCache.clear();
    this.broadcastState();
  }

  async performReset(type) {
    this.log('info', `Performing ${type} reset`);
    for (const c of this.connectors) {
      if (c.transactionId) {
        try {
          await this.endTransaction(c.number, type === 'Hard' ? 'HardReset' : 'SoftReset');
        } catch {
          /* ignore */
        }
      }
    }

    if (type === 'Hard') {
      await this.stop({ silent: true });
      this.shouldRun = true;
      // Reset connector runtime state
      for (const c of this.connectors) {
        if (c.number === 0) continue;
        c.cablePlugged = false;
        c.locked = false;
        c.transactionId = null;
        c.idTag = null;
        c.errorCode = 'NoError';
        transition(c, c.availability === 'Inoperative' ? ConnectorStatus.Unavailable : ConnectorStatus.Available, {
          force: true,
        });
        this.meters.get(c.number)?.resetSession();
      }
      await this.connect();
    } else {
      await this.sendAllStatusNotifications();
      this.broadcastState();
    }
  }

  setRequireSubprotocol(value) {
    this.requireSubprotocol = !!value;
  }
}
