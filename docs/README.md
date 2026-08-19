# Handoff: 808 Alerts — Home / Location + Alert Summary

Approved directions: **1c** (mobile, "Hazard bands") and **2b** (desktop, "Board").

## Overview
808 Alerts is a hyper-local emergency and infrastructure status page for Hawaiʻi. The home screen does two things:

1. Asks the visitor where they are (geolocation or manual city/ZIP entry).
2. Once a location is known, shows a single-glance summary of active alerts for that neighborhood across five categories: Power, Roads, Weather, Ocean, Emergency.

Location is neighborhood-level, not island-level: a Waiʻanae user sees "Waiʻanae Alerts", a Kailua user sees "Kailua Alerts". The island name and last-updated time are secondary metadata.

Direction 1c is the chosen design: **severity is the layout**. Each category is a full-bleed color band whose color encodes severity, and the bands are ordered worst-first rather than in a fixed category order. Type is large and high-contrast so the page is readable at arm's length on a phone in bright sun.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior, not production code to copy directly.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, SwiftUI, native, etc.) using its established components, styling approach, and conventions. If no codebase exists yet, choose the most appropriate framework for the project and implement the design there. Do not ship the HTML as-is; treat it as a spec.

Note that `808alerts.dc.html` is a **design board** holding both approved designs side by side: the block with `id="1c"` is the mobile design, the block with `id="2b"` is the desktop design. Everything with a class starting `dv-` is board chrome (id badges, labels, the light gray page background) and must not be implemented.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final and specified exactly below. Recreate pixel-for-pixel using the codebase's existing libraries and patterns where they exist. Two things are deliberately unresolved and need product/engineering decisions, called out in "Open questions" at the end.

Two viewports are specified: mobile at 412px (option 1c) and desktop at 1440px (option 2b). Tablet is not designed — see "Responsive" below for the recommended crossover.

---

## Screens / Views

### Screen 1 — Home, no location known

**Purpose:** capture the user's location as fast as possible with minimum friction.

**Layout:** single column, full width, no max-width, no horizontal page padding (bands are full-bleed). Vertical stack:

1. Brand bar
2. Hero (headline + two location controls)
3. — nothing below until a location is set —

#### Brand bar
- Container: `background: #101010`, `padding: 18px 20px`, `display: flex; align-items: center; justify-content: space-between`
- Wordmark: `808` in `#ffffff` + `ALERTS` in `#ffd93b`, set solid with no space between. Archivo 900, 18px, `line-height: 1`, `letter-spacing: -0.02em`
- Right side: island label, e.g. `OʻAHU`. Archivo Narrow 700, 10px, `line-height: 1`, `letter-spacing: 0.16em`, color `#8c8c8c`. Uppercase in the source string (do not rely on `text-transform` — the ʻokina must be preserved literally)

#### Hero
- Container: `background: #101010`, `padding: 28px 20px 24px`
- Headline: exact copy `WHAT'S HAPPENING NEAR YOU?` — Archivo 800, 32px, `line-height: 1.02`, `letter-spacing: -0.03em`, color `#ffffff`, `text-wrap: pretty`. Wraps to 2–3 lines at 412px; do not hard-break it.
- Controls row: `display: flex; gap: 8px; margin-top: 18px`. Two children, each `flex: 1` (equal halves).
  - **Primary — "USE MY LOCATION"**: `background: #ffd93b`, text `#101010`, no border, `border-radius: 0`, `padding: 15px 12px`, Archivo 800, 12px, `line-height: 1`, `letter-spacing: 0.06em`, `cursor: pointer`. Hover: `background: #fff06b`. Rendered height ≈ 42px.
  - **Secondary — city/ZIP input**: `border: 2px solid #3a3a3a`, transparent background, `padding: 13px 12px` (compensating for the 2px border so both controls are the same height), placeholder text `CITY / ZIP` in Archivo 600, 12px, `letter-spacing: 0.04em`, color `#7d7d7d`, centered. In the mock this is a static div; **implement it as a real `<input>`** with an accessible label and centered text. Focus state is not designed — use a `#ffd93b` 2px outline/border to match the accent.

