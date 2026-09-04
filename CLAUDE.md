# Hawaiʻi Storm Info

A web app that brings scattered official Hawaiʻi emergency information into one place.
It is an information aggregator and a link directory. It is not an official alert system
and never replaces county emergency management or 911.

Live at **https://808alerts.com**. See Deployment below before changing anything.

## Who it is for

Someone preparing for an approaching storm who may not have TV or news access. They are
trying to answer, in order: what is happening, how long do I have, and where would I go
if I needed to. The app is built for planning ahead, not only for the moment of crisis.

## Non-negotiable invariants

These exist for safety. Do not remove, weaken, or "clean up" any of them. If a change
would violate one, stop and ask.

1. **Never assert live shelter status.** The app shows *reports* with a source and a
   timestamp. It never renders a shelter as "open" or "closed" as if it were fact.
2. **Every shelter card shows the confirm-before-you-travel band.** Not dismissible,
   not collapsible, not smaller.
3. **Every displayed report carries a source name, source URL and reported-at time.**
   A report missing any of the three does not get rendered.
4. **(Removed 2026-08-19 at the owner's direction.)** This was the always-visible
   `tel:911` action, taken out on request. The number is kept so invariants 5-8, which
   the rest of these docs reference by number, do not shift.
5. **Nothing external is required to render.** No CDN scripts, no webfonts, no CSS
   frameworks, no analytics. The HTML, CSS, JS, registry, Archivo subset and the whole
   of Leaflet are inlined in one file, and the served page has **zero** `<script src>`
   or `<link href>` tags. Grep for that before shipping. The Hawaiian Electric map
   toggle (see The map) adds an `<iframe>`, but it ships with **no `src`**: nothing
   loads from it until the user asks for it, so this invariant still holds. Grep that
   the served `#hecoIframe` has no `src` attribute.
   **This has drifted from the original wording and the drift is deliberate.** The page
   now calls five external hosts *after* it renders: `api.weather.gov`,
   `waterservices.usgs.gov`, `services1.arcgis.com`, `services.arcgisonline.com`
   for map tiles, and `pae-paha.pacioos.hawaii.edu` for the ocean wave reading. A saved copy still opens and still shows the plan, the kit, the
   and the sources with no network. What it loses offline is live data and
   the basemap. A **fifth host, `www.hawaiianelectric.com`, now loads too**, but only
   inside the map toggle's iframe and only when the user switches to Hawaiian Electric's
   map. It never loads at render, so a saved copy still opens and still shows everything
   above. This was the fifth-host decision; it was made deliberately for the outage map
   and nothing else should quietly ride on it. A sixth host,
   `mapservices.weather.noaa.gov`, loads the same way: only when the user turns on the
   radar layer (see The map), never at render. A seventh, `geodata.hawaii.gov`, loads the
   same way for the tsunami and flood hazard zones. An eighth, `gibs.earthdata.nasa.gov`
   (NASA's satellite imagery, see The satellite layer), was added the same way, only on a
   user toggle, then **changed same-day (2026-09-03) to load automatically instead**: see
   below. Three genuinely on-demand hosts now (radar, hazard zones, and the Hawaiian
   Electric iframe), each behind a user action and off by default; none of those three
   loads at render, so a saved copy still opens with no network.
   **As of 2026-09-03, three of the hosts above fire at render, not on demand.** The
   home map (see The home map) shows `services.arcgisonline.com` tiles and fetches the
   worker's `/api/hurricane` (itself proxying NOAA NHC) on page load, before any location
   is picked. The owner then asked for satellite imagery **on by default** too, so
   `gibs.earthdata.nasa.gov` now joins them: `SAT_ON` starts `true`, and `drawMap()` calls
   `setSatellite(true)` the first time it creates the map, whether or not a location is
   known yet. All three still degrade the same way if unreachable (flat tile pane, no
   storms, no satellite tile), and the static HTML/CSS/JS shell still needs no network to
   parse and paint, so a saved copy still opens. But the honest framing now is: three
   hosts call automatically on every landing, three more stay behind an explicit toggle.
   Not "nothing loads until you act" any more, not since the home map first shipped.
6. **Empty states are honest.** If no reports exist for a county, say so, point at that
   county's agency, and push the user to plan. Never imply absence of data means absence
   of shelters.
7. **Surface discrepancies, do not resolve them silently.** When sources conflict,
   show both and flag it. Live examples are already in the data.
8. **Keep the last-resort guidance in step 2 of the plan panel.** Hurricane refuge areas
   are ordinary buildings, not hardened shelters, and a friend's house may be safer.
   This is the county's own guidance and it is the most valuable thing on the page.

## Design rules

The palette, type and layout all come from a design handoff in `docs/`, not from
taste. Read those files before changing anything visual.

**Palette.** Five values carry the whole page. Do not add a sixth.

```
--ink       #101010   bars, hero, page headers
--ink2      #1c1c1c   location strip
--surface   #faf8f5   resting ground
--surface2  #f0ece4   secondary ground, all clear tiles
--accent    #ffd93b   wordmark ALERTS, primary buttons, step numbers
--warn      #c22e22   POWER and WEATHER bands, confirm band, hurricane cone
--advis     #e8a317   ROADS band, discrepancy notes
--watch     #1c6f7d   OCEAN band
```

**Band colour is fixed per category and does not move.** POWER red, WEATHER red,
ROADS amber, OCEAN teal, EMERGENCY light. This was an explicit product decision:
the board must read the same every day. **Do not reintroduce severity driven
colour.** It was built once, rejected, and removed. Live data fills the headline
and the sub-line only. See Known gaps for the hazard this creates.

**Type is Archivo, inlined.** One variable file covers both Archivo and Archivo
Narrow through the `wdth` axis at 77% for the narrow cuts. Sizes come from the
handoff tables; do not invent steps.

`--muted3` is `#5c5c5c`, not the handoff's `#8a8a8a`. At 10px on the light ground
`#8a8a8a` measures 3.26:1 and fails AA. This is a deliberate deviation.

**Radius is 0 everywhere. Shadows are none** except the map popup. Separation comes
from colour blocks and 2px rules.

**Do not add visual elements that were not requested.** No decorative motifs, no
logos, no illustrations, no icon sets, no gradients. Describe and ask instead.

### The design lineage

Four handoffs, all in `docs/`, each superseding part of the last:

- `808alerts.dc.html`, the original board. `1c` is the mobile hazard band stack,
  `2b` the desktop tile grid. `README.md` is its written spec and still the best
  reference for type and spacing.
- `808alerts.dc-v2.html` adds turn 3, the category detail views. `3a` ROADS
  desktop, `3b` POWER mobile sheet, `3c` WEATHER mobile. `1c` and `2b` are
  byte identical to v1.
- `808alerts-map.html`, the map dashboard. **This supersedes 2b's tile grid on
  desktop**: the board became a two column grid, map left at `1.15fr`, the five
  bands as full width rows right. **Superseded again 2026-09-03** (see The map):
  the owner asked for the map to stay full width across the top the way the home
  map already did, located or not, so the two column split is gone. `.board` is a
  single column at every width now; bands stack in full width rows below the map,
  desktop and mobile alike.
- `Home - Located.dc.html`, added 2026-09-03. **Supersedes the hero and the map
  height** for the located state. Two changes: (1) the full-height hero (headline,
  USE MY LOCATION, CITY/ZIP, island list) is replaced by the compact location strip
  once a location is known, the strip carries its own compact relocate controls
  rather than losing that ability; (2) the map card is capped at `360px`, not the
  `640px` min-height that immediately preceded this handoff, because the bands
  right below it are meant to be the primary above-the-fold content, not the map.
  See The located strip's relocate controls and The map for the implementation.

Where they conflict, the newest wins.

## How the page is structured

```
sticky brand bar        wordmark, UPDATED time stacked below it, island label
hero                    headline, use my location, city / ZIP (hidden once located)
location strip          {PLACE} ALERTS, island, relocate controls
                        (hidden pre-location; carries the hero's controls once shown)
board                   map full width across the top, always, located or not
                        pre-location: per-island forecast snapshot tiles below the map
                        located: four bands (WEATHER, OCEAN, ROADS, EMERGENCY,
                        see "POWER removed" below) stack in full width rows
                        below the map, PLAN and CHECKLIST continue as two
                        more cards right after them, same styling
footer                  the not an official alert system disclaimer
```

Tapping a band routes to `#roads`, `#weather`, `#ocean`, `#emergency`, `#plan`.
POWER has no route any more (see "POWER removed" below). Hash routing, no
router and no build step. The board hides, the detail view takes the viewport,
the browser
back button works and board scroll position is restored.
Landing on the site shows the board with nothing expanded: the map itself renders
immediately, before anyone picks a location (see "The home map" under The map).

## Architecture

The web app is a single static `index.html`, deployed straight from the repo root by
Cloudflare Pages' Git integration (see Deployment below): pushing to `main` is the whole
deploy, no staging copy, no build command. A companion **Cloudflare Worker** pulls data
that cannot be fetched from the browser (National Hurricane Center track and cone, which
sends no CORS header, and the Hawaiian Electric newsroom parse) and re-serves it as
CORS-open JSON the page fetches. See `docs/worker-plan.md`. The page still renders and
works with no network; the worker only fills in live data, exactly as the direct
`api.weather.gov` / USGS / PacIOOS calls already do.

- **`index.html` is the live app** and the only file Cloudflare Pages deploys. About
  319KB, roughly 123KB gzipped over the wire. It contains markup, CSS, JS, the registry,
  a base64 Archivo subset and the whole of Leaflet 1.9.4. `index-v5.html` is the previous
  revision, kept for rollback, and is a completely different design. **Renamed from
  `index-v6.html` on 2026-09-03** when deploys moved from a manual two-directory
  `wrangler`/`vercel` copy-and-push to Cloudflare Pages deploying the repo root directly;
  the version-numbered name only made sense when a staging copy step already existed to
  rename it. Git history is the version record now, not the filename.
- **There is no build step.** Edit `index.html` directly. An earlier session kept
  split `part1/part2/registry` sources in a scratchpad; `/private/tmp` was cleared and
  they are gone. Do not recreate that split, it only adds a failure mode.
- The font is a subset of Archivo built by `tools/build-font.sh`. One variable file
  covers both Archivo and Archivo Narrow through the `wdth` axis, at 77% for the
  narrow cuts. Archivo ships no U+02BB, so the okina is remapped onto the left single
  quote outline; source strings still carry the correct character. Regenerate with the
  script rather than editing the base64 by hand.
- `sources.json` is the portable registry and the schema of record. It is not fetched at
  runtime, the registry is inlined. Keep the two in step by hand.
- Live alerts come from `api.weather.gov`, public, keyless, and it sends
  `Access-Control-Allow-Origin: *`. No proxy needed.
- `GET /points/{lat},{lon}` resolves a location to a county zone and a forecast zone.
- Lead time is computed from `onset` / `effective` on Extreme and Severe alerts only.
- Distance sorting uses haversine against hardcoded shelter coordinates. These are
  approximate and were entered by hand. Directions links use name and address text,
  not the coordinates.

### The map

Leaflet 1.9.4 is **inlined**, not loaded from a CDN, so the only thing the map needs
from the network is tiles. If tiles fail the pane stays flat and every marker, line
and list row still works. The Leaflet CSS rules that reference `images/marker-icon.png`
and friends were stripped, and markers are `circleMarker` or `divIcon`, so nothing
requests a Leaflet image. If you ever use `L.marker` with the default icon it will 404.

**Basemap is Esri, deliberately not OpenStreetMap.** The handoff points at
`tile.openstreetmap.org`. Those are volunteer run, and the OSMF tile usage policy
steers heavy or spiky traffic elsewhere, which a Hawaiʻi storm page is. Esri's
`World_Street_Map` is keyless, sends `Access-Control-Allow-Origin: *`, and is what
KIUC's own outage map and HI-EMA's dashboards already use. It is one constant,
`TILES`, so swapping it is a one line change. The tile pane is desaturated with
`filter:grayscale(1)` to get the single tone basemap the 3a brief asks for.

**`maxZoom` raised from 17 to 19, 2026-09-03.** The owner asked for more street detail
when zoomed in. Rather than add a second tile source that swaps in past some zoom
threshold (which would mean a second host, and specifically reintroduces the OSM
question this file already answered above), the existing Esri layer was checked first:
verified live against real Honolulu tile coordinates that zoom 18 and 19 return real,
distinct street-level tiles (not a repeat of the zoom-17 tile), so the `L.tileLayer`
call's `maxZoom:17` was just capping the same source below what it actually supports.
Raising it to 19 was the whole fix, one line, same host, same CORS story, no new
external request pattern to reason about.

Markers follow the map handoff: closures are weight 9 lines, red for a full closure
and amber for one lane open; National Weather Service alerts are dashed polygons at
22% fill; shelters are 22px bordered pins; stream gauges are small white ringed dots.
Popups carry a coloured header, a key/value row and a dark action bar whose link goes
to the matching detail route.

The handoff draws closures as point pins with a `✕` glyph. Two reasons that is not
what shipped: HCCDA publishes real polyline geometry, so the actual closed stretch is
better than a dot on it, and **Archivo has no U+2715**, so the glyph would fall back
to a system font mid design. Same trap as the okina.

**Touch drag and pinch-zoom need no gate**: Leaflet enables both by default and
nothing in this file turns them off, so a finger already pans and pinch-zooms the
map with no "expand" step. **Mouse scroll-wheel zoom is deliberately gated**
(added 2026-09-03): it starts disabled on the `L.map()` constructor so a visitor
scrolling PAST the map, cursor incidentally passing over it, does not get their
whole page scroll hijacked into a map zoom, a well known embedded-map problem. A
`mousedown` inside `#map` calls `MAP.scrollWheelZoom.enable()`; a `document` click
outside `#mapwrap` calls `.disable()` again, so normal page scroll resumes once you
click elsewhere. The `.tall` (expand) state is unaffected, it already forces
wheel-zoom on unconditionally the way it always has.

### The home map (added 2026-09-03)

Before this, `#mapwrap` was hidden until `setLoc()` ran, so a first-time visitor who
had not yet picked a location saw no map at all, just the hero form. The owner asked
for a prominent home page map, zoomed out enough to see an approaching storm, so the
same `MAP`/`#mapwrap` the board already uses now renders immediately at boot, before
any location is known.

- `drawMap()` no longer hard-requires `S.c`. Without a location it skips
  `mapFeatures()` (county roads, shelters, gauges, NWS polygons all need a location
  and correctly render nothing), draws only the basemap and any active tropical
  systems, and adds a `home` class to `#mapwrap`, which `.board:has(.mapwrap.home)
  #bands{display:none}` uses to hide the empty `#bands` div so it doesn't leave a
  stray gap line under the map. (The map spanning the full board width used to be
  what this class was for; since 2026-09-03 the board is a single column always,
  so the map is full width in every state and this rule's only job now is hiding
  the empty bands div pre-location.)
- `fitStormView()` fits the map to `HI_BOUNDS`, a fixed statewide box (Niʻihau to
  Hawaiʻi Island, padded), extended with `bounds.extend()` for every active storm's
  forecast cone (or just its point, if a storm has no cone) that passes
  `stormNearHawaii()`. A quiet day, or a day where every active storm is filtered
  out, rests on `HI_BOUNDS` alone; a day with at least one storm on track zooms out
  however far it takes to keep that storm on screen. The owner chose this over a
  fixed wide Pacific view specifically so the zoom reflects what's actually out
  there rather than a constant, sometimes-empty ocean view.
- **`stormNearHawaii()`, added 2026-09-03.** The worker's own filter for which
  storms count as "could concern Hawaiʻi" is deliberately broad (anything west of
  125W, see `hurricane()` in `worker/src/index.js`), so the WEATHER band and
  TROPICAL SYSTEMS list don't miss a real threat. That same broad filter is wrong
  for the default zoom: a storm recurving north 1,500 miles out would otherwise
  drag the home map's zoom out to a nearly empty ocean every day it's active, which
  is exactly the "constant, sometimes-empty ocean view" the owner rejected above,
  just reached a different way. So `fitStormView()` only zooms out for a storm
  whose own forecast cone (or, with no cone, its current position) comes within
  about 300 miles of Hawaiʻi's bounding box, tested with Leaflet's
  `LatLngBounds.intersects()`. Checked against live data the day this shipped: an
  Eastern Pacific storm whose cone stayed out past 149W correctly did not pull the
  zoom out for it, while a Central Pacific storm whose cone reached into Hawaiʻi's
  own longitude band correctly did. A storm can still be listed and drawn on the
  map without passing this test, it just does not drive the default zoom.
- `drawStorms()` is the old inline HURRLAYER block, pulled out so both the home map
  and the per-location board map draw storms the same way instead of duplicating it.
- `loadHurricane()` and `hurrPop()` both now tolerate no location: `dist`/`dir` are
  `null` when there is no `S.lat` to measure from, and the popup falls back to the
  storm's own lat/lon instead of "NaN mi undefined of ".
- Once a location resolves (fresh pick, or the stored one `restore()` reloads on
  return visits), `drawMap()` re-centers the same map to the existing zoom-11 local
  view exactly as before. The home map is a state of the one map, not a second map.
  **`setLoc()` calls `drawMap()` synchronously, not just from the async loads
  below it.** Before the home map existed this did not matter: the map sat
  `hidden` until the first fetch resolved either way, so a beat of delay was
  invisible. Now the map can already be on screen showing the home view when
  `setLoc()` runs, and that view does not clear itself just because `S`
  changed; only `drawMap()` running notices. Without the synchronous call, a
  freshly picked location would sit on the wide home view, seemingly stuck,
  until `loadClosures`/`loadShelters`/`loadGauges`/`loadHurricane` happened to
  resolve. Caught 2026-09-03 when the owner reported the located map "does
  not load".
- **The located map gets the same intelligent zoom as the home map, added
  2026-09-03.** `fitStormView()` only ever ran for the home (no-location)
  state; the located branch always did a flat `MAP.setView([S.lat,S.lon],11)`,
  so a storm genuinely on track to affect the state stayed off screen the
  moment someone picked a location. `fitLocalView()` is the located
  counterpart: it runs the same `stormNearHawaii()` ~300 mile test, but the
  base bounds is a small box around the user's own coordinates (roughly what
  zoom 11 already frames) instead of statewide `HI_BOUNDS`, so a quiet day
  still lands on the familiar local view and a storm on track extends that
  box outward, `fitBounds`, rather than replacing it with a statewide one.
  A new `mapFitStorms` flag (reset alongside `MAPAT` whenever the map is
  built or the location changes) makes this run once per location, once
  storm data is actually known, not on every routine `drawMap()` a band
  refresh triggers: `setLoc()`'s synchronous `drawMap()` call runs before
  `HURRICANES` has loaded (it's `null` at that point, deliberately guarded
  against), so it still shows the immediate zoom-11 placeholder; the
  `loadHurricane().then(...drawMap())` call right after is what actually
  fires `fitLocalView()` once real data (or a confirmed-empty list) is in.
  Without that guard, a five-minute band refresh calling `drawMap()` again
  would silently undo anything the user panned or zoomed to by hand.
- **Invariant 5, updated.** Tiles (`services.arcgisonline.com`) and the worker's
  `/api/hurricane` (which itself proxies NOAA NHC) now fetch on page load for every
  visitor, not only after someone picks a location. The initial HTML/CSS/JS still
  needs no network to parse and paint, and both fetches degrade the same way they
  always have (flat tile pane, `HURRICANES=[]`), so a saved copy still opens. But
  the home page is no longer inert until interaction: every landing hits Esri and
  the worker once. Worth knowing if traffic ever needs to be pared back.

### The located strip's relocate controls (added 2026-09-03)

`Home - Located.dc.html` replaces the full-height hero with the compact location
strip once a location is known, but someone still needs a way to change it without
scrolling back to the top. Rather than build a second set of location controls with
new ids (and rewire geolocation, ZIP lookup, and the island-disambiguation list a
second time), `moveLocateControls()` literally relocates the existing `#where`
(the form holding `#geo` and `#zip`), `#note` and `#isles` nodes into a new
`#stripCtl` span inside `#strip`. `appendChild` **moves** a DOM node, it does not
clone it, so every event listener already bound to `#geo`, `#zip`, `#where` and
`#isles` keeps working with zero re-wiring. It runs once (guarded by a `located`
class on `<body>`) from the top of `setLoc()`, so it fires on a fresh pick and on
`restore()` reloading a stored location alike, and `body.located .hero{display:none}`
hides the now-empty hero. This app has no "forget my location" flow, so the move is
one-way in practice; `moveLocateControls()` is written idempotent regardless.
`#stripCtl`'s children reuse the hero's existing `.controls`/`.go`/`.zip`/`.note`/
`.isles` classes (already styled for a dark background) with a compact-size override
scoped under `.loc-ctl`, rather than inventing new styling, so no new colour joins
the five-value palette.

**`#locUp` (the "UPDATED" timestamp) moved into the brand bar, 2026-09-03.** It
used to live at the right side of the location strip; the owner asked for it
under the wordmark instead. It is the same `#locUp` span, just relocated in
the markup into a new `.bar-l` column (`display:flex;flex-direction:column`)
alongside `.mark`, not duplicated, so `stamp()` (which sets its text) did not
need to change. It renders empty until a location resolves and `stamp()` first
runs, exactly as before, just in a different spot.

**The hero's USE MY LOCATION / CITY-ZIP row stays side by side at every
width, 2026-09-03.** `.controls` used to switch to `flex-direction:column`
at the 1024px breakpoint, stacking the button above the field. The owner
asked for them to stay side by side on larger screens too; removing that one
declaration is the whole fix, `.controls>*{flex:1}` already splits the row
evenly and did not need to change.

### The companion Worker (hurricane + power)

A Cloudflare Worker, `808alerts-api.shauna-coy.workers.dev` (source in `worker/`,
`docs/worker-plan.md`), serves two things the browser cannot fetch directly, as CORS-open
JSON. Both are fetched with the board in `setLoc`, like the gauge/wave calls, and both
degrade to the old behaviour if the worker is unreachable.

- **`/api/hurricane`** proxies NOAA NHC `CurrentStorms.json` (no CORS at source). Active
  Pacific storms near Hawaiʻi become: a red cyclone marker on the map (`HURRLAYER`, drawn
  by `drawStorms()`; the home map (see The home map) fits its zoom to include it, the
  per-location board map shows it once zoomed out to the basin), a line in the WEATHER
  band, and a TROPICAL SYSTEMS block in the WEATHER detail with distance and bearing from
  the user, when a location is known. When there
  is no NWS product, the storm is the WEATHER headline; when there is, it rides in the
  sub-line and the NWS product stays the headline. The **forecast cone and track** are
  drawn too: the worker unzips NHC's KMZ (via `fflate`), pulls the `<coordinates>`,
  decimates the ~1500-point cone ring to ~140, and returns GeoJSON; the map draws a
  translucent red cone plus the centre-track line, visible when zoomed out to the basin.
  **Added 2026-09-03: best track, wind extent and arrival time.** NHC's
  `CurrentStorms.json` carries several more GIS fields that were unused until now.
  `bestTrackGIS` (where the storm has actually been, not just the forecast ahead of
  it) is drawn automatically alongside the cone and track: a lighter, thinner line
  with filled points, so the observed past reads differently from the uncertain
  forecast ahead. `initialWindExtent` (current 34kt+ wind radii) and
  `mostLikelyTimeTSWindsGIS` (most likely arrival of tropical-storm-force winds) are
  drawn too, but behind two new off-by-default map chips, WIND FIELD and ARRIVAL
  TIME (`STORMLAYER_ON`), shown only when a storm actually carries that data. No
  extra fetch: both ride along with the same `/api/hurricane` response, so toggling
  just rebuilds `HURRLAYER` locally. **These two are unverified.** `stormExtras()` in
  `worker/src/index.js` parses them with the same generic "every `<coordinates>`
  block is a ring" extractor already proven for the cone, but a wind radii or
  arrival-time KMZ carries several rings (one per quadrant, or per threshold) where
  the cone is genuinely one, and that has only been checked against a synthetic
  fixture in `worker/test-parse.mjs`, not a real KMZ pulled from a live storm. Fetch
  one from an active storm's `initialWindExtent.kmzFile` / `mostLikelyTimeTSWindsGIS.kmzFile`
  and look at the shapes on the map before trusting them. Best track was left on by
  default anyway because a bad line still just looks like a line; a wrong wind-extent
  shape could read as a claim about how far damaging wind actually reaches, which is
  exactly the kind of thing invariant 1 exists for.
- **Added 2026-09-03: individual model tracks ("spaghetti"), off by default, a MODELS
  chip.** Everything above is NHC's own single blended forecast (cone/track) plus where
  the storm has actually been (best track). This is different: it shows what each
  individual model (GFS, ECMWF, UKMET, HWRF, HMON, COAMPS-TC, NAVGEM, plus the
  multi-model consensus) independently thinks the storm will do, so agreement or
  disagreement between them is visible, the way tropicaltidbits.com and similar sites
  show it. NHC does not publish this as JSON or KML like the rest of `/api/hurricane`;
  it is a plain-text ATCF "a-deck" file, gzipped, one per storm, at
  `ftp.nhc.noaa.gov/atcf/aid_public/a{storm id}.dat.gz`, where `{storm id}` is exactly
  `CurrentStorms.json`'s own `id` field (e.g. `ep122026`), no translation needed.
  **Verified live 2026-09-03**, not assumed: fetched a real current storm's `.dat.gz`,
  confirmed `curl -I` sends no `Access-Control-Allow-Origin` header at all (same gate as
  `CurrentStorms.json` and the KMZ files, so this goes through the worker) and a
  browser-context `fetch()` to it throws, then decompressed and parsed the real file and
  got 8 legible model lines back (GFS, UKMET, CMC, NAVGEM, HWRF, HMON, COAMPS-TC,
  Consensus) with real point counts.
  `modelTracks()` in `worker/src/index.js` fetches and gunzips the file (`fflate`'s
  `gunzipSync`, a different function than the `unzipSync` already used for KMZ, since
  this is plain gzip, not a zip archive), keeps only the newest advisory cycle (the file
  accumulates the storm's whole life, tens of thousands of lines), and keeps only a
  curated allow-list of the well-known dynamical models plus consensus
  (`MODEL_TRACK_ALLOW`), using NHC's synoptic-time-interpolated "I" variant of each
  (`AVNI`, `UKXI`, `CMCI`, `NVGI`, `HWFI`, `HMNI`, `CTCI`, `EMXI`, `TVCN`), not the ~30
  raw GEFS ensemble members or the statistical intensity-only tools (`DSHP`/`SHIP`/
  `LGEM`, which carry no track) or `OFCL`/`CARQ` (already drawn separately). A duplicate
  forecast hour on one model (a second row for a different wind-radii threshold) is
  deduped to its first value; a model with fewer than two points that cycle is dropped,
  same "just don't draw it" rule as every other optional layer here. A storm near the
  end of its life can legitimately return only the consensus line or nothing, checked
  against a real storm on 2026-08-25; that is not a bug.
  On the map, each model line is thin, low-opacity, fine-dotted (`dashArray:"1 3"`), and
  in the same `#c22e22` as every other storm element: **no sixth colour was added**, the
  palette rule holds, models are told apart by their popup label (tap the line) rather
  than by colour. `worker/test-parse.mjs` pins the parser (cycle filtering, allow-list,
  tau dedupe, lat/lon sign parsing) against a fixture built from the real file's shape.
- **Added 2026-09-04: the full NHC/CPHC Public Advisory text, not just a link to it.**
  `CurrentStorms.json` already carried `publicAdvisory.url` (e.g.
  `https://www.nhc.noaa.gov/text/HFOTCPCP4.shtml`), the always-current bulletin for that
  storm; the page already linked it in two places (the WEATHER detail's tropical systems
  block, the map popup) but never showed the actual content. `publicAdvisory()` in
  `worker/src/index.js` fetches that URL (verified live 2026-09-04: no
  `Access-Control-Allow-Origin` header, same as everything else from `nhc.noaa.gov`, so
  through the worker), pulls the text out of the page's single `<pre>` tag, and
  `parseAdvisoryText()` turns the raw fixed-width bulletin into `{label, issued,
  headline[], sections:[{title,paragraphs[]}]}`. This is public domain federal text (17
  U.S.C. section 105), unlike HECO's press releases elsewhere in this file, which are
  only reproduced because HECO explicitly publish them for redistribution, so verbatim
  reproduction here needs no such justification.
  **Deliberately current-advisory-only, not a browsable archive.** NHC's archive of past
  numbered advisories (like `nhc.noaa.gov/archive/2026/ep12/ep122026.public.006.shtml`)
  is not a clean indexable list, and every other live feed on this page shows only the
  current state, not history; adding one would be a materially bigger, separate feature.
  **The headline lines are the one genuinely tricky part.** A bulletin's
  "...KEY MESSAGE..." lines are word-wrapped across 2+ source lines exactly like every
  paragraph below them, so they cannot be read one source line at a time: the label,
  issued-time, and NWS/"Issued by" office lines are dropped from the leading block, what
  is left is rejoined into flowing text, and only then are the "...span..." segments
  pulled out. Section bodies (SUMMARY OF.../WATCHES AND WARNINGS/DISCUSSION AND
  OUTLOOK/HAZARDS AFFECTING LAND/NEXT ADVISORY, the exact set varies advisory to
  advisory) are split into paragraphs on blank lines, each paragraph's own internal
  word-wrap collapsed back into one line, since the source is wrapped for a fixed-width
  terminal and this page's type is proportional Archivo, not monospace.
  `advisoryBlock()` in `index.html` renders it in `tropicalBlock()` (the WEATHER
  detail's tropical systems section), reusing the `.d-sec`/`.guide` heading-plus-prose
  pattern already established for the county power blocks rather than inventing new
  typography, with the headline styled like a warning (bold, `--warn`) since that is
  what it is. The original small "NHC advisory" link-out is kept only as a fallback for
  when the fetch or parse fails (`h.advisory` is null but `h.advisoryUrl` still is not);
  when the full text is available, a link to the original bulletin still sits at the end
  as a citation, so nothing about "read the primary source" is lost. `worker/test-parse.mjs`
  pins the parser against a real bulletin (Hurricane Lowell, Advisory 30, fetched live
  2026-09-04), not a synthetic fixture.
- **`/api/power?county=`** parses the newest Hawaiian Electric release **tagged to that
  county's island** for its outage count, and is now the only source the POWER band has:
  the hand-entered fallback was deleted 2026-08-28. When the newest release for an island
  carries no figure, it says so and names the date, never zero. Press releases are
  redistributable; the gated map API is not. Invariant 1 holds: it says "snapshot, not a
  live reading". See "Hawaiian Electric press updates" below before touching the parser,
  and run `node worker/test-parse.mjs` after.

Worker responses are `Cache-Control: private` on purpose; see `docs/worker-plan.md` for
why (the four-origin CORS trap).

**Removed 2026-08-19:** the FLOOD ZONE map layer and the WAVES map overlay (with its
colour legend) were taken out as not useful enough to keep. The TSUNAMI ZONE layer stays,
and the OCEAN-band wave *reading* (a number, from PacIOOS) stays; only the wave map
overlay went.

### The hazard zone layers

Two more map toggles, **TSUNAMI ZONE** and **FLOOD ZONE**, on every island. Off by
default. They draw the Hawaiʻi Statewide GIS hazard polygons so someone can see whether
their location sits in a tsunami evacuation zone or a coastal flood zone. This is the one
map data that exists for Oʻahu, Maui and Kauaʻi, where there are otherwise no live layers.

Source is the state's own `Hazards` MapServer, chosen the same way as everything else:
official, keyless, open CORS, statewide. Verified 2026-08-18.

    https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer
    layer 2  = Tsunami Evacuation Zones
    layer 15 = 1% Coastal Flood Zone with 3.2 ft sea level rise (statewide)

`loadHazard(k)` queries only the current map view (an envelope from `MAP.getBounds()`),
generalised with `maxAllowableOffset`, as GeoJSON in EPSG:4326, so the payload stays small
though the statewide geometry is huge. `setHazard(k,on)` toggles it; a debounced `moveend`
handler re-queries the active zones after a pan or an island change. Notes:

- **These are zones, not live readings.** A mapped tsunami evacuation zone is not an
  active tsunami warning; the flood layer is a planning layer, not a forecast. The popups
  say exactly that. Invariant 1 applies here too.
- **Own pane, like the radar.** The zones render in a `hazard` pane at z-index 350, above
  the basemap and radar and below the live incident markers, and outside the grayscale
  filter so the teal shows.
- **Invariant 5.** Queried only on toggle; nothing loads at render.
- Both zones are teal (the ocean-hazard colour), tsunami filled and flood dashed, so they
  stay on-palette and remain legible where they overlap.
- `loadHazard` carries a per-key request token (`hazSeq`) so a pan-triggered refetch can
  never remove a layer a newer request is about to place. On first island load the flood
  query can finish several seconds behind the lighter requests; that is load, not a bug.

### The radar layer

The map has a **RADAR** chip in the layer row (Oʻahu and every island). Off by default.
Turning it on overlays live NWS base reflectivity so someone can see the rain bands
approaching, not just the alert text.

Source is NOAA's symbolized radar MapServer, chosen the same way every other feed here
was: it is official (National Weather Service), keyless, sends an open CORS header, and
its extent covers Hawaiʻi. Verified 2026-08-18.

    https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/export

Implementation in `index.html`: `makeRadarLayer()` is a `L.TileLayer` subclass whose
`getTileUrl` builds one `export` request per tile, using the tile's own EPSG:3857 bbox so
the radar aligns with the basemap grid. `setRadar()` toggles it and runs a six-minute
refresh while it is visible. Notes for anyone touching it:

- **It must live in its own map pane.** The basemap tile pane carries `filter:grayscale(1)`
  for the single-tone look; a radar layer left in that pane renders grey instead of the
  green/yellow/red reflectivity scale. The layer uses a dedicated `radar` pane at
  z-index 250 (above the basemap, below the markers) with no filter. This was a real bug,
  caught and fixed 2026-08-18. Do not move the radar back into the tile pane.
- **Invariant 5.** The layer is built lazily on first toggle, so no NOAA request fires at
  render and a saved copy still opens offline. Keep it that way.
- No `crossOrigin` on the tiles: the overlay is only displayed, never read pixel by pixel,
  so it needs no CORS and cannot taint if a header is ever missing.
- **A clear sky draws nothing, which reads as a broken toggle.** This came up
  repeatedly. Two things answer it, both kept: `#radarnote` below the map explains in
  prose, and an on-map badge `#radarbadge` (top-right, under the expand button) shows a
  live status. `radarStatus()` fetches one NOAA export for the current view and reads the
  returned PNG's byte size (NOAA is CORS open): a clear frame is tiny, any echo is not, so
  the badge says **NO RAIN HERE** or **RAIN ON MAP** and updates on `moveend`. Text is
  kept short so it does not overlap the wrapped filter chips on a 375px map. Do not
  lengthen it. This is the honest fix: the layer proves it queried live data even when
  there is nothing to draw.
- The symbolized MapServer returns proper radar colours with no rendering rule. The
  sibling `radar_base_reflectivity_time` is an ImageServer (time-enabled, raw pixels); it
  would need a rendering rule to colour, so it was not used.

### The satellite layer (added 2026-09-03, on by default same day)

A **SATELLITE** chip, next to RADAR. The owner asked for the storms to look "more
dynamic/realistic" after the wind-radii/best-track/arrival-time additions turned out
too subtle to actually look different. Abstract shapes (cones, dots, rings) were never
going to answer that; real cloud imagery is the only thing that does. It shipped off
by default like every other map chip; the owner then asked for it on by default
instead, specifically so a first-time visitor sees real cloud cover immediately
without finding the chip. **`SAT_ON` starts `true`**, and `drawMap()` calls
`setSatellite(true)` the moment it creates the map (see the `if(!MAP)` branch), whether
or not a location is known yet. Toggling it off in the chip still works for that
session; nothing here persists, so it is back on at the next load, same as every other
map chip. See invariant 5 above: this is now one of the three hosts that load
automatically, not one of the three still gated behind a toggle.

- Source is NASA's GIBS (Global Imagery Browse Services), `GOES-West_ABI_GeoColor`.
  GOES-**West**, not East: GOES-East looks at the Americas/Atlantic, GOES-West is the
  satellite that actually covers Hawaiʻi and the Central Pacific. **Verified live,
  2026-09-03**, not just assumed from the docs: fetched an actual tile from a real
  cross-origin page and confirmed `response.type === "cors"` with a readable body (a
  blocked or key-gated source would come back opaque or fail outright). Got a real
  153KB/36KB PNG back both times, status 200, no API key, refreshes about every 10
  minutes (`layer-time-actual` in the response advanced from `18:40Z` to `18:50Z`
  between two test calls). GOES imagery is standard NASA/NOAA public-domain federal
  data, the same tier as the NWS/USGS/PacIOOS sources already wired.
- `SAT_SRC` is a plain WMTS REST tile template
  (`.../GOES-West_ABI_GeoColor/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`),
  so unlike radar (which needs a `getTileUrl` subclass to compute a bbox per tile) this
  is a standard `L.tileLayer`. Row/col order in the URL is `{TileMatrix}/{TileRow}/{TileCol}`,
  i.e. `z/y/x`, not Leaflet's usual `z/x/y`; the template spells that out explicitly.
  The literal `default` time value resolves server-side to the latest available frame,
  confirmed via the same live test.
- **Own pane, z-index 205**, just above the basemap tile pane (200) and below the
  wave/radar/hazard panes (240/250/350) and every marker. So it behaves like a base
  layer replacement: it is not caught by the basemap's `grayscale(1)` filter (the whole
  point is real colour), and the cone, track, wind extent, shelters and every other
  overlay still draw on top of it untouched.
  Opacity 1: GOES-West GeoColor is opaque source imagery (day true-colour, infrared
  blended in at night), so anything less than full opacity would just look washed out
  rather than like a real satellite view.
- `setSatellite()` follows the radar pattern: builds the layer lazily on first toggle
  (invariant 5), then refreshes every 10 minutes via `SATLAYER.setUrl()` with an
  incrementing `satStamp` query param, since Leaflet caches tiles by URL client-side
  regardless of the server's own `Cache-Control: no-store` header.
- No radar-style "clear day reads as broken" problem: satellite imagery always shows
  something (ocean, land, cloud), so there is no equivalent of `#radarnote` needed.

**Auto satellite by zoom, added 2026-09-04.** GOES-West's own `maxNativeZoom` is 7 (see
`SAT_SRC` above), so past that Leaflet is already just upscaling a blurry tile, not
showing real detail. The owner asked for the layer to turn itself off once zoomed to
island level and back on when zoomed back out, so it stays useful at the scale it
actually has resolution for rather than sitting on screen as a soft colour wash once
someone zooms in on their own roads. `satAutoZoom()` tracks a `satZoomBand` of `"wide"`
or `"local"` (the threshold is zoom 9, a couple steps past `maxNativeZoom` so satellite
is gone before the blur is obvious, and clear of the zoom-11 local view the located map
settles on) and only calls `setSatellite()` when that band actually changes, not on
every `zoomend` - so a manual toggle via the chip is not immediately fought while the
user stays within one band, it only gets corrected the next time they cross the
threshold. Hooked once via `MAP.on("zoomend",satAutoZoom)` at map creation. The initial
call at map creation runs `satAutoZoom()` instead of a bare `setSatellite(true)`, so a
located visitor who lands already at zoom 11 gets satellite correctly off from first
paint instead of on-then-immediately-corrected.

### The Hawaiian Electric map toggle (removed 2026-09-03)

There used to be a two-button toggle, **This map / Hawaiian Electric**, on the three
Hawaiian Electric counties, switching the map pane to HECO's own outage map page loaded
in an iframe (their real live map, not a clone, framed rather than scraped because their
outage data is bearer-token gated and their terms forbid republishing it, see Known
gaps). The owner asked for it removed, along with every link this page carried straight
to Hawaiian Electric's outage map: `HECOMAP`, `syncMapSrc()`, `setMapSrc()`, the
`#mapsrc`/`#hecoframe`/`#hecoIframe` markup and CSS, and the three `RES` entries
("Oʻahu outage map" etc.) that linked out to it from the Sources section are all gone.
KIUC's own outage center link (Kauaʻi, not Hawaiian Electric) is untouched, it was never
part of this.

**This did not touch the POWER outage-count feature.** That is a different thing: the
worker still parses Hawaiian Electric's newest press release per island and the "Hawaiian
Electric newsroom" citation links in that feature stay, because those are a source
citation for a number, not a link to their gated outage map. See "Hawaiian Electric press
updates" below. POWER itself is already off the board and unroutable (see "POWER removed"
above), so this cleanup only removed dead surface area, not live functionality.

