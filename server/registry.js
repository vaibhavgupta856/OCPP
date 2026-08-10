/**
 * Multi charge-point registry
 */

import { ChargePoint } from './ocpp/ChargePoint.js';

export class Registry {
  constructor({ io }) {
    this.io = io;
    this.chargers = new Map();
  }

  list() {
    return [...this.chargers.values()].map((cp) => cp.getPublicState());
  }

  get(cpId) {
    return this.chargers.get(cpId) || null;
  }

  async create(options) {
    if (this.chargers.has(options.cpId)) {
      throw new Error(`Charge point ${options.cpId} already exists`);
    }

    const cp = new ChargePoint(options, {
      onState: (state) => this.io.emit('cp:state', state),
      onMessage: (msg) => this.io.emit('cp:message', msg),
      onLog: (entry) => this.io.emit('cp:log', entry),
    });

    this.chargers.set(cp.cpId, cp);
    this.io.emit('cp:state', cp.getPublicState());

    // Connect in background
    cp.start().catch((err) => {
      cp.log('error', err.message);
    });

    return cp.getPublicState();
  }

  async remove(cpId) {
    const cp = this.chargers.get(cpId);
    if (!cp) return false;
    await cp.stop();
    this.chargers.delete(cpId);
    this.io.emit('cp:removed', { cpId });
    return true;
  }

  async removeAll() {
    const ids = [...this.chargers.keys()];
    for (const id of ids) {
      await this.remove(id);
    }
  }
}
