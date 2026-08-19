# Companion Worker plan

A small **Cloudflare Worker** (same account as the Pages project) that fetches data the
browser cannot reach directly and re-serves it as CORS-open JSON. The page keeps working
with no network; the worker only fills live data in, exactly like the direct
`api.weather.gov` / USGS / PacIOOS calls already do. Nothing about the offline-render
behaviour changes.

Why a worker at all: two data sources we want send **no CORS header**, so the browser is
blocked from calling them. A worker has no such restriction and can also hold a secret
API key the client must never see.

## Endpoints

    GET /api/hurricane                 active storms: position, category, winds, movement   [BUILT, wired]
    GET /api/power?county=HIC003       county outage counts, parsed from HECO newsroom      [BUILT, wired]
    GET /api/heco-news?county=HIC003   latest restoration-update text (newsroom)            [not needed: /api/power carries the text]

**CORS gotcha, learned the hard way:** the worker responses are `Cache-Control: private`,
never `public`. The app is served from four origins (apex, www, pages.dev, vercel.app); a
shared edge cache with `public` pinned one origin's `Access-Control-Allow-Origin` and
handed it to the others, breaking CORS everywhere but the first caller. `private` keeps the
per-origin response out of the shared cache; the upstream fetch is still cached via
`cf.cacheTtl`, so NHC/HECO are hit at a polite rate regardless. Localhost origins are also
allowed for development (these endpoints serve only public data).

Deployed: https://808alerts-api.shauna-coy.workers.dev (workers.dev; custom route
api.808alerts.com is a later step, see bottom).

All responses: `Access-Control-Allow-Origin: https://808alerts.com`, cached.

## 1. Hurricane data (National Hurricane Center) — BUILT and deployed

`https://www.nhc.noaa.gov/CurrentStorms.json` lists every active storm with position,
`classification` (HU/TS/TD), `intensity` (kt), `pressure`, `movementDir/Speed`,
`lastUpdate`, and GIS links to the **forecast cone** (`trackCone`) and **forecast track**
(`forecastTrack`), plus wind-radii and storm-surge products. Verified live 2026-08-19:
it returned Hurricane **Lala**, 110 kt, at 20.7N 168.9W. It sends **no CORS header**, which
is the whole reason the worker exists for this feed.

The worker fetches `CurrentStorms.json`, and for each storm fetches its `trackCone` and
`forecastTrack` GIS files, converts to GeoJSON in EPSG:4326, and returns a compact bundle:

```js
// worker.js — hurricane handler (sketch)
async function hurricane(env) {
  const r = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json",
                        { cf: { cacheTtl: 180 } });
  const storms = (await r.json()).activeStorms || [];
  // Central + Eastern Pacific and any that threaten the islands
  const near = storms.filter(s => s.longitudeNumeric < -140 && s.longitudeNumeric > -180);
  const out = [];
  for (const s of near) {
    out.push({
      id: s.id, name: s.name,
      category: category(s.classification, +s.intensity), // "Category 3", "Tropical Storm"
      winds: +s.intensity, pressure: +s.pressure,
      pos: [s.latitudeNumeric, s.longitudeNumeric],
      moving: `${s.movementDir}° at ${s.movementSpeed} kt`,
      updated: s.lastUpdate,
      cone: await geojson(s.trackCone?.zipFile),   // fetch + shp/kml -> GeoJSON
      track: await geojson(s.forecastTrack?.zipFile),
      advisory: s.publicAdvisory?.url
    });
  }
  return json(out, 180);
}
```

**What shipped** (`worker/src/index.js`): the endpoint returns each storm's name,
category (Saffir-Simpson from the wind speed), winds in mph, pressure, position, movement,
the advisory URL, and the cone/track KMZ URLs. Tested live: it returns Lala as a
`Category 3 Hurricane`, 127 mph, at 20.7N 168.9W, moving 285 degrees at 10 mph. The page
can draw a storm marker and an info line from this today.

**Cone/track geometry: BUILT.** The worker fetches NHC's cone and track KMZ, unzips them
with `fflate`, extracts the `<coordinates>`, decimates the dense cone ring (~1500 -> ~140
points, ~3 KB), and returns GeoJSON `cone` (Polygon) and `track` (MultiLineString) on each
storm. The page draws the cone as a translucent red polygon and the track as the centre
line, both far offshore so they show when the map is zoomed out. The whole
`/api/hurricane` response with geometry is ~3.7 KB. The NHC ArcGIS tropical service has
cone/track layers too, but its Central Pacific coverage was empty for this storm, so
CurrentStorms.json + KMZ is the reliable source.