Note for whoever touches `.mapwrap` next: it used to leave a grey gap under it on desktop
at some widths, because a base `.mapwrap{height:360px}` rule sat after the desktop
`height:auto` rule in source order and won the cascade. Do not reintroduce a fixed
`height` on `.mapwrap` at desktop widths.

### The weather forecast widget (added 2026-09-04)

Beyond active alerts, the WEATHER card now carries an actual forecast: current
conditions, the 7-day text forecast, and the next 12 hours, plus a per-island
snapshot on the home page before anyone has picked a location. All of it comes
from `api.weather.gov`, the same host the alerts already use: public, keyless,
CORS open (`Access-Control-Allow-Origin: *`, verified live 2026-09-04). No new
external host, no worker involvement, this is a page-side fetch like the
alerts already are.

- **Grid cell comes from the nearest island's own hardcoded `gx`/`gy`, not a
  fresh `/points` lookup.** Same reasoning as the forecast zone (`z`) already
  hardcoded per `ISLANDS` entry: `/points` is the request most likely to
  fail, and this is enhancement on top of the page, not the safety-critical
  alerts path (which still does its own live `/points` lookup and always
  will). Verified live 2026-09-03 against each island's own coordinates; all
  six resolve to office `HFO` (Honolulu), just different x/y.
