# Massive Mobility Charging Simulator — Technologies in Flow Order

This document explains **every major technology** used in the Massive Mobility Charging Simulator, **one by one in runtime flow order**: what it does, and how it depends on the others.

Project folder: `evse-ocpp16-console`

---

## 0. Big picture (end-to-end flow)

```
Operator
   │
   ▼
Browser (React UI + 3D scene)
   │  REST (/api/...) + Socket.IO
   │  (dev: via Vite proxy)
   ▼
Node backend (Express + Socket.IO + ChargePoint engine)
   │  OCPP 1.6 JSON over WebSocket (ws)
   ▼
CMS / CSMS (e.g. Massive Charging)
```

**Rule of the architecture**

- The **browser never speaks OCPP**.
- Only the **Node backend** opens the OCPP WebSocket to the CMS.
- The browser only controls and observes the simulator through **REST** and **Socket.IO**.

---

## 1. Node.js

**What it is:** JavaScript runtime outside the browser.

**What it does here:** Runs the Charge Point simulator backend (`server/index.js`), installs packages, and launches scripts.

**Depends on:** Operating system (Windows in your setup).

**Used by:** npm, Express, Socket.IO server, `ws`, all server-side OCPP logic.

Without Node.js, the simulator backend cannot run.

---

## 2. npm (Node Package Manager)

**What it is:** Tool to install and manage JavaScript libraries.

**What it does here:**

- Installs backend packages (`express`, `ws`, `socket.io`, …)
- Installs frontend packages (`react`, `three`, `vite`, …)
- Runs scripts such as `npm run dev`, `npm run server`, `npm run client`

**Depends on:** Node.js

**Used by:** The whole project (root `package.json` + `client/package.json`)

---

## 3. concurrently

**What it is:** A small npm utility that runs multiple commands in one terminal.

**What it does here:** `npm run dev` starts **both**:

1. Backend server (`node server/index.js`)
2. Frontend Vite app (`npm run client`)

**Depends on:** npm / Node.js

**Why it matters:** One command brings up the full local stack (UI + API).

---

## 4. PowerShell / batch launchers (`start.ps1`, `start.bat`)

**What they are:** Simple OS scripts.

**What they do here:** Put Node on PATH if needed, install dependencies when missing, then run `npm run dev`.

**Depends on:** Windows shell + npm

**Interdependence:** Convenience wrappers around npm; not part of OCPP itself.

---

## 5. Vite

**What it is:** Modern frontend build tool and local development server.

**What it does here:**

- Serves the React app at `http://localhost:5173`
- Hot-reloads UI changes
- Bundles the app for production (`vite build`)
- **Proxies** `/api` and `/socket.io` to the backend on port `8787`

**Depends on:** Node.js, npm

**Used by:** React app during development

**Interdependence with backend:**  
Browser calls `/api/...` on port 5173 → Vite forwards to Express on 8787. Same for Socket.IO WebSocket upgrade.

---

## 6. `@vitejs/plugin-react`

**What it is:** Vite plugin for React.

**What it does here:** Enables JSX transform and React Fast Refresh so `.jsx` components reload quickly.

**Depends on:** Vite, React

---

## 7. React + React DOM

**What they are:** UI library (React) and browser renderer (React DOM).

**What they do here:** Build the operator console:

- Station commission form
- Status chips / buttons
- Message/log panes
- Embed the 3D yard

**Depends on:** Browser + Vite toolchain

**Talks to backend via:**

- `fetch` / REST → Express routes
- `socket.io-client` → live state / OCPP trace / logs

React does **not** open the OCPP socket.

---

## 8. CSS (custom styles)

**What it is:** Styling for the console (`global.css`, `console.css`).

**What it does here:** Massive Mobility theme (maroon / rose / light panels), layout rails, buttons, pills.

**Depends on:** Browser + React class names

**Interdependence:** Pure presentation; no protocol role.

---

## 9. Three.js

**What it is:** WebGL 3D graphics library.

