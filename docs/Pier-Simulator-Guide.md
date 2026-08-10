# Pier OCPP 1.6 Simulator — How It Works

Short guide to the Pier Charge Point lab: what it is, how parts connect, and how a session runs.

---

## 1. What Pier is

Pier is an **OCPP 1.6 Charge Point (EVSE) simulator**.

- It acts like a real charger talking to a CMS (for example Massive Charging).
- It is **not** a CMS / Central System.
- The browser UI is only a local control panel for the simulated charger.

Brand in the lab: **Quillgrid Systems / Pier-16H**.

Project folder:

`C:\Users\massi\Downloads\OCPP_Simulator\evse-ocpp16-console`

---

## 2. Main pieces (stack)

| Part | Role | Tech |
|------|------|------|
| **Client** (`client/`) | Operator UI + 3D charge point | Vite, React, Three.js / React Three Fiber |
| **Server** (`server/`) | Simulator brain + OCPP client | Node.js, Express, Socket.IO, `ws` |
| **CMS** (external) | Real Central System | e.g. Massive `wss://…` |

---

## 3. How to run

1. Open the project folder.
2. Run `.\start.ps1` (or `npm run install:all` then `npm run dev`).
3. Open the UI: **http://localhost:5173**
4. API runs on: **http://localhost:8787**

Vite proxies `/api` and `/socket.io` from the UI to the backend.

---

## 4. How everything is connected

```
┌──────────────────────────┐
│  Browser (UI :5173)      │
│  3D CP + operator panel  │
└────────────┬─────────────┘
             │
             │  REST  /api/...
             │  Socket.IO  (live state, logs, OCPP trace)
             ▼
┌──────────────────────────┐
│  Pier backend (:8787)    │
│  ChargePoint simulator   │
└────────────┬─────────────┘
             │
             │  OCPP 1.6 WebSocket
             │  URL = {CSMS base}/{cpId}
             │  (optional subprotocol ocpp1.6, Basic Auth)
             ▼
┌──────────────────────────┐
│  CMS / CSMS              │
│  e.g. Massive Charging   │
└──────────────────────────┘
```

Important:

- The **browser never speaks OCPP**.
- Only the **Pier Node server** opens the OCPP WebSocket to the CMS.
- UI commands go Pier API → Pier translates them into OCPP messages.

---

## 5. What travels on each connection

### A. Browser ↔ Pier (local)

| Channel | Used for |
|---------|----------|
| **REST `/api/...`** | Create station, plug, start/stop, fault, power, auth mode, reconnect, reset |
| **Socket.IO** | Live charger state, meter values, OCPP message trace, logs |

### B. Pier ↔ CMS (real protocol)

| Channel | Used for |
|---------|----------|
| **OCPP WebSocket** | BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, MeterValues, StopTransaction, RemoteStart/Stop, Reset, Config, etc. |

OCPP messages are JSON arrays:

- `[2, messageId, Action, payload]` = CALL (request)
- `[3, messageId, payload]` = CALLRESULT (success)
- `[4, messageId, errorCode, description, details]` = CALLERROR

---

## 6. Commissioning a station

In the left **Stations** panel:

1. Enter **Charge Point ID** (must match the CMS device / path id).
2. Enter **CSMS WebSocket base** (without trailing slash), e.g. `wss://stageocpp.example.com/ocpp`.
3. Set connector count and per-outlet kW (and optional names).
4. Click **Connect EVSE**.

Pier connects to:

`{baseUrl}/{cpId}`

Example:

`wss://stageocpp.example.com/ocpp/NDOFCACP0001`

---

## 7. What happens after connect

1. WebSocket opens to CMS.
2. Pier sends **BootNotification** (vendor, model, serial, firmware).
3. CMS replies Accepted / Pending / Rejected + heartbeat interval.
4. Pier sends **StatusNotification** for connector `0` (whole CP) and each gun `1…N`.
5. Pier may announce connector info (name/type/power) via StatusNotification `info` and a DataTransfer.
6. **Heartbeat** starts on the CMS interval.

