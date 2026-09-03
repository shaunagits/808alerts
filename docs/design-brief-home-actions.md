# Design brief: action-first home and directory views

Round 4 of the 808alerts design work. Rounds 1 to 3 are attached
(`808alerts.dc.html`, `808alerts.dc-v2.html`, `808alerts-map.html`, plus
`README.md`, the written spec). Everything in those files is shipped and live
at 808alerts.com. This round adds to that page; it does not restart it.

## What the site is

A single-page Hawaiʻi storm information aggregator. It shows official alerts,
a map, and five hazard bands (POWER, ROADS, WEATHER, OCEAN, EMERGENCY), with
collapsed Plan / Kit / Sources folds below. It is not an official alert
system, and the design reflects that everywhere: every report carries a
source name and timestamp, shelter cards carry a non-dismissible "confirm
before you travel" band, and empty states say plainly that no feed exists
rather than implying all clear.

## What this round adds

1. **Five large action buttons on the home screen, above the existing board.**
   The board, map, bands and folds all stay exactly as designed in round 3.
   The buttons are a task layer on top, answering "what do I do" before the
   board answers "what is happening":

   - WHAT'S HAPPENING NOW, routes to the existing WEATHER detail
   - FIND A SAFE PLACE, routes to the existing EMERGENCY detail (shelters)
   - GET HELP, routes to a new directory view (#help)
   - PETS AND ANIMALS, routes to a new directory view (#pets)
   - REPORT OR RECOVER, routes to a new directory view (#recover)

2. **Three new routed detail views**, same full-viewport pattern as the
   round 2 category views (3a/3b/3c):

   - **#help**: a hand-curated resource directory. Food, water, charging,
     medical, transport, and agency referrals (211, county DEM, HI-EMA).
     List first, not map first. Filter chips by category. Cards sorted by
     distance from the user's set location.
   - **#pets**: the same card machinery filtered to animal resources:
     veterinary and emergency clinics, boarding, foster and rescue contacts,
     pet supplies, plus pet rules for shelters.
   - **#recover**: recovery resources. Damage reporting links, cleanup,
     food and water distribution, FEMA and insurance preparation, volunteer
     and donation channels.

## Directory card anatomy

Every card in the three new views carries, in some arrangement you choose:

- Name and category
- Distance from the user's location
- Eligibility and access notes (residents, visitors, pets, wheelchair)
- One-tap DIRECTIONS and CALL actions
- A source line: source name, link, and a VERIFIED time
- A **needs-verification state**: when an entry's verification has expired,
  the card stays visible but is clearly downgraded. It must never read as
  confirmed open. Design this state; it will be common.
- An honest empty state per view and per island: "No entries for this island
  yet" pointing at the county agency, never an implied all clear.

## Hard constraints, none negotiable

- **The palette is closed at five values plus ink variants.** No sixth color.
  --ink #101010, --ink2 #1c1c1c, --surface #faf8f5, --surface2 #f0ece4,
  --accent #ffd93b, --warn #c22e22, --advis #e8a317, --watch #1c6f7d.
  Muted text on light ground is #5c5c5c (an AA deviation from the original
  spec; keep it).
- **Band colors are fixed per category and carry no severity meaning.** A
  severity-driven color system was built, rejected, and removed. Do not
  design status banners or cards whose color scales with severity. The new
  action buttons must not introduce severity color either.
- **Radius 0 everywhere. No shadows** except the existing map popup.
  Separation comes from color blocks and 2px rules.
- **Type is Archivo and Archivo Narrow only**, as in the spec's size tables.
  Add no new sizes. Glyph coverage is limited: the okina (U+02BB) is remapped
  onto the left single quote and symbols like U+2715 do not exist in the
  font. Use no glyph outside basic Latin plus what the existing pages use.
- **No decorative elements.** No icons, no logos, no illustrations, no
  gradients, no motifs. If you believe an element needs a mark, describe it
  in a note instead of drawing it.
- **Nothing external at render.** No webfonts, CDN assets, or images. Mocks
  must be self-contained HTML like the previous handoffs.
- **Mobile is 375px.** Every screen must work there with no box crossing the
  viewport edge and no text flush against it. Buttons and tap targets at
  least 44px.

## Design questions this round must answer

1. Hierarchy of the opening screen: hero, location strip, five actions,
   board. Where do the actions sit and what do they displace visually, given
   nothing may be removed?
2. The five buttons at 375px (stacked or gridded) and at desktop widths
   (the board behind them is a two-column map-plus-bands grid at 1024px+).
3. How REPORT OR RECOVER can read as the priority action during a
   hand-flipped recovery mode without severity color. State, weight, position
   and copy are available to you; a new color is not.
4. The needs-verification and empty states for directory cards.
5. Filter chips for #help: the map view already has a chip row; reuse or
   evolve that pattern, do not invent a third.

## Deliverable

Self-contained HTML mock pages, same format as rounds 1 to 3, covering:
the home screen with actions (375px and desktop), #help with chips and cards
in normal, needs-verification and empty states (375px and desktop), #pets and
#recover (375px is sufficient if they reuse #help's system). Where this brief
conflicts with the earlier files, this brief wins; where it is silent, the
existing system wins.
