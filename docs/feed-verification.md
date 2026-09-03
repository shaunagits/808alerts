# Feed verification, self-managing sources

Verified 2026-08-19 (HST). Scope: feeds that populate and empty themselves during an
event, per the owner's decision to add only sources that need no hand entry. Everything
here was checked against the live endpoint, not documentation alone.

## Status summary

| Feed | Live | HI coverage | Provenance | CORS | Verdict |
|---|---|---|---|---|---|
| NWPS flood stages | yes | yes, ~40 gauges Oʻahu, 4 in Hilo bbox | NWS (.gov) | not yet confirmed | wire after CORS check |
| FEMA/Red Cross open shelters | yes | yes, live HI record returned | gis.fema.gov (.gov) | not yet confirmed | wire after CORS check |
| NOAA CO-OPS water level | yes | yes, Hilo station live | NOAA (.gov) | not yet confirmed | wire after CORS check |
| NWS gridpoint wind timing | host already wired | yes | NWS (.gov) | known `*` (same host as alerts) | wire, verify fields in browser |
| GoAkamai road closures | not re-checked | Oʻahu/Maui | HDOT (.gov) | none (checked earlier, see CLAUDE.md) | blocked on terms, contact HDOT |

CORS could not be read from the verification tooling used this session. Before wiring,
run this once from the console on https://808alerts.com and record the results here:

    ['https://api.water.noaa.gov/nwps/v1/gauges/WLUH1',
     'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=1617760&product=water_level&datum=MLLW&time_zone=lst&units=english&format=json',
     "https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query?where=state='HI'&outFields=*&f=json"
    ].forEach(u=>fetch(u).then(r=>console.log('OK',u)).catch(e=>console.log('BLOCKED',u)))

All three hosts are expected to pass (federal open-data APIs, and ArcGIS REST servers
send `Access-Control-Allow-Origin: *` by default), but expected is not verified.

## NWS NWPS, flood stages for gauges

    https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=&bbox.ymin=&bbox.xmax=&bbox.ymax=&srid=EPSG_4326
    https://api.water.noaa.gov/nwps/v1/gauges/{lid}

Keyless JSON. The bbox list call returns, per gauge: `lid`, name, coordinates, current
observed stage, and `status.observed.floodCategory` (`no_flooding`, `action`, `minor`,
`moderate`, `major`, `not_defined`, `out_of_service`). The per-gauge call adds
`flood.categories` threshold values and `flood.impacts`, plain-language statements per
stage. Wailuku at Piʻihonua (`WLUH1`, USGS 16704000) carries: minor 20 ft, major 24.4 ft,
and an impact at 21 ft naming Bayfront flooding and Kamehameha Ave / lower Pauahi St
closures. That impact text belongs in the WEATHER detail card as quoted NWS copy.

Coverage checked live: Hilo bbox returned 4 gauges, Oʻahu bbox returned ~40. The `lid`
joins to the USGS site id (`usgsId`), so this layers onto the existing USGS rows rather
than replacing them.

Caveats that must shape the copy:

- Many gauges are `floodCategory: not_defined`, and some categories within a defined
  gauge are `-9999` (Wailuku has no action or moderate stage). Only render a stage line
  when the threshold exists. `not_defined` is not `no_flooding`; say nothing rather
  than implying a rating.
- `out_of_service` is a real state (several Oʻahu gauges today). Treat like the HCCDA
  stale flag: show the gauge as out of service, do not drop it silently.
- Forecasts are `fcst_not_current` for nearly all HI gauges ("Forecasts are not
  available" per the API). This is observations plus thresholds, not a flood forecast.
  The existing "a gage reading is not a flood forecast" line stays.

## FEMA/Red Cross National Shelter System, open shelters

    https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query
      ?where=state='HI'&outFields=*&returnGeometry=true&f=json

Keyless ArcGIS REST on FEMA's own .gov server, so provenance is inherent; no
arcgis.com item check needed. Synced daily with the Red Cross shelter database, then
polled every 20 minutes for updates (service description, confirmed in service JSON).

Live check returned one Hawaiʻi feature during Lala recovery: Nāʻālehu Elementary
School, `shelter_status: OPEN`, `total_population: 18`, `pet_accommodations_code: NONE`,
`ada_compliant: UNK`, with point geometry. So HI coverage is real and the feed was
active for this exact event.

Fields available: name, address, city, zip, status, evacuation and post-impact
capacity, current population, pets, ADA, wheelchair. The `latitude`/`longitude`
attribute columns can be null; use the feature geometry instead.

Findings that must shape the rendering:

- **This is an open-shelters-only feed.** The full inventory layer
  (`NSS/FEMA_NSS/MapServer/0`) holds only 1 HI record total, so there is no
  pre-identified Hawaiʻi roster in NSS. Quiet day = zero features = the county keeps
  its honest empty state. Never read zero as all clear.
- FEMA's own guidance: the layer should not determine operational status of a
  facility. That is invariant 1 verbatim. Render as "listed open", source
  "FEMA/Red Cross shelter roster", with fetch-time stamp and the six-hour stale flag.
- The layer's own edit timestamp was not confirmed this session; check
  `editingInfo.dataLastEditDate` on the FeatureServer variant before relying on it,
  else stamp with fetch time and say so.
- Big Island dedupe: the same shelter can appear here and in the HCCDA layer. One
  pin, both sources in the popup, flag disagreement (invariant 7).
- `pet_accommodations_code` and `ada_compliant` fill the shelter-card attribute line,
  but `UNK` is common; render UNK as "not listed", never as no.

## NOAA CO-OPS, observed water level

    https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
      ?date=latest&station={id}&product=water_level&datum=MLLW&time_zone=lst&units=english&format=json

Keyless JSON, 6-minute observations. Live check: Hilo (1617760) returned a reading.
This is an observation, the counterpart to the PacIOOS model; the copy must say
"observed at the tide station", and the anomaly (observed minus predicted, via
`product=predictions`) is the storm-relevant number, not the raw height.

Station ids to confirm against the CO-OPS station map before wiring (only Hilo was
verified live): Honolulu 1612340, Kahului 1615680, Nāwiliwili 1611400, Mokuʻoleʻe
(Kāneʻohe) 1612480. One station per island entry in `ISLANDS`, hardcoded like the
forecast zones, so no live station lookup is needed.

## NWS gridpoint wind timing

Same `api.weather.gov` host already wired for alerts, so no new origin. The hourly
forecast (`/gridpoints/{wfo}/{x},{y}/forecast/hourly`) carries wind speed and gusts;
derive the first hour crossing 39 / 58 / 74 mph. The `/points` lookup for the grid
coordinates should be resolved once per `ISLANDS` entry and hardcoded, exactly like
the forecast zones, since `/points` is the call most likely to fail mid-event. Not
verified this session (the endpoint returned an empty body to the verification tool,
likely a user-agent quirk); verify in a browser and record the grid ids here.

## GoAkamai, HDOT closures

No public API documentation or terms of use were found. Prior session finding stands:
`alertservice` sends no CORS header and returned `[]`, so the route would be a worker
proxy. Do not wire until HDOT's terms are known; the HECO lesson applies, the blocker
may be terms rather than transport. Next step is asking HDOT directly whether the feed
may be republished. Parked.

## Derived features these feeds enable at no extra upkeep

- WEATHER band line when any nearby gauge is at or above a defined category.
- NWPS impact statements as quoted copy in the WEATHER detail.
- Shelter-card pet/ADA line from NSS fields.
- OCEAN band anomaly line when observed minus predicted exceeds a threshold.
- Wind arrival countdown in the WEATHER band during tropical products.
