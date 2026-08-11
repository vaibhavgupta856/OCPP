/**
 * OCPP 1.6 Smart Charging helpers: profile store, schedule eval, composite schedule.
 */

const PURPOSES = new Set(['ChargePointMaxProfile', 'TxDefaultProfile', 'TxProfile']);
const KINDS = new Set(['Absolute', 'Recurring', 'Relative']);
const RATE_UNITS = new Set(['W', 'A']);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function parseIsoMs(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * @typedef {{ connectorId: number, profile: object }} StoredProfile
 */

export class SmartChargingStore {
  constructor({
    maxStackLevel = 3,
    maxProfiles = 10,
    allowedRateUnits = ['Current', 'Power'],
    maxPeriods = 24,
  } = {}) {
    /** @type {StoredProfile[]} */
    this.profiles = [];
    this.maxStackLevel = maxStackLevel;
    this.maxProfiles = maxProfiles;
    this.allowedRateUnits = allowedRateUnits;
    this.maxPeriods = maxPeriods;
  }

  configureFromConfig(config) {
    this.maxStackLevel = config.getNumber('ChargeProfileMaxStackLevel', 3);
    this.maxProfiles = config.getNumber('MaxChargingProfilesInstalled', 10);
    this.maxPeriods = config.getNumber('ChargingScheduleMaxPeriods', 24);
    const units = String(config.keys.ChargingScheduleAllowedChargingRateUnit || 'Current,Power');
    this.allowedRateUnits = units.split(',').map((s) => s.trim()).filter(Boolean);
  }

  list() {
    return this.profiles.map((p) => ({
      connectorId: p.connectorId,
      chargingProfileId: p.profile.chargingProfileId,
      stackLevel: p.profile.stackLevel,
      chargingProfilePurpose: p.profile.chargingProfilePurpose,
      chargingProfileKind: p.profile.chargingProfileKind,
      transactionId: p.profile.transactionId ?? null,
      validFrom: p.profile.validFrom ?? null,
      validTo: p.profile.validTo ?? null,
      chargingRateUnit: p.profile.chargingSchedule?.chargingRateUnit ?? null,
    }));
  }

  /**
   * Validate + install. Returns OCPP status string.
   */
  setProfile(connectorId, csChargingProfiles, { hasTransaction, transactionId } = {}) {
    if (!csChargingProfiles || typeof csChargingProfiles !== 'object') {
      return 'Rejected';
    }

    const profile = clone(csChargingProfiles);
    const purpose = profile.chargingProfilePurpose;
    const kind = profile.chargingProfileKind;
    const schedule = profile.chargingSchedule;

    if (!PURPOSES.has(purpose) || !KINDS.has(kind)) return 'Rejected';
    if (typeof profile.chargingProfileId !== 'number') return 'Rejected';
    if (typeof profile.stackLevel !== 'number' || profile.stackLevel < 0) return 'Rejected';
    if (profile.stackLevel > this.maxStackLevel) return 'Rejected';
    if (!schedule || !RATE_UNITS.has(schedule.chargingRateUnit)) return 'Rejected';
    if (!Array.isArray(schedule.chargingSchedulePeriod) || schedule.chargingSchedulePeriod.length === 0) {
      return 'Rejected';
    }
    if (schedule.chargingSchedulePeriod.length > this.maxPeriods) return 'Rejected';

    const unitOk =
      (schedule.chargingRateUnit === 'W' && this.allowedRateUnits.some((u) => /power/i.test(u))) ||
      (schedule.chargingRateUnit === 'A' && this.allowedRateUnits.some((u) => /current/i.test(u)));
    if (!unitOk) return 'Rejected';

    for (const period of schedule.chargingSchedulePeriod) {
      if (typeof period.startPeriod !== 'number' || period.startPeriod < 0) return 'Rejected';
      if (typeof period.limit !== 'number' || period.limit < 0) return 'Rejected';
    }

    // Spec: ChargePointMaxProfile only on connector 0
    if (purpose === 'ChargePointMaxProfile' && connectorId !== 0) {
      return 'Rejected';
    }

    // Spec: TxProfile only while a transaction is active on that connector
    if (purpose === 'TxProfile') {
      if (connectorId === 0 || !hasTransaction) return 'Rejected';
      if (
        profile.transactionId != null &&
        transactionId != null &&
        Number(profile.transactionId) !== Number(transactionId)
      ) {
        return 'Rejected';
      }
      if (profile.transactionId == null && transactionId != null) {
        profile.transactionId = transactionId;
      }
    }

    // Replace by same chargingProfileId
    this.profiles = this.profiles.filter((p) => p.profile.chargingProfileId !== profile.chargingProfileId);

    // Replace by connectorId + purpose + stackLevel
    this.profiles = this.profiles.filter(
      (p) =>
        !(
          p.connectorId === connectorId &&
          p.profile.chargingProfilePurpose === purpose &&
          p.profile.stackLevel === profile.stackLevel
        )
    );

    if (this.profiles.length >= this.maxProfiles) {
      return 'Rejected';
    }

    this.profiles.push({ connectorId, profile });
    return 'Accepted';
  }

  clearProfiles(filters = {}) {
    const { id, connectorId, chargingProfilePurpose, stackLevel } = filters;
    const hasFilter =
      id != null || connectorId != null || chargingProfilePurpose != null || stackLevel != null;

    const before = this.profiles.length;
    if (!hasFilter) {
      this.profiles = [];
      return before > 0 ? 'Accepted' : 'Unknown';
    }

    const kept = [];
    let removed = 0;
    for (const p of this.profiles) {
      const matchId = id == null || p.profile.chargingProfileId === id;
      const matchConn = connectorId == null || p.connectorId === connectorId;
      const matchPurpose =
        chargingProfilePurpose == null || p.profile.chargingProfilePurpose === chargingProfilePurpose;
      const matchStack = stackLevel == null || p.profile.stackLevel === stackLevel;
      if (matchId && matchConn && matchPurpose && matchStack) {
        removed += 1;
      } else {
        kept.push(p);
      }
    }
    this.profiles = kept;
    return removed > 0 ? 'Accepted' : 'Unknown';
  }

  /** Drop TxProfiles that belong to a finished transaction */
  clearTxProfilesForTransaction(transactionId) {
    if (transactionId == null) return;
    this.profiles = this.profiles.filter(
      (p) =>
        !(
          p.profile.chargingProfilePurpose === 'TxProfile' &&
          Number(p.profile.transactionId) === Number(transactionId)
        )
    );
  }

  clearTxProfilesForConnector(connectorId) {
    this.profiles = this.profiles.filter(
      (p) => !(p.connectorId === connectorId && p.profile.chargingProfilePurpose === 'TxProfile')
    );
  }

  _isValidNow(profile, nowMs) {
    const from = parseIsoMs(profile.validFrom);
    const to = parseIsoMs(profile.validTo);
    if (from != null && nowMs < from) return false;
    if (to != null && nowMs > to) return false;
    return true;
  }

  _periodLimitAt(schedule, elapsedSec) {
    const periods = [...(schedule.chargingSchedulePeriod || [])].sort(
      (a, b) => a.startPeriod - b.startPeriod
    );
    let limit = periods[0]?.limit ?? null;
    for (const p of periods) {
      if (elapsedSec >= p.startPeriod) limit = p.limit;
      else break;
    }
    if (schedule.duration != null && elapsedSec > schedule.duration) {
      return null;
    }
    return limit;
  }

  /**
   * Resolve limit for a profile at `nowMs`.
   * Returns { limit, unit } or null if inactive.
   */
  resolveProfileLimit(profile, nowMs, { transactionStartMs = null } = {}) {
    if (!this._isValidNow(profile, nowMs)) return null;
    const schedule = profile.chargingSchedule;
    if (!schedule) return null;

    let scheduleStartMs = parseIsoMs(schedule.startSchedule);
    if (profile.chargingProfileKind === 'Relative') {
      scheduleStartMs = transactionStartMs ?? nowMs;
    } else if (profile.chargingProfileKind === 'Recurring') {
      // Daily / Weekly: align to startSchedule time-of-day (or midnight) within recurrence window
      const base = scheduleStartMs ?? nowMs;
      const rec = profile.recurrencyKind === 'Weekly' ? 7 * 86400000 : 86400000;
      const offset = ((nowMs - base) % rec + rec) % rec;
      scheduleStartMs = nowMs - offset;
    } else {
      // Absolute
      if (scheduleStartMs == null) scheduleStartMs = nowMs;
    }

    const elapsedSec = Math.max(0, Math.floor((nowMs - scheduleStartMs) / 1000));
    const limit = this._periodLimitAt(schedule, elapsedSec);
    if (limit == null) return null;
    return { limit, unit: schedule.chargingRateUnit };
  }

  _pickHighestStack(candidates, nowMs, opts) {
    let best = null;
    let bestStack = -1;
    for (const entry of candidates) {
      const resolved = this.resolveProfileLimit(entry.profile, nowMs, opts);
      if (!resolved) continue;
      if (entry.profile.stackLevel >= bestStack) {
        bestStack = entry.profile.stackLevel;
        best = resolved;
      }
    }
    return best;
  }

  /**
   * Effective limit for a connector in Watts (and Amps for reporting).
   */
  getEffectiveLimit({
    connectorId,
    connectorRatedKw,
    voltageV = 230,
    transactionId = null,
    transactionStartMs = null,
    nowMs = Date.now(),
  }) {
    const ratedW = Math.max(0, Number(connectorRatedKw) || 0) * 1000;

    const cpMax = this._pickHighestStack(
      this.profiles.filter(
        (p) => p.connectorId === 0 && p.profile.chargingProfilePurpose === 'ChargePointMaxProfile'
      ),
      nowMs,
      { transactionStartMs }
    );

    const txProfiles = this.profiles.filter(
      (p) =>
        p.connectorId === connectorId &&
        p.profile.chargingProfilePurpose === 'TxProfile' &&
        (p.profile.transactionId == null ||
          transactionId == null ||
          Number(p.profile.transactionId) === Number(transactionId))
    );
    let tx = this._pickHighestStack(txProfiles, nowMs, { transactionStartMs });

    if (!tx) {
      const defaults = this.profiles.filter(
        (p) =>
          (p.connectorId === connectorId || p.connectorId === 0) &&
          p.profile.chargingProfilePurpose === 'TxDefaultProfile'
      );
      // Prefer connector-specific over CP-level
      const specific = defaults.filter((p) => p.connectorId === connectorId);
      tx =
        this._pickHighestStack(specific, nowMs, { transactionStartMs }) ||
        this._pickHighestStack(
          defaults.filter((p) => p.connectorId === 0),
          nowMs,
          { transactionStartMs }
        );
    }

    const toWatts = (resolved) => {
      if (!resolved) return null;
      if (resolved.unit === 'W') return resolved.limit;
      return resolved.limit * Math.max(1, voltageV);
    };

    let limitW = ratedW;
    const parts = [];
    const cpMaxW = toWatts(cpMax);
    const txW = toWatts(tx);
    if (cpMaxW != null) {
      limitW = Math.min(limitW, cpMaxW);
      parts.push({ purpose: 'ChargePointMaxProfile', ...cpMax, watts: cpMaxW });
    }
    if (txW != null) {
      limitW = Math.min(limitW, txW);
      parts.push({
        purpose: txProfiles.length ? 'TxProfile' : 'TxDefaultProfile',
        ...tx,
        watts: txW,
      });
    }

    const limitA = voltageV > 0 ? limitW / voltageV : 0;
    return {
      limitW: Math.max(0, limitW),
      limitA: Math.max(0, limitA),
      ratedW,
      parts,
    };
  }

  /**
   * Build GetCompositeSchedule response schedule for duration seconds.
   */
  buildCompositeSchedule({
    connectorId,
    duration,
    chargingRateUnit = 'W',
    connectorRatedKw,
    voltageV = 230,
    transactionId = null,
    transactionStartMs = null,
    nowMs = Date.now(),
  }) {
    const unit = chargingRateUnit === 'A' ? 'A' : 'W';
    const durationSec = Math.max(1, Math.floor(Number(duration) || 0));
    const step = 60; // 1-minute resolution for composite
    const periods = [];
    let lastLimit = null;
    let periodStart = 0;

    for (let t = 0; t <= durationSec; t += step) {
      const at = nowMs + t * 1000;
      const eff = this.getEffectiveLimit({
        connectorId,
        connectorRatedKw,
        voltageV,
        transactionId,
        transactionStartMs,
        nowMs: at,
      });
      const limit = unit === 'A' ? Math.round(eff.limitA * 10) / 10 : Math.round(eff.limitW);
      if (lastLimit === null) {
        lastLimit = limit;
        periodStart = 0;
      } else if (limit !== lastLimit) {
        periods.push({ startPeriod: periodStart, limit: lastLimit });
        periodStart = t;
        lastLimit = limit;
      }
    }
    if (lastLimit !== null) {
      periods.push({ startPeriod: periodStart, limit: lastLimit });
    }
    if (periods.length === 0) {
      const ratedW = (Number(connectorRatedKw) || 0) * 1000;
      periods.push({
        startPeriod: 0,
        limit: unit === 'A' ? Math.round((ratedW / voltageV) * 10) / 10 : Math.round(ratedW),
      });
    }

    return {
      duration: durationSec,
      startSchedule: new Date(nowMs).toISOString(),
      chargingRateUnit: unit,
      chargingSchedulePeriod: periods,
    };
  }
}
