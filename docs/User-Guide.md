# Massive Mobility Charging Simulator — Website User Guide

How to use the **live simulator website** to commission a charger, run sessions, and work every panel.

**Website:** https://massive-ocpp-simulator.onrender.com  

> Free hosting may sleep when idle. If the first open is slow, wait about one minute and refresh.

---

## 1. What you are using

This website simulates an **EV charge point** that talks to your real CMS (for example Massive Charging) over **OCPP 1.6**.

You use it to:

- Connect a virtual charger to the CMS  
- Plug / unplug cables  
- Authorize with RFID / idTag  
- Start and stop charging  
- Watch live OCPP messages  
- Inject faults and change outlet settings for lab tests  

You do **not** need to install anything. Open the website and work in the browser.

---

## 2. Overview of the screen

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR — brand, status pills, Hide bench                   │
├────────────┬─────────────────────────────┬───────────────────┤
│ LEFT PANEL │     CENTER STAGE            │ RIGHT PANEL       │
│ Chargers   │     3D charger +            │ Bench controls    │
│            │     Operator panel          │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│ BOTTOM — Message Trace                                       │
└──────────────────────────────────────────────────────────────┘
```

Every side panel has:

- **⋮⋮ Drag** — move the panel (undocks it as a floating window)  
- **Edge drag** — resize  
- **Dock** — snap it back to its normal place  

Use **Hide bench** in the top bar to hide or show the right panel and give the charger more width.

---

## 3. Top bar

| Control | What it does |
|---------|----------------|
| **Massive Mobility** | Product header |
| **N chargers** | How many charge points you have commissioned |
| **online / connecting / offline / reconnecting** | Link state of the selected charger |
| **Hide bench / Bench controls** | Show or hide the right **Bench controls** panel |

---

## 4. Left panel — Chargers

This is where you create and pick charge points.

### Commission form

| Field | How to use it |
|-------|----------------|
| **Charge Point ID** | Unique ID for this virtual charger (must match what the CMS expects). Example: `MASSIVE-CP-001` |
| **CSMS WebSocket base** | CMS OCPP base URL **without** the charge-point ID. Example: `wss://your-cms.example.com/ocpp/1.6`. The site connects to `{base}/{Charge Point ID}` |
| **Default kW** | Rated power used for outlets (example: `22`) |
| **Connectors** | Number of guns / outlets (1–4) |
| **C1…Cn kW / name** | Optional per-outlet power and label |
| **Require ocpp1.6 subprotocol** | Keep ON unless your CMS rejects the `ocpp1.6` WebSocket subprotocol |
| **Basic Auth (optional)** | Username / password only if the CMS requires HTTP Basic Auth on the WebSocket. This is **not** an RFID card |
| **Connect EVSE** | Creates the charger and starts connecting to the CMS |

### After you connect

- The new charger appears in the list under the form  
- Click a charger row to select it (center + right panels follow that charger)  
- Use remove / disconnect controls on the row if you need to delete it  
- **Hide form / Commission** toggles the commission form to free space  

### Connection states

| State | Meaning |
|-------|---------|
| **connecting** | Opening WebSocket / sending BootNotification |
| **online** | Connected; Heartbeats should be running |
| **reconnecting** | Link lost; automatic retry |
| **offline** | Not connected |

---

## 5. Center stage — 3D charger

The large middle area shows the Massive cabinet.

### View controls

| Action | Result |
|--------|--------|
| **Drag** on the yard | Orbit around the charger |
| **Scroll** | Zoom in / out |
| Goal | Keep the full pedestal, screen, and side guns visible |

### Touch screen (HMI)

Tap the on-charger display.

#### Pages

| Soft key | What you see / do |
|----------|-------------------|
| **HOME** | Ready status, live energy / power / cost tiles |
| **SESSION** | Current or last transaction, idTag, SoC, rate |
| **OUTLETS** | List of connectors. Tap a row to focus that outlet (C1, C2, …) |
| **INFO** | System identity + live hardware: vendor, model, serial, firmware, AC/DC type, CPU, RAM, ROM, temperatures, uptime |

#### Action keys (bottom of the screen)

