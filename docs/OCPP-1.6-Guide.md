# OCPP 1.6 — Practical Guide

A clearer, more detailed overview of **OCPP 1.6 JSON (OCPP-J)** for EV charge points and CMS backends. Written for use with the **Massive Mobility Charging Simulator**.

For exact field schemas and enums, always check the official Open Charge Alliance **OCPP 1.6** specification. This guide focuses on how the protocol works in practice.

---

## 1. What is OCPP 1.6?

**OCPP** (Open Charge Point Protocol) lets an **EV charger** and a **Central System** exchange charging events in a standard way.

| Role | Also called | Responsibility |
|------|-------------|----------------|
| **Charge Point (CP)** | EVSE, charger, station | Physical charger; connects out to CMS; reports status, starts/stops sessions, sends meter values |
| **Central System (CSMS / CMS)** | Backend, CPO platform | Accepts charger connections; authorizes tags; assigns `transactionId`; can remote-start/stop, configure, reset |

### Important facts

- OCPP is a **message protocol**, not a programming language or framework.
- In **OCPP 1.6 JSON**, transport is **WebSocket**.
- The **Charge Point is the WebSocket client**. The **CMS is the WebSocket server**.
- The charger usually connects to something like:  
  `wss://cms.example.com/ocpp/{chargePointId}`
- There is also an older **SOAP / HTTP** variant of 1.6; modern CMS platforms (including Massive Charging stage) typically use **JSON over WebSocket**.

### Feature profiles (1.6)

OCPP 1.6 groups optional capability into profiles. Common ones:

| Profile | Typical use |
|---------|-------------|
| **Core** | Boot, Heartbeat, Status, Authorize, Start/Stop, MeterValues, RemoteStart/Stop, Reset, Config, TriggerMessage, Unlock, ChangeAvailability |
| **FirmwareManagement** | UpdateFirmware, FirmwareStatusNotification |
| **LocalAuthListManagement** | SendLocalList, GetLocalListVersion, ClearCache |
| **Reservation** | ReserveNow, CancelReservation |
| **SmartCharging** | SetChargingProfile, ClearChargingProfile, GetCompositeSchedule |
| **RemoteTrigger** | TriggerMessage (often listed with Core in practice) |

A charger advertises support via configuration key `SupportedFeatureProfiles`.

---

## 2. Connection model

```
┌────────────────────┐         WebSocket (OCPP-J)         ┌────────────────────┐
│  Charge Point      │  ────────────────────────────────► │  CMS / CSMS        │
│  (client)          │     wss://…/ocpp/{cpId}            │  (server)          │
│                    │  ◄──────────────────────────────── │                    │
└────────────────────┘     CALL / CALLRESULT / CALLERROR  └────────────────────┘
```

### Handshake notes

- Optional WebSocket **subprotocol**: `ocpp1.6`
- Some CMS endpoints require the subprotocol; some reject it. The Massive Mobility simulator can toggle this.
- Optional **HTTP Basic Auth** on the handshake (username/password).
- After the socket opens, the CP must send **BootNotification** before normal operation.

### Who may send what

Either side can send a **CALL** (request). The other side answers with **CALLRESULT** or **CALLERROR**.

Examples:

- CP → CMS: `BootNotification`, `StartTransaction`, `MeterValues`
- CMS → CP: `RemoteStartTransaction`, `ChangeConfiguration`, `Reset`

---

## 3. Message format (OCPP-J)

Every frame is a **JSON array**.

| Type | Code | Shape | Meaning |
|------|------|-------|---------|
| **CALL** | `2` | `[2, messageId, action, payload]` | Request |
| **CALLRESULT** | `3` | `[3, messageId, payload]` | Success reply to that `messageId` |
| **CALLERROR** | `4` | `[4, messageId, errorCode, errorDescription, errorDetails]` | Failure reply |

### Example CALL

```json
[2, "19223201", "Heartbeat", {}]
```

### Example CALLRESULT

```json
[3, "19223201", { "currentTime": "2026-08-11T09:00:00.000Z" }]
```

### Example CALLERROR

```json
[4, "19223201", "NotImplemented", "Action not supported", {}]
```

### Rules of thumb

- `messageId` must be unique enough for the open connection (string).
- `action` is the OCPP operation name (`BootNotification`, `StartTransaction`, …).
- Payload is a JSON object; some conf responses are empty `{}`.
- Common CALLERROR codes: `NotImplemented`, `NotSupported`, `InternalError`, `ProtocolError`, `SecurityError`, `FormationViolation`, `PropertyConstraintViolation`, `OccurrenceConstraintViolation`, `TypeConstraintViolation`, `GenericError`.

---

## 4. Boot / go-online sequence

Typical first minutes after connect:

