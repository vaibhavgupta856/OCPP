# OCPP 1.6 — Message Guide

Focus: **OCPP 1.6 JSON (OCPP-J)** — how it works and **every standard message type**.  
For field-level schemas/enums, use the official Open Charge Alliance OCPP 1.6 specification.

---

## 1. Protocol basics

| Item | Fact |
|------|------|
| Purpose | Standard talk between an EV **Charge Point (CP)** and a **Central System (CMS / CSMS)** |
| Transport (JSON) | **WebSocket** — CP is client, CMS is server |
| URL shape | `wss://cms.example.com/ocpp/{chargePointId}` |
| Optional handshake | Subprotocol `ocpp1.6`, HTTP Basic Auth |
| First action after open | CP sends **BootNotification** |

Either side can send a request (**CALL**). The other replies with **CALLRESULT** or **CALLERROR**.

### Frame shapes

| Type | Code | Shape |
|------|------|--------|
| **CALL** | `2` | `[2, messageId, action, payload]` |
| **CALLRESULT** | `3` | `[3, messageId, payload]` |
| **CALLERROR** | `4` | `[4, messageId, errorCode, errorDescription, errorDetails]` |

Common CALLERROR codes: `NotImplemented`, `NotSupported`, `InternalError`, `ProtocolError`, `SecurityError`, `FormationViolation`, `PropertyConstraintViolation`, `OccurrenceConstraintViolation`, `TypeConstraintViolation`, `GenericError`.

### Feature profiles (groups of messages)

| Profile | Messages (main) |
|---------|-----------------|
| **Core** | Boot, Heartbeat, Status, Authorize, Start/Stop, MeterValues, RemoteStart/Stop, Reset, Unlock, ChangeAvailability, Get/ChangeConfiguration, ClearCache, DataTransfer, TriggerMessage |
| **FirmwareManagement** | UpdateFirmware, FirmwareStatusNotification |
| **LocalAuthListManagement** | GetLocalListVersion, SendLocalList, ClearCache |
| **Reservation** | ReserveNow, CancelReservation |
| **SmartCharging** | SetChargingProfile, ClearChargingProfile, GetCompositeSchedule |
| **RemoteTrigger** | TriggerMessage |

---

## 2. All Charge Point → CMS messages

| Message | Purpose | Typical when |
|---------|---------|----------------|
| **BootNotification** | Identify CP (vendor, model, serial, firmware) | After connect / reset / FW install |
| **Heartbeat** | Keep-alive; CMS returns time | Every `HeartbeatInterval` seconds |
| **StatusNotification** | Report CP / connector status + errorCode | Boot, status change, trigger |
| **Authorize** | Ask if `idTag` may charge | Before start (and often remote start) |
| **StartTransaction** | Open a charging session | After auth / remote start |
| **MeterValues** | Energy, power, current, voltage, SoC samples | During (and sometimes outside) transaction |
| **StopTransaction** | Close session + final meter / reason | End of charge |
| **DataTransfer** | Vendor-specific payload (`vendorId`, `messageId`, data) | Custom extensions |
| **DiagnosticsStatusNotification** | Diagnostics upload progress | After GetDiagnostics |
| **FirmwareStatusNotification** | Firmware download/install progress | After UpdateFirmware |
| **SecurityEventNotification** | Security events (security whitepaper / stacks that support it) | Implementation-specific |

### Key payloads (CP → CMS)

**BootNotification.req** — `chargePointVendor`, `chargePointModel`, `chargePointSerialNumber`, `firmwareVersion`, optional modem/meter fields  

**BootNotification.conf** — `status` (`Accepted` / `Pending` / `Rejected`), `currentTime`, `interval` (heartbeat seconds)

**StatusNotification.req** — `connectorId` (`0` = whole CP, `1…N` = outlet), `status`, `errorCode`, optional `info`, `timestamp`, `vendorId`, `vendorErrorCode`

**Authorize.req** — `{ idTag }`  
**Authorize.conf** — `idTagInfo.status` (`Accepted`, `Blocked`, `Expired`, `Invalid`, `ConcurrentTx`)

**StartTransaction.req** — `connectorId`, `idTag`, `meterStart`, `timestamp`, optional `reservationId`  
**StartTransaction.conf** — `transactionId` (required for later stop/meters), `idTagInfo`

**MeterValues.req** — `connectorId`, optional `transactionId`, `meterValue[]` (timestamp + `sampledValue[]` with measurand/unit/context)

