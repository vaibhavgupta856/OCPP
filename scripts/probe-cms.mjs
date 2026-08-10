/**
 * Probe an OCPP CSMS WebSocket endpoint (handshake only).
 *
 * Usage:
 *   node scripts/probe-cms.mjs <baseUrl> [cpId]
 * Example:
 *   node scripts/probe-cms.mjs wss://csms.example.com/ocpp/1.6 LAB-CP-01
 */

import WebSocket from 'ws';

const baseArg = process.argv[2];
if (!baseArg) {
  console.error('Usage: node scripts/probe-cms.mjs <baseUrl> [cpId]');
  process.exit(1);
}

const base = baseArg.replace(/\/$/, '');
const cpId = process.argv[3] || `PROBE-${Date.now()}`;
const url = `${base}/${cpId}`;

async function tryConnect(withSubprotocol) {
  return new Promise((resolve) => {
    const started = Date.now();
    const ws = withSubprotocol
      ? new WebSocket(url, 'ocpp1.6', { handshakeTimeout: 10000 })
      : new WebSocket(url, { handshakeTimeout: 10000 });

    const done = (result) => {
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      resolve({ ...result, ms: Date.now() - started, withSubprotocol });
    };

    ws.on('open', () => {
      done({ ok: true, protocol: ws.protocol || '(none)' });
    });
    ws.on('unexpected-response', (_req, res) => {
      done({ ok: false, error: `HTTP ${res.statusCode}` });
    });
    ws.on('error', (err) => {
      done({ ok: false, error: err.message });
    });
  });
}

console.log('Probing', url);
const a = await tryConnect(true);
console.log('With ocpp1.6:', a);
const b = await tryConnect(false);
console.log('Without subprotocol:', b);

if (a.ok || b.ok) {
  console.log('CSMS REACHABLE — use the working subprotocol mode in Pier.');
  process.exit(0);
}
console.log('CSMS NOT REACHABLE from this network. Check URL, VPN, and firewall.');
process.exit(0);
