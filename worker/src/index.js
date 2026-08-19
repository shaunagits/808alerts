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

import { unzipSync, strFromU8 } from "fflate";

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

/* NHC serves the forecast cone and track only as KMZ (zipped KML). Unzip,
 * pull the <coordinates> out, and return GeoJSON. The cone is one dense ring
 * (~1500 points); decimate it so the payload stays small. */
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
  try {
    if (trackUrl) {
      const buf = await fetch(trackUrl, { cf: { cacheTtl: 300 } }).then((r) => r.arrayBuffer());
      const blocks = coordBlocks(kmlFromKmz(buf));
      const lines = blocks.filter((b) => b.length > 1).sort((a, b) => b.length - a.length);
      const pts = blocks.filter((b) => b.length === 1).map((b) => b[0]); // forecast positions
      if (lines.length) g.track = { type: "MultiLineString", coordinates: lines };
      if (pts.length) g.points = { type: "MultiPoint", coordinates: pts };
    }
  } catch (e) {
    /* leave track/points null */
  }
  return g;
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
 * HECO's press releases publish per-county customer outage counts, and press
 * releases are issued for redistribution (unlike the token-gated map API). This
 * parses the newest release. Peak-phase releases give a per-county breakdown;
 * recovery-phase releases give a statewide total and a percent restored. We
 * return whatever the latest release carries, with the source and timestamp.
 */
const COUNTY_NAME = {
  HIC001: "Hawaiʻi County",
  HIC003: "Honolulu County (Oʻahu)",
  HIC007: "Kauaʻi County",
  HIC009: "Maui County",
};

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
function floatNum(re, t) {
  const m = t.match(re);
  return m ? parseFloat(m[1]) : null;
}
/* The breakdown lines always read "County: About N" or "County: Approximately N",
 * so requiring that word avoids matching a stray number after a county name. */
function countyCount(namePattern, t) {
  return intNum(new RegExp(namePattern + ":\\s*(?:about|approximately)\\s*([\\d,]+)", "i"), t);
}
function newestRelease(listHtml) {
  const m = listHtml.match(
    /href="(\/(?:\d{1,2}-[ap]m|noon|\d{1,2}-a\.?m|midnight)[^"]*update[^"]*)"[^>]*>([^<]{10,160})</i
  );
  return m ? { path: m[1], title: m[2].replace(/\s+/g, " ").trim() } : null;
}

async function power(origin, county) {
  if (!county || !COUNTY_NAME[county]) return json({ available: false, error: "bad county" }, 60, origin);
  if (county === "HIC007")
    return json({ available: false, note: "Kauaʻi is served by KIUC, not Hawaiian Electric." }, 300, origin);

  const ua = { "User-Agent": "808alerts.com storm information (contact: shauna.coy@gmail.com)" };
  let rel, relHtml;
  try {
    const listHtml = await fetch("https://www.hawaiianelectric.com/about-us/newsroom", {
      cf: { cacheTtl: 300 },
      headers: ua,
    }).then((r) => r.text());
    rel = newestRelease(listHtml);
    if (!rel) return json({ available: false, error: "no release found" }, 120, origin);
    relHtml = await fetch("https://www.hawaiianelectric.com" + rel.path, {
      cf: { cacheTtl: 300 },
      headers: ua,
    }).then((r) => r.text());
  } catch (e) {
    return json({ available: false, error: "fetch failed" }, 60, origin);
  }

  const body = releaseBody(strip(relHtml));
  const counts = {
    HIC001: countyCount("Hawai.?i Island", body),
    HIC003: countyCount("Oahu", body),
    HIC009: countyCount("Maui County", body),
  };
  const totalStatewide = intNum(/about\s*([\d,]+)\s*customers?\s*(?:are|remain)\s*without power/i, body);
  const percentRestored = floatNum(/([\d.]+)\s*%\s*of\s*(?:all\s*)?(?:impacted\s*)?customers/i, body);
  const asOf = (body.match(/as of ([\d: ]+[ap]\.?m\.?)/i) || [])[1] || null;
  const releaseDate = (strip(relHtml).match(/Release Date:\s*([\d/]+)/i) || [])[1] || null;
  const out = counts[county];

  return json(
    {
      available: out != null || totalStatewide != null,
      county,
      countyName: COUNTY_NAME[county],
      out,                        // customers out in this county (null in recovery-phase releases)
      totalStatewide,             // statewide customers out
      percentRestored,            // statewide, when the release states it
      asOf,
      releaseDate,
      title: rel.title,
      source: "Hawaiian Electric",
      sourceUrl: "https://www.hawaiianelectric.com" + rel.path,
      caveat:
        "Outage numbers are a snapshot in time and change often as customers are restored and new outages occur.",
    },
    300,
    origin
  );
}

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
