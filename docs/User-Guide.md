# Massive Mobility Simulator — Quick Manual

**Site:** https://massive-ocpp-simulator.onrender.com  

*(First load after idle can take ~1 minute.)*

---

## Screen map

| Area | Use it for |
|------|------------|
| **Left — Chargers** | Create / select a charge point |
| **Center — 3D charger** | Touch screen, RFID pad, guns |
| **Center — Operator panel** | Quick plug / start / stop buttons |
| **Right — Bench** | Auth, car battery, faults, power, reconnect |
| **Bottom — Message Trace** | Live OCPP + system logs |

Drag **⋮⋮**, resize edges, or **Dock** panels. **Hide bench** frees width for the charger.

---

## Connect a charger (left panel)

1. Enter **Charge Point ID** (CMS ID).  
2. Paste **CSMS WebSocket base** (no ID on the end) — site connects to `{base}/{ID}`.  
3. Set **kW** and **Connectors** (1–4).  
4. Leave **ocpp1.6 subprotocol** ON unless CMS rejects it.  
5. Fill **Basic Auth** only if CMS needs WebSocket username/password (not RFID).  
6. Click **Connect EVSE** → wait for **online**.

---

## Run a charge

Demo tags (Auth = **Local or CMS**): `CARD-7F2A91`, `FOB-ORBIT-44`, `TOKEN-MASSIVE-09`

1. **Plug** cable (HMI **PLUG**, Operator panel, or Bench).  
2. Set **idTag** → **START** or tap the **RFID** pad.  
3. Watch energy / cost on the screen.  
4. **STOP** → **UNPLUG**.

For a real Massive RFID: Auth = **CMS only**, paste the registered tag, then start.

---

## 3D charger screen

| Key | Action |
|-----|--------|
| **HOME** | Status + energy / power / cost |
| **SESSION** | Transaction, idTag, SoC |
| **OUTLETS** | Pick connector C1…C4 |
| **INFO** | Model, AC/DC, CPU / RAM / temp |
| **PLUG / START / STOP / CLEAR** | Cable, session, clear fault |

Drag to orbit, scroll to zoom.

---

## Operator panel (under charger)

Plug / Start / Stop / RFID / Emergency / Clear fault · set Auth + idTag · change outlet kW.

---

## Bench controls (right)

| Section | Use |
|---------|-----|
| **Charger hardware** | Live AC/DC, CPU, RAM, ROM, temp (simulated) |
| **Auth mode** | Local or CMS · Local only · CMS only |
| **Cable / Session** | Plug, start, stop reason, emergency |
| **Car configuration** | Pack energy + capacity; fill by full / kWh / money / time → **Set car config** before start |
| **Suspend / Faults** | Pause states; inject or clear OCPP faults |
| **Hardware** | Connector type, name, kW, ₹/kWh tariff |
| **Link** | Reconnect (± subprotocol), soft/hard reset |

---

## Message Trace (bottom)

| Tab / filter | Shows |
|--------------|--------|
| **OCPP** | `→ CMS` / `← CMS` frames |
| **System** | Connect / error logs |
| **All / Station / Cn** | Filter by scope |

Resize height or collapse. Use this to confirm Boot, Authorize, Start/Stop, MeterValues.

---

## Quick fixes

| Problem | Try |
|---------|-----|
| Not connecting | Check URL + ID; Basic Auth; Reconnect ± subprotocol |
| Authorize Invalid | Wrong tag, or switch Auth mode |
| Old UI | Ctrl+Shift+R or private window |
| Same ID in two tabs | Use one only |
