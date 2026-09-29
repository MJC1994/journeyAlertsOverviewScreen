# V1 Journey Planner — Feature Overview

This document describes the **classic (V1)** journey planner at `/` — the Airbnb-style search experience. It does not cover the experimental `/v2` or `/v3` labs.

**Primary code:** [`index.html`](index.html), [`src/main.js`](src/main.js), [`src/search-ui.js`](src/search-ui.js)

---

## Purpose

V1 lets a traveller compose a rail search for:

- **Day tickets** — single, return, or open return journeys  
- **Season tickets** — unlimited travel over a chosen period  
- **Others** — rover-style products  

The UI collects stations, dates/times, passengers, and optional filters, then submits a search. **Live journey/season API calls are disabled** in the current demo; Day and Season show a status message instead. Others still renders a local rover stub.

---

## Modes

A pill switch at the top of the page selects the mode:

| Mode | What it is for |
|------|----------------|
| **Day tickets** | Point-to-point travel on chosen dates/times |
| **Season tickets** | Season products between two stations |
| **Others** | Rover tickets (area travel for a set period) |

Switching modes shows and hides the relevant fields in the search bar (via page classes and CSS).

---

## Day tickets

### Route

- **From** and **To** station fields with fuzzy autocomplete — **no pre-filled stations**; the user must choose  
- With an empty field, the picker shows **Home**, **Work**, **Nearest** (via device location), and **Recent** searches  
- As soon as the user types, results switch to fuzzy station matches  
- Choosing From moves focus to To; choosing To opens the When panel (outbound)  
- **Swap** exchanges origin and destination  

### When (Outbound / Return)

The When area is split into two cells:

- **Outbound** — always shown; expands from the Outbound cell into a full-screen date/time picker (animates open/closed), titled **Outbound** with the selected date/time  
- **Return** — shown when a return is set; otherwise **Add return**; same expand animation, titled **Returning** with the selected date/time  

Close uses an **X** control (or Done / backdrop tap) and collapses back to the CTA.  

Inside the When panel:

| Control | Behaviour |
|---------|-----------|
| **Single / Return / Open Return** | Trip type pills |
| **Calendar** | Pick outbound (and return range when applicable); past days disabled |
| **Outbound / Return time blocks** | Leave at / Arrive by + quarter-hour times |
| **Done** | On outbound, if trip is Return or Open Return → moves to return picker; on Single (or after return) → closes |
| **Remove return** | In the return footer's secondary CTA (and clears return) |

**Single** — one-way only; return cleared.  
**Return** — outward + return dates/times; return defaults to the outbound date with a later time.  
**Open return** — flexible return; no fixed return time picker; summary shows open return.

Summaries show weekday + date on one line and time on the next (e.g. `Sun 13 Sept` / `19:45`).

### Who

- Adults and children (0–9 each, max 9 travellers total, at least one required)  
- Optional **railcards** from a fixed catalogue  
- Summary shows party size and railcard names (or “No railcard”)  

### Filters

- **Via / Avoid** — pick one station to travel via or avoid (not both the same)  
- **Discount code** — UI-only mock validation (first apply fails, second succeeds); not sent to a live API  

### Search actions

- **Search Trains and Times** — primary submit (journey-oriented intent)  
- **Search tickets** — same form submit with a tickets/fares intent flag  

On submit (after validation): status shows **“Live search is disabled in this demo.”** Journey/fare result UIs remain in the codebase but are not populated by submit while the API is off.

---

## Season tickets

### Route

- Same **From / To / Swap** as Day tickets  
- Choosing To opens the **Starting** date panel  

### Starting / Until

- **Starting** — dual-month calendar (one month on small screens); defaults to today  
- **Until** — only when **Custom length** is checked; must be after the start date  

### Passenger

- Exactly **one** traveller: Adult or Child  
- Adults may optionally add a **16-17 Saver** railcard  

### Season lengths

Multi-select checkboxes under the bar:

- Flexi Season  
- Weekly  
- Monthly  
- Annual  
- Custom length  

### Search

- Button label: **Search Seasons**  
- On submit (after validation): same demo-disabled status message as Day tickets  

---

## Others (Rover)

### Product

- Radio intro for rover tickets  
- Product picker: All Line rover (14 days), All Line rover (7 days), Kent rover  
- Default: All Line rover (14 days)  

### Starting

- Reuses the season start date calendar (defaults to today)  

### Who

- Same adults / children / railcards panel as Day tickets  

### Search

- Compact **Search** control  
- On submit: validates product, start date, and passengers, then renders a **local rover results stub** (no live API)  

Stations, When, via/avoid, and discount are hidden in this mode.

---

## Validation (Day / Season)

Typical checks before the demo status (or rover stub) runs:

- Origin and destination selected from the station list  
- Via/avoid consistent (and not the same station)  
- Outward date/time present; return complete when required; return after outward  
- Passenger rules (day party size; season exactly one adult or child; custom until rules)  

---

## Defaults (summary)

| Field | Default |
|-------|---------|
| Origin / destination | Empty — user selects (picker offers Home, Work, Nearest, Recent when empty) |
| Saved Home / Work (picker) | Surbiton / London Bridge (stored in localStorage; first visit seeds demo values) |
| Outward | Today, time snapped to 15 minutes |
| Return | About 4 hours after outward (same day when possible) |
| Trip type | Return |
| Adults / children | 1 / 0 |
| Season start | Today |
| Season lengths | Flexi, Weekly, Monthly, Annual on; Custom off |
| Season passenger | Adult |
| Rover product | All Line rover (14 days) |

---

## Layout notes

- **Desktop:** horizontal search bar with cell separators; dual-month calendars in When / season date panels  
- **Mobile (≤860px):** stacked search cells; Outbound/Return stack; swap control beside From/To; single-month calendars; full-width actions  

Header links to experimental labs: **Try v2**, **Try v3**.

---

## Related modules

| Area | Module |
|------|--------|
| Modes, panels, season/rover chrome | [`src/search-ui.js`](src/search-ui.js) |
| When / trip type | [`src/when-picker.js`](src/when-picker.js) |
| Season / rover calendars | [`src/season-start.js`](src/season-start.js) |
| Passengers / railcards | [`src/passengers.js`](src/passengers.js) |
| Station autocomplete | [`src/station-picker.js`](src/station-picker.js) |
| Home / work / recent | [`src/station-memory.js`](src/station-memory.js) |
| Nearest stations | [`src/nearest-stations.js`](src/nearest-stations.js), [`src/data/station-coords.json`](src/data/station-coords.json) |
| Constants | [`src/config.js`](src/config.js) |
| Submit + status / results wiring | [`src/main.js`](src/main.js) |
| Rover stub board | [`src/rover-board.js`](src/rover-board.js) |
| Journey / fare / season result renderers (present; Day/Season submit does not feed them while API is off) | [`src/journey-card.js`](src/journey-card.js), [`src/fares-board.js`](src/fares-board.js), [`src/season-board.js`](src/season-board.js), [`src/journey-detail.js`](src/journey-detail.js) |
| Styles | [`src/style.css`](src/style.css) |
