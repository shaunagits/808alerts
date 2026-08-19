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
   same way for the tsunami and flood hazard zones. Three on-demand hosts now, each behind
   a user action and off by default; none loads at render, so a saved copy still opens
   with no network.
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

Three handoffs, all in `docs/`, each superseding part of the last:

- `808alerts.dc.html`, the original board. `1c` is the mobile hazard band stack,
  `2b` the desktop tile grid. `README.md` is its written spec and still the best
  reference for type and spacing.
- `808alerts.dc-v2.html` adds turn 3, the category detail views. `3a` ROADS
  desktop, `3b` POWER mobile sheet, `3c` WEATHER mobile. `1c` and `2b` are
  byte identical to v1.
- `808alerts-map.html`, the map dashboard. **This supersedes 2b's tile grid on
  desktop**: the board is now a two column grid, map left at `1.15fr`, the five
  bands as full width rows right.

Where they conflict, the newest wins.

## How the page is structured

```
sticky brand bar        wordmark, island label
hero                    headline, use my location, city / ZIP
location strip          {PLACE} ALERTS, island, UPDATED time
board                   map left, five bands right (one column below 1024)
map note                what the map can and cannot show
folds                   Plan, Kit, Sources, all collapsed on load
footer                  the not an official alert system disclaimer
```

Tapping a band routes to `#power`, `#roads`, `#weather`, `#ocean`, `#emergency`.
Hash routing, no router and no build step. The board hides, the detail view takes
the viewport, the browser back button works and board scroll position is restored.
Landing on the site shows the board with nothing expanded.

## Architecture

The web app is a single static `index-v6.html`. A companion **Cloudflare Worker** is now
planned to pull data that cannot be fetched from the browser (National Hurricane Center
track and cone, which sends no CORS header, and any licensed outage feed) and re-serve it
as CORS-open JSON the page fetches. See `docs/worker-plan.md`. The page still renders and
works with no network; the worker only fills in live data, exactly as the direct
`api.weather.gov` / USGS / PacIOOS calls already do.

- **`index-v6.html` is the live app** and the only file that is deployed. About 319KB,
  roughly 123KB gzipped over the wire. It contains markup, CSS, JS, the registry, a
  base64 Archivo subset and the whole of Leaflet 1.9.4. `index-v5.html` is the previous
  revision, kept for rollback, and is a completely different design.
- **There is no build step.** Edit `index-v6.html` directly. An earlier session kept
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

Markers follow the map handoff: closures are weight 9 lines, red for a full closure
and amber for one lane open; National Weather Service alerts are dashed polygons at
22% fill; shelters are 22px bordered pins; stream gauges are small white ringed dots.
Popups carry a coloured header, a key/value row and a dark action bar whose link goes
to the matching detail route.

The handoff draws closures as point pins with a `✕` glyph. Two reasons that is not
what shipped: HCCDA publishes real polyline geometry, so the actual closed stretch is
better than a dot on it, and **Archivo has no U+2715**, so the glyph would fall back
to a system font mid design. Same trap as the okina.

### The companion Worker (hurricane + power)

A Cloudflare Worker, `808alerts-api.shauna-coy.workers.dev` (source in `worker/`,
`docs/worker-plan.md`), serves two things the browser cannot fetch directly, as CORS-open
JSON. Both are fetched with the board in `setLoc`, like the gauge/wave calls, and both
degrade to the old behaviour if the worker is unreachable.

- **`/api/hurricane`** proxies NOAA NHC `CurrentStorms.json` (no CORS at source). Active
  Pacific storms near Hawaiʻi become: a red cyclone marker on the map (`HURRLAYER`, far
  offshore so it shows when zoomed out), a line in the WEATHER band, and a TROPICAL
  SYSTEMS block in the WEATHER detail with distance and bearing from the user. When there
  is no NWS product, the storm is the WEATHER headline; when there is, it rides in the
  sub-line and the NWS product stays the headline. The **forecast cone and track** are
  drawn too: the worker unzips NHC's KMZ (via `fflate`), pulls the `<coordinates>`,
  decimates the ~1500-point cone ring to ~140, and returns GeoJSON; the map draws a
  translucent red cone plus the centre-track line, visible when zoomed out to the basin.
- **`/api/power?county=`** parses Hawaiian Electric's newest newsroom release for the
  per-county outage count (peak phase) or statewide total and percent restored (recovery
  phase). It fills the POWER band and detail as a sourced, timestamped snapshot, ahead of
  the hand-entered `POWERREPORTS` fallback. Press releases are redistributable; the
  gated map API is not. Invariant 1 holds: it says "snapshot, not a live reading".

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