| Key | What it does |
|-----|----------------|
| **PLUG / UNPLUG** | Plug or remove the cable on the focused outlet |
| **START** | Start charging with the current idTag |
| **STOP** | Stop the active transaction |
| **CLEAR** | Clear a fault when the outlet is Faulted |

### RFID pad

The pad on the cabinet face starts a charge using the current idTag (same idea as tapping a card).

### Guns / cables

Side guns are the connectors. Plug / unplug via the HMI, Operator panel, or Bench **Cable** section. Focus the correct outlet first (OUTLETS page or by selecting it in controls).

---

## 6. Center stage — Operator panel

Below the 3D yard is the **Operator panel** (always visible; scroll the center stage if needed).

| Control | What it does |
|---------|----------------|
| **Title line** | Shows focused outlet (e.g. C1), status, energy, cost |
| **Auth** | Same auth modes as the right bench (see below) |
| **idTag** | RFID / token used for Start / card tap |
| **Add to local list** | Saves the typed idTag into the simulator’s local allow-list |
| **Plug / Unplug cable** | Cable state for the focused outlet(s) |
| **Start charge** | Starts a session |
| **Stop charge** | Stops the session |
| **Tap RFID / Card** | Authorizes and starts like a card tap |
| **Emergency stop** | Immediate emergency stop |
| **Clear fault** | Clears fault on the focused outlet |
| **Cn kW** | Change rated kW for that outlet |

Use this panel when you want quick 2D buttons without touching the 3D HMI.

---

## 7. Right panel — Bench controls

Detailed lab controls for the **selected** charger and **focused** outlet. Scroll inside the panel.

### Status summary (top)

Shows outlet number, name, status, kW, session kWh, cost, and optional smart limit / diagnostics state.

### Charger hardware

Live **simulated** telemetry (for display / lab feel):

| Tile | Meaning |
|------|---------|
| **CPU** | Processor load % + CPU model |
| **RAM** | Used / total memory |
| **ROM** | Used / total flash storage |
| **Temp** | Cabinet temperature + power-module temperature |
| Type line | **AC**, **DC**, or **AC/DC** based on connector types |

### RFID pad (bench)

Same card flow as the physical pad: pick/type an idTag, tap to start.

Demo tags (work when Auth is **Local or CMS** or **Local only**):

- `CARD-7F2A91`  
- `FOB-ORBIT-44`  
- `TOKEN-MASSIVE-09`  

### Auth mode

| Mode | When to use it |
|------|----------------|
| **Local or CMS** | Default. Demo tags work; real CMS tags also work |
| **Local only** | Only tags stored in the local list |
| **CMS only** | CMS must Accept the idTag (use a real Massive RFID / registered token) |

### Cable

Plug or unplug the focused connector.

### Session

| Control | What it does |
|---------|----------------|
| **Start** | StartTransaction with current idTag |
| **Stop reason** | Reason sent with StopTransaction (Local, EVDisconnected, …) |
| **Stop** | End the session with the selected reason |
| **Emergency** | Emergency stop |

### Car configuration

Set the simulated EV battery **before** you start charging:

| Field | Meaning |
|-------|---------|
| **Energy already in car (kWh)** | Energy already in the pack |
| **Battery capacity (kWh)** | Full pack size |
| **Fill mode — Full** | Charge until pack is full |
| **Fill mode — Energy** | Deliver a set kWh |
| **Fill mode — Money** | Deliver energy worth a set amount (uses tariff) |
| **Fill mode — Time** | Charge for a set number of minutes |

Click **Set car config**, then start. Charging auto-stops when the target or full pack is reached.

### Suspend

Simulate pause states:

- Suspended by EV  
- Suspended by EVSE  

### Faults

| Control | What it does |
|---------|----------------|
| Error code list | Choose an OCPP fault (OverCurrent, HighTemperature, …) |
| **Inject fault** | Marks the connector Faulted and notifies the CMS |
| **Clear fault** | Returns the connector to a healthy path |

### Hardware (connector settings)

