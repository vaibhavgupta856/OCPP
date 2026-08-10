# Pier — OCPP 1.6 Charge Point Lab

Browser console for a **Charge Point / EVSE** that speaks OCPP 1.6 JSON over WebSocket to any CSMS. Built as a standalone Node + React project (not derived from other simulator trees in this download folder).

## What it does

- Full Core Charge Point client: Boot, Heartbeat, Status, Authorize, Start/Stop, MeterValues
- RemoteStart/Stop, Reset, Unlock, ChangeAvailability, Config, TriggerMessage, LocalList, DataTransfer, Reserve
- Per-outlet state machine and metering
- Interactive Pier cabinet UI (outlets, LCD soft-keys, RFID pad, car plug scene)
- Auth modes: CSMS-only, local list, or local-or-CSMS
- Optional `ocpp1.6` subprotocol + Basic Auth

## Run

```powershell
cd evse-ocpp16-console
.\start.ps1
```

Or:

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm run install:all
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:8787  

## Connect to a CSMS

1. Paste your CSMS WebSocket **base** URL (Pier appends `/{chargePointId}`).
2. Enter a charge point ID that exists on that CSMS.
3. Prefer **Require ocpp1.6 subprotocol**; if handshake fails, reconnect without it from Bench controls.
4. For local demo tags (`CARD-7F2A91`, …) keep Auth mode **Local or CMS**. For production-like tests use a CSMS-registered idTag and **CMS only**.

```bash
npm run smoke
node scripts/probe-cms.mjs wss://your-csms.example/ocpp/1.6 YOUR-CP-ID
```

## 3D yard

The center stage includes an interactive Three.js scene (`client/src/components/scene3d/`):
- Procedural **Pier** pedestal charger with selectable outlets
- Procedural **EV** hatch with charge port
- Cable that connects when plugged

Drag to orbit. Click the car to plug/unplug; click an outlet to select (double-click to plug).

## Layout

```
evse-ocpp16-console/
  server/     Express + Socket.IO + OCPP Charge Point
  client/     Vite + React Pier console
  scripts/    Local smoke + CSMS probe
```