1. **WebSocket open** to `{baseUrl}/{chargePointId}`
2. CP sends **BootNotification**
3. CMS returns `status`, `currentTime`, `interval`
4. If `Accepted` (or after Pending becomes Accepted), CP sends **StatusNotification** for:
   - connector `0` (whole charge point)
   - each connector `1…N`
5. CP starts **Heartbeat** every `interval` seconds (CMS may also change this later via `ChangeConfiguration`)

### BootNotification.req (CP → CMS) — key fields

| Field | Meaning |
|-------|---------|
| `chargePointVendor` | Vendor name (e.g. `Massive Mobility`) |
| `chargePointModel` | Model (e.g. `Massive-CP-Sim-16`) |
| `chargePointSerialNumber` | Serial |
| `firmwareVersion` | Firmware string (e.g. `Massive-CPS-16.3.2.1`) |
| `iccid` / `imsi` | Optional modem identities |
| `meterType` / `meterSerialNumber` | Optional meter info |

### BootNotification.conf (CMS → CP)

| Field | Meaning |
|-------|---------|
| `status` | `Accepted` / `Pending` / `Rejected` |
| `currentTime` | CMS clock (ISO 8601) |
| `interval` | Heartbeat interval in **seconds** |

If `Rejected`, the CP should not continue normal operation on that connection.

---

## 5. Connectors and status

### connectorId

| Id | Meaning |
|----|---------|
| `0` | Whole Charge Point |
| `1…N` | Physical outlets / guns |

OCPP 1.6 does **not** have a standard “rename connector” message. Names are often carried in `StatusNotification.info`, vendor `DataTransfer`, or CMS inventory only.

### StatusNotification

Sent when connector (or CP) status changes, and also on boot / trigger.

Important fields:

| Field | Meaning |
|-------|---------|
| `connectorId` | `0` or `1…N` |
| `status` | See table below |
| `errorCode` | `NoError` or fault code (`GroundFailure`, `OverCurrentFailure`, …) |
| `info` | Free text (≤50 chars in many stacks) |
| `timestamp` | When the status applied |
| `vendorId` / `vendorErrorCode` | Vendor extensions |

### Connector status values

| Status | Typical meaning |
|--------|-----------------|
| `Available` | Free, ready |
| `Preparing` | User/cable interaction before charging |
| `Charging` | Energy flowing (or session active and delivering) |
| `SuspendedEV` | EV asked to pause |
| `SuspendedEVSE` | Charger/CMS paused delivery |
| `Finishing` | Session ending; often waiting for cable removal |
| `Reserved` | Reserved for an idTag |
| `Unavailable` | Taken out of service |
| `Faulted` | Error / fault present |

### Typical happy-path status chain

`Available` → `Preparing` → `Charging` → `Finishing` → `Available`

Some CMS UIs stay on **Finishing** until they see **Available** again (and sometimes until unplug). Simulators often force Available shortly after Stop so the CMS does not stick.

---

## 6. Authorization and idTags

An **idTag** is a string identifying the driver credential: RFID card UID, app token, virtual card, etc.

### Authorize

- CP → CMS: `{ "idTag": "CARD-7F2A91" }`
- CMS → CP: `{ "idTagInfo": { "status": "Accepted", "expiryDate": "...", "parentIdTag": "..." } }`

### Common idTagInfo.status values

| Status | Meaning |
|--------|---------|
| `Accepted` | Allowed to charge |
| `Blocked` | Explicitly blocked |
| `Expired` | Tag expired |
| `Invalid` | Unknown / not valid |
| `ConcurrentTx` | Already has another concurrent transaction (many CMS platforms enforce this) |

### Where authorization can happen

1. **Online Authorize** to CMS  
2. **Authorization cache** on the CP  
3. **Local authorization list** (`SendLocalList`)  
4. Simulator modes (Massive Mobility sim): **Local only** / **CMS only** / **Local or CMS**

**Important:** Even if a simulator accepts a lab tag locally, the CMS may still reject `StartTransaction` if that tag is not registered in the CMS, or if the same RFID is already charging on another connector (`Blocked` / `ConcurrentTx`).

---

## 7. Charging session flows

### A) Local start (RFID / HMI)

1. Cable plugged (optional depending on charger logic)
2. **Authorize** idTag (local and/or CMS)
3. **StartTransaction** → CMS returns `transactionId`
4. Status → `Charging`
5. Periodic **MeterValues**
6. **StopTransaction** (local stop, app stop, E-stop, EV disconnect, …)
7. Status → `Finishing` → `Available`

### B) Remote start (app / CMS)

1. CMS sends **RemoteStartTransaction** `{ idTag, connectorId? }`
2. CP answers `Accepted` or `Rejected`
3. If accepted, CP runs Authorize (if configured) + StartTransaction
4. Later CMS may send **RemoteStopTransaction** `{ transactionId }`