**What it does here:** Draws the charge point cabinet, screen, outlets, RFID pad in the browser.

**Depends on:** Browser WebGL

**Used through:** React Three Fiber (not usually called raw in app code).

---

## 10. React Three Fiber (`@react-three/fiber`)

**What it is:** React renderer for Three.js.

**What it does here:** Lets the 3D scene be written as React components (`EvYard3D`, `MassiveChargerMesh`, `ChargerLcdScreen`).

**Depends on:** React + Three.js

**Interdependence:** 3D clicks (Start / Stop / Plug / RFID) call the same React handlers that hit the REST API — so the 3D HMI is just another UI front for the backend Charge Point.

---

## 11. Drei (`@react-three/drei`)

**What it is:** Helper library for React Three Fiber.

**What it does here:** Provides helpers such as `OrbitControls` (rotate / zoom the station view).

**Depends on:** React Three Fiber + Three.js

---

## 12. Canvas 2D API (browser built-in)

**What it is:** Built-in browser drawing API (no npm package).

**What it does here:**

- Draws the LCD touch-screen texture (`ChargerLcdScreen`)
- Draws baked labels on soft-keys / RFID pad (`CanvasLabel`, key textures)

**Depends on:** Browser

**Interdependence:** Canvas output becomes a Three.js texture on the 3D mesh.

---

## 13. Fetch / HTTP REST (browser built-in)

**What it is:** Standard browser HTTP client.

**What it does here:** Sends operator commands, for example:

- `POST /api/chargers` — create / connect station
- `POST /api/chargers/:cpId/start` — local start
- `POST /api/chargers/:cpId/stop` — stop
- `POST /api/chargers/:cpId/plug` — plug/unplug
- power / fault / auth-mode / reset / reconnect, etc.

**Depends on:** Vite proxy (dev) → Express

**Interdependence:** REST is the **command channel**. Socket.IO is the **live feedback channel**.

---

## 14. Socket.IO client (`socket.io-client`)

**What it is:** Real-time client library (WebSocket-based, with fallbacks).

**What it does here:** Receives live updates from the backend:

- charger state (`cp:state`)
- OCPP message trace (`cp:message`)
- logs (`cp:log`)

**Depends on:** Browser + Socket.IO server on the backend

**Why not use OCPP here?**  
Socket.IO is only for the **lab UI**. OCPP remains a separate socket from backend → CMS.

---

## 15. Express

**What it is:** Node.js HTTP framework.

**What it does here:** Hosts the simulator control API on port **8787**:

- Health check
- Charger create / list / delete
- Per-charger actions (plug, start, stop, power, fault, …)
- In production mode, can also serve the built React `dist` files

**Depends on:** Node.js, `http` module

**Used by:** Browser (through Vite proxy in development)

---

## 16. CORS (`cors`)

**What it is:** Express middleware for Cross-Origin Resource Sharing.

**What it does here:** Allows the UI origin to call the API during development.

**Depends on:** Express

---

## 17. Node `http` module

**What it is:** Built-in Node HTTP server.

**What it does here:** Creates the server that Express and Socket.IO share (`http.createServer(app)`).

**Depends on:** Node.js

**Interdependence:** One TCP port (8787) carries both REST and Socket.IO.

---

## 18. Socket.IO server (`socket.io`)

**What it is:** Real-time server paired with the Socket.IO client.

**What it does here:** Pushes live Charge Point events to all connected browser sessions.

**Depends on:** Node `http` server + Express app lifecycle

**Interdependence with OCPP:**  
When `ChargePoint` sends/receives OCPP frames, it emits UI events → Socket.IO → browser message trace. The CMS never sees Socket.IO.

---

## 19. Registry (`server/registry.js`)

**What it is:** In-project module (plain JavaScript), not an npm package.

**What it does here:** Keeps a map of active simulated chargers (`cpId` → `ChargePoint` instance), and wires each one to Socket.IO broadcasts.

**Depends on:** ChargePoint class + Socket.IO

**Interdependence:** Express routes call Registry; Registry owns ChargePoint objects.