| Control | What it does |
|---------|----------------|
| **Type** | Connector standard (Mennekes T2, CCS Combo 2, CHAdeMO, …). DC-style types mark the station as DC (or AC/DC if mixed) |
| **Name** | Friendly outlet name |
| **Power (kW)** | Rated / max power for that outlet |
| **Tariff** | Display rate (₹/kWh) used for cost on screen and money-based fill |

### Link

| Control | What it does |
|---------|----------------|
| **Reconnect** | Drop and reopen the OCPP WebSocket |
| **Reconnect with/without subprotocol** | Retry with the opposite subprotocol setting (useful if CMS rejects `ocpp1.6`) |
| **Soft / Hard Reset** | Sends OCPP Reset to the simulated charge point |

---

## 8. Bottom panel — Message Trace

Live traffic between the simulator and the CMS.

### Header controls

| Control | What it does |
|---------|----------------|
| **▾ / ▴ Message Trace** | Collapse or expand the message body |
| **OCPP (N)** | Protocol frames to and from the CMS |
| **System (N)** | Simulator logs (connect, errors, status text) |
| **Clear** | Empty both lists |
| **⋮⋮ Drag / resize** | Move or change height of this panel |

### Filters

| Filter | Shows |
|--------|--------|
| **All** | Everything, grouped by station / connector when useful |
| **Station / CP** | Charge-point level messages (Boot, Heartbeat, …) |
| **C1, C2, …** | Messages for that outlet only |

### How to read OCPP rows

| Marker | Meaning |
|--------|---------|
| **→ CMS** | Simulator sent this to the CMS |
| **← CMS** | CMS sent this to the simulator |
| Action name | e.g. BootNotification, Authorize, StartTransaction, MeterValues |
| JSON payload | Details of that message |

Use this panel to confirm Boot Accepted, Authorize status, meter samples, and stop reasons.

---

## 9. Typical website workflows

### A. Quick local demo

1. Commission with your CMS base URL + a unique Charge Point ID  
2. Wait until status is **online**  
3. Keep Auth = **Local or CMS**  
4. idTag = `CARD-7F2A91`  
5. **Plug** → **Start** or tap RFID → watch charging → **Stop** → **Unplug**  
6. Confirm frames in **Message Trace → OCPP**  

### B. Real CMS RFID

1. Auth = **CMS only** (or Local or CMS)  
2. Paste the CMS-registered idTag  
3. Plug → Start / RFID tap  
4. In Message Trace, confirm Authorize **Accepted**  

### C. Multi-outlet

1. Commission with 2–4 connectors  
2. On the HMI open **OUTLETS** and select the gun you want  
3. Each parallel session needs its own accepted idTag  

### D. Charge by money or time

1. Set tariff under Bench **Hardware**  
2. Fill **Car configuration** (money or time mode)  
3. **Set car config** → start charging  
4. Session stops when the planned energy/time (or full pack) is reached  

---

## 10. Troubleshooting (website only)

| What you see | What to do |
|--------------|------------|
| Site blank / very slow first load | Wait ~1 minute (cold start), then refresh |
| Stays **connecting** / **reconnecting** | Check base URL and Charge Point ID; try Basic Auth if required; try Reconnect with/without subprotocol |
| **online** but no Boot Accepted | Open Message Trace → OCPP/System and read the reject reason |
| Authorize **Invalid** | Wrong idTag, or Auth is CMS only without a registered card |
| UI looks outdated | Hard refresh (**Ctrl+Shift+R**) or open a private/incognito window |
| Same Charge Point ID open in two browsers/tabs | Use one only — duplicate IDs fight the CMS |
| Charger looks cut off | Zoom out (scroll) or orbit until the full unit is in view |

---

## 11. Glossary

| Term | Simple meaning |
|------|----------------|
| **CMS / CSMS** | The backend system that manages chargers |
| **Charge Point ID** | ID of this virtual charger in the WebSocket path |
| **idTag** | Card / token used to start a session |
| **Connector / Cn** | Outlet number (C1, C2, …) |
| **Basic Auth** | Optional WebSocket username/password (not the RFID) |
| **BootNotification** | First hello the charger sends after connect |
| **MeterValues** | Live power and energy samples while charging |