- **`loadWeather()`** (in `index.html`) fetches `/gridpoints/HFO/{gx},{gy}/forecast`
  and `/forecast/hourly` for the located state, plus `currentConditions()` for
  a best-effort current-conditions reading. Cached once per location like the
  gauge and wave readings (`WX` stays `null` while loading, `false` only if
  the forecast fetch itself fails outright; a current-conditions miss does
  not fail the whole thing, see below).
- **`currentConditions()` tries up to the 3 nearest stations, not just the
  closest one.** Verified live 2026-09-03: Honolulu Airport (PHNL), the
  *first* station for most of Oʻahu, was reporting `null` for temperature,
  humidity and wind at the time, while a station further down the list
  (PHKO, Kona) had real numbers. NWS observation values are metric
  (`degC`, `km_h-1`), converted to °F/mph on the way in; `textDescription` is
  taken as-is. A station that returns no numeric temperature is skipped in
  favor of the next one; if none of the 3 have a reading, current conditions
  are simply absent from the card, same honest-empty-state rule as
  everything else here, not an error state.
- **`forecastBlock()`** renders all three pieces in `panelWeather()`'s detail
  view, reusing the existing `.d-sec`/`.d-area`/`.d-eta` pattern already
  established by `gaugeBlock`/`waveBlock` rather than inventing new visual
  language.