**StopTransaction.req** — `transactionId`, `meterStop`, `timestamp`, optional `idTag`, `reason`, `transactionData`

**FirmwareStatusNotification.req** — `status` (`Idle`, `Downloading`, `Downloaded`, `Installing`, `Installed`, `DownloadFailed`, `InstallationFailed`, …)

**DiagnosticsStatusNotification.req** — `status` (`Idle`, `Uploaded`, `UploadFailed`, `Uploading`)

---

## 3. All CMS → Charge Point messages

| Message | Purpose | Typical conf |
|---------|---------|----------------|
| **RemoteStartTransaction** | Start from app/CMS | `Accepted` / `Rejected` |
| **RemoteStopTransaction** | Stop by `transactionId` | `Accepted` / `Rejected` |
| **Reset** | Soft or Hard reboot | `Accepted` / `Rejected` |
| **UnlockConnector** | Unlock cable on connector | `Unlocked` / `UnlockFailed` / `NotSupported` |
| **ChangeAvailability** | Operative / Inoperative (CP or connector) | `Accepted` / `Rejected` / `Scheduled` |
| **GetConfiguration** | Read config keys | key/value list + unknown key list |
| **ChangeConfiguration** | Write one config key | `Accepted` / `Rejected` / `RebootRequired` / `NotSupported` |
| **ClearCache** | Clear authorization cache | `Accepted` / `Rejected` |
| **GetLocalListVersion** | Local auth list version | `{ listVersion }` |
| **SendLocalList** | Full or differential local auth list | `Accepted` / `Failed` / `VersionMismatch` |
| **ReserveNow** | Reserve connector for `idTag` | `Accepted` / `Faulted` / `Occupied` / `Rejected` / `Unavailable` |
| **CancelReservation** | Cancel reservation | `Accepted` / `Rejected` |
| **TriggerMessage** | Ask CP to send Boot / Status / MeterValues / Heartbeat / FW or Diagnostics status | `Accepted` / `Rejected` / `NotImplemented` |
| **GetDiagnostics** | Upload diagnostics to a location URI | optional `fileName`; then status notifications |
| **UpdateFirmware** | Download/install firmware from URL | empty `{}`; then FirmwareStatusNotification |
| **SetChargingProfile** | Apply smart-charging limit schedule | `Accepted` / `Rejected` / `NotSupported` |
| **ClearChargingProfile** | Remove profile(s) | `Accepted` / `Unknown` |
| **GetCompositeSchedule** | Ask planned power schedule | schedule object or rejected |
| **DataTransfer** | Vendor command to CP | `Accepted` / `Rejected` / `UnknownVendorId` / `UnknownMessageId` |

### Key payloads (CMS → CP)

**RemoteStartTransaction.req** — `idTag`, optional `connectorId`, optional `chargingProfile`  
**RemoteStopTransaction.req** — `transactionId`  

**Reset.req** — `type`: `Soft` / `Hard`  

**ChangeAvailability.req** — `connectorId`, `type`: `Operative` / `Inoperative`  

**ChangeConfiguration.req** — `key`, `value` (strings)  

**SendLocalList.req** — `listVersion`, `updateType` (`Full` / `Differential`), `localAuthorizationList[]`  

**ReserveNow.req** — `connectorId`, `expiryDate`, `idTag`, `reservationId`, optional `parentIdTag`  

**TriggerMessage.req** — `requestedMessage`, optional `connectorId`  

**UpdateFirmware.req** — `location`, optional `retrieveDate`, `retries`, `retryInterval`  

**GetDiagnostics.req** — `location`, optional `retries`, `retryInterval`, `startTime`, `stopTime`  

**SetChargingProfile.req** — `connectorId`, `csChargingProfiles` (purpose, stackLevel, schedule periods, …)  

**ClearChargingProfile.req** — optional filters: `id`, `connectorId`, `chargingProfilePurpose`, `stackLevel`  

**GetCompositeSchedule.req** — `connectorId`, `duration`, optional `chargingRateUnit`

---

## 4. Connector status values (StatusNotification)

| Status | Meaning |
|--------|---------|
| `Available` | Free |
| `Preparing` | Cable/user prep before charge |
| `Charging` | Session delivering (or active charge) |
| `SuspendedEV` | EV paused |
| `SuspendedEVSE` | Charger/CMS paused |
| `Finishing` | Ending; often wait for unplug |
| `Reserved` | Reserved |
| `Unavailable` | Out of service |
| `Faulted` | Error present |

`connectorId` **0** = whole charge point; **1…N** = outlets.