After that the station shows **online**.

---

## 8. How a charging session works

### Local start (from Pier UI / 3D screen)

1. Select connector (C1, C2, …).
2. Plug cable (or Pier auto-plugs on start).
3. **Authorize** idTag (local list and/or CMS, depending on auth mode).
4. **StartTransaction** → CMS returns `transactionId`.
5. Status → **Charging**; **MeterValues** sent periodically.
6. **Stop** → StopTransaction → brief Finishing → **Available**.

### Remote start (from CMS / app)

1. CMS sends **RemoteStartTransaction**.
2. Pier accepts and runs the same Authorize / StartTransaction path.
3. CMS can later send **RemoteStopTransaction**.

---

## 9. Multi-connector notes

- Pier supports **1–4** outlets plus connector **0** (charge point).
- Each outlet has its own status, meter, and transaction.
- Many CMS platforms (including Massive) **block the same RFID** on two concurrent sessions (`Blocked` / `ConcurrentTx`).
- For parallel charging, use a **different CMS-registered idTag** per connector.
- Pier will try alternate lab tags when the current one is already in use.

Default lab tags:

- `CARD-7F2A91`
- `FOB-ORBIT-44`
- `TOKEN-QUILL-09`

Auth modes:

- **Local or CMS** (default) — accept if either allows
- **Local only** — local list only
- **CMS only** — CMS Authorize must accept

---

## 10. UI layout — how controls connect

| UI area | What it does | Reaches CMS? |
|---------|--------------|--------------|
| **3D charge point** | Touch screen + physical soft keys, outlets, RFID | Yes, via Pier API → OCPP |
| **Operator panel (2D)** | Easy start/stop/plug/E-stop, idTag, kW | Yes, same path |
| **Stations dock** | Commission / select / remove CP | Creates OCPP connection |
| **Bench controls** | Fault, suspend, auth mode, reconnect, reset | Mixed (local sim + OCPP) |
| **Message / log panes** | Show OCPP frames and logs | Display only |

Flow for a button press:

`UI click → REST API → ChargePoint method → OCPP CALL → CMS → CALLRESULT → Socket.IO state update → UI refresh`

---

## 11. Important API endpoints (short)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Backend health |
| `POST /api/chargers` | Create / connect station |
| `DELETE /api/chargers/:cpId` | Remove station |
| `POST .../plug` | Plug / unplug cable |
| `POST .../start` | Local authorize + start |
| `POST .../stop` | Stop transaction |
| `POST .../emergency-stop` | E-stop |
| `POST .../fault` / `clear-fault` | Inject / clear fault |
| `POST .../power` | Set outlet kW |
| `POST .../auth-mode` | Switch auth mode |
| `POST .../reconnect` | Reopen OCPP socket |
| `POST .../reset` | Soft / Hard reset |

---

## 12. What is local-only (not OCPP)

These stay inside Pier / browser:

- 3D graphics and layout
- Socket.IO live feed to the UI
- Local RFID allow-list editing
- Meter / SoC simulation knobs
- Choosing which station is selected in the UI

The CMS only sees the **OCPP WebSocket messages**.

---

## 13. Quick troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| UI up, station offline | Wrong base URL / cpId, CMS down, TLS/auth issue |
| `Authorize Invalid` | Tag not accepted by CMS; try Local or CMS mode, or a real RFID |
| `StartTransaction idTag Blocked` | Same RFID already charging on another outlet |
| Stuck on Finishing in CMS | Older builds; current Pier sends Available after stop — reconnect station |
| Boot / ChangeConfiguration show `connectorId: null` | Normal — those are charge-point level messages |
| Need per-outlet status | Look for StatusNotification with connectorId 1, 2, … |

---

## 14. One-line summary

**Browser controls Pier; Pier speaks OCPP to the CMS.**  
WebSocket for OCPP is only Backend ↔ CMS. REST + Socket.IO are only Browser ↔ Backend.

---

*Pier OCPP 1.6 Charge Point lab — connection and operation overview.*