- **`loadHomeWeather()` / `renderIslandWx()`** give the home (pre-location)
  state a lightweight per-island snapshot: just today's forecast period, one
  fetch per island (no station lookup, that would be 6 more round trips for a
  page nobody has located yet), rendered as a tile grid under the map
  (`#islandWx`), reusing the `.d-stats`/`.d-stat` tile pattern from the
  detail pages under its own class name (`.islandwx`) so the column count can
  flex for six tiles instead of three. Hidden once a location is picked or
  the map is expanded, same visibility rule `#bands` already follows.
  Fetched once at boot independent of `setLoc`, since this is home-state
  content with no equivalent in the located flow.
- **Band order changed the same day, at the owner's direction: WEATHER now
  leads, POWER moved down** (`BANDORDER` in `index.html`). This only reorders
  the band cards on the board and the map's filter chips, both of which sort
  against `BANDORDER`; it does not touch any band's own color (`CATCOLOR`/
  `BANDCOLOR` are keyed by category name, not position), so "band colour is
  fixed per category" (see Design rules above) still holds exactly as before.
- **POWER removed from the board entirely, 2026-09-03, at the owner's
  direction: the HECO outage feed is unreliable and there is no way to fix
  it.** `BANDORDER` no longer lists `"POWER"`, so `buildBands()` never builds
  a POWER card and `route()` no longer matches `#power` (it only opens a
  detail page for a hash that is in `BANDORDER`), so the POWER detail view is
  unreachable too. `loadPower()`, `panelPower()` and the `powerLive()`/
  `powerQuiet()` helpers are left in place rather than torn out: they are now
  dead code from the UI's perspective, harmless, and ripping out a working
  parser and its worker endpoint for a one-line ask wasn't worth the risk. If
  POWER is ever fully retired, remove those too. **ROADS was asked to be
  removed as well, then kept** ("Keep Roads then, but put it lower") since it
  carries real live HCCDA data for Hawaiʻi County even though it is empty
  elsewhere; it moved from 3rd of 5 to 3rd of 4, just above EMERGENCY.
  `BANDORDER` is now `["WEATHER","OCEAN","ROADS","EMERGENCY"]`.

