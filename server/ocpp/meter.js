/**
 * Energy / power / SoC metering simulation for a single connector
 */

export class MeterSimulator {
  constructor({ maxPowerKw = 22, batteryKwh = 60, initialSoc = 20, energyRatePerKwh = 18.5 } = {}) {
    this.maxPowerKw = maxPowerKw;
    this.batteryKwh = Math.max(0.1, Number(batteryKwh) || 60);
    this.soc = Math.max(0, Math.min(100, Number(initialSoc) || 0));
    this.meterWh = 0;
    this.powerW = 0;
    this.currentA = 0;
    this.voltageV = maxPowerKw >= 50 ? 400 : 230;
    this.running = false;
    this._lastTick = null;
    this.socEnabled = true;
    this.full = this.soc >= 99.5;

    /** @type {'full'|'energy'|'money'|'time'} */
    this.fillMode = 'full';
    this.fillEnergyKwh = null;
    this.fillMoney = null;
    this.fillMinutes = null;
    this.energyRatePerKwh = Math.max(0, Number(energyRatePerKwh) || 0);
    this.sessionStartedAt = null;
    this.limitReached = false;
    this.limitReason = null;
  }

  resetSession({ keepMeter = false } = {}) {
    if (!keepMeter) this.meterWh = 0;
    this.powerW = 0;
    this.currentA = 0;
    this.running = false;
    this._lastTick = null;
    this.sessionStartedAt = null;
    this.limitReached = false;
    this.limitReason = null;
    this.full = this.soc >= 99.5;
  }

  setFillGoal({ mode = 'full', energyKwh, money, minutes, energyRatePerKwh } = {}) {
    const allowed = new Set(['full', 'energy', 'money', 'time']);
    this.fillMode = allowed.has(mode) ? mode : 'full';
    this.fillEnergyKwh =
      energyKwh != null && Number.isFinite(Number(energyKwh)) ? Math.max(0, Number(energyKwh)) : null;
    this.fillMoney =
      money != null && Number.isFinite(Number(money)) ? Math.max(0, Number(money)) : null;
    this.fillMinutes =
      minutes != null && Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : null;
    if (energyRatePerKwh != null && Number.isFinite(Number(energyRatePerKwh))) {
      this.energyRatePerKwh = Math.max(0, Number(energyRatePerKwh));
    }
    this.limitReached = false;
    this.limitReason = null;
  }

  setEnergyRate(rate) {
    this.energyRatePerKwh = Math.max(0, Number(rate) || 0);
  }

  start() {
    this.full = this.soc >= 99.5;
    this.limitReached = false;
    this.limitReason = null;
    this.sessionStartedAt = Date.now();

    if (this.full || this.sessionEnergyCapWh() <= 0) {
      this.soc = this.full ? 100 : this.soc;
      this.full = this.full || this.remainingKwh() <= 0.0005;
      this.limitReached = !this.full;
      this.limitReason = this.full ? 'full' : this.fillMode;
      this.running = false;
      this.powerW = 0;
      this.currentA = 0;
      this._lastTick = null;
      return;
    }

    this.running = true;
    this._lastTick = Date.now();
    this._applyPower(this.maxPowerKw * 1000 * (0.85 + Math.random() * 0.15));
  }

  pause() {
    this.running = false;
    this.powerW = 0;
    this.currentA = 0;
    this._lastTick = null;
  }

  stop() {
    this.pause();
  }

  setMaxPowerKw(kw) {
    this.maxPowerKw = kw;
    this.voltageV = kw >= 50 ? 400 : 230;
  }

  setSoc(soc) {
    this.soc = Math.max(0, Math.min(100, Number(soc) || 0));
    this.full = this.soc >= 99.5;
    if (this.full) {
      this.soc = 100;
      this.pause();
    }
  }

  setBatteryKwh(kwh) {
    this.batteryKwh = Math.max(0.1, Number(kwh) || 0.1);
  }

  /** kWh still needed to reach 100% SoC */
  remainingKwh() {
    if (this.batteryKwh <= 0) return 0;
    return Math.max(0, ((100 - this.soc) / 100) * this.batteryKwh);
  }

  /** Max Wh this session may still accept (pack + fill goal) */
  sessionEnergyCapWh() {
    let capWh = this.remainingKwh() * 1000;
    if (this.fillMode === 'energy' && this.fillEnergyKwh != null) {
      capWh = Math.min(capWh, this.fillEnergyKwh * 1000);
    } else if (this.fillMode === 'money' && this.fillMoney != null && this.energyRatePerKwh > 0) {
      capWh = Math.min(capWh, (this.fillMoney / this.energyRatePerKwh) * 1000);
    }
    return Math.max(0, capWh);
  }