Implementation in `index-v6.html`: `makeRadarLayer()` is a `L.TileLayer` subclass whose
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

### The Hawaiian Electric map toggle

The board's map area carries a two-button toggle, **This map / Hawaiian Electric**, on
the three Hawaiian Electric counties only (Oʻahu `HIC003`, Hawaiʻi Island `HIC001`, Maui
County `HIC009`). Kauaʻi is KIUC and has no entry, so the toggle is hidden there and the
county keeps our map alone.

Switching to Hawaiian Electric shows their **official outage map page in an iframe**, not
a clone of it. This matters and is the whole reason it is built this way:

- HECO's live outage data is bearer-token gated and origin-allowlisted, and their terms
  forbid republishing it (see Known gaps). We cannot and do not touch the data.
- Their bare map app (`outagemap-heco.azurewebsites.net/heco`) renders **blank** when
  framed from any other origin: verified 2026-08-18, it only runs when framed by
  hawaiianelectric.com, so we frame the **whole official page** instead. It carries
  their nav and breadcrumbs above the map; that is the cost of showing their real live
  map without cloning it. A bar above the frame says what it is and links out.
- Neither HECO page sends `X-Frame-Options` or a `frame-ancestors` CSP, so framing is
  not blocked. KIUC's `kiuc.outagemap.coop` also renders blank framed, which is the
  other reason Kauaʻi has no toggle.

Implementation lives in `index-v6.html`: `HECOMAP` (county to URL), `syncMapSrc()`
(shows or hides the toggle per island, and resets to our map on every island change so
one island's map never shows under another) and `setMapSrc()` (swaps the pane and, on
the way out, **removes the iframe `src`** so their page stops polling in the background).
The iframe starts with no `src`; that is invariant 5. On mobile the frame grows to 80vh
so their page is usable; on desktop it stretches with the board.

Do not persist the choice across loads. Our map is the offline-safe default and must be
what a fresh visit shows.

**A fix that rode along with this:** the map used to leave a grey gap under it on desktop
at some widths. The base `.mapwrap{...height:360px}` rule sat *after* the desktop
`height:auto` rule in source order, so it won the cascade and pinned a definite height,
which defeated the grid's `align-items:stretch`. That 360px applied nowhere else (mobile
has its own 280px), so it was removed. The map now stretches to match the bands column.
Do not reintroduce a fixed `height` on `.mapwrap` at desktop widths.

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

### Hawaiian Electric press updates

The one Hawaiian Electric channel this page can legitimately carry. HECO publishes
dated restoration updates to `hawaiianelectric.com/about-us/newsroom`, linked from a
site-wide banner and mirrored as a PDF under `/documents/about_us/news/{year}/`. Press
releases are published for redistribution, which the token-gated map API is not.

They live in `POWERREPORTS` in `index-v6.html`, one entry per **county**, and they are
**hand-entered** today. Nothing fetches them yet. When the worker (`docs/worker-plan.md`)
lands, it can serve these from the newsroom instead of hand entry.

    {c, kind, band, headline, guide, note, disc, at, srcName, srcUrl}

- `band` is the short line the board shows, `headline` the fuller one in the detail
  card. They differ on purpose, the same way an EMERGENCY band differs from its report
  card. Setting them to the same string makes the routed page stutter.
- `powerReportOK()` enforces invariant 3 exactly as `reportOK()` does for shelters. No
  `srcName`, `srcUrl` or `at` means the entry does not render and the county falls all
  the way back to the honest no-feed panel.
- The band sub-line always says "Not a live reading" before anything else, and the card
  carries a `confirm` line. Invariant 1 applies to a utility press release the same as
  to a shelter roster.
- **Kauaʻi has no entry and must not get one.** Kauaʻi is KIUC, not Hawaiian Electric.
  It keeps the no-feed state.
- Molokaʻi and Lānaʻi are Maui County, so they inherit the `HIC009` entry.

**To update during an event:** open the newsroom, take the newest update, and rewrite
the three entries with its figures, its own caveat in `disc`, and the release time in
`at`. Quote HECO's snapshot caution rather than paraphrasing it away. These entries age
exactly as badly as `REPORTS` does, and stale restoration percentages are worse than
none, so clear them when the event ends.

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
   The Hawaiʻi County maps are owned by `GIS.HCCDA.Admin@hawaiicounty.gov`, the Kauaʻi
   refuge viewer by `slouxz@kauai.gov`.