Happy path: `Available` → `Preparing` → `Charging` → `Finishing` → `Available`

---

## 5. Session message flow

### Local start (RFID / HMI)

1. **Authorize**  
2. **StartTransaction** → get `transactionId`  
3. **StatusNotification** → `Charging`  
4. **MeterValues** (repeat)  
5. **StopTransaction**  
6. **StatusNotification** → `Finishing` → `Available`

### Remote start

1. CMS **RemoteStartTransaction**  
2. CP may **Authorize**  
3. CP **StartTransaction** … same as above  
4. CMS may **RemoteStopTransaction**

### Stop reasons (StopTransaction)

`Local`, `Remote`, `EVDisconnected`, `EmergencyStop`, `PowerLoss`, `HardReset`, `SoftReset`, `Reboot`, `Unauthorized`, `DeAuthorized`, `Other`, …

---

## 6. MeterValues (what gets sent)

Controlled by config such as `MeterValueSampleInterval`, `MeterValuesSampledData`.

Common measurands:

| Measurand | Typical meaning |
|-----------|-----------------|
| `Energy.Active.Import.Register` | Energy Wh register |
| `Power.Active.Import` | Instant power |
| `Current.Import` | Current |
| `Voltage` | Voltage |
| `SoC` | EV state of charge % |

Each sample: `timestamp` + `sampledValue[]` (`value`, `measurand`, `unit`, `context`, `location`, `phase`).

---

## 7. Configuration messages

**GetConfiguration** / **ChangeConfiguration** read and write string keys on the CP.

Important Core keys:

| Key | Role |
|-----|------|
| `HeartbeatInterval` | Heartbeat period (s) |
| `MeterValueSampleInterval` | Meter sample period (s) |
| `MeterValuesSampledData` | Measurands list |
| `NumberOfConnectors` | Outlet count |
| `AuthorizeRemoteTxRequests` | RemoteStart must Authorize? |
| `LocalAuthorizeOffline` / `LocalPreAuthorize` | Offline / local auth behavior |
| `ConnectionTimeOut` | Auth/start timeout |
| `SupportedFeatureProfiles` | Advertised profiles |
| `AuthorizationCacheEnabled` / `LocalAuthListEnabled` | Cache / local list |
| `StopTransactionOnEVSideDisconnect` | Auto-stop on unplug |
| `UnlockConnectorOnEVSideDisconnect` | Auto-unlock on unplug |

`ChangeConfiguration.conf` = `Accepted` | `Rejected` | `RebootRequired` | `NotSupported`

---

## 8. Firmware & diagnostics message flow

**UpdateFirmware** (CMS) → CP **FirmwareStatusNotification**  
`Downloading` → `Downloaded` → `Installing` → `Installed` (or `*Failed`) → often `Idle`, then new **BootNotification**

**GetDiagnostics** (CMS) → CP **DiagnosticsStatusNotification**  
`Uploading` → `Uploaded` (or `UploadFailed`) → `Idle`

---

## 9. Smart charging messages

| Message | Role |
|---------|------|
| **SetChargingProfile** | Install TxProfile / TxDefaultProfile / ChargePointMaxProfile schedule |
| **ClearChargingProfile** | Remove matching profiles |
| **GetCompositeSchedule** | Return combined planned limit for a connector |

Limits from profiles typically cap power during **MeterValues** / charging.

---

## 10. Minimal message set for a working charger

**CP must send:** BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, MeterValues, StopTransaction  

**CP must handle:** RemoteStartTransaction, RemoteStopTransaction, Reset, GetConfiguration, ChangeConfiguration, TriggerMessage, ChangeAvailability  

**Next layer:** UnlockConnector, ClearCache, SendLocalList, DataTransfer, UpdateFirmware + FirmwareStatusNotification, GetDiagnostics + DiagnosticsStatusNotification, ReserveNow / CancelReservation, Set/ClearChargingProfile, GetCompositeSchedule

---

## 11. Quick pitfalls

| Symptom | Related messages / cause |
|---------|---------------------------|
| CMS stays offline | Missing/Rejected **BootNotification**; wrong cpId path |
| Can’t start | **Authorize** / **StartTransaction** `Invalid` / `Blocked` / `ConcurrentTx` |
| No live kW | Missing **MeterValues** or wrong measurands |
| Stuck Finishing | No **StatusNotification** `Available` after stop |
| Config ignored | **ChangeConfiguration** returned `RebootRequired` |
| Subprotocol fail | Handshake requires or forbids `ocpp1.6` |