Both controls are ≥44px tall in practice once the border-box height is accounted for; if your implementation lands under 44px, increase vertical padding rather than font size.

### Screen 2 — Home, location known

Same brand bar and hero (the hero stays visible so the user can change location), then:

#### Location strip
- Container: `background: #1c1c1c`, `padding: 14px 20px`, `display: flex; align-items: center; justify-content: space-between`
- Left: `{NEIGHBORHOOD} ALERTS` — e.g. `KAILUA ALERTS`. Archivo 800, 13px, `line-height: 1`, `letter-spacing: 0.02em`, color `#ffffff`
- Right: `UPDATED 1:32 PM` — Archivo Narrow 600, 10.5px, `line-height: 1`, `letter-spacing: 0.12em`, color `#9a9a9a`

#### Alert bands
Five bands, each full-bleed, `padding: 20px`, stacked with no gap. Each band that has active alerts is a link/tappable row to that category's detail view. The Emergency band in its all-clear state is **not** a link.

Every active band has the same internal structure:

```
row 1: [CATEGORY LABEL] ................ [→]
row 2: HEADLINE (large)
row 3: sub-line (optional)
```

- Row 1: `display: flex; align-items: center; justify-content: space-between`
- Category label: Archivo Narrow 700, 10px, `line-height: 1`, `letter-spacing: 0.2em`
- Arrow glyph: `→` (U+2192), Archivo 700, 16px, `line-height: 1`
- Headline: Archivo 800, 27px, `line-height: 1.05`, `letter-spacing: -0.02em`, `margin-top: 8px`
- Sub-line: Archivo 500, 13px, `line-height: 1.3`, `margin-top: 4px`

Per-band values, in the exact display order used in the mock:

| # | Category | Severity | Background | Label color | Headline / arrow color | Sub-line color | Headline | Sub-line |
|---|----------|----------|-----------|-------------|------------------------|----------------|----------|----------|
| 1 | POWER | warning | `#c22e22` | `rgba(255,255,255,.75)` | `#ffffff` | `rgba(255,255,255,.82)` | `3 ACTIVE OUTAGES` | `1,284 customers affected` |
| 2 | WEATHER | warning | `#c22e22` | `rgba(255,255,255,.75)` | `#ffffff` | `rgba(255,255,255,.82)` | `FLASH FLOOD WARNING` | `Wind Advisory` |
| 3 | ROADS | advisory | `#e8a317` | `rgba(0,0,0,.55)` | `#101010` | `rgba(0,0,0,.7)` | `4 CLOSURES` | `7 major incidents` |
| 4 | OCEAN | watch | `#1c6f7d` | `rgba(255,255,255,.7)` | `#ffffff` | — | `HIGH SURF WARNING` | none |
| 5 | EMERGENCY | all clear | `#faf8f5` | `#8a8a8a` | — | `#3d3d3d` | `No active evacuation orders` | none |

**Adjacent same-color bands need a divider.** Bands 1 and 2 are both `#c22e22`, so band 2 carries `border-top: 2px solid rgba(255,255,255,.22)`. Rule: when a band's background equals the previous band's background, add a 2px top border at 22% white (or 22% black on light backgrounds). Bands whose color differs from the one above get no border.

**Emergency all-clear band** is styled differently from the active bands — it is the page's resting state, not an alert:
- `background: #faf8f5`, `border-top: 2px solid #e6e1d9`, `padding: 20px`
- Label `EMERGENCY`: Archivo Narrow 700, 10px, `letter-spacing: 0.2em`, `#8a8a8a`
- Message: `No active evacuation orders` — Archivo 600, 16px, `line-height: 1.2`, `#3d3d3d`, `margin-top: 7px`, **sentence case, not uppercase**
- No arrow, not tappable

---

### Screen 3 — Desktop, location known (option 2b, "Board")