### Plan, Kit and Sources became one PLAN page (2026-09-03, superseded same day)

First pass: Plan, Kit and Sources were converted from three `<details
class="fold">` accordions into three separate `.band`-styled cards, still
expanding in place. The owner then looked at it running locally and said
that was not the ask: three cards at the bottom still read as clutter
("that is awful"), and the ask was for one **PLAN** card that routes to a
real page, the same way WEATHER/OCEAN/ROADS/EMERGENCY do, with Plan, Kit and
Sources all living on that one page. `hurricane-kit-checklist.html` (see
SEO section) gets promoted to its own second card, **CHECKLIST**, since a
real separate indexable page is what actually helps SEO here.

`#more` now holds exactly two plain `<a class="band sev-clear">` links, no
`<details>` involved: PLAN goes to `#plan` (hash routed, like every live
band); CHECKLIST goes straight to `/hurricane-kit-checklist.html` (a real
page, not a hash route). Both reuse the exact `.band-top`/`.band-lab`/
`.band-arw`/`.band-body`/`.band-h` markup the live bands use, so no new CSS
was needed for them, they are `a.band` like everything else. The `.prep`
class and its hover/rotate rules from the first pass are gone along with
the `<details>` markup they styled.

**PLAN is a routed page, but it is not a hazard band.** It carries no
severity color, no map layer, and does not belong in `BANDORDER` (which
also drives the map's filter-chip sort, and PLAN has nothing to sort there).
Routing now checks a separate `ROUTES` array (`[...BANDORDER,"PLAN"]`)
instead of `BANDORDER` directly. `bandOf()`'s fallback and `metaWord()` both
special-case `cat==="PLAN"` (a plain header line and "REFERENCE" instead of
a fabricated severity/status word) since PLAN never appears in the `BANDS`
array `buildBands()` produces. `panelPlan()` returns three empty containers
(`#plan`, `#kit`, `#sources`/`#resources`); `renderPage()` fills them in
right after the containers are actually attached to the document, the same
pattern `renderShelters()` already used for EMERGENCY, because the render
functions target these ids directly and the ids do not exist until the page
markup is inserted. The kit checklist's checkbox rendering became a
function, `renderKit()`, called the same way, since `#kit` now only exists
while the PLAN page is open rather than sitting permanently in the DOM; its
change listener is delegated onto the persistent `#pages` container instead
of binding to `#kit` directly, so it survives every re-render without
rebinding. `setLoc()` no longer eagerly renders Plan/Kit/Sources into
always-present DOM nodes on every location change, since `route()` already
calls `renderPage("PLAN")` whenever the `#plan` hash is open, the same way
every other detail page rebuilds itself from current state on each route.

The footer's own "Hurricane kit checklist" link is removed now that
CHECKLIST is a proper home page card; the footer goes back to just the
disclaimer and the NWS Honolulu credit.

**The `#mapnote` paragraph under the map is removed**, per "the page ends
after the Hurricane card": both the `<p id="mapnote">` element and the block
in `drawMap()` that filled it in (explaining what the map does and doesn't
show) are gone. `#radarnote` is untouched, it is a different element that
answers a different question (why a clear-sky radar toggle draws nothing)
and stays.

### Fetching alerts: query the point AND the zone

This is the most important thing in this file. Getting it wrong hides hurricane warnings.

`GET /alerts/active?point={lat},{lon}` is **not sufficient on its own.** When an alert
carries a polygon, the API matches the polygon rather than the zone, so an alert issued
for an entire forecast zone can miss a point that sits inside that zone.

Verified live during Hurricane Lala on 2026-08-15: the Hurricane Warning for Big Island
East (HIZ053) had a polygon that excluded Hilo, and the Tropical Storm Warning for Maui
Leeward West (HIZ018) excluded the Lahaina point. A point-only query dropped both. A
Hilo user in an active Hurricane Warning saw "Flood Watch" as their top card.

Always query **both** and merge, de-duplicating on the alert `id`:

    /alerts/active?point={lat},{lon}
    /alerts/active?zone={forecastZone}

The point query still earns its place. It catches sub-zone products such as Flash Flood
Warnings and Flood Advisories that the zone query does not return. Dropping either half
loses real alerts.

### County zone mapping

Verified against the live API. The API's own zone *names* are malformed
("Oahu in Honolulu", "Niihau in Kauai"), so always use these codes with our own labels.

| Zone | County | Islands |
|---|---|---|
| HIC001 | Hawaiʻi County | Hawaiʻi Island |
| HIC003 | Honolulu County | Oʻahu |
| HIC007 | Kauaʻi County | Kauaʻi, Niʻihau |
| HIC009 | Maui County | Maui, Molokaʻi, Lānaʻi, Kahoʻolawe |

Use the county zone only to pick which county's cards to show.

### Forecast zones per island button

There are 43 finer public forecast zones. Each entry in `ISLANDS` carries the one that
contains its coordinates, so the zone query does not depend on a live `/points` lookup,
which is the request most likely to fail in the conditions this app exists for.
`/points` remains the fallback for the geolocation path.

| Island button | County | Forecast zone |
|---|---|---|
| Oʻahu | HIC003 | HIZ033 |
| Hawaiʻi Island | HIC001 | HIZ053 |
| Maui | HIC009 | HIZ018 |
| Molokaʻi | HIC009 | HIZ041 |
| Lānaʻi | HIC009 | HIZ015 |
| Kauaʻi | HIC007 | HIZ030 |

If an island's coordinates change, re-verify its zone against `/points` and update both.

### Live layers currently wired

Several external hosts are called at runtime now, not one. The file still renders
fully offline; these only fill in.

- `api.weather.gov` for alerts. See the point-and-zone note above.
- `waterservices.usgs.gov` for USGS gage height, keyless, CORS open. Queried by
  bounding box around the location, `parameterCd=00065`, `period=PT3H`, so the
  three hour trend is derivable. **A gage reading is not a flood forecast** and the
  page says so. Flood categories would need NWS AHPS, which is not wired.
  Loaded only when the Weather view opens, because the payload is ~160KB.
- `pae-paha.pacioos.hawaii.edu` (PacIOOS ERDDAP) for **open-ocean wave height**,
  keyless, CORS `*`. The `ww3_hawaii_lon180` WaveWatch III model, queried for a
  small box around the location; `loadWaves` takes the nearest cell with a value,
  since land is masked. Feeds the OCEAN band sub-line and a reading in the OCEAN
  detail. **It is a model forecast, not an observation, and open-ocean height is
  not surf height at a beach** (which runs larger); the copy says both. Time is an
  explicit current timestamp that ERDDAP snaps to the nearest model hour, because
  this ERDDAP does not accept `(now)`.
  A **WAVES map toggle** draws the same model as a coloured overlay: `drawWaveOverlay`
  requests one ERDDAP `transparentPng` per map view (not per tile, to stay light on
  PacIOOS), forced to `.size=512|512` so it stays sharp at any zoom, and places it as an
  `L.imageOverlay` refetched on `moveend`. It lives in its own `wave` pane at z-index 240
  (above the basemap, below radar, hazards and markers) so the basemap grayscale filter
  does not touch it, and it swaps frames on image `load` so there is no gap. Land is
  masked, so the island shows through. Palette is ERDDAP **Rainbow2**, a full rainbow
  (purple/blue calm, green/yellow building, orange/red high surf), chosen over Rainbow
  because Rainbow's violet low-end dominated and made calm water look alarming. On a
  typical calm day the map reads blue because the seas are all low values; the warm end
  only shows in real high surf, which is the right danger signal. On-demand like radar and
  the hazard zones, so invariant 5 holds. `#wavenote` is a colour legend shown when the
  layer is on: a CSS `linear-gradient` bar whose stops were sampled from ERDDAP's own
  Rainbow2 colorbar (`#80007f` at 0 ft through blue, cyan, green, yellow to `#820200` at
  16+ ft) so the legend matches the map exactly, labelled 0 to 16+ ft, calm to high surf.
  If the map palette ever changes, re-sample and update the gradient stops together.
- `services1.arcgis.com/C2LPusZs5OXNGFDn` for **Hawaiʻi County Civil Defense**.
  Public, keyless, CORS open, and edited by county staff during an event.
  Currently used: `Road_Closures_(HCCDA)_Public` filtered to `Active='Active'`,
  and `Emergency_Shelters_(HCCDA)_Public` with its `Status` field.
  Also available and not yet wired: Hazards, Evacuations, Flooding, School
  Closures, Fire Locations, DWS Water Shut Off Notices, Water Spigots.
  Entry point is the Hazard Impact Map dashboard already linked in `COUNTIES.HIC001`.

**This is Hawaiʻi County only.** Honolulu, Maui and Kauaʻi publish static geodata
(tsunami zones, flood zones, shelter locations) but no live incident layers.
Those counties must keep the no feed state rather than a false all clear.

The shelter layer carries a `Status` of Open, Closed or Pre-Identified. It is
rendered as **"listed open"**, never "open", with the layer's own
`editingInfo.dataLastEditDate` attached and a stale flag past six hours. It was
28 hours old during an active event on 2026-08-18, which is exactly why the flag
exists. Invariant 1 applies to a county roster the same as to a news report.

### Hawaiian Electric press updates (fully automatic since 2026-08-28)

The one Hawaiian Electric channel this page can legitimately carry. HECO publishes
dated restoration updates to `hawaiianelectric.com/about-us/newsroom`, linked from a
site-wide banner and mirrored as a PDF under `/documents/about_us/news/{year}/`. Press
releases are published for redistribution, which the token-gated map API is not.

**Nothing here is hand-entered.** The `POWERREPORTS` array was deleted on 2026-08-28,
along with `powerReport()` and `powerReportOK()`. It had sat at "more than 91% of
customers statewide had power" for ten days, which is exactly the failure the rest of
this file warns about. Do not reintroduce a hand-maintained array; fix the parser in
`worker/src/index.js` instead.

**HECO tag every release to the islands it concerns** and expose that as a newsroom
filter, so each county is answered from its OWN newest release rather than from
whatever went out last. This is the key to the whole thing:

    cat=34 Oahu    cat=35 Maui County    cat=36 Hawaii Island

Three traps, each found in a real release. The regression test in
`worker/test-parse.mjs` pins all of them; run it after touching the parser.

1. **Never infer statewide from silence.** The 2026-08-20 4 p.m. release reads
   "...restored on Hawaii Island. Currently, about 13,000 are without power." Read
   alone that is a statewide claim; with the previous sentence it is Hawaiʻi Island.
   Scope resolves from the sentence, then its neighbours, then the release's island
   tags, and is left **null** rather than guessed.
2. **Never loosen the per-county breakdown match past `about|approximately`.** HECO
   print outage phone numbers in the same shape, `Hawaii Island: 1-855-304-9191`,
   which a looser pattern reads as a count of 1.
3. **The number does not follow the county heading.** On 2026-08-18 Maui County's
   heading was followed by two sentences of prose before "About 2,100 remain without
   power". `countyBreakdown()` parses the island's whole section, capped at 600 chars.

**HECO publish no statewide outage total.** Verified across all ten Lala releases.
Peak-phase releases give a per-county breakdown; recovery-phase releases give one
island's figure. So the board shows this county's number as the headline and the other
counties HECO named in the sub-line. **Do not sum their county numbers into a statewide
figure**: it would present our arithmetic as their number, and undercount whenever they
list only some islands.

**A count scoped to another island is deliberately not returned.** This county's newest
tagged release can be days behind that island's own newest one. On 2026-08-28 the
Oʻahu-tagged release still said 6,390 for Hawaiʻi Island while the live figure there was
under 400. HECO's site-wide event banner carries the same "something is happening
elsewhere" signal and is current, so `eventActive` / `eventHeadline` is used instead.

The four states the page renders, and why the last two differ:

| State | When | Band |
|---|---|---|
| `live` | HECO published a figure for this island | the number, sourced and timed |
| `quiet` | HECO published, but nothing about this island | "No storm outages reported for X", plus when they last spoke |
| KIUC | Kauaʻi, not HECO territory at all | no-feed panel |
| unreachable | the worker did not answer | "not loading", explicitly not a reading |

**The `quiet` state is the one most easily rendered dishonestly.** HECO issue releases
for storms and major events, never for quiet days, so no release is absence of evidence
and not evidence of absence. It must never read "no outages", and it always names the
date HECO last published for that island. Invariants 1 and 6. This wording was proposed
as a flat "no weather or incident related power outages" on 2026-08-28 and deliberately
changed to attribute it to HECO instead.

- **Kauaʻi is KIUC, not Hawaiian Electric.** The worker returns `utility: "KIUC"` and
  the county keeps the no-feed state. It must never get a HECO figure.
- Molokaʻi and Lānaʻi are Maui County, so they inherit `HIC009`.

### Sources that resist automation

- `p.veoci.com/hnlshelter` and `p.veoci.com/hnlevac` are public but render client-side
  and are tagged noindex. Link out. Do not scrape, do not iframe.
- `honolulu.gov/hurricaneevac` blocks automated access. Link out only.
- `kauai.gov` returns 403 to scripted requests but loads normally in a browser. A 403
  from curl does not mean the link is broken. Check in a real browser before removing it.

### Vetting a new external link

Every county link in the plan panel was checked two ways before it shipped. Do the same:

1. Confirm it returns a live 200, following redirects, with a browser user agent.
2. If it is an ArcGIS item, confirm provenance through the item API rather than trusting
   the URL. An `arcgis.com` address proves nothing about who published it.

       https://www.arcgis.com/sharing/rest/content/items/{id}?f=json

   Check `owner` is a `.gov` account, `access` is `public`, and `modified` is recent.
   The Hawaiʻi County maps are owned by a `hawaiicounty.gov` GIS admin account, the
   Kauaʻi refuge viewer by a `kauai.gov` account. (Owner addresses are visible in the
   ArcGIS item JSON; check the domain rather than hard-coding the address here.)
3. Watch for staging hosts in search results. `dev-dod.hawaii.gov` and `dod80.hawaii.gov`
   both surface for HI-EMA queries and neither is canonical. `dod.hawaii.gov` is.
   The frequently cited `dod.hawaii.gov/hiema/know-your-tsunami-zones/` is a 404.

Neither Maui nor Kauaʻi publishes a public address-lookup app, so both use NOAA's
`tsunami.coast.noaa.gov`, which takes an address or current location and covers all
islands. MEMA points residents there themselves.

## Direction change (decided 2026-08-21, plan of record)

The owner adopted an action-first home layout plus hand-curated resource,
pet/animal, and recovery directories, and **reversed the "only self-managing
feeds" rule for evergreen directory entries** (per-event hand-entered status
stays ruled out). The five action buttons sit above the existing board; nothing
current is removed, and the architecture (single file, no build, no runtime
backend) does not change. Full phases, schema, constraints and the list of
brainstorm recommendations deliberately NOT implemented are in
`docs/expansion-plan.md`. Read it before building. Where it conflicts with the
section below, it wins.

