/* 808alerts companion Worker.
 *
 * Serves data the browser cannot fetch directly (no CORS on the source) as
 * CORS-open JSON. First endpoint: /api/hurricane, proxying NOAA's National
 * Hurricane Center CurrentStorms.json (which sends no CORS header) and shaping
 * it into what the map needs: name, category, winds, position, movement.
 *
 * The page still renders and works with no network; this only fills live data
 * in, the same as the direct api.weather.gov / USGS / PacIOOS calls.
 */

import { unzipSync, gunzipSync, strFromU8 } from "fflate";

const ALLOW = new Set([
  "https://808alerts.com",
  "https://www.808alerts.com",
  "https://808alerts.pages.dev",
  "https://808alerts.vercel.app",
]);

function corsHeaders(origin) {
  // Production domains, plus localhost for development. These endpoints serve
  // only public NWS / HECO-press-release data, so this is convenience, not a
  // security boundary.
  const dev = /^http:\/\/localhost(:\d+)?$/.test(origin);
  const allowed = ALLOW.has(origin) || dev ? origin : "https://808alerts.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data, ttl, origin) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // `private`, never `public`: the app is served from four different
      // origins, and a shared edge cache would pin one origin's CORS header
      // and hand it to the others. The upstream fetch is cached instead
      // (cf.cacheTtl), so sources are still hit at a polite rate.
      "Cache-Control": `private, max-age=${ttl}`,
      ...corsHeaders(origin),
    },
  });
}

const KT_TO_MPH = 1.15078;

/* Saffir-Simpson category from sustained winds in knots. */
function category(classification, kt) {
  if (classification === "TD") return "Tropical Depression";
  if (classification === "TS") return "Tropical Storm";
  if (classification === "PTC") return "Potential Tropical Cyclone";
  if (classification === "HU") {
    if (kt >= 137) return "Category 5 Hurricane";
    if (kt >= 113) return "Category 4 Hurricane";
    if (kt >= 96) return "Category 3 Hurricane";
    if (kt >= 83) return "Category 2 Hurricane";
    if (kt >= 64) return "Category 1 Hurricane";
    return "Hurricane";
  }
  return classification || "Tropical system";
}

/* NHC serves the forecast cone, track, best track and wind extent shapes only
 * as KMZ (zipped KML). Unzip, pull the <coordinates> out, and return GeoJSON.
 * The cone is one dense ring (~1500 points); decimate it so the payload stays
 * small. This is a generic block extractor, not a full KML parser: it reads
 * every <coordinates> tag regardless of which Placemark or Folder it sits in,
 * so it cannot tell a 34kt quadrant from a 64kt one, or a best-track line from
 * a best-track point beyond point count. That is enough for the cone and
 * track, already shipped and working. It is NOT yet visually verified for
 * best track or wind radii KMZ, see fetchStormExtras below before trusting
 * those two on screen. */
function kmlFromKmz(buf) {
  const files = unzipSync(new Uint8Array(buf));
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".kml"));
  return name ? strFromU8(files[name]) : "";
}
function coordBlocks(kml) {
  const out = [];
  const re = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/g;
  let m;
  while ((m = re.exec(kml))) {
    const pts = m[1]
      .trim()
      .split(/\s+/)
      .map((t) => {
        const p = t.split(",");
        return [parseFloat(p[0]), parseFloat(p[1])];
      })
      .filter((p) => isFinite(p[0]) && isFinite(p[1]));
    if (pts.length) out.push(pts);
  }
  return out;
}
function decimate(ring, max) {
  if (ring.length <= max) return ring;
  const step = Math.ceil(ring.length / max);
  const out = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
  const last = ring[ring.length - 1];
  if (out[out.length - 1][0] !== last[0] || out[out.length - 1][1] !== last[1]) out.push(last);
  return out;
}
/* Fetch one KMZ and split its coordinate blocks into lines (>2 points) and
 * standalone points (a single coordinate pair), same rule already used for
 * the forecast track. Used for both the forecast track and the best track. */