---

## 20. ChargePoint engine (`server/ocpp/ChargePoint.js`)

**What it is:** Core simulator class for one OCPP Charge Point.

**What it does here:**

- Opens/closes the OCPP WebSocket to the CMS
- Sends BootNotification, Heartbeat, StatusNotification, Authorize, Start/StopTransaction, MeterValues, FirmwareStatusNotification, …
- Handles inbound CMS commands (RemoteStart/Stop, Reset, Config, TriggerMessage, UpdateFirmware, …)
- Simulates connectors, meters, local auth list, firmware identity

**Depends on:**

- `ws` (WebSocket client)
- `protocol.js` (frame encode/decode)
- `handlers` (inbound actions)
- `fsm.js` (connector status transitions)
- `meter.js` (energy/power simulation)
- `configStore.js` (OCPP configuration keys)
- `uuid` (message ids)

**This is the software “charger.”**

---

## 21. `ws` (WebSocket client library)

**What it is:** Node WebSocket implementation.

**What it does here:** Charge Point connects as **client** to CMS:

`wss://{cms-host}/.../{chargePointId}`

Optionally negotiates subprotocol `ocpp1.6` and Basic Auth.

**Depends on:** Node.js networking / TLS

**Interdependence:** This is the **only** transport carrying OCPP JSON to the CMS.

---

## 22. OCPP 1.6 JSON (protocol — not an npm package)

**What it is:** Open Charge Point Protocol, JSON over WebSocket (OCPP-J).

**What it does here:** Defines the message language between charger and CMS:

- Frame types: CALL `2`, CALLRESULT `3`, CALLERROR `4`
- Actions: BootNotification, StartTransaction, MeterValues, RemoteStartTransaction, …

**Depends on:** WebSocket transport (`ws`)

**Interdependence:** All CMS visibility (online status, sessions, energy) comes from these messages — not from React or Socket.IO.

---

## 23. Protocol helper (`server/ocpp/protocol.js`)

**What it is:** Local module.

**What it does here:** Parses/serializes OCPP frames and creates CALL / CALLRESULT / CALLERROR structures.

**Depends on:** JSON + `uuid` for message ids

---

## 24. `uuid`

**What it is:** Library to generate unique IDs.

**What it does here:** Creates OCPP `messageId` values so requests and responses can be matched.

**Depends on:** Node.js

**Used by:** OCPP protocol helpers / ChargePoint outbound calls

---

## 25. Handlers (`server/ocpp/handlers/index.js`)

**What it is:** Local module.

**What it does here:** Implements CMS → CP actions:

RemoteStart/Stop, Reset, Unlock, ChangeAvailability, Get/ChangeConfiguration, TriggerMessage, LocalList, DataTransfer, ReserveNow/Cancel, UpdateFirmware, …

**Depends on:** ChargePoint methods + FSM

**Interdependence:** When a CMS CALL arrives on `ws`, ChargePoint dispatches to the matching handler, then replies with CALLRESULT.

---

## 26. FSM (`server/ocpp/fsm.js`)

**What it is:** Finite state helper for connector statuses.

**What it does here:** Controls legal transitions such as:

`Available` → `Preparing` → `Charging` → `Finishing` → `Available`  
(plus Faulted / Unavailable / Reserved / Suspended*)

**Depends on:** OCPP status model

**Interdependence:** Status changes trigger `StatusNotification` messages to the CMS and UI state updates.

---

## 27. Meter simulator (`server/ocpp/meter.js`)

**What it is:** Local energy/power simulation module.

**What it does here:** Advances Wh / W / SoC while a transaction is active, feeding **MeterValues**.

**Depends on:** ChargePoint transaction loop + configured sample interval

**Interdependence:** CMS live power/energy views rely on these OCPP MeterValues, which are derived from this simulator (not from React).

---

## 28. Config store (`server/ocpp/configStore.js`)

**What it is:** Local key/value store for OCPP configuration.

**What it does here:** Implements GetConfiguration / ChangeConfiguration keys such as:

