# OCPP 1.6 — Short Guide

Practical cheat sheet for **OCPP 1.6 JSON over WebSocket**, for use with the Massive Mobility Charging Simulator. For full schemas, see the official Open Charge Alliance OCPP 1.6 spec.

---

## Roles

| Role | Does what |
|------|-----------|
| **Charge Point (CP)** | Charger. WebSocket **client**. Reports status, starts/stops, sends meters |
| **CMS / CSMS** | Backend. WebSocket **server**. Authorizes tags, assigns `transactionId`, remote control |

Connect URL shape: `wss://cms.example.com/ocpp/{chargePointId}`  
Optional: subprotocol `ocpp1.6`, HTTP Basic Auth. After open → send **BootNotification**.

---

## Message shapes

Every frame is a JSON array:

| Type | Shape |
|------|--------|
| **CALL** | `[2, messageId, action, payload]` |
| **CALLRESULT** | `[3, messageId, payload]` |
| **CALLERROR** | `[4, messageId, errorCode, description, details]` |

Either side can send a CALL; the other replies.

---

## Go online

1. WebSocket open  
2. **BootNotification** → CMS returns `status`, `currentTime`, `interval`  
3. If **Accepted** → **StatusNotification** for connector `0` and each `1…N`  
4. **Heartbeat** every `interval` seconds  

| Boot field | Meaning |
|------------|---------|
| Vendor / Model / Serial / firmwareVersion | CP identity |
| conf `status` | Accepted / Pending / Rejected |
| conf `interval` | Heartbeat seconds |

Simulator defaults: **Massive Mobility** / **Massive-CP-Sim-16** / **Massive-CPS-16.3.2.1**

---

## Connectors & status

| connectorId | Meaning |
|-------------|---------|
| `0` | Whole charge point |
| `1…N` | Outlets / guns |

Common statuses: `Available` → `Preparing` → `Charging` → `Finishing` → `Available`  
Also: `SuspendedEV`, `SuspendedEVSE`, `Reserved`, `Unavailable`, `Faulted`

**StatusNotification** carries `status`, `errorCode` (`NoError` or fault), optional `info`.

---

## Auth & charging

**idTag** = RFID / app token string.

| Step | Message |
|------|---------|
| Check tag | **Authorize** → `idTagInfo.status` (`Accepted`, `Invalid`, `Blocked`, `Expired`, `ConcurrentTx`) |
| Open session | **StartTransaction** → CMS returns **`transactionId`** |
| While charging | **MeterValues** (energy, power, SoC, …) |
| Close session | **StopTransaction** (`reason`: Local, Remote, EVDisconnected, EmergencyStop, …) |

**Remote start:** CMS **RemoteStartTransaction** → CP Authorize (if configured) + StartTransaction  
**Remote stop:** CMS **RemoteStopTransaction** `{ transactionId }`

Auth can be online CMS, local list, or cache. Same tag on two connectors often → `ConcurrentTx` / `Blocked`.

---

## CP → CMS (common)

BootNotification · Heartbeat · StatusNotification · Authorize · StartTransaction · MeterValues · StopTransaction · DataTransfer · FirmwareStatusNotification · DiagnosticsStatusNotification

## CMS → CP (common)

RemoteStart / RemoteStop · Reset · UnlockConnector · ChangeAvailability · Get/ChangeConfiguration · ClearCache · SendLocalList · ReserveNow / CancelReservation · TriggerMessage · GetDiagnostics · UpdateFirmware · Set/ClearChargingProfile · GetCompositeSchedule · DataTransfer

---

## Config keys worth knowing

| Key | Role |
|-----|------|
| `HeartbeatInterval` | Heartbeat seconds |
| `MeterValueSampleInterval` | MeterValues seconds |
| `MeterValuesSampledData` | Which measurands |
| `NumberOfConnectors` | Outlet count |
| `AuthorizeRemoteTxRequests` | RemoteStart must Authorize? |
| `SupportedFeatureProfiles` | Advertised profiles |

`ChangeConfiguration` may return **RebootRequired** → needs Reset.

---

## Minimal working set

**Must send:** Boot, Heartbeat, Status, Authorize, Start, MeterValues, Stop  
**Must handle:** RemoteStart/Stop, Reset, Get/ChangeConfiguration, TriggerMessage, ChangeAvailability

---

## Pitfalls

| Symptom | Likely cause |
|---------|----------------|
| Online socket, CMS offline | Boot missing / Rejected / wrong cpId |
| Authorize Invalid | Tag not in CMS |
| Start Blocked / ConcurrentTx | Tag already charging elsewhere |
| No live kW | No MeterValues / wrong measurands |
| Stuck Finishing | Waiting for Available / unplug |
| Subprotocol error | CMS requires or forbids `ocpp1.6` |

---

## Simulator note

Browser UI ≠ OCPP. Only the **Node backend** opens the WebSocket to the CMS. The UI drives the sim over REST / Socket.IO.
