# OCPP 1.6 — Short Guide

## What is OCPP 1.6?

OCPP 1.6 is a protocol so an **EV charger (Charge Point / CP)** can talk to a **backend CMS (Central System / CSMS)**.

- **Charger** = WebSocket **client**
- **CMS** = WebSocket **server**
- Charger connects out to the CMS (usually `ws://` or `wss://` … `/cpId`)
- Messages are JSON arrays over WebSocket (OCPP-J)

---

## Message format

| Type | Code | Meaning |
|------|------|---------|
| CALL | 2 | Request |
| CALLRESULT | 3 | Success reply |
| CALLERROR | 4 | Error reply |

Example CALL:

```json
[2, "msg-001", "Heartbeat", {}]
```

---

## How it starts

1. Charger opens WebSocket to CMS  
2. Sends **BootNotification** (vendor, model, firmware, etc.)  
3. CMS replies with `status` (`Accepted` / `Pending` / `Rejected`), `currentTime`, and `interval`  
4. Charger sends **StatusNotification** for connector `0` (whole CP) and each gun `1..N`  
5. Charger starts **Heartbeat** every `interval` seconds  

After that, the charger is online.

---

## How a charge session runs

**Local (RFID):**  
Authorize → StartTransaction → MeterValues → StopTransaction  

**Remote (app/CMS):**  
RemoteStartTransaction → (Authorize) → StartTransaction → MeterValues → Stop / RemoteStop  

Typical connector statuses: `Available` → `Preparing` → `Charging` → `Finishing` → `Available`  
Also: `Faulted`, `Unavailable`, `Reserved`, `SuspendedEV`, `SuspendedEVSE`

---

## Messages from Charge Point → CMS

| Message | Purpose |
|---------|---------|
| BootNotification | Register / boot |
| Heartbeat | Keep-alive |
| StatusNotification | Connector / CP status |
| Authorize | Check RFID / idTag |
| StartTransaction | Open session |
| MeterValues | Energy / power samples |
| StopTransaction | Close session |
| DataTransfer | Vendor custom data |
| DiagnosticsStatusNotification | Diagnostics upload status |
| FirmwareStatusNotification | Firmware update status |

---

## Messages from CMS → Charge Point

| Message | Purpose |
|---------|---------|
| RemoteStartTransaction | Start from app |
| RemoteStopTransaction | Stop from app |
| Reset | Soft / Hard reboot |
| UnlockConnector | Unlock cable |
| ChangeAvailability | Set Available / Unavailable |
| GetConfiguration | Read settings |
| ChangeConfiguration | Write settings |
| ClearCache | Clear auth cache |
| GetLocalListVersion | Local list version |
| SendLocalList | Update local auth list |
| ReserveNow | Reserve a connector |
| CancelReservation | Cancel reservation |
| TriggerMessage | Force CP to send an event |
| DataTransfer | Vendor custom command |
| GetDiagnostics | Ask for diagnostics file |
| UpdateFirmware | Ask firmware update |
| SetChargingProfile | Smart charging |
| ClearChargingProfile | Clear profile |
| GetCompositeSchedule | Get schedule |

---

## Minimal messages for a basic working charger

**Must send:** BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, MeterValues, StopTransaction  

**Must handle:** RemoteStart, RemoteStop, Reset, Get/ChangeConfiguration, TriggerMessage, ChangeAvailability  

---

## Quick terms

| Term | Meaning |
|------|---------|
| CP | Charge Point (charger) |
| CSMS / CMS | Central System (backend) |
| connectorId | `0` = whole charger, `1..N` = guns |
| idTag | RFID / app token |
| transactionId | Session ID from CMS |

---

*OCPP 1.6 JSON overview — keep it short. For field-level schema, use the official OCPP 1.6 spec.*