**Warnings are already covered** client-side by `api.weather.gov` (Hurricane Warning,
Tropical Storm Warning, etc.). The worker adds the *storm itself* — where it is, how
strong, where it is forecast to go — which `api.weather.gov` alerts do not carry.

## 2. Outage counts ("X customers out in Your City")

**Correction to an earlier note in this repo:** HECO's *press releases* DO publish
customer outage counts, broken down **by county**, and press releases are issued for
redistribution. That is different from the gated real-time map API, which is
authenticated and whose content the terms forbid republishing. The press-release counts
are usable, with attribution and a timestamp, exactly like a news outlet quoting them.

Verified against the Lala releases (2026-08-16 to -18): each update carries a statewide
total and a per-county line, for example:

    As of 7 p.m., about 178,400 customers are without power:
    Hawaii Island: About 44,900 customers remain without power, mostly in Puna,
      North Kona and South Kohala...
    Oahu: About ...
    Maui County: About ...

So the worker can scrape the newsroom, parse the total and the per-county numbers, and
serve them. No license, no permission needed — this is the redistributable channel.

```js
// worker.js — power handler (sketch): parse county counts from the latest newsroom update
async function power(env, county) {
  const list = await fetch("https://www.hawaiianelectric.com/about-us/newsroom",
                           { cf: { cacheTtl: 300 } }).then(r => r.text());
  const latest = firstReleaseLink(list);                 // newest "* update:" release
  const html = await fetch("https://www.hawaiianelectric.com" + latest,
                           { cf: { cacheTtl: 300 } }).then(r => r.text());
  const text = stripTags(html);
  const total = num(/about ([\d,]+) customers are without power/i, text);
  const perCounty = {                                    // "Hawaii Island: About 44,900 customers"
    HIC001: num(/Hawaii Island:\s*About ([\d,]+)/i, text),
    HIC003: num(/Oahu:\s*About ([\d,]+)/i, text),
    HIC009: num(/Maui County:\s*About ([\d,]+)/i, text),
  };
  const at = releaseDate(html);
  return json({ available: perCounty[county] != null,
                out: perCounty[county], totalStatewide: total,
                area: COUNTY_NAME[county], source: "Hawaiian Electric", at,
                caveat: "Outage numbers are a snapshot in time and change often." }, 300);
}
```

### Can it say "X customers out in **Your City**" and "**Y%** of Your City"?

- **County-level count: yes, free.** "About 44,900 customers without power on Hawaiʻi
  Island (Hawaiʻi County), as of 7 p.m. — Hawaiian Electric." Straight from the press
  release, redistributable.
- **True city level (Hilo, Kailua, Kahului): no, from anyone.** The releases *name* the
  hardest-hit areas within a county ("mostly in Puna, North Kona and South Kohala") but
  give no number per area. HECO does not publish per-city counts, and neither does any
  legitimate source. So a "Your City" line honestly resolves to the user's **county**
  figure, labelled as the county.
- **Percent:** the releases give the *count* per county and a *statewide* percent
  restored. A per-county percent needs a per-county customer base, which HECO does not
  state in every release. Show the count and HECO's own stated percent; do not compute
  and present a per-county percent the source did not give.
- **Freshness:** every few hours (release cadence), not real time. Always carry HECO's
  own "snapshot in time" caveat and the release timestamp. Invariant 1 holds.

A **licensed feed** (PowerOutage.us) is still the only route to *real-time* or
*sub-county* numbers, and it is paid. But it is no longer required just to show outage
counts — the free press-release path covers county level.

## 3. HECO newsroom text (automates the current hand-entry)

The `POWERREPORTS` restoration-status text is hand-entered today from HECO's newsroom.
The newsroom is redistributable but has no RSS and no CORS, so the page cannot pull it.
The worker can: fetch the newsroom, parse the latest dated update per county, and serve it
at `/api/heco-news`. This removes the manual step for the text (not the counts).

## Cost, caching, secrets

- Cloudflare Workers free tier covers this easily (100k requests/day). Cache each upstream
  with a short `cacheTtl` (hurricane 180s, power 120s) so we hit NHC / the paid feed at a
  polite rate no matter how many visitors.
- `OUTAGE_API_KEY` is a Worker secret, never shipped to the browser.
- CORS restricted to `https://808alerts.com` (and the `.pages.dev` / `.vercel.app`
  mirrors).
- Deploy with `wrangler deploy`; the page fetches `https://api.808alerts.com/...` (a
  Worker route on the same zone).

## Build order

1. `/api/hurricane` first — free, legitimate, high value, and it answers "pull the
   hurricane data from the national weather databases" directly.
2. `/api/heco-news` — removes the manual POWERREPORTS entry.
3. `/api/power` — only once a licensed feed or HECO permission exists. Until then it
   returns `{available:false}` and the page keeps the honest no-feed panel.