### StartTransaction.req — key fields

| Field | Meaning |
|-------|---------|
| `connectorId` | Outlet number (`1…N`) |
| `idTag` | Credential |
| `meterStart` | Wh (or meter unit) at start |
| `timestamp` | Start time |
| `reservationId` | Optional |

### StartTransaction.conf

| Field | Meaning |
|-------|---------|
| `transactionId` | Session id assigned by CMS (**required** for later Stop / MeterValues) |
| `idTagInfo.status` | May still be `Invalid` / `Blocked` even after Authorize |

### StopTransaction.req — key fields

| Field | Meaning |
|-------|---------|
| `transactionId` | From StartTransaction |
| `idTag` | Optional |
| `meterStop` | Wh at end |
| `timestamp` | Stop time |
| `reason` | `Local`, `Remote`, `EVDisconnected`, `EmergencyStop`, `PowerLoss`, … |
| `transactionData` | Optional sampled values |

### MeterValues

While charging, CP sends samples. Important ideas:

- Controlled by config keys such as `MeterValueSampleInterval` (seconds) and `MeterValuesSampledData`
- Common measurands:  
  `Energy.Active.Import.Register`, `Power.Active.Import`, `Current.Import`, `Voltage`, `SoC`
- Each sample has `timestamp` + `sampledValue[]` with `value`, `measurand`, `unit`, `context`, `location`, `phase`

CMS billing / live power views usually depend on these messages.

---

## 8. Messages from Charge Point → CMS

| Message | Purpose | When |
|---------|---------|------|
| **BootNotification** | Identify CP + firmware | After connect / after reset / after FW install |
| **Heartbeat** | Keep-alive + clock sync opportunity | Every `interval` seconds |
| **StatusNotification** | Connector / CP status | Boot, change, trigger |
| **Authorize** | Check idTag | Before start (and sometimes remote start) |
| **StartTransaction** | Open session | Local or remote start |
| **MeterValues** | Energy / power / SoC samples | During transaction (and sometimes clock-aligned) |
| **StopTransaction** | Close session | End of charge |
| **DataTransfer** | Vendor-specific payload | Custom integrations |
| **DiagnosticsStatusNotification** | Diagnostics upload progress | After GetDiagnostics |
| **FirmwareStatusNotification** | FW update progress | After UpdateFirmware |
| **SecurityEventNotification** | (security whitepaper / extensions) | Implementation-specific |

---

## 9. Messages from CMS → Charge Point

| Message | Purpose | CP typical response |
|---------|---------|---------------------|
| **RemoteStartTransaction** | Start from app | `Accepted` / `Rejected` |
| **RemoteStopTransaction** | Stop by transactionId | `Accepted` / `Rejected` |
| **Reset** | Soft or Hard reboot | `Accepted` / `Rejected` |
| **UnlockConnector** | Unlock cable | `Unlocked` / `UnlockFailed` / `NotSupported` |
| **ChangeAvailability** | Operative / Inoperative | `Accepted` / `Rejected` / `Scheduled` |
| **GetConfiguration** | Read keys | Key/value list + unknown keys |
| **ChangeConfiguration** | Write a key | `Accepted` / `Rejected` / `RebootRequired` / `NotSupported` |
| **ClearCache** | Clear auth cache | `Accepted` / `Rejected` |
| **GetLocalListVersion** | Local list version | `{ listVersion }` |
| **SendLocalList** | Full / differential local auth list | `Accepted` / `Failed` / `VersionMismatch` |
| **ReserveNow** | Reserve connector for idTag | `Accepted` / `Faulted` / `Occupied` / `Rejected` / `Unavailable` |
| **CancelReservation** | Cancel reservation | `Accepted` / `Rejected` |
| **TriggerMessage** | Ask CP to send Boot/Status/MeterValues/… | `Accepted` / `Rejected` / `NotImplemented` |
| **DataTransfer** | Vendor command | `Accepted` / `Rejected` / `UnknownVendorId` / `UnknownMessageId` |
| **GetDiagnostics** | Upload diagnostics to location | `{ fileName? }` then status notifications |
| **UpdateFirmware** | Download/install firmware from URL | empty conf; then FirmwareStatusNotification |
| **SetChargingProfile** | Smart charging limit schedule | `Accepted` / `Rejected` / `NotSupported` |
| **ClearChargingProfile** | Remove profile(s) | `Accepted` / `Unknown` |
| **GetCompositeSchedule** | Ask planned schedule | schedule object or rejected |

---

## 10. Configuration (Get / Change Configuration)

Configuration is a set of string key/value pairs on the CP.

### Examples of important Core keys