## Planned additions (decided 2026-08-19, not yet wired)

The owner reviewed a full list of candidate data sources and set one rule: **only
self-managing feeds get added**, sources that populate when an event starts and empty
when it ends with no hand entry. Hand-entered categories that were considered and
**rejected as ongoing upkeep**: BWS/DWS water status, statewide school closures, FCC
DIRS cell-site counts, transit suspensions. Do not re-propose them as REPORTS-pattern
entries; the decision was deliberate.

The shortlist, each verified against the live endpoint on 2026-08-19. Full findings,
endpoints, field names and copy caveats are in `docs/feed-verification.md`. Read that
file before wiring any of these.

- **FEMA/Red Cross open shelters** (`gis.fema.gov`, NSS OpenShelters layer). The first
  live shelter source for Oʻahu, Maui and Kauaʻi. Returned a real Hawaiʻi record
  during Lala recovery. Renders as the existing shelter cards ("listed open",
  confirm band, stale flag) and 22px map pins. Open-shelters-only feed; a quiet day
  is honestly empty, never all clear.
- **NWS NWPS flood stages** (`api.water.noaa.gov`). Joins to the USGS gauge rows
  already shown, adds action/minor/moderate/major thresholds and per-stage impact
  statements. ~40 gauges on Oʻahu alone. Tag on gauge rows in the WEATHER detail,
  one WEATHER band line when a nearby gauge is at or above a defined category.
