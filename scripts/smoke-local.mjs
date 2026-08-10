/**
 * Local smoke test: mock CSMS + ChargePoint BootNotification / Heartbeat / Status
 * Run: node scripts/smoke-local.mjs
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { ChargePoint } from '../server/ocpp/ChargePoint.js';
import { parseMessage, createCallResult, MessageType, stringifyFrame } from '../server/ocpp/protocol.js';

const PORT = 19090;
const CP_ID = 'SMOKE-CP-001';

function startMockCsms() {
  const server = http.createServer();
  const wss = new WebSocketServer({
    server,
    handleProtocols: (protocols) => {
      if ([...protocols].includes('ocpp1.6')) return 'ocpp1.6';
      return false;
    },
  });

  const received = [];

  wss.on('connection', (ws, req) => {
    console.log('CSMS: connection', req.url, 'protocol=', ws.protocol);
    ws.on('message', (data) => {
      const msg = parseMessage(data.toString());
      received.push(msg);
      console.log('CSMS ←', msg.action || msg.type, JSON.stringify(msg.payload || {}).slice(0, 120));

      if (msg.type === MessageType.CALL) {
        let payload = {};
        if (msg.action === 'BootNotification') {
          payload = { status: 'Accepted', currentTime: new Date().toISOString(), interval: 30 };
        } else if (msg.action === 'Heartbeat') {
          payload = { currentTime: new Date().toISOString() };
        } else if (msg.action === 'StatusNotification') {
          payload = {};
        } else if (msg.action === 'Authorize') {
          payload = { idTagInfo: { status: 'Accepted' } };
        } else if (msg.action === 'StartTransaction') {
          payload = { transactionId: 4242, idTagInfo: { status: 'Accepted' } };
        } else if (msg.action === 'StopTransaction') {
          payload = { idTagInfo: { status: 'Accepted' } };
        } else if (msg.action === 'MeterValues') {
          payload = {};
        }
        ws.send(stringifyFrame(createCallResult(msg.messageId, payload)));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve({ server, wss, received }));
  });
}

async function main() {
  const mock = await startMockCsms();
  const events = [];

  const cp = new ChargePoint(
    {
      cpId: CP_ID,
      baseUrl: `ws://127.0.0.1:${PORT}`,
      powerKw: 22,
      connectorCount: 2,
      requireSubprotocol: true,
      meterInterval: 2,
      heartbeatInterval: 30,
    },
    {
      onState: (s) => events.push(['state', s.connectionState, s.bootAccepted]),
      onMessage: (m) => {
        if (m.kind === 'ocpp') events.push(['ocpp', m.direction, m.action]);
      },
      onLog: (l) => console.log('LOG', l.level, l.text),
    }
  );

  await cp.start();
  await new Promise((r) => setTimeout(r, 800));

  if (cp.connectionState !== 'online' || !cp.bootAccepted) {
    throw new Error(`Expected online+boot, got ${cp.connectionState} boot=${cp.bootAccepted}`);
  }

  await cp.plugCable(1, true);
  await cp.localAuthorizeAndStart(1, 'CARD-7F2A91');
  await new Promise((r) => setTimeout(r, 500));
  await cp.localStop(1, 'Local');
  await new Promise((r) => setTimeout(r, 300));

  const actions = mock.received.filter((m) => m.type === MessageType.CALL).map((m) => m.action);
  console.log('Received actions:', actions.join(', '));

  for (const need of ['BootNotification', 'StatusNotification', 'Authorize', 'StartTransaction', 'StopTransaction']) {
    if (!actions.includes(need)) throw new Error(`Missing ${need}`);
  }

  await cp.stop();
  mock.wss.close();
  mock.server.close();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