async function kmzLinesPoints(url) {
  const out = { lines: [], points: [] };
  if (!url) return out;
  try {
    const buf = await fetch(url, { cf: { cacheTtl: 300 } }).then((r) => r.arrayBuffer());
    const blocks = coordBlocks(kmlFromKmz(buf));
    out.lines = blocks.filter((b) => b.length > 1).sort((a, b) => b.length - a.length);
    out.points = blocks.filter((b) => b.length === 1).map((b) => b[0]);
  } catch (e) {
    /* leave empty */
  }
  return out;
}
/* Fetch one KMZ and return every closed ring (>2 points) as a GeoJSON
 * Polygon, decimated. Wind radii and arrival-time KMZ carry several rings
 * (one per quadrant, or one per threshold); this returns all of them as a
 * MultiPolygon rather than picking one, unlike the cone (which is genuinely
 * a single ring and always takes the largest). */
async function kmzPolygons(url) {
  if (!url) return null;
  try {
    const buf = await fetch(url, { cf: { cacheTtl: 300 } }).then((r) => r.arrayBuffer());
    const rings = coordBlocks(kmlFromKmz(buf)).filter((r) => r.length > 2);
    if (!rings.length) return null;
    return { type: "MultiPolygon", coordinates: rings.map((r) => [decimate(r, 150)]) };
  } catch (e) {
    return null;
  }
}
async function stormGeometry(coneUrl, trackUrl) {
  const g = { cone: null, track: null, points: null };
  try {
    if (coneUrl) {
      const buf = await fetch(coneUrl, { cf: { cacheTtl: 300 } }).then((r) => r.arrayBuffer());
      const rings = coordBlocks(kmlFromKmz(buf)).sort((a, b) => b.length - a.length);
      if (rings[0]) g.cone = { type: "Polygon", coordinates: [decimate(rings[0], 150)] };
    }
  } catch (e) {
    /* leave cone null */
  }
  const t = await kmzLinesPoints(trackUrl);
  if (t.lines.length) g.track = { type: "MultiLineString", coordinates: t.lines };
  if (t.points.length) g.points = { type: "MultiPoint", coordinates: t.points }; // forecast positions
  return g;
}
/* Best track (where the storm has actually been, as opposed to the forecast
 * cone/track ahead of it) and current wind extent, both new NHC fields this
 * page was not using. Best effort: any of these can come back null and the
 * map just does not draw that layer, same failure mode as the cone. */
async function stormExtras(bestTrackUrl, windExtentUrl, arrivalUrl) {
  const bt = await kmzLinesPoints(bestTrackUrl);
  return {
    bestTrack: bt.lines.length ? { type: "MultiLineString", coordinates: bt.lines } : null,
    bestTrackPoints: bt.points.length ? { type: "MultiPoint", coordinates: bt.points } : null,
    windExtent: await kmzPolygons(windExtentUrl),
    arrival: await kmzPolygons(arrivalUrl),
  };
}

/* Individual model forecast tracks ("spaghetti"), added 2026-09-03. This is a
 * different feed than the cone/track above: those are NHC's single blended
 * official forecast, this is where each individual model (GFS, ECMWF, UKMET,
 * the hurricane-specific dynamical models...) thinks the storm is headed, so
 * you can see whether the models agree or are pulling apart. NHC do not
 * publish this as JSON or KML; it comes as a plain-text ATCF "a-deck" file
 * (aid_public), one per storm, gzipped, at ftp.nhc.noaa.gov. Verified live
 * 2026-09-03: no Access-Control-Allow-Origin header at all (checked with a
 * plain curl -I, and separately confirmed a browser-context fetch to it
 * throws), same as CurrentStorms.json and the KMZ files, so this goes
 * through the worker like everything else here.
 *
 * The file name is `a` + the storm's own id (e.g. `aep122026.dat.gz`), and
 * NHC's `id` field in CurrentStorms.json is already in that exact form, so
 * no id translation is needed. The file accumulates every advisory cycle for
 * the storm's whole life (tens of thousands of lines for a long-lived
 * storm), so only the newest cycle (max YYYYMMDDHH) is kept.
 *
 * NHC carries dozens of "tech" codes per cycle: the ~30 GEFS ensemble
 * members, statistical intensity-only tools (DSHP, SHIP, LGEM, which have no
 * track), NHC's own working aids (OFCL is the official forecast, already
 * drawn as the cone/track; CARQ is the best track, already drawn separately)
 * and the individual dynamical models. Showing all of them would be an
 * unreadable tangle and would restate what OFCL/CARQ already draw, so this
 * keeps only a curated set of the well-known dynamical models plus the
 * multi-model consensus, using NHC's synoptic-time-*interpolated* variant of
 * each (the "I" suffix codes) since that is what every other public
 * spaghetti-plot site draws from and is what lines up to common tau values.
 * A storm with no model guidance in NHC's most recent cycle (checked against
 * a storm near the end of its life, 2026-08-25) legitimately returns fewer
 * lines, sometimes just the consensus; that is not a bug, the feed just
 * empties out the same honest way every other feed on this page does. */
