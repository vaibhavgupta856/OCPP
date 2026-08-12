# Massive Mobility Charging Simulator — User Guide

A practical guide for new users: how to open the simulator, connect a charger to your CMS, run a charging session, and use each part of the console.

---

## 1. What this app is

This is an **OCPP 1.6 Charge Point (EVSE) simulator**.

| It is | It is not |
|-------|-----------|
| A virtual charger that talks to a real CMS | A CMS / Central System |
| A lab tool for testing Massive Charging (or any OCPP 1.6 CSMS) | Real hardware firmware |
| A 3D + 2D control panel for plug / RFID / start / stop | A production charger UI for drivers |

**Live site:** https://massive-ocpp-simulator.onrender.com  
*(Free Render instances may sleep; first open can take ~1 minute.)*

**Local:** run `.\start.ps1` then open http://localhost:5173

---

## 2. Screen layout

```
┌──────────────────────────────────────────────────────────────┐
│  Header — Massive Mobility · connection pills · Hide bench   │
├──────────┬───────────────────────────────┬───────────────────┤
│ Chargers │     3D yard (charger)         │ Bench controls    │
│ (left)   │     + Operator panel          │ (right)           │
│          │                               │                   │
├──────────┴───────────────────────────────┴───────────────────┤
│  Message Trace — OCPP frames + system logs                   │
└──────────────────────────────────────────────────────────────┘
```

| Area | Purpose |
|------|---------|
| **Chargers (left)** | Commission / select / remove charge points |
| **3D yard (center)** | Touch the charger HMI, RFID pad, and guns |
| **Operator panel** | 2D buttons under the yard (plug / start / stop…) |
| **Bench controls (right)** | Auth, session, car battery, faults, power, reconnect |
| **Message Trace (bottom)** | Live OCPP messages and simulator logs |

Panels can be **dragged** (⋮⋮ Drag), **resized** from edges, and **Dock**ed again.

---

## 3. First connection (5 minutes)

### Step 1 — Commission a charger

In the left **Chargers** form:

1. **Charge Point ID** — unique ID your CMS expects (example: `MASSIVE-CP-001`)
2. **CSMS WebSocket base** — CMS OCPP URL **without** the charge-point id  
   Example: `wss://your-cms.example.com/ocpp/1.6`  
   The simulator connects to: `{base}/{cpId}`
3. **Default kW** — rated power (e.g. `22`)
4. **Connectors** — 1 to 4 outlets
5. Optional per-connector kW and name
6. **Require ocpp1.6 subprotocol** — leave ON unless your CMS rejects it
7. **Basic Auth (optional)** — only if your CMS needs username/password on the WebSocket handshake (not RFID)
8. Click **Connect EVSE**

### Step 2 — Wait for online

Watch the header / left list:

- `connecting` → handshake in progress  
- `online` → WebSocket up; BootNotification should be Accepted  
- `reconnecting` → link dropped; simulator will retry  

Use **Message Trace → OCPP** to confirm `BootNotification` and `Heartbeat`.

### Step 3 — Run a demo charge

Default demo tags work in **Local or CMS** auth mode:

- `CARD-7F2A91`
- `FOB-ORBIT-44`
- `TOKEN-MASSIVE-09`

Typical flow:

1. **Plug** the cable (3D gun double-click / HMI **PLUG** / Operator panel **Plug cable**)
2. Tap **RFID** on the charger (or **START** / **Tap RFID / Card**)
3. Watch status → **Charging**, energy + cost update on the screen
4. **STOP** when done, then **UNPLUG**

---

## 4. Using the 3D charger

### Orbit / zoom

- **Drag** — orbit around the charger  
- **Scroll** — zoom  
- Default view shows the full pedestal and HMI

### Touch screen (HMI)

On-screen pages:

| Page | What you see |
|------|----------------|
| **HOME** | Ready status, energy / power / cost tiles |
| **SESSION** | Active or last transaction, idTag, SoC |
| **OUTLETS** | All connectors — tap a row to focus that outlet |
| **INFO** | Vendor, model, serial, firmware, AC/DC type, live CPU / RAM / ROM / temp |

Soft keys at the bottom:

- **PLUG / UNPLUG**
- **START**
- **STOP**
- **CLEAR** (when faulted)

### RFID pad

The physical pad on the cabinet face starts a charge with the current idTag (same as card tap).

### Guns / cables

Side connectors represent outlets **C1…C4**. Double-click / use plug controls to plug or unplug the focused outlet.

---

## 5. Operator panel (under the yard)

Always-visible 2D controls for the focused outlet(s):

| Button | Action |
|--------|--------|
| Plug / Unplug cable | Cable plugged state |
| Start charge | StartTransaction with current idTag |
| Stop charge | StopTransaction |
| Tap RFID / Card | Same as RFID pad |
| Emergency stop | Immediate stop with emergency reason |
| Clear fault | Clear a faulted connector |
| C*n* kW | Change rated power for that outlet |