- **NOAA CO-OPS observed water level** (`api.tidesandcurrents.noaa.gov`). One tide
  station per island, observed vs predicted. OCEAN band sub-line and a reading block
  in the OCEAN detail, the observation counterpart to the PacIOOS model.
- **Wind arrival timing** (`api.weather.gov` gridpoint hourly, host already wired).
  First hour crossing 39/58/74 mph. One WEATHER band line, small threshold block in
  the detail. Resolve grid ids once per `ISLANDS` entry and hardcode, like the zones.
- **Unwired HCCDA layers** (org already trusted): evacuations, water spigots, school
  closures. Big Island only.

Static additions agreed in principle, no feed involved: per-island emergency radio
frequencies (verify against HI-EMA before shipping; drafts in this session were
placeholders), pet/ADA attributes on shelter cards (NSS carries the fields), the kit
checklist regrouped under T-48/T-24/T-12 with the computed lead time highlighting the
current group, and an "after the storm" fold for a hand-flipped recovery mode.

**The gate before wiring: CORS is expected but not verified.** The verification
tooling could not read response headers. `docs/feed-verification.md` has a console
snippet to run once on 808alerts.com; record the results there first.

**Parked: GoAkamai / HDOT closures.** No public terms found, no CORS at source. Would
need the worker plus HDOT's explicit OK. The HECO lesson applies: the blocker may be
terms, not transport. Contact HDOT before any work.

Pending owner sign-off, do not build without it: whether a gauge dot may change
colour above flood stage on the map (severity colour was rejected once at band level;
a map marker is arguably different, but ask), and the visual hierarchy between HCCDA
evacuation polygons and NWS alert polygons, which are both red areas and will overlap
mid-event.

## SEO (started 2026-09-04)

The realistic framing: for head terms like "hurricane hawaii" this page is never going
to outrank NHC, HI-EMA, the Star-Advertiser or Google's own weather box, all of which
have either official authority or a long head start. The winnable ground is narrower:
being genuinely useful and shareable during an event, and ranking for evergreen
planning queries (kit checklist, shelter directories, evacuation zones) that face far
less competition than "is there a hurricane right now."

**Added 2026-09-04, no architecture change needed:**

- `<link rel="canonical">`, Open Graph (`og:type`/`og:site_name`/`og:url`/`og:title`/
  `og:description`) and a Twitter Card (`summary`, no image). All in `index.html`'s
  `<head>`.
- `robots.txt` and `sitemap.xml` at the repo root, both deployed automatically since
  Cloudflare Pages serves the repo root as-is. `sitemap.xml` currently lists exactly one
  URL, `https://808alerts.com/`, because that is currently the only URL that exists, see
  the routing note below.
- One `WebSite` JSON-LD block in `index.html`. **Deliberately `WebSite` only, not
  `SpecialAnnouncement` or any live-alert schema.** Structured data here is static HTML,
  shipped identically to every visitor with no build step and no server render; a
  schema block claiming a specific watch or warning is active could not be kept
  accurate as that alert changes or expires, which is exactly the stale, misleading
  assertion invariant 1 exists to prevent. If per-alert structured data is ever wanted,
  it has to be injected client-side from the same live alert data the page already
  renders from, not hand-authored statically.

**Favicon and `og:image` shipped 2026-09-03, sourced from the owner.** The owner
supplied the mark directly (a shaka hand on a rounded warning triangle, amber
fill, close enough to `--advis` `#e8a317` that it reads as the site's own
amber, not a sixth color), so the design rule against inventing a mark without
asking does not apply here, the mark was given, not invented. Two crops of the
same source image, both processed with ImageMagick in the sandbox (`convert
... -resize ... -strip`):
- **Favicon**: a 32×32 PNG, stripped of metadata (989 bytes), inlined as a
  `data:image/png;base64,` URI on `<link rel="icon">` in both `index.html` and
  `hurricane-kit-checklist.html`. Same inlining rule as the font and Leaflet;
  invariant 5 holds, zero extra request at render.
- **`og-image.png`**: a 600×600 PNG at the repo root (`og-image.png`), palette
  reduced to 16 colors (21.6KB) since the source art is flat amber and white
  with no gradients to lose. `og:image`/`twitter:image` point at it by full
  URL in both HTML files. This is a real separate file, not inlined: social
  crawlers fetch OG images by URL, a data URI is not reliable there, and
  `robots.txt`/`sitemap.xml`/`hurricane-kit-checklist.html` already establish
  that separate static files alongside `index.html` are normal for this repo.
  `twitter:card` stays `summary` (square-image card), which fits a square
  source image without cropping.

**Putting the mark next to the wordmark in the brand bar was tried and reverted, same
day.** It briefly sat inline before `808<i>ALERTS</i></span>` via a `.mark-row` wrapper;
the owner looked at it and asked for it back out ("looks bad"), so the header goes back
to text-only `.mark`. The favicon and `og-image.png` above are unaffected, this was the
header placement only.

**First evergreen content page shipped 2026-09-04: `hurricane-kit-checklist.html`.**
Its own real static HTML file at the repo root, its own `<title>`/description/canonical/
OG/Twitter tags, and a `HowTo` JSON-LD block. Same 5-color palette and 0-radius/no-shadow
rules as the app, but does not inline the Archivo base64 font (a system UI font stack is
used instead, so this page does not carry the ~64KB font payload the app pays for once);
no live data, no fetches, just the kit list and the step-2 refuge-area guidance, both
lifted verbatim from the app's own `KIT` array and `renderPlan()` so the two never drift
apart in wording. Linked from the app's footer, and listed in `sitemap.xml`. This is the
template for any further pages of this kind (a shelter directory page is the obvious
next one); before adding another, check `KIT`/`renderPlan()`/etc. for the current wording
rather than re-describing it from memory.

**Still open: hash routing blocks per-section indexing of the app itself.** The board
uses `#weather`/`#power`/`#roads`/`#ocean`/`#emergency` client-side routing with no real
server-distinguishable URLs, so Google sees exactly one URL and one title/description
no matter what a visitor is looking at. Queries like "Maui evacuation shelters" or
"Oʻahu power outage map" would ideally be their own indexable page with its own title,
but cannot be under the current routing. The evergreen content pages above are a
separate, already-shipped answer for planning-type queries; this is specifically about
the live app's own sections. Options, genuinely open, including ones that add a build
step if that is what serves the site best:

- Give the app's own sections real URLs (`/weather`, `/power`, etc.) instead of hash
  fragments, with each route's own real HTML and its own `<title>`/description.
- A static site generator or build step producing multiple pre-rendered pages, if that
  turns out to be the best way to get real per-page metadata without hand-maintaining
  duplicate HTML files.

Not decided, and deliberately not pre-narrowed to whichever option avoids a build step.

## Deployment

**Single host, Git-connected, one command: `git push`.** Changed 2026-09-03: the two
staging directories and the manual wrangler/vercel deploy steps were replaced with
Cloudflare Pages' own Git integration. This was a deploy-mechanics decision, not a
statement that the site's architecture can never use a build step; see SEO above for an
open question that may need one. Host is **Cloudflare Pages**, project `808alerts`,
connected directly to the `shaunagits/808alerts` GitHub
repo. A push to `main` deploys automatically; there is no manual `wrangler`/`vercel`
step, no staging directory, and no file to rename before deploying, because `index.html`
already sits at the repo root and Cloudflare Pages serves the repo root as-is with no
build command.

**Vercel is retired.** It was kept as a live mirror behind a second manual deploy step;
that was exactly the complexity being removed here. `808alerts.vercel.app`,
`808alerts-shaunagits-projects.vercel.app` and `hawaii-storm-info.vercel.app` may still
resolve to whatever was last deployed there, but nothing updates them any more. Treat
them as dead links, not a live mirror, until someone either deletes the Vercel project
or explicitly decides to wire it back up.

**One-time cutover, not yet done as of this writing.** The existing `808alerts` Cloudflare
Pages project was created with `wrangler pages deploy` (a Direct Upload project), and
Cloudflare does not support converting a Direct Upload project to Git-integrated in
place. The path that avoids downtime:

1. In the Cloudflare dashboard, Workers & Pages -> Create application -> Pages ->
   Connect to Git. Pick the `shaunagits/808alerts` repo, branch `main`.
2. Build settings: framework preset **None**, build command **empty**, build output
   directory **`/`** (repo root). No environment variables needed.
3. This creates a **new** project (it cannot reuse the name `808alerts` while the old
   one still exists, so name it something like `808alerts-live` for now). Confirm it
   deploys correctly at its own `*.pages.dev` URL before touching anything live.
4. Once confirmed, move the custom domains: add `808alerts.com` and `www.808alerts.com`
   as Custom Domains on the new project. Cloudflare will prompt for any DNS change
   needed; since the zone is already Cloudflare-proxied this is usually automatic.
5. Remove the custom domains from the old Direct Upload project, then delete it (or
   leave it paused as a fallback for a few days before deleting).

`*.pages.dev` subdomains are assigned once at project creation and cannot be renamed or
reused, which is why this goes through a second project rather than converting in place.

Confirm the deployed bytes with a sha256 against the source rather than trusting a green
deploy:

    curl -s https://808alerts.com | sha256sum
    sha256sum index.html

After a deploy, the custom domain can briefly serve the previous build while the
project's own `pages.dev` already has the new one. Poll until the sha matches rather
than judging by the first reload.

## Conventions

- Plain HTML, CSS and vanilla JS. Do not introduce a framework or a bundler.
- No `localStorage` or `sessionStorage` in the artifact-preview path. If adding offline
  caching, guard it in try/catch so it degrades silently.
- All user-facing strings escaped through the existing `esc()` helper.
- No em dashes in user-facing copy.
- Commit messages describe the change only. No tool or AI attribution anywhere in the
  repo, commits, or code comments.
- Test at 375px width. Check that no element's box crosses the viewport edge, and
  separately that content is not flush against it. A zero overflow count still permits
  text sitting on the bezel, which has happened twice.