const MODEL_TRACK_NAMES = {
  AVNI: "GFS",
  UKXI: "UKMET",
  CMCI: "CMC",
  NVGI: "NAVGEM",
  HWFI: "HWRF",
  HMNI: "HMON",
  CTCI: "COAMPS-TC",
  EMXI: "ECMWF",
  TVCN: "Consensus",
};
const MODEL_TRACK_ALLOW = Object.keys(MODEL_TRACK_NAMES);

/* ATCF a-deck lat/lon are tenths of a degree with a trailing hemisphere
 * letter, e.g. "132N" -> 13.2, "1453W" -> -145.3. */
function parseAtcfLatLon(latS, lonS) {
  const lat = ((latS.endsWith("S") ? -1 : 1) * parseFloat(latS)) / 10;
  const lon = ((lonS.endsWith("W") ? -1 : 1) * parseFloat(lonS)) / 10;
  return [lon, lat];
}
/* One comma-separated a-deck line -> {cycle, tech, tau, lon, lat}, or null
 * for a line too short/malformed to trust (there are stray blank trailing
 * lines in some files). Only the first 8 fields (basin, cyclone number,
 * cycle, tech number, tech, tau, lat, lon) are used; radii and every field
 * after are irrelevant to a track line and vary in count between tech types. */
function parseAtcfLine(line) {
  const f = line.split(",").map((x) => x.trim());
  if (f.length < 8) return null;
  const cycle = f[2],
    tech = f[4],
    tau = parseInt(f[5], 10),
    latS = f[6],
    lonS = f[7];
  if (!cycle || !tech || !latS || !lonS || !Number.isFinite(tau)) return null;
  const [lon, lat] = parseAtcfLatLon(latS, lonS);
  if (!isFinite(lon) || !isFinite(lat)) return null;
  return { cycle, tech, tau, lon, lat };
}
/* The full a-deck file text -> one GeoJSON LineString per allowed model,
 * latest cycle only, deduped to one point per forecast hour (a tech can
 * repeat a tau across different wind-radii threshold rows; the first one
 * wins, radii are not used here). A model with fewer than 2 points forms no
 * line and is dropped, same "just don't draw it" rule as every other
 * optional storm layer. */