- `HeartbeatInterval`
- `MeterValueSampleInterval`
- `NumberOfConnectors`
- `SupportedFeatureProfiles`
- auth-related keys, etc.

**Depends on:** OCPP Core configuration model

**Interdependence:** CMS can change charger behaviour by writing keys; ChargePoint reads them during runtime.

---

## 29. External CMS / CSMS (Massive Charging)

**What it is:** Real Central System (outside this repo).

**What it does:** WebSocket **server** for OCPP; authorizes tags; assigns `transactionId`; shows station status/sessions in its console.

**Depends on:** Reachable `wss://` endpoint + matching charge point id

**Interdependence:** Without CMS, the simulator can still run UI/backend locally, but there is no real OCPP session partner. With CMS, this project behaves like a real Charge Point.

---

## 30. Optional tooling scripts

| Script | Tech used | Purpose |
|--------|-----------|---------|
| `scripts/smoke-local.mjs` | Node, `ws`, ChargePoint | Local mock CMS smoke test |
| `scripts/probe-cms.mjs` | Node, `ws` | Probe whether a CMS WebSocket accepts connections |
| `scripts/build_ocpp_guide_docx.py` | Python + `python-docx` | Build Word docs from Markdown |

These are helper tools, not part of the live charging path.

---

## Interdependence map (who needs whom)

```
npm / Node.js
 ├── concurrently
 │    ├── Vite (+ plugin-react) ──► React UI
 │    │                              ├── CSS theme
 │    │                              ├── Three.js ◄── R3F ◄── Drei
 │    │                              ├── Canvas 2D textures
 │    │                              ├── fetch/REST ──────────────┐
 │    │                              └── socket.io-client ────────┤
 │    └─ Express + cors + http + socket.io server ◄───────────────┘
 │         └── Registry
 │              └── ChargePoint
 │                   ├── protocol.js + uuid
 │                   ├── handlers
 │                   ├── fsm.js
 │                   ├── meter.js
 │                   ├── configStore.js
 │                   └── ws ── OCPP 1.6 JSON ──► CMS (Massive)
```

---

## One charge-session example (tech hand-off)

1. **React** button / 3D START clicked  
2. **fetch** → **Vite proxy** → **Express** route  
3. **Registry** finds **ChargePoint**  
4. ChargePoint may **Authorize** / **StartTransaction** over **`ws`** using **OCPP JSON**  
5. **CMS** returns `transactionId`  
6. **meter.js** runs; ChargePoint sends **MeterValues** on **`ws`**  
7. ChargePoint emits state/trace → **Socket.IO server** → **socket.io-client** → **React** UI updates  
8. CMS dashboard updates from OCPP only

---

## Ports and channels (quick reference)

| Channel | Port / path | Technologies | Carries |
|---------|-------------|--------------|---------|
| UI | `http://localhost:5173` | Vite, React, Three.js | Operator screens |
| API + live UI events | `http://localhost:8787` | Express, Socket.IO | Commands + live state |
| OCPP | CMS `wss://…/{cpId}` | `ws` + OCPP 1.6 JSON | Real charger protocol |

---

## Summary

| Layer | Technologies | Job |
|-------|--------------|-----|
| Run / install | Node.js, npm, concurrently, start scripts | Boot the lab |
| Operator UI | Vite, React, CSS, Three.js, R3F, Drei, Canvas | Control & visualize the charger |
| UI ↔ backend | REST fetch, Socket.IO, Vite proxy, Express, cors | Commands + live feedback |
| Simulated charger | Registry, ChargePoint, FSM, meter, config, handlers, uuid, protocol | Behave like an EVSE |
| Charger ↔ CMS | `ws` + OCPP 1.6 | Real protocol path |

**Flow in one sentence:**  
React/Three.js UI commands Express over REST; Express drives the ChargePoint engine; ChargePoint speaks OCPP over `ws` to the CMS; Socket.IO mirrors state back to the UI.

---

*Massive Mobility Charging Simulator — technology stack and interdependence guide.*
