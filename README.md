# Massive Mobility Charging Simulator — OCPP 1.6

Charge Point (EVSE) simulator that speaks OCPP 1.6 JSON over WebSocket to your CSMS (e.g. Massive Charging).

Default BootNotification identity: **Massive Mobility** / **Massive-CP-Sim-16** / firmware **Massive-CPS-16.3.2.1**.

## Features

- Boot, Heartbeat, StatusNotification, Authorize, Start/StopTransaction, MeterValues
- Remote start/stop, Reset, Unlock, ChangeAvailability, Get/ChangeConfiguration, TriggerMessage, ClearCache, LocalList, DataTransfer, ReserveNow/CancelReservation
- Interactive Massive cabinet UI (touch screen, soft-keys, RFID pad, multi-outlet)
- Multi-connector (1–4) with per-outlet power (kW)
- Auth modes: Local or CMS, Local only, CMS only

## Quick start

```powershell
.\start.ps1
```

Or:

```powershell
npm run install:all
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:8787  

## Connect to CSMS

1. Paste your CSMS WebSocket **base** URL (simulator appends `/{chargePointId}`).
2. Choose a charge point id and connector count.
3. Commission / connect.
4. For local demo tags (`CARD-7F2A91`, …) keep Auth mode **Local or CMS**. For production-like tests use a CSMS-registered idTag and **CMS only**.

## Live website (Render)

One-click deploy (free Web Service):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vaibhavgupta856/OCPP)

Or in the [Render Dashboard](https://dashboard.render.com/): **New → Blueprint** → select `vaibhavgupta856/OCPP` (uses `render.yaml`).

After deploy, open `https://<service>.onrender.com`. Free instances sleep when idle (first load can take ~1 min).

## Docs

- `docs/User-Guide.md` / `.docx` — **start here** — how new users run sessions and use each UI panel
- `docs/OCPP-1.6-Guide.md` — short OCPP 1.6 overview
- `docs/Massive-Mobility-Simulator-Guide.md` / `.docx` — how the simulator works and how parts connect
- `docs/Tech-Stack-Flow-Guide.md` / `.docx` — every technology in flow order and how they depend on each other

## Layout

```
  server/     Node Express + Socket.IO + OCPP WebSocket client
  client/     Vite + React console
  docs/       Guides
```

## Architecture

```
Browser (UI) --REST/Socket.IO--> Simulator backend --OCPP WebSocket--> CMS
```

The browser never opens the OCPP socket; only the Node process does.