Also set **Auth** mode and **idTag** here.

---

## 6. Bench controls (right rail)

Scroll this panel for advanced lab controls.

### Auth mode

| Mode | Behavior |
|------|----------|
| **Local or CMS** (default) | Demo tags work locally; real CMS tags also work |
| **Local only** | Only tags in the local list |
| **CMS only** | CMS Authorize must Accept (use real Massive RFIDs) |

Add custom tags with **Add to local list** or the RFID pad presets.

### Cable / Session

- Plug / unplug  
- Start / stop with selectable stop reason  
- Emergency stop  

### Car configuration

Simulates the EV battery before you start:

| Field | Meaning |
|-------|---------|
| Energy already in car (kWh) | How full the pack is now |
| Battery capacity (kWh) | Full pack size |
| Fill mode | Full / by energy / by money / by time |

Click **Set car config** before starting. Charging stops when the fill target or full pack is reached.

### Suspend

Simulate EV or EVSE pause (`SuspendedEV` / `SuspendedEVSE`).

### Faults

Inject OCPP error codes (e.g. `OverCurrentFailure`, `HighTemperature`) and clear them.

### Hardware (connector)

- Connector type (Mennekes T2, CCS Combo 2, …) — drives **AC vs DC** label  
- Connector name  
- Power (kW)  
- Display tariff (₹/kWh)

### Charger hardware (live)

Simulated telemetry (not real silicon):

- AC / DC / AC-DC mode  
- CPU %, RAM, ROM  
- Cabinet + module temperature  

### Link

- **Reconnect** — drop and reopen the OCPP WebSocket  
- Toggle subprotocol and reconnect  
- Soft / hard **Reset** (OCPP Reset)

---

## 7. Message Trace

Bottom drawer:

| Tab | Shows |
|-----|--------|
| **OCPP** | Frames to/from CMS (`→ CMS` / `← CMS`) |
| **System** | Simulator logs (connect, boot, errors) |

Filters: **All**, **Station / CP**, or a specific connector **C1…**

- Drag the top edge to resize height  
- Collapse with the Message Trace button  
- **Clear** empties both lists  

Use this to debug BootNotification, Authorize, StartTransaction, MeterValues, etc.

---

## 8. Common workflows

### A. Local demo (no real RFID)

1. Auth = **Local or CMS**  
2. idTag = `CARD-7F2A91`  
3. Plug → Start → Stop → Unplug  

### B. Test a real Massive RFID

1. Auth = **CMS only** (or Local or CMS)  
2. Paste the CMS-registered idTag  
3. Plug → Tap RFID / Start  
4. Confirm Authorize Accepted in Message Trace  

### C. Multi-outlet parallel charge

1. Commission with 2–4 connectors  
2. Focus each outlet from **OUTLETS** on the HMI  
3. Each active session needs its **own** accepted idTag  

### D. DC vs AC

- Connector types like **CCS Combo 2 / CHAdeMO** → treated as **DC**  
- **Mennekes T2 / Schuko / J1772** → **AC**  
- Mixed outlets → **AC/DC**  
- INFO page and Bench **Charger hardware** show the mode  

### E. Fill by money / time

1. Set tariff under Hardware  
2. Car configuration → fill mode Money or Time  
3. Set car config → start charging  
4. Session auto-stops at the planned energy / time / full pack  

---

## 9. Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Stays `connecting` / `reconnecting` | Check base URL + cpId; try with/without subprotocol; check Basic Auth if CMS requires it |
| Boot never Accepted | CMS rejected identity / URL path; read System + OCPP tabs |
| Authorize Invalid | Wrong idTag, or Auth = CMS only without a registered card |
| UI looks old | Hard refresh (**Ctrl+Shift+R**) or private window (cached JS) |
| Charger clipped in 3D | Scroll zoom out / orbit; default camera shows full pedestal |
| Same cpId on laptop + Render | Both fight the CMS — use only one at a time |
| Free Render sleeps | Wait ~1 min on first open after idle |

---

## 10. Quick glossary

| Term | Meaning |
|------|---------|
| **CMS / CSMS** | Central System that manages charge points |
| **cpId** | Charge Point ID in the WebSocket path |
| **idTag** | RFID / token used to authorize a session |
| **Connector Cn** | Outlet number (C1, C2, …); C0 = station |
| **BootNotification** | First OCPP hello after connect |
| **MeterValues** | Live power / energy samples while charging |
| **Basic Auth** | Optional WebSocket username/password (not RFID) |
| **Firmware string** | Simulated version in BootNotification (lab identity) |

---

## 11. More docs

| Doc | Audience |
|-----|----------|
| `docs/User-Guide.md` (this file) | New operators |
| `docs/Massive-Mobility-Simulator-Guide.md` | How pieces connect |
| `docs/OCPP-1.6-Guide.md` | OCPP 1.6 overview |
| `docs/Tech-Stack-Flow-Guide.md` | Tech stack deep dive |
| `README.md` | Install, deploy, feature list |
