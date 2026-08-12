/**
 * EVSE OCPP 1.6 Console — HTTP + Socket.IO control plane
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { Registry } from './registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
});

const registry = new Registry({ io });

/* ---------- REST API ---------- */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'massive-mobility-charging-sim',
    chargers: registry.chargers.size,
    commit: (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '').slice(0, 7) || null,
  });
});

app.get('/api/chargers', (_req, res) => {
  res.json({ chargers: registry.list() });
});

app.post('/api/chargers', async (req, res) => {
  try {
    const {
      cpId,
      baseUrl,
      powerKw = 22,
      connectorCount = 1,
      connectorPowers,
      connectorNames,
      requireSubprotocol = true,
      authMode = 'local_or_csms',
      basicAuth,
      vendor,
      model,
      serial,
      firmware,
      connectorTypes,
      meterInterval,
      heartbeatInterval,
      initialSoc,
      batteryKwh,
      energyRatePerKwh,
      currency,
      currencySymbol,
    } = req.body || {};

    if (!cpId || !baseUrl) {
      return res.status(400).json({ error: 'cpId and baseUrl are required' });
    }

    const state = await registry.create({
      cpId: String(cpId).trim(),
      baseUrl: String(baseUrl).trim(),
      powerKw: Number(powerKw) || 22,
      connectorCount: Number(connectorCount) || 1,
      connectorPowers: Array.isArray(connectorPowers)
        ? connectorPowers.map((p) => Number(p) || Number(powerKw) || 22)
        : undefined,
      connectorNames: Array.isArray(connectorNames)
        ? connectorNames.map((n, i) => String(n || '').trim() || `Connector ${i + 1}`)
        : undefined,
      requireSubprotocol: !!requireSubprotocol,
      authMode: authMode || 'local_or_csms',
      basicAuth: basicAuth || null,
      vendor,
      model,
      serial,
      firmware,
      connectorTypes,
      meterInterval,
      heartbeatInterval,
      initialSoc,
      batteryKwh,
      energyRatePerKwh,
      currency,
      currencySymbol,
    });

    res.status(201).json({ charger: state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/chargers/:cpId', async (req, res) => {
  const ok = await registry.remove(req.params.cpId);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/chargers/:cpId', (req, res) => {
  const cp = registry.get(req.params.cpId);
  if (!cp) return res.status(404).json({ error: 'Not found' });
  res.json({ charger: cp.getPublicState() });
});

async function withCp(req, res, fn) {
  const cp = registry.get(req.params.cpId);
  if (!cp) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await fn(cp);
    res.json({ ok: true, result, charger: cp.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message, charger: cp.getPublicState() });
  }
}

app.post('/api/chargers/:cpId/plug', (req, res) =>
  withCp(req, res, (cp) => cp.plugCable(Number(req.body.connectorId), !!req.body.plugged))
);

app.post('/api/chargers/:cpId/start', (req, res) =>
  withCp(req, res, (cp) =>
    cp.localAuthorizeAndStart(Number(req.body.connectorId), String(req.body.idTag || 'CARD-7F2A91'))
  )
);

app.post('/api/chargers/:cpId/stop', (req, res) =>
  withCp(req, res, (cp) =>
    cp.localStop(Number(req.body.connectorId), req.body.reason || 'Local')
  )
);

app.post('/api/chargers/:cpId/emergency-stop', (req, res) =>
  withCp(req, res, (cp) => cp.emergencyStop(Number(req.body.connectorId)))
);

app.post('/api/chargers/:cpId/fault', (req, res) =>
  withCp(req, res, (cp) =>
    cp.injectFault(Number(req.body.connectorId), req.body.errorCode || 'OtherError', req.body.info || '')
  )
);

app.post('/api/chargers/:cpId/clear-fault', (req, res) =>
  withCp(req, res, (cp) => cp.clearFault(Number(req.body.connectorId)))
);

app.post('/api/chargers/:cpId/suspend', (req, res) =>
  withCp(req, res, (cp) => cp.setSuspended(Number(req.body.connectorId), req.body.who || null))
);

app.post('/api/chargers/:cpId/connector-type', (req, res) =>
  withCp(req, res, (cp) => {
    cp.setConnectorType(Number(req.body.connectorId), req.body.type);
  })
);

app.post('/api/chargers/:cpId/connector-name', (req, res) =>
  withCp(req, res, (cp) =>
    cp.setConnectorName(Number(req.body.connectorId), req.body.name, {
      reannounce: req.body.reannounce !== false,
    })
  )
);

app.post('/api/chargers/:cpId/power', (req, res) =>
  withCp(req, res, (cp) => {
    const connectorId = req.body.connectorId !== undefined ? Number(req.body.connectorId) : null;
    if (connectorId && connectorId > 0) {
      cp.updateConnectorPower(connectorId, Number(req.body.powerKw));
    } else {
      cp.updatePower(Number(req.body.powerKw));
    }
  })
);

app.post('/api/chargers/:cpId/tariff', (req, res) =>
  withCp(req, res, (cp) =>
    cp.setTariff({
      energyRatePerKwh: req.body.energyRatePerKwh,
      currency: req.body.currency,
      currencySymbol: req.body.currencySymbol,
    })
  )
);

app.post('/api/chargers/:cpId/soc', (req, res) =>
  withCp(req, res, (cp) => {
    cp.updateSocSettings(Number(req.body.connectorId), {
      soc: req.body.soc !== undefined ? Number(req.body.soc) : undefined,
      batteryKwh: req.body.batteryKwh !== undefined ? Number(req.body.batteryKwh) : undefined,
      energyKwh: req.body.energyKwh !== undefined ? Number(req.body.energyKwh) : undefined,
      fillMode: req.body.fillMode,
      fillEnergyKwh:
        req.body.fillEnergyKwh !== undefined ? Number(req.body.fillEnergyKwh) : undefined,
      fillMoney: req.body.fillMoney !== undefined ? Number(req.body.fillMoney) : undefined,
      fillMinutes: req.body.fillMinutes !== undefined ? Number(req.body.fillMinutes) : undefined,
    });
  })
);

app.post('/api/chargers/:cpId/local-tag', (req, res) =>
  withCp(req, res, (cp) => {
    cp.addLocalTag(String(req.body.idTag));
  })
);

app.post('/api/chargers/:cpId/auth-mode', (req, res) =>
  withCp(req, res, (cp) => {
    cp.setAuthMode(String(req.body.authMode || 'local_or_csms'));
  })
);

app.post('/api/chargers/:cpId/clear-auth-cache', (req, res) =>
  withCp(req, res, (cp) => {
    cp.clearAuthCache();
  })
);

app.post('/api/chargers/:cpId/reconnect', (req, res) =>
  withCp(req, res, async (cp) => {
    await cp.stop({ silent: true });
    cp.shouldRun = true;
    if (req.body.requireSubprotocol !== undefined) {
      cp.setRequireSubprotocol(!!req.body.requireSubprotocol);
    }
    if (req.body.authMode) {
      cp.setAuthMode(String(req.body.authMode));
    }
    await cp.connect();
  })
);

app.post('/api/chargers/:cpId/reset', (req, res) =>
  withCp(req, res, (cp) => cp.performReset(req.body.type === 'Hard' ? 'Hard' : 'Soft'))
);

/* ---------- Socket.IO ---------- */

io.on('connection', (socket) => {
  socket.emit('cp:snapshot', { chargers: registry.list() });
});

/* ---------- static client (production) ---------- */

if (isProd) {
  const dist = path.join(ROOT, 'client', 'dist');
  // Hashed Vite assets can be cached; HTML must always revalidate so deploys show up
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (/\.[a-f0-9]{8,}\.(js|css|woff2?)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // SPA fallback — API + Socket.IO routes are registered above and take precedence
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Massive Mobility Charging Simulator on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'dev'})`);
  if (!isProd) {
    console.log('Vite client: run `npm run client` (proxies API to this port)');
  }
});