  plannedDeliverKwh() {
    return this.sessionEnergyCapWh() / 1000;
  }

  plannedCost() {
    return this.plannedDeliverKwh() * this.energyRatePerKwh;
  }

  _timeLimitHit(now = Date.now()) {
    if (this.fillMode !== 'time' || this.fillMinutes == null || !this.sessionStartedAt) return false;
    return now - this.sessionStartedAt >= this.fillMinutes * 60_000;
  }

  tick() {
    if (!this.running) {
      return this.snapshot();
    }
    const now = Date.now();
    const elapsedMs = this._lastTick ? now - this._lastTick : 0;
    this._lastTick = now;

    if (this._timeLimitHit(now)) {
      this.limitReached = true;
      this.limitReason = 'time';
      this.pause();
      return this.snapshot();
    }

    const target = this.maxPowerKw * 1000 * (0.82 + Math.random() * 0.16);
    this._applyPower(this.powerW * 0.7 + target * 0.3);

    const hours = elapsedMs / 3_600_000;
    let deltaWh = this.powerW * hours;

    const sessionCapWh = this.sessionEnergyCapWh();
    const roomWh = Math.max(0, sessionCapWh - this.meterWh);
    if (deltaWh > roomWh) deltaWh = roomWh;

    this.meterWh += deltaWh;

    if (this.socEnabled && this.batteryKwh > 0 && deltaWh > 0) {
      const deltaKwh = deltaWh / 1000;
      this.soc = Math.min(100, this.soc + (deltaKwh / this.batteryKwh) * 100);
    }

    if (this.soc >= 99.5 || this.remainingKwh() <= 0.0005) {
      this.soc = 100;
      this.full = true;
      this.limitReason = 'full';
      this.pause();
    } else if (this.meterWh + 0.01 >= sessionCapWh) {
      this.limitReached = true;
      this.limitReason = this.fillMode === 'full' ? 'full' : this.fillMode;
      this.pause();
    }

    return this.snapshot();
  }

  _applyPower(watts) {
    this.powerW = Math.max(0, watts);
    if (this.voltageV > 0) {
      this.currentA = this.powerW / this.voltageV;
    }
  }

  snapshot() {
    const deliveredKwh = this.meterWh / 1000;
    return {
      meterWh: Math.round(this.meterWh * 1000) / 1000,
      powerW: Math.round(this.powerW),
      currentA: Math.round(this.currentA * 10) / 10,
      voltageV: Math.round(this.voltageV),
      soc: this.socEnabled ? Math.round(this.soc * 10) / 10 : null,
      batteryKwh: this.batteryKwh,
      energyInKwh: Math.round((this.soc / 100) * this.batteryKwh * 1000) / 1000,
      remainingKwh: Math.round(this.remainingKwh() * 1000) / 1000,
      full: !!this.full,
      limitReached: !!this.limitReached || !!this.full,
      limitReason: this.full ? 'full' : this.limitReason,
      fillMode: this.fillMode,
      fillEnergyKwh: this.fillEnergyKwh,
      fillMoney: this.fillMoney,
      fillMinutes: this.fillMinutes,
      plannedDeliverKwh: Math.round(this.plannedDeliverKwh() * 1000) / 1000,
      plannedCost: Math.round(this.plannedCost() * 100) / 100,
      sessionCost: Math.round(deliveredKwh * this.energyRatePerKwh * 100) / 100,
      elapsedSec: this.sessionStartedAt
        ? Math.max(0, Math.round((Date.now() - this.sessionStartedAt) / 1000))
        : 0,
    };
  }

  sampledValues({ includeSoc = true } = {}) {
    const snap = this.snapshot();
    const values = [
      {
        value: String(Math.round(snap.meterWh)),
        context: 'Sample.Periodic',
        format: 'Raw',
        measurand: 'Energy.Active.Import.Register',
        unit: 'Wh',
      },
      {
        value: String(snap.powerW),
        context: 'Sample.Periodic',
        format: 'Raw',
        measurand: 'Power.Active.Import',
        unit: 'W',
      },
      {
        value: String(snap.currentA),
        context: 'Sample.Periodic',
        format: 'Raw',
        measurand: 'Current.Import',
        unit: 'A',
      },
      {
        value: String(snap.voltageV),
        context: 'Sample.Periodic',
        format: 'Raw',
        measurand: 'Voltage',
        unit: 'V',
      },
    ];
    if (includeSoc && snap.soc !== null) {
      values.push({
        value: String(snap.soc),
        context: 'Sample.Periodic',
        format: 'Raw',
        measurand: 'SoC',
        unit: 'Percent',
      });
    }
    return values;
  }
}