3. Watch for staging hosts in search results. `dev-dod.hawaii.gov` and `dod80.hawaii.gov`
   both surface for HI-EMA queries and neither is canonical. `dod.hawaii.gov` is.
   The frequently cited `dod.hawaii.gov/hiema/know-your-tsunami-zones/` is a 404.

Neither Maui nor Kauaʻi publishes a public address-lookup app, so both use NOAA's
`tsunami.coast.noaa.gov`, which takes an address or current location and covers all
islands. MEMA points residents there themselves.

## Deployment

Primary host is **Cloudflare Pages**, project `808alerts`, account
`shauna.coy@gmail.com`. Chosen over Vercel because the free tier has no bandwidth cap,
and the failure mode to avoid is an emergency page going down because it got popular
during the emergency. **Vercel** is kept as a live mirror, project `808alerts` (renamed
from `hawaii-storm-info`) under the team `shaunagits-projects`.

Deploy from a directory whose entry file is named `index.html`. The working copy is
`index-v6.html`, so copy it to a staging directory as `index.html` and deploy that.
Keep **two separate staging directories**. The Vercel CLI writes a `.vercel/` folder and
a `vercel.json` into whatever directory it deploys from, and Cloudflare will happily
publish those, so Cloudflare gets a directory containing nothing but `index.html`.

**If the Vercel staging dir is recreated from scratch, link it before the first deploy.**
A fresh directory has no `.vercel/project.json`, so `vercel deploy` silently creates a
NEW project named after the directory (a `stage` project appeared this way on 2026-08-18)
instead of updating the `808alerts` mirror. Run first, then deploy:

    cd stage && npx vercel link --yes --project 808alerts --scope shaunagits-projects

    cp index-v6.html cf/index.html
    npx wrangler pages deploy cf --project-name 808alerts --branch main

    cp index-v6.html stage/index.html
    cd stage && npx vercel deploy --prod --yes --scope shaunagits-projects

Confirm the deployed bytes with a sha256 against the source rather than trusting the CLI.
Wrangler reporting `Uploaded 0 files (1 already uploaded)` is content addressed dedupe,
not a skipped deploy; the sha is the thing to check.

Domains, all serving the same content:

- `808alerts.com` (apex, primary)
- `www.808alerts.com`
- `808alerts.pages.dev`
- `808alerts.vercel.app` and `808alerts-shaunagits-projects.vercel.app`. The first was
  originally set with `vercel alias set`, which **pins to one deployment and does not
  follow later production deploys**. It is now attached with `vercel domains add`
  instead, so it tracks production. If a `.vercel.app` name ever goes stale while the
  others update, that is the cause.
- `hawaii-storm-info.vercel.app` still resolves, kept so old links do not break

DNS is two proxied CNAMEs to `808alerts.pages.dev`. Note that `wrangler login` grants
**no DNS scope at all**, so DNS and redirect rules cannot be managed from the CLI. Those
need the dashboard or an API token scoped to Zone / DNS / Edit.

After a deploy, the custom domain can briefly serve the previous build while
`808alerts.pages.dev` already has the new one. Poll until the sha matches rather than
judging by the first reload.

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
  stream gauges. This is the single biggest coverage gap.
- **Power outages have no machine feed, but the page is no longer empty.** Hawaiian
  Electric's press updates are now carried as hand-entered reports. See
  "Hawaiian Electric press updates" under Architecture for how to keep them current.
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
  Lala event. Still the only shelter data for Oʻahu, Maui and Kauaʻi.
- **Honolulu BWS has no feed at all.** It is CMS prose. During Lala it carried live and
  important content: low to no water pressure caused by the power outages, plus four
  emergency water fill stations with hydrant numbers. That belongs in the `REPORTS`
  pattern, hand entered with a source and a time. Not yet done.
- **Traffic signal status does not exist anywhere public.** No county publishes it.
  GoAkamai's `alertservice` sends no CORS header and returned `[]`. Cameras show a human
  whether an intersection is dark; they are not a feed.
- **The all clear state has never been designed.** Handoff open question 2.
- `http://www.honolulu.gov/hurricaneevac` in Oʻahu's step 2 is the one insecure link.
  **Checked: https works**, 301ing to
  `cchnl.maps.arcgis.com/apps/webappviewer/index.html?id=14fad086020b4bc8acfcf2e3f79d4329`.
  Switch the scheme. Vet the ArcGIS item first if you link the viewer directly.
- Shelter coordinates in `REPORTS` are approximate. Yano Hall in Captain Cook is a guess.
- **Two index files exist and only one is deployed.** `index-v6.html` is live,
  `index-v5.html` is the rollback. `archive/` holds the two abandoned ones.
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