**Purpose:** same job as mobile, but the extra width is spent on hierarchy — the most severe alert gets physically more space instead of just more color.

**Layout:** full-bleed, no max-width. Horizontal padding is `40px` throughout (vs 20px on mobile). Four stacked regions:

1. Nav bar
2. Hero
3. Location strip
4. Alert tile grid

#### Nav bar
- `background: #101010`, `padding: 20px 40px`, `display: flex; align-items: center; justify-content: space-between`
- Wordmark: same construction as mobile, scaled up — Archivo 900, 22px, `letter-spacing: -0.02em`
- Right cluster: `display: flex; align-items: center; gap: 28px`
  - `ABOUT` — Archivo Narrow 700, 11px, `letter-spacing: 0.16em`, `#8c8c8c`
  - `GET TEXT ALERTS` — Archivo 800, 11px, `letter-spacing: 0.1em`, text `#101010` on `background: #ffd93b`, `padding: 9px 14px`, no radius. This is a new element that does not exist on mobile; it needs a destination (SMS signup) or should be cut.

#### Hero
- `background: #101010`, `padding: 64px 40px 40px`
- `display: grid; grid-template-columns: 1fr 420px; gap: 64px; align-items: end` — headline left, controls right, both bottom-aligned
- Headline `WHAT'S HAPPENING NEAR YOU?` — Archivo 800, 76px, `line-height: 0.94`, `letter-spacing: -0.04em`, `#ffffff`, `text-wrap: pretty`. Sets to two lines at 1440px.
- Controls: `display: flex; flex-direction: column; gap: 10px` (stacked, not side-by-side as on mobile)
  - Primary `USE MY LOCATION`: `background: #ffd93b`, text `#101010`, `padding: 18px 16px`, Archivo 800, 13px, `letter-spacing: 0.06em`. Hover `#fff06b`.
  - Input `CITY / ZIP`: `border: 2px solid #3a3a3a`, `padding: 16px`, Archivo 600, 13px, `letter-spacing: 0.04em`, `#7d7d7d`, left-aligned (mobile centers it).

#### Location strip
- `background: #1c1c1c`, `padding: 18px 40px`, `display: flex; align-items: baseline; justify-content: space-between`
- Left cluster (`display: flex; align-items: baseline; gap: 18px`): `{NEIGHBORHOOD} ALERTS` in Archivo 800, 24px, `letter-spacing: 0`, `#ffffff`; then island `OʻAHU` in Archivo Narrow 600, 11px, `letter-spacing: 0.14em`, `#9a9a9a`
- Right: `UPDATED 1:32 PM` — Archivo Narrow 600, 11px, `letter-spacing: 0.14em`, `#9a9a9a`

#### Alert tile grid
- `display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2px; background: #faf8f5`
- The 2px gap showing the page background is what separates tiles — no borders, no radius, no shadow. This replaces mobile's same-color divider rule.
- **Feature tile** (highest-severity alert): first cell, `grid-row: span 2`, `padding: 32px 34px`, `min-height: 300px`. `display: flex; flex-direction: column; justify-content: space-between` so the label pins top and the headline pins bottom.
  - Label row: `display: flex; align-items: center; justify-content: space-between` — category label (Archivo Narrow 700, 11px, `letter-spacing: 0.2em`) and `→` (Archivo 700, 22px)
  - Headline: Archivo 800, 60px, `line-height: 0.98`, `letter-spacing: -0.035em`
  - Sub-line: Archivo 500, 17px, `line-height: 1.35`, `margin-top: 12px`