function atcfModelTracks(text) {
  const rows = text.trim().split("\n").map(parseAtcfLine).filter(Boolean);
  if (!rows.length) return null;
  let maxCycle = "";
  for (const r of rows) if (r.cycle > maxCycle) maxCycle = r.cycle;
  const byTech = {};
  for (const r of rows) {
    if (r.cycle !== maxCycle || !MODEL_TRACK_ALLOW.includes(r.tech)) continue;
    if (!byTech[r.tech]) byTech[r.tech] = new Map();
    if (!byTech[r.tech].has(r.tau)) byTech[r.tech].set(r.tau, [r.lon, r.lat]);
  }
  const features = [];
  for (const tech of MODEL_TRACK_ALLOW) {
    const pts = byTech[tech];
    if (!pts || pts.size < 2) continue;
    const coords = [...pts.entries()].sort((a, b) => a[0] - b[0]).map(([, ll]) => ll);
    features.push({
      type: "Feature",
      properties: { tech, name: MODEL_TRACK_NAMES[tech] },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}
async function modelTracks(id) {
  if (!id) return null;
  try {
    const r = await fetch(`https://ftp.nhc.noaa.gov/atcf/aid_public/a${id}.dat.gz`, {
      cf: { cacheTtl: 1800 }, // one advisory cycle is ~6h; this is deliberately shorter
      headers: { "User-Agent": "808alerts.com storm information (contact: shauna.coy@gmail.com)" },
    });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const text = strFromU8(gunzipSync(new Uint8Array(buf)));
    return atcfModelTracks(text);
  } catch (e) {
    return null;
  }
}

async function hurricane(origin) {
  let all;
  try {
    const r = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", {
      cf: { cacheTtl: 180, cacheEverything: true },
      headers: { "User-Agent": "808alerts.com storm information (contact: shauna.coy@gmail.com)" },
    });
    if (!r.ok) return json({ storms: [], error: "upstream " + r.status }, 60, origin);
    all = (await r.json()).activeStorms || [];
  } catch (e) {
    return json({ storms: [], error: "fetch failed" }, 60, origin);
  }

  /* Central Pacific + nearby Eastern Pacific: storms that could concern Hawaiʻi.
     Hawaiʻi sits near 155-160W; this window catches CPac storms and EPac storms
     already west of 125W and heading into the basin. */
  const near = all.filter(
    (s) =>
      typeof s.longitudeNumeric === "number" &&
      typeof s.latitudeNumeric === "number" &&
      s.longitudeNumeric <= -125 &&
      s.longitudeNumeric >= -180 &&
      s.latitudeNumeric >= 5 &&
      s.latitudeNumeric <= 40
  );

  const storms = await Promise.all(
    near.map(async (s) => {
      const kt = Number(s.intensity);
      const geo = await stormGeometry(
        s.trackCone && s.trackCone.kmzFile,
        s.forecastTrack && s.forecastTrack.kmzFile
      );
      const extra = await stormExtras(
        s.bestTrackGIS && s.bestTrackGIS.kmzFile,
        s.initialWindExtent && s.initialWindExtent.kmzFile,
        s.mostLikelyTimeTSWindsGIS && s.mostLikelyTimeTSWindsGIS.kmzFile
      );
      const models = await modelTracks(s.id);
      return {
        id: s.id,
        name: s.name,
        classification: s.classification,
        category: category(s.classification, kt),
        windsMph: Number.isFinite(kt) ? Math.round(kt * KT_TO_MPH) : null,
        pressureMb: Number(s.pressure) || null,
        position: [s.latitudeNumeric, s.longitudeNumeric],
        movement:
          s.movementDir != null && s.movementSpeed != null
            ? { dirDeg: Number(s.movementDir), speedMph: Math.round(Number(s.movementSpeed) * KT_TO_MPH) }
            : null,
        updated: s.lastUpdate,
        advisoryUrl: s.publicAdvisory && s.publicAdvisory.url,
        cone: geo.cone, // GeoJSON Polygon (forecast cone of uncertainty)
        track: geo.track, // GeoJSON MultiLineString (forecast center path)
        points: geo.points, // GeoJSON MultiPoint (forecast positions along the track)
        bestTrack: extra.bestTrack, // GeoJSON MultiLineString, where the storm has actually been
        bestTrackPoints: extra.bestTrackPoints, // GeoJSON MultiPoint, each observed fix
        windExtent: extra.windExtent, // GeoJSON MultiPolygon, current wind radii (unverified shape, see stormExtras)
        arrival: extra.arrival, // GeoJSON MultiPolygon, most-likely TS-force-wind arrival time bands (unverified shape)
        modelTracks: models, // GeoJSON FeatureCollection, one LineString per model ("spaghetti")
      };
    })
  );

  return json(
    { storms, source: "NOAA National Hurricane Center / Central Pacific Hurricane Center" },
    180,
    origin
  );
}

/* ---- /api/power: county outage counts parsed from HECO's newsroom ---------
 * HECO's press releases publish customer outage counts, and press releases are
 * issued for redistribution (unlike the token-gated map API, which is bearer
 * gated AND barred by their terms; see CLAUDE.md before revisiting that).
 *
 * Nothing here is hand-maintained. HECO tags every release to the islands it
 * concerns, and exposes that as a newsroom filter, so each county is answered
 * from its OWN newest release rather than from whatever went out last.
 *
 *   cat=34 Oahu   cat=35 Maui County   cat=36 Hawaii Island
 *
 * Two things this must never do, both learned from real releases:
 *
 * 1. Never claim a number is statewide because no island was named in the
 *    sentence. The 2026-08-20 4 p.m. release reads "...restored on Hawaii
 *    Island. Currently, about 13,000 are without power." Read alone that is a
 *    statewide claim; read with the sentence before it, it is Hawaiʻi Island.
 *    Scope is resolved from the sentence, then its neighbours, then the
 *    release's island tags, and is left null rather than guessed.
 * 2. Never loosen the per-county breakdown regex past "about|approximately".
 *    HECO print their outage phone numbers as "Hawaii Island: 1-855-304-9191",
 *    which a looser pattern reads as an outage count of 1.
 *
 * When the newest release for an island carries no figure, that is reported as
 * exactly that (counts null, with the release date), never as zero outages.
 * HECO issues releases for events, not for quiet days, so silence is absence of
 * evidence and the page must say so. Invariants 1 and 6.
 */
const COUNTY_NAME = {
  HIC001: "Hawaiʻi County",
  HIC003: "Honolulu County (Oʻahu)",
  HIC007: "Kauaʻi County",
  HIC009: "Maui County",
};
/* What the band calls the place. The county name is too long for a headline. */
const COUNTY_SHORT = {
  HIC001: "Hawaiʻi Island",
  HIC003: "Oʻahu",
  HIC007: "Kauaʻi",
  HIC009: "Maui County",
};
/* HECO's own island filter on the newsroom listing. */
const COUNTY_CAT = { HIC003: 34, HIC009: 35, HIC001: 36 };

/* Island words to county zones, for resolving what a number refers to. */
const ISLAND_ZONE = [
  [/\bhawai.?i island\b/i, "HIC001"],
  [/\bbig island\b/i, "HIC001"],
  [/\bo.?ahu\b/i, "HIC003"],
  [/\bmaui county\b/i, "HIC009"],
  [/\bmaui\b/i, "HIC009"],
  [/\bmoloka.?i\b/i, "HIC009"],
  [/\blana.?i\b/i, "HIC009"],
];
function zonesIn(text) {
  const s = new Set();
  for (const [re, z] of ISLAND_ZONE) if (re.test(text)) s.add(z);
  return s;
}

function strip(h) {
  return h
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}
/* Only the release body, so related-article sidebars do not leak numbers in. */
function releaseBody(t) {
  const a = t.search(/HONOLULU,/);
  const b = t.search(/Hawaiian Electric communicates restoration/i);
  return a >= 0 ? t.slice(a, b > a ? b : a + 4000) : t;
}
function intNum(re, t) {
  const m = t.match(re);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}
/* Peak-phase releases carry a per-county breakdown under island headings, but
 * the number does not reliably follow the heading. From 2026-08-18:
 *
 *   "Hawaii Island : Approximately 26,900 customers remain without power."
 *   "Maui County : With a majority of impacted customers brought back online,
 *    crews are focusing today on ... East Maui. About 2,100 remain without
 *    power."
 *
 * So match the heading, then look for a count inside that island's SECTION,
 * bounded by the next heading. An earlier version required the number to sit
 * directly after the colon and silently lost Maui County every time.
 *
 * The section is capped because the last heading otherwise runs to the end of
 * the release and would swallow an unrelated figure. And the count still has to
 * be followed by "without power", which is what keeps HECO's outage phone
 * numbers ("Hawaii Island: 1-855-304-9191") from parsing as a count of 1. */
const COUNTY_HEADING = /(hawai.?i island|o.?ahu|maui county)\s*:/gi;
function countyBreakdown(body) {
  const out = { HIC001: null, HIC003: null, HIC009: null };
  const heads = [];
  let m;
  COUNTY_HEADING.lastIndex = 0;
  while ((m = COUNTY_HEADING.exec(body))) {
    const z = [...zonesIn(m[1])];
    if (z.length === 1) heads.push({ zone: z[0], at: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < heads.length; i++) {
    const stop = Math.min(heads[i + 1] ? heads[i + 1].at : body.length, heads[i].end + 600);
    const section = body.slice(heads[i].end, stop);
    const c = section.match(OUTAGE_RE);
    if (!c) continue;
    const n = parseInt(c[2].replace(/,/g, ""), 10);
    // First heading wins: HECO list each island once, and a later mention is
    // more likely to be a cross reference than a fresh figure.
    if (Number.isFinite(n) && out[heads[i].zone] == null) out[heads[i].zone] = n;
  }
  return out;
}

/* Every phrasing seen across the ten Lala releases, 2026-08-20 to 08-28:
 *   "Fewer than 400 customers remain without power."
 *   "Approximately 1,430 Hawaii Island customers remain without power."
 *   "As of this afternoon, about 6,460 customers remain without power."
 *   "Currently, about 11,290 without power."      (no "customers")
 *   "About 13,380 are still without power."
 * The qualifier is captured so the page can say "Fewer than 400", which is what
 * HECO said, rather than rounding it to "About 400". */
/* The island or "statewide" can sit either side of the word "customers":
 *   "1,430 Hawaii Island customers remain without power"   (before)
 *   "9,000 customers statewide are without power"          (after)
 * so "customers" is optional on both sides of the scope group. */
const OUTAGE_RE =
  /(about|approximately|roughly|nearly|fewer than|more than|over|at least)?\s*([\d][\d,]*)\s*(?:customers?\s+)?(hawai.?i island|o.?ahu|maui county|maui|statewide)?\s*(?:customers?\s*)?(?:are|is|remain|remains|remaining)?\s*(?:still\s*)?without power/i;

/* Split into sentences and return the one containing `index`, with the sentence
 * either side. Scope lives in that window more often than in the sentence. */
function sentenceWindow(text, index) {
  const parts = text.split(/(?<=\.)\s+/);
  let run = 0,
    at = 0;
  for (let i = 0; i < parts.length; i++) {
    if (index >= run && index < run + parts[i].length + 1) {
      at = i;
      break;
    }
    run += parts[i].length + 1;
  }
  return {
    sentence: parts[at] || "",
    window: parts.slice(Math.max(0, at - 1), at + 2).join(" "),
  };
}

/* The outage count, plus what it refers to. `scope` is a county zone, the
 * string "STATE", or null when the release does not make it clear. Null is a
 * real answer and the caller must not treat it as statewide. */
function outageCount(body, taggedZones) {
  const m = body.match(OUTAGE_RE);
  if (!m) return null;
  const count = parseInt(m[2].replace(/,/g, ""), 10);
  if (!Number.isFinite(count)) return null;
  const qualifier = (m[1] || "").toLowerCase() || null;

  // Stated outright in the sentence: believe it.
  if (m[3]) {
    const w = m[3].toLowerCase();
    if (/statewide/.test(w)) return { count, qualifier, scope: "STATE" };
    const z = zonesIn(m[3]);
    if (z.size === 1) return { count, qualifier, scope: [...z][0] };
  }
  const { sentence, window } = sentenceWindow(body, m.index);
  if (/\bstatewide\b/i.test(sentence)) return { count, qualifier, scope: "STATE" };
  const near = zonesIn(window);
  if (near.size === 1) return { count, qualifier, scope: [...near][0] };
  // The release itself is tagged to exactly one island.
  if (taggedZones && taggedZones.size === 1) return { count, qualifier, scope: [...taggedZones][0] };
  return { count, qualifier, scope: null };
}

/* "80% of impacted customers have been restored on Hawaii Island" puts the
 * island AFTER the verb, so look either side of "restored". */
function percentRestored(body) {
  const m = body.match(
    /([\d.]+)\s*%\s*of\s*(?:all\s*)?(?:impacted\s*)?customers\s*([^.]{0,60}?)restored([^.]{0,60})/i
  );
  if (!m) return null;
  const pct = parseFloat(m[1]);
  if (!Number.isFinite(pct)) return null;
  const ctx = (m[2] || "") + " " + (m[3] || "");
  if (/\bstatewide\b/i.test(ctx)) return { pct, scope: "STATE" };
  const z = zonesIn(ctx);
  return { pct, scope: z.size === 1 ? [...z][0] : null };
}

/* Newest release in a newsroom listing, by DATE rather than document order:
 * the promoted "featured" item sits above the list and is usually older. */
function newestRelease(listHtml) {
  const items = [];
  const re =
    /([A-Z][a-z]{2,8}\s+\d{1,2},\s+(\d{4}))\s*<\/[^>]+>[\s\S]{0,600}?href="(\/[a-z0-9][a-z0-9\-]{14,})"[^>]*>\s*([^<]{10,180})</g;
  let m;
  while ((m = re.exec(listHtml))) {
    const when = Date.parse(m[1]);
    if (!Number.isFinite(when)) continue;
    items.push({ when, date: m[1], path: m[3], title: m[4].replace(/\s+/g, " ").trim() });
  }
  if (!items.length) return null;
  items.sort((a, b) => b.when - a.when);
  return items[0];
}

/* HECO raise a site-wide alert banner during an event and drop it afterwards.
 * It is their own "something is happening" flag, so it answers the statewide
 * question without us inferring anything from silence. */
function alertBanner(listHtml) {
  const m = listHtml.match(/alert_icon\.png[\s\S]{0,400}?href="([^"]+)"[^>]*>\s*([^<]{10,200})</i);
  if (!m) return null;
  return { url: m[1].startsWith("http") ? m[1] : "https://www.hawaiianelectric.com" + m[1],
           headline: m[2].replace(/\s+/g, " ").trim() };
}

const HECO_UA = {
  "User-Agent": "808alerts.com storm information (contact: shauna.coy@gmail.com)",
};
const newsroom = (cat) =>
  "https://www.hawaiianelectric.com/about-us/newsroom" + (cat ? "?year=" + new Date().getUTCFullYear() + "&cat=" + cat : "");

async function power(origin, county) {
  if (!county || !COUNTY_NAME[county]) return json({ available: false, error: "bad county" }, 60, origin);
  if (county === "HIC007")
    return json(
      {
        available: false,
        county,
        countyName: COUNTY_NAME[county],
        countyShort: COUNTY_SHORT[county],
        utility: "KIUC",
        note: "Kauaʻi is served by Kauaʻi Island Utility Cooperative, not Hawaiian Electric.",
        sourceUrl: "https://kiuc.outagemap.coop/",
      },
      300,
      origin
    );

  const cat = COUNTY_CAT[county];
  let rel, relHtml, banner = null, taggedZones = null;
  try {
    // This county's own listing, plus the unfiltered one for the event banner.
    const [islandHtml, allHtml] = await Promise.all([
      fetch(newsroom(cat), { cf: { cacheTtl: 300 }, headers: HECO_UA }).then((r) => r.text()),
      fetch(newsroom(null), { cf: { cacheTtl: 300 }, headers: HECO_UA }).then((r) => r.text()),
    ]);
    banner = alertBanner(allHtml);
    rel = newestRelease(islandHtml);
    if (!rel) return json({ available: false, error: "no release found" }, 120, origin);

    // Which islands is this release tagged to? Used only to resolve the scope
    // of a number when the prose does not say. One extra pair of fetches, both
    // edge cached, and it stops a Hawaiʻi Island count being called statewide.
    const others = await Promise.all(
      Object.entries(COUNTY_CAT)
        .filter(([z]) => z !== county)
        .map(([z, c]) =>
          fetch(newsroom(c), { cf: { cacheTtl: 300 }, headers: HECO_UA })
            .then((r) => r.text())
            .then((h) => [z, h.includes('href="' + rel.path + '"')])
            .catch(() => [z, false])
        )
    );
    taggedZones = new Set([county, ...others.filter(([, hit]) => hit).map(([z]) => z)]);

    relHtml = await fetch("https://www.hawaiianelectric.com" + rel.path, {
      cf: { cacheTtl: 300 },
      headers: HECO_UA,
    }).then((r) => r.text());
  } catch (e) {
    return json({ available: false, error: "fetch failed" }, 60, origin);
  }

  const body = releaseBody(strip(relHtml));

  // Peak-phase releases carry an explicit per-county breakdown. Prefer it: it
  // is HECO's own attribution of a number to an island, so nothing is inferred.
  const breakdown = countyBreakdown(body);
  const hasBreakdown = Object.values(breakdown).some((v) => v != null);

  const single = outageCount(body, taggedZones);
  const pct = percentRestored(body);

  // `out` is only ever this county's number. A count scoped to another island,
  // or to nothing we can pin down, is not shown as if it were local.
  let out = breakdown[county];
  let outQualifier = out != null ? "about" : null;
  let totalStatewide = null;
  if (single) {
    if (single.scope === "STATE") totalStatewide = single.count;
    else if (single.scope === county && out == null) {
      out = single.count;
      outQualifier = single.qualifier;
    }
  }
  if (hasBreakdown && single && single.scope === "STATE") totalStatewide = single.count;

  // Deliberately NOT returned: a count scoped to another island. This county's
  // newest tagged release can be days behind that island's own newest one, so
  // the number would be stale the moment it was shown somewhere it is not
  // local. On 2026-08-28 the Oʻahu-tagged release still said 6,390 for Hawaiʻi
  // Island while the live figure there was under 400. The event banner below
  // carries the same "something is happening elsewhere" signal, and it is
  // current because HECO maintain it.

  // A time with no number attached is noise, and implies a precision we do not
  // have, so it is only kept when a count came out of the same release.
  const hasCount = out != null || totalStatewide != null;
  const asOf = hasCount
    ? (body.match(/as of ([\d]{1,2}(?::[\d]{2})?\s*[ap]\.?\s?m\.?)/i) || [])[1] || null
    : null;
  const releaseDate = (strip(relHtml).match(/Release Date:\s*([\d/]+)/i) || [])[1] || rel.date || null;
  const published = Number.isFinite(rel.when) ? new Date(rel.when).toISOString().slice(0, 10) : null;
  // Floor, not round: a release from this morning must never read "1 day ago".
  const daysSince = Number.isFinite(rel.when)
    ? Math.max(0, Math.floor((Date.now() - rel.when) / 86400000))
    : null;

  return json(
    {
      // A number for THIS county, or a statewide total, is what "available"
      // means. Everything else is the honest no-count state, which still
      // carries the release date so the page can say when HECO last spoke.
      available: out != null || totalStatewide != null,
      county,
      countyName: COUNTY_NAME[county],
      countyShort: COUNTY_SHORT[county],
      out,
      outQualifier,
      totalStatewide,
      statewideQualifier: totalStatewide != null && single ? single.qualifier : null,
      // Every county figure this release actually stated, so the detail card
      // can show the wider picture without us summing anything. HECO do not
      // publish a statewide outage total, and adding their county numbers up
      // ourselves would be our arithmetic presented as their figure, and an
      // undercount whenever they list only some islands. Do not add one.
      breakdown: Object.entries(breakdown)
        .filter(([, n]) => n != null)
        .map(([z, n]) => ({ zone: z, name: COUNTY_SHORT[z], count: n })),
      percentRestored: pct ? pct.pct : null,
      percentRestoredScope: pct ? pct.scope : null,
      percentRestoredScopeName: pct && pct.scope && pct.scope !== "STATE" ? COUNTY_SHORT[pct.scope] : null,
      // HECO's own event flag. Absent is NOT proof that nothing is happening.
      eventActive: !!banner,
      eventHeadline: banner ? banner.headline : null,
      eventUrl: banner ? banner.url : null,
      asOf,
      releaseDate,
      published,
      daysSince,
      title: rel.title,
      source: "Hawaiian Electric",
      sourceUrl: "https://www.hawaiianelectric.com" + rel.path,
      caveat:
        "Outage numbers are a snapshot in time and change often as customers are restored and new outages occur.",
      // Said plainly so the page never has to imply it.
      coverage:
        "Hawaiian Electric issue news releases for storms and major events, not for everyday outages. No release does not mean no outages.",
    },
    300,
    origin
  );
}

/* Exposed for test-parse.mjs only. The parsing rules here were each derived
 * from a real release, so they get a regression test rather than a comment. */
export const __test = {
  countyBreakdown,
  outageCount,
  percentRestored,
  newestRelease,
  alertBanner,
  strip,
  releaseBody,
  coordBlocks,
  decimate,
  parseAtcfLatLon,
  parseAtcfLine,
  atcfModelTracks,
  MODEL_TRACK_ALLOW,
  MODEL_TRACK_NAMES,
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (url.pathname === "/api/hurricane") {
      return hurricane(origin);
    }
    if (url.pathname === "/api/power") {
      return power(origin, url.searchParams.get("county"));
    }
    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};
