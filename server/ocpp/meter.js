/**
 * Energy / power / SoC metering simulation for a single connector
 */

export class MeterSimulator {
  constructor({ maxPowerKw = 22, batteryKwh = 60, initialSoc = 20 } = {}) {
    this.maxPowerKw = maxPowerKw;
    this.batteryKwh = batteryKwh;
    this.soc = initialSoc;
    this.meterWh = 0;
    this.powerW = 0;
    this.currentA = 0;
    this.voltageV = maxPowerKw >= 50 ? 400 : 230;
    this.running = false;
    this._lastTick = null;
    this.socEnabled = maxPowerKw >= 40;
  }

  resetSession({ keepMeter = false } = {}) {
    if (!keepMeter) this.meterWh = 0;
    this.powerW = 0;
    this.currentA = 0;
    this.running = false;
    this._lastTick = null;
  }

  start() {
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
    this.socEnabled = kw >= 40;
  }

  setSoc(soc) {
    this.soc = Math.max(0, Math.min(100, soc));
  }

  setBatteryKwh(kwh) {
    this.batteryKwh = Math.max(1, kwh);
  }

  tick() {
    if (!this.running) {
      return this.snapshot();
    }
    const now = Date.now();
    const elapsedMs = this._lastTick ? now - this._lastTick : 0;
    this._lastTick = now;

    // Gentle power wobble
    const target = this.maxPowerKw * 1000 * (0.82 + Math.random() * 0.16);
    this._applyPower(this.powerW * 0.7 + target * 0.3);

    const hours = elapsedMs / 3_600_000;
    const deltaWh = this.powerW * hours;
    this.meterWh += deltaWh;

    if (this.socEnabled && this.batteryKwh > 0) {
      const deltaKwh = deltaWh / 1000;
      this.soc = Math.min(100, this.soc + (deltaKwh / this.batteryKwh) * 100);
      if (this.soc >= 99.5) {
        this.soc = 100;
        this.pause();
      }
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
    return {
      meterWh: Math.round(this.meterWh),
      powerW: Math.round(this.powerW),
      currentA: Math.round(this.currentA * 10) / 10,
      voltageV: Math.round(this.voltageV),
      soc: this.socEnabled ? Math.round(this.soc * 10) / 10 : null,
    };
  }

  sampledValues({ includeSoc = true } = {}) {
    const snap = this.snapshot();
    const values = [
      {
        value: String(snap.meterWh),
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