- **Standard tiles** (remaining four): `padding: 28px 30px`, `min-height: 149px` (two stack to match the feature tile's 300px including the 2px gap). Same top-label / bottom-content structure.
  - Label: Archivo Narrow 700, 11px, `letter-spacing: 0.2em`; arrow Archivo 700, 18px
  - Headline: Archivo 800, 28px, `line-height: 1.02`, `letter-spacing: -0.025em`
  - Sub-line: Archivo 500, 14px, `line-height: 1.3`, `margin-top: 7px`

Tile colors, label colors, and copy are **identical to the mobile band table above** — same five categories, same severity-to-color mapping. The one difference: the all-clear Emergency tile uses `background: #f0ece4` (a step darker than mobile's `#faf8f5`) so it reads as a tile rather than as page background, with no top border. Its message is Archivo 600, 22px, `line-height: 1.15`, `#3d3d3d`.

**Grid placement rule.** The severity sort from "Ordering" below decides content order; the grid then places item 1 in the feature cell and items 2–5 in the four standard cells, filling left-to-right, top-to-bottom. Because tile sizes are fixed by position rather than by content, the *feature slot changes occupant* as conditions change — accept this, or see open question 4.

**Long headlines.** The feature tile at 60px fits roughly 20 characters per line and two lines comfortably. Standard tiles at 28px fit roughly 22 characters per line, two lines. Longer strings than the samples (`FLASH FLOOD WARNING` is near the limit) must not be truncated with an ellipsis — let them wrap to three lines and let `min-height` grow. Verify with the longest real NWS product names before shipping.

---

## Interactions & Behavior

**Location capture**
- "Use my location" → `navigator.geolocation.getCurrentPosition`, reverse-geocode to a neighborhood, persist the resolved location (localStorage or user profile) so returning visitors skip this step.
- Permission denied or unavailable → keep the hero visible and move focus to the city/ZIP input. An inline error message style is not designed; use `#ffd93b` text at 12px under the controls row.
- City/ZIP submit → resolve to a neighborhood, then render the location strip and bands.
- Ambiguous or unrecognized input → not designed. Simplest resolution: an inline list of matching neighborhoods under the input.

**Band tap** → navigates to that category's detail view (out of scope for this handoff; the arrow signals it exists). Hover/active states for the bands are not defined in the mock — suggest a 4% white overlay on dark bands, 4% black on light, plus a normal focus ring for keyboard users.

**Ordering** — bands are ordered by severity, worst first, not by fixed category. The mock's order (Power, Weather, Roads, Ocean, Emergency) is the *result* of the sample data, not a hardcoded sequence. Sort key: `warning (0) → advisory (1) → watch (2) → all clear (3)`; ties broken by a fixed category order (Emergency, Weather, Power, Roads, Ocean) so the layout doesn't shuffle unpredictably between refreshes. **Exception:** an active Emergency alert (evacuation order) always sorts to the top regardless of the other bands.

**Refresh** — "Updated 1:32 PM" implies polling. Choose an interval (5 min is reasonable) and update the timestamp on success. A stale-data state (fetch failing for >N minutes) is not designed and should be added — recommend the location strip's right side switching to `UPDATED 1:32 PM · STALE` in `#e8a317`.

**Loading** — not designed. Recommend skeleton bands in `#1c1c1c` at full height rather than a spinner, so the page doesn't reflow.

**Empty / all clear** — if every category is clear, the page becomes five bands in the Emergency band's light treatment. Consider a single consolidated "No active alerts for {neighborhood}" panel instead; needs a design decision.

**Responsive** — two designed layouts: the mobile band stack (412px, Screens 1–2) and the desktop board (1440px, Screen 3). Recommended crossover at 1024px: below it, the mobile stack; at and above it, the board grid. Between 1024px and 1440px the board scales fluidly — the grid is `2fr 1fr 1fr` with no max-width, and the hero headline should step down proportionally (roughly 76px at 1440 → 56px at 1024) rather than wrapping to four lines. Tablet portrait (768–1023px) uses the mobile stack with the hero headline at 44px.

**Accessibility**
- Severity is communicated by color alone in this design. Add a text or icon severity marker (e.g. the label reading `POWER · WARNING`) so it survives color blindness and grayscale.
- Contrast check: white on `#c22e22` ≈ 5.3:1 (passes AA for normal text). Black on `#e8a317` ≈ 9.5:1. White on `#1c6f7d` ≈ 4.9:1. The `rgba(0,0,0,.55)` label on `#e8a317` is ~4.2:1 at 10px — **this fails AA**; darken to `rgba(0,0,0,.7)` in implementation.
- Each band is a link; give it an accessible name that includes the category, headline, and sub-line.

## State Management

```
location:        null | { neighborhood, island, lat, lng, source: 'geo' | 'manual' }
locationStatus:  'idle' | 'requesting' | 'denied' | 'resolved' | 'error'
alerts:          Array<{ category, severity, headline, subline?, href }>
alertsStatus:    'idle' | 'loading' | 'ok' | 'error'
lastUpdated:     ISO timestamp, formatted for display in the location's timezone (HST)
```

Transitions: `idle → requesting` on geolocation click; `requesting → resolved | denied | error`; on `resolved`, fetch alerts (`loading → ok | error`) and start the poll timer. Persist `location` across sessions; never persist `alerts`.

Data sources for the five categories (HECO outage feed, HDOT road closures, NWS Honolulu products, state emergency management) are not specified here — confirm with the product owner.

## Design Tokens

**Colors**
```
ink            #101010   brand bar, hero, primary button text
ink-2          #1c1c1c   location strip
surface        #faf8f5   all-clear band
surface-border #e6e1d9   all-clear band top border
accent         #ffd93b   wordmark "ALERTS", primary button
accent-hover   #fff06b
severity-warn  #c22e22
severity-advis #e8a317
severity-watch #1c6f7d
text-invert    #ffffff
text-muted     #8c8c8c   island label
text-muted-2   #9a9a9a   updated timestamp
text-muted-3   #8a8a8a   all-clear label
text-body      #3d3d3d   all-clear message
input-border   #3a3a3a
input-placeh   #7d7d7d
```

**Spacing** — 4px base: 4, 7, 8, 12, 14, 18, 20, 24, 28. Band and bar padding is 20px horizontal throughout.

**Typography** — Archivo (400–900) and Archivo Narrow (500–700), both Google Fonts.
```
wordmark        Archivo 900 / 18px / 1 / -0.02em
hero            Archivo 800 / 32px / 1.02 / -0.03em
band headline   Archivo 800 / 27px / 1.05 / -0.02em
location name   Archivo 800 / 13px / 1 / 0.02em
allclear msg    Archivo 600 / 16px / 1.2
band subline    Archivo 500 / 13px / 1.3
button          Archivo 800 / 12px / 1 / 0.06em
input placeh    Archivo 600 / 12px / 1 / 0.04em
category label  Archivo Narrow 700 / 10px / 1 / 0.2em
island label    Archivo Narrow 700 / 10px / 1 / 0.16em
updated stamp   Archivo Narrow 600 / 10.5px / 1 / 0.12em
```

**Radius** — `0` everywhere. This is intentional; the squared-off treatment is the design's character.

**Shadows** — none. Separation comes from color blocks and 2px borders.

## Assets
None. No images, no icon set — the only glyph is `→` (U+2192) set in Archivo. The wordmark is live text, not a logo file.

Hawaiian orthography matters: the ʻokina in `Oʻahu`, `Waiʻanae` is U+02BB (`ʻ`), not an apostrophe or a left single quote. Store place names with the correct character and avoid CSS `text-transform: uppercase` on them.

## Files
- `808alerts.dc.html` — the design board, containing the mobile design (`id="1c"`) and the desktop design (`id="2b"`). All `dv-*` classes are board chrome.
- `support.js` — runtime for the design-board format. Not part of the design; do not port.

## Open questions for the product owner
1. Does severity reorder the bands (as designed), or should category order be fixed so users learn the positions? The sort rules above assume reordering.
2. What is the all-clear page — five light bands, or one consolidated panel?
3. Does `GET TEXT ALERTS` in the desktop nav ship, and where does it go? It has no mobile equivalent yet.
4. On desktop, should the feature (double-height) tile always hold the worst alert, or should one category permanently own it so the page's shape is predictable? The grid rules above assume the former.