| Key | Meaning |
|-----|---------|
| `HeartbeatInterval` | Seconds between Heartbeats |
| `MeterValueSampleInterval` | Seconds between MeterValues while charging |
| `MeterValuesSampledData` | Comma-separated measurands |
| `NumberOfConnectors` | Usually read-only |
| `AuthorizeRemoteTxRequests` | Whether RemoteStart must Authorize first |
| `LocalAuthorizeOffline` | Allow local auth when offline |
| `LocalPreAuthorize` | Use local list / cache without waiting |
| `ConnectionTimeOut` | Seconds to wait for auth/start interaction |
| `ResetRetries` | Reset retry count |
| `SupportedFeatureProfiles` | Advertised profiles |
| `WebSocketPingInterval` | WS ping (implementation-dependent) |
| `AuthorizationCacheEnabled` | Use auth cache |
| `LocalAuthListEnabled` | Use local list |
| `StopTransactionOnEVSideDisconnect` | Auto-stop on unplug |
| `UnlockConnectorOnEVSideDisconnect` | Auto-unlock on unplug |

`ChangeConfiguration.conf` may return **`RebootRequired`** — meaning the value is stored but applies only after Reset.

---

## 11. Firmware update (FirmwareManagement)

1. CMS sends **UpdateFirmware** with:
   - `location` (URL of firmware file)
   - optional `retrieveDate`, `retries`, `retryInterval`
2. CP answers with empty conf `{}`
3. CP sends **FirmwareStatusNotification** with statuses such as:
   - `Downloading` → `Downloaded` → `Installing` → `Installed`
   - or `DownloadFailed` / `InstallationFailed`
   - then often back to `Idle`
4. After install, CP typically reconnects and sends a new **BootNotification** with the updated `firmwareVersion`

Massive Mobility simulator firmware example: `Massive-CPS-16.3.2.1`

---

## 12. Minimal set for a basic working charger

### Must send (CP → CMS)

- BootNotification  
- Heartbeat  
- StatusNotification  
- Authorize  
- StartTransaction  
- MeterValues  
- StopTransaction  

### Must handle (CMS → CP)

- RemoteStartTransaction  
- RemoteStopTransaction  
- Reset  
- GetConfiguration / ChangeConfiguration  
- TriggerMessage  
- ChangeAvailability  

### Strongly useful next

- UnlockConnector  
- ClearCache / Local list  
- DataTransfer  
- UpdateFirmware + FirmwareStatusNotification  
- ReserveNow / CancelReservation  
- Smart charging messages (if CMS uses them)

---

## 13. Quick glossary

| Term | Meaning |
|------|---------|
| **CP / Charge Point** | The charger |
| **CSMS / CMS** | Central System backend |
| **EVSE** | Electric Vehicle Supply Equipment (often same idea as CP / connector context) |
| **connectorId** | `0` = whole CP; `1…N` = outlets |
| **idTag** | RFID / app / virtual credential string |
| **transactionId** | Session id returned by CMS on StartTransaction |
| **OCPP-J** | OCPP over JSON + WebSocket |
| **CALL / CALLRESULT / CALLERROR** | Request / success / failure frames |
| **Measurand** | What a meter sample measures (energy, power, SoC, …) |
| **Local list** | Auth tags stored on the charger |
| **Feature profile** | Optional capability group in OCPP 1.6 |

---

## 14. Common pitfalls

| Symptom | Likely cause |
|---------|----------------|
| Socket connects but CMS shows offline | BootNotification missing / Rejected; wrong cpId path |
| `Authorize Invalid` | Tag not in CMS; wrong auth mode |
| `StartTransaction` Blocked / ConcurrentTx | Same idTag already charging elsewhere |
| No live kW in CMS | MeterValues not sent, wrong measurands, or interval too high |
| Stuck on Finishing | CMS waiting for Available / unplug StatusNotification |
| `connectorId: null` on Boot / ChangeConfiguration in UI traces | Normal — those messages are charge-point level, not per-outlet |
| Subprotocol errors | CMS requires or forbids `ocpp1.6` subprotocol |
| Config change ignored | Key returned `RebootRequired` and no Reset yet |

---

## 15. How this maps to Massive Mobility Charging Simulator

| Piece | Role |
|-------|------|
| Browser UI | Operator panel only (REST + Socket.IO) |
| Simulator Node backend | Real OCPP WebSocket **client** to CMS |
| Massive Charging CMS | Real OCPP WebSocket **server** |

Default BootNotification identity in the simulator:

- Vendor: `Massive Mobility`
- Model: `Massive-CP-Sim-16`
- Firmware: `Massive-CPS-16.3.2.1`

Remember: **the browser never speaks OCPP**. Only the simulator backend does.

---

*OCPP 1.6 JSON practical guide for the Massive Mobility Charging Simulator. For normative field-level schema, refer to the official OCPP 1.6 specification from the Open Charge Alliance.*