## Known gaps

Ordered by how much they matter. Verified 2026-08-18.

- **Live incident data is Hawaiʻi County only.** HCCDA publishes road closures,
  hazards, evacuations, flooding, shelters, school closures and fire locations.
  Honolulu, Maui and Kauaʻi publish static geodata only. So the map and the ROADS
  and EMERGENCY bands are rich on the Big Island and empty on the other three, where
  they correctly fall back to the no feed state. On Oʻahu the only live layer is
  stream gauges. This is the single biggest coverage gap. The FEMA/Red Cross open
  shelters feed (see Planned additions) is the first verified live source for the
  other three counties.
- **Power outages have no machine feed, but the page is no longer empty and no longer
  hand-maintained.** Since 2026-08-28 the worker parses Hawaiian Electric's newest
  island-tagged press release automatically. See "Hawaiian Electric press updates" under
  Architecture. The ceiling is real and worth restating: **press releases only exist
  during an event.** Between events HECO publish no public outage count anywhere, so the
  band correctly shows no number on a quiet day. Everyday outages are invisible to this
  page and always will be without HECO's permission.
  There is still no legitimate free *feed*. Researched
  2026-08-17, 2026-08-18 and re-verified 2026-08-18 against the live hosts.
  **A worker cannot get the outage counts from HECO's own API.** An earlier plan assumed
  "CORS is a browser policy, not an access control", so a server-side worker would sail
  through. That premise is false for this API: the blocker is authentication, and
  separately the terms. A worker is still the right tool for hurricane data and for a
  *licensed* outage feed (see `docs/worker-plan.md`); it just cannot legitimately pull
  HECO's outage numbers, no matter where it runs.
  - The map at `/safety-and-outages/power-outages/{oahu,hawaii-island,maui-county}-outage-map`
    embeds a Blazor WASM app from `outagemap-heco.azurewebsites.net/heco`. Its
    `appsettings.json` is public and names both back ends:

        OutageApiClient.BaseUrl       https://outagemap-api-heco.azurewebsites.net/  v1
        AccessTokenApiClient.BaseUrl  https://ext-access-heco.azurewebsites.net/     v1

  - **The outage API is bearer-token gated.** `GET outagemap-api-heco.azurewebsites.net/api/v1/outages`
    from a plain server side request, no `Origin` header at all, returns
    `401 Unauthorized` with `WWW-Authenticate: Bearer`. The 400 origin error seen
    on 2026-08-17 was the second gate, not the only one.
  - The token comes from a private key service. `ExternalPublicAuthentication.Client.wasm`
    in the app's `_framework/` describes itself as a "Client library that retrieves
    and caches Access Tokens from the External Access Key Service", with
    `IAccessTokenService`, `ExternalAccessTokenHandler` and `AddExternalAccessTokenToRequests`.
    A collector would have to replicate that token flow and forge an allowlisted
    `Origin`. That is defeating an access control, not sidestepping a browser policy.
  - **HECO's terms of use forbid the republishing regardless.** They grant permission
    "to copy and display the content of this website for your personal, noncommercial,
    informational use only" and state "You may not distribute, publish, transmit,
    modify, create derivative works from, or in any way exploit any of the content,
    in whole or in part, for any purpose." Putting outage counts on 808alerts.com is
    distributing and publishing that content. `robots.txt` is not the constraint here
    and does not disallow these paths; the terms are the constraint.
  - PowerOutage.us and ORNL's EAGLE-I are **not a precedent this site can copy.**
    EAGLE-I is a federal DOE/ORNL programme and PowerOutage.us sells licences; both
    operate on a footing a small public site does not have. "Other sites pull from it"
    was the basis of the old plan and it does not survive contact with either gate.
  - **"Collect it but do not republish it" does not unlock this, asked 2026-08-28.**
    It answers the wrong gate. The terms are the softer of the two, and a bare outage
    count is a fact rather than their creative expression, so the copyright half is
    genuinely weak. But the API returns `401` with `WWW-Authenticate: Bearer` to every
    request from anywhere, published or not, so collecting it at all means replicating
    their private token service and forging an allowlisted `Origin`. That is defeating
    an access control whatever is done with the result. And a number that is collected
    but never displayed does nothing for this page; the moment it helps a user, it is
    being published. Do not revisit this framing.
  - The **only remaining legitimate route is HECO's own permission**, an access key
    or a data-sharing agreement. The owner ruled that out on 2026-08-17, but that
    call was made when the blocker looked like a CORS allowlist. It is worth
    revisiting now that it is the only door left.
  - ODIN (ORNL/DOE) is the right shape, an open API with per incident records, but
    covers 34 states and **not Hawaiʻi**. EAGLE-I is county level but published as
    annual historical datasets, not real time.
  - PowerOutage.us covers Hawaiʻi live by county and utility, but its API terms say
    internal use, no public redistribution. It needs a commercial licence.
  - KIUC (Kauaʻi, not HECO) points at `kiuc.outagemap.coop`. Not investigated as a
    feed. Same two questions apply before anyone tries: auth, and terms.
  - Checked and ruled out 2026-08-18, so nobody repeats them: HECO's own public
    ArcGIS account (`tomoko.acoba@hawaiianelectric.com_HECO`, org `gfBpz2hbsVDgru6D`)
    publishes 23 services, all PSPS shutoff zones, EV load and grid planning, **no
    live outages**. HI-EMA's ArcGIS org (`aKxrz4vDVjfUwBWJ`) has 425 items, all
    sirens, HMGP grants and district boundaries, **no outage layer**. HCCDA has a
    `Utility_Outages_(HCCDA)_Public` layer on the org already wired, but it holds
    **0 features and was last edited 2024-02-05**, untouched through Lala. Do not
    wire it; it would render a permanent false empty. Worth re-checking in a future
    event. HECO's Medium account (`@PoweringHawaii`, RSS at `medium.com/feed/@PoweringHawaii`)
    is corporate feature writing, not storm updates, and went quiet before Lala.
- **Band colour no longer means anything.** Fixed per category by decision. The hazard:
  a Tsunami Warning lands in EMERGENCY, the palest band, while POWER sits red above it
  saying outages are not tracked. Worth one exception so an active evacuation product
  can take the alarm colour. Would need the owner's sign off, since severity colour was
  explicitly rejected once.
- **Shelter and closure layers can go stale mid event.** HCCDA's shelter layer was
  **28 hours** old on 2026-08-18 during an active response. The page flags this past
  six hours and says to call the county. Do not remove that flag.
- **`REPORTS` is hardcoded and ages badly.** Entered from reporting on 2026-08-14, the
  Lala event. Still the only shelter data for Oʻahu, Maui and Kauaʻi. The NSS feed in
  Planned additions is the verified candidate to retire most of it.
- **Honolulu BWS has no feed at all.** It is CMS prose. During Lala it carried live and
  important content: low to no water pressure caused by the power outages, plus four
  emergency water fill stations with hydrant numbers. That belongs in the `REPORTS`
  pattern, hand entered with a source and a time. Not yet done, and on 2026-08-19 the
  owner ruled out adding new hand-entered categories; this stays a gap deliberately
  unless that call changes.
- **Traffic signal status does not exist anywhere public.** No county publishes it.
  GoAkamai's `alertservice` sends no CORS header and returned `[]`. Cameras show a human
  whether an intersection is dark; they are not a feed.
- **The all clear state has never been designed.** Handoff open question 2. A proposed
  answer exists (2026-08-19): a hand-flipped recovery mode adding a collapsed "after
  the storm" fold, quiet bands otherwise unchanged. See Planned additions.
- `http://www.honolulu.gov/hurricaneevac` in Oʻahu's step 2 is the one insecure link.
  **Checked: https works**, 301ing to
  `cchnl.maps.arcgis.com/apps/webappviewer/index.html?id=14fad086020b4bc8acfcf2e3f79d4329`.
  Switch the scheme. Vet the ArcGIS item first if you link the viewer directly.
- Shelter coordinates in `REPORTS` are approximate. Yano Hall in Captain Cook is a guess.
- **Two index files exist and only one is deployed.** `index.html` (renamed from
  `index-v6.html` 2026-09-03) is live, `index-v5.html` is the rollback. `archive/` holds
  the two abandoned ones.
- **Vercel mirror retired 2026-09-03, dashboard cleanup not yet done.** The
  `*.vercel.app` domains listed under the old Deployment section may still serve a stale
  build until someone deletes or pauses the Vercel project. They are dead links now, not
  a live mirror; do not rely on them.
- `www.808alerts.com` serves rather than redirecting to the apex. A redirect rule needs
  Zone / Rulesets / Edit, which the wrangler token does not carry.
- **HSTS is inconsistent.** Vercel sends `strict-transport-security`, Cloudflare Pages
  does not. Worth a deliberate decision, since the max-age is hard to walk back.
- The map adds ~145KB of Leaflet that every visitor pays for on the board.

### Recently closed

- The Cloudflare analytics beacon is **gone**. No `cloudflareinsights` or `/cdn-cgi/rum`
  in the served HTML on either domain.
- The Vercel mirror is **no longer stale**, and the project is renamed `808alerts`.
  `808alerts.vercel.app` is attached with `vercel domains add` so it tracks production.
- The kit checklist **persists** through `localStorage`, wrapped in try/catch.
- The old `--faint` attribution contrast failure went with the v6 palette.

## Context a new session will not have

Tropical Storm Lala hit Hawaiʻi Island on 2026-08-15 and 16. Peak outage was
**250,900 HECO customers**, the largest in the state's modern history. On 2026-08-18
about 43,500 were still out, Hawaiʻi County at 30% of the island, and HECO was telling
rural Big Island residents to expect **weeks or months**. Every "stale data" warning
and honest empty state in this app is calibrated to that, not to a quiet day.

The design went through four rounds with the owner and two are worth knowing about,
because repeating them wastes everyone's time:

1. A severity driven colour system was built, rejected, and removed. Colour is fixed
   per category now. Do not rebuild it without asking.
2. The detail views were first built as in page expandables, then rebuilt as routed
   pages. Pages won because landing on the site still shows only the board, and the
   detail then gets the whole viewport as the handoff draws it.

The owner's steer throughout: implement the handoff as drawn, do not narrow scope,
and do not invent data. Where a feed does not exist the page says so in copy rather
than showing a number.
