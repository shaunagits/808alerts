/* Parser regression check against real Hawaiian Electric releases.
 *
 * Every case here is a sentence HECO actually published during Hurricane Lala,
 * 2026-08-18 to 08-28. When a future release breaks the parser, add the new
 * phrasing here first, then fix the regex.
 *
 *   node test-parse.mjs
 */
import { __test } from "./src/index.js";

const {
  countyBreakdown,
  outageCount,
  percentRestored,
  newestRelease,
  alertBanner,
  coordBlocks,
  placemarks,
  decimate,
  parseAtcfLatLon,
  parseAtcfLine,
  atcfModelTracks,
  MODEL_TRACK_ALLOW,
  parseAdvisoryText,
} = __test;

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  ok   " : "  FAIL ") + label);
  if (!ok) console.log("         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want));
  ok ? pass++ : fail++;
}

/* ---- single count, and what island it belongs to ---- */
console.log("\noutageCount");
const one = (t, tags) => {
  const r = outageCount(t, tags ? new Set(tags) : null);
  return r && { n: r.count, q: r.qualifier, s: r.scope };
};

eq("fewer than, island from next sentence (08-28)",
  one("Fewer than 400 customers remain without power. Approximately 99.4% of impacted customers on Hawaii Island have been restored.", ["HIC001"]),
  { n: 400, q: "fewer than", s: "HIC001" });

eq("island named inline (08-27)",
  one("Approximately 1,430 Hawaii Island customers remain without power."),
  { n: 1430, q: "approximately", s: "HIC001" });

eq("no 'customers' at all (08-21)",
  one("Currently, about 11,290 without power.", ["HIC001"]),
  { n: 11290, q: "about", s: "HIC001" });

eq("'are still' form (08-20)",
  one("About 13,380 are still without power.", ["HIC001"]),
  { n: 13380, q: "about", s: "HIC001" });

// The trap: read alone this is a statewide claim. The sentence before it is not.
eq("island comes from the PREVIOUS sentence (08-20 4pm)",
  one("As of 2:30 p.m., about 80% of impacted customers have been restored on Hawaii Island. Currently, about 13,000 are without power."),
  { n: 13000, q: "about", s: "HIC001" });

eq("explicit statewide is believed",
  one("About 9,000 customers statewide are without power."),
  { n: 9000, q: "about", s: "STATE" });

// Ambiguity must stay null, never default to statewide.
eq("two islands in the window stays unresolved",
  one("Crews worked on Oahu and Maui today. About 8,800 customers remain without power."),
  { n: 8800, q: "about", s: null });

eq("no figure at all (08-24 body)",
  one("Additional Hawaiian Electric employees arrived on Hawaii Island today, including lineworkers."),
  null);

/* ---- per-county breakdown ---- */
console.log("\ncountyBreakdown");
const aug18 =
  "As of 11 a.m.: Hawaii Island : Approximately 26,900 customers remain without power. " +
  "Most of the outages are in the Puna area, North and South Kona. " +
  "Maui County : With a majority of impacted customers brought back online, crews are focusing " +
  "today on restoring areas of Haiku and Peahi as well pocket outages in Upcountry, Kahului, " +
  "Lahaina, and East Maui. About 2,100 remain without power. " +
  "Oahu : About 11,400 customers remain without power in Honolulu, Leeward and Windward areas.";

eq("all three counties, number not adjacent to the heading",
  countyBreakdown(aug18),
  { HIC001: 26900, HIC003: 11400, HIC009: 2100 });

// The reason the breakdown regex must stay strict.
eq("outage phone numbers are not counts",
  countyBreakdown("Report an outage: Hawaii Island: 1-855-304-9191 or Report online Oahu: 1-855-304-1212 or Report online Maui County: 1-855-304-8181"),
  { HIC001: null, HIC003: null, HIC009: null });

/* ---- percent restored ---- */
console.log("\npercentRestored");
eq("island named after the verb (08-28)",
  percentRestored("Approximately 99.4% of impacted customers on Hawaii Island have been restored since Hurricane Lala."),
  { pct: 99.4, scope: "HIC001" });

eq("island named after 'restored' (08-20 4pm)",
  percentRestored("About 80% of impacted customers have been restored on Hawaii Island."),
  { pct: 80, scope: "HIC001" });

eq("no percentage present", percentRestored("Crews continue to work."), null);

/* ---- newest release is by date, not document order ---- */
console.log("\nnewestRelease");
const listing =
  '<div>August 11, 2026</div><h2><a href="/nearly-3500-rooftop-solar-systems-added-to-grids">Featured older promo item</a></h2>' +
  '<div>August 28, 2026</div><h3><a href="/hawaiian-electric-working-to-resolve-remaining-pocket-outages">Working to resolve remaining pocket outages</a></h3>' +
  '<div>August 24, 2026</div><h3><a href="/additional-hawaiian-electric-crews-arrive-on-hawaii-island">Additional crews arrive on Hawaii Island</a></h3>';
const nr = newestRelease(listing);
eq("skips the featured promo sitting above the list",
  nr && nr.path, "/hawaiian-electric-working-to-resolve-remaining-pocket-outages");

/* ---- event banner ---- */
console.log("\nalertBanner");
const withBanner =
  '<img src="/images/alert_icon.png" /> <a href="/hawaiian-electric-working-to-resolve-remaining-pocket-outages">We are working to resolve remaining pocket outages on Hawaii Island</a>';
eq("reads HECO's site-wide event banner",
  alertBanner(withBanner) && alertBanner(withBanner).headline,
  "We are working to resolve remaining pocket outages on Hawaii Island");
eq("absent banner returns null", alertBanner("<p>Newsroom</p>"), null);

/* NHC KML structural fixture, not a captured real file: it mirrors the shape
 * NHC's public GIS KMZ have used for years (multiple Placemark/Polygon rings
 * for wind radii and arrival-time bands, a LineString plus separate Point
 * placemarks for a track), so coordBlocks/decimate can be checked against a
 * realistic multi-ring document. It does NOT prove the real KMZ has this
 * exact structure today. Before trusting windExtent/arrival/bestTrack on
 * screen, fetch one live KMZ from a current storm and compare. */
const RADII_KML = `<kml><Document>
  <Folder><name>Wind Speed 34 Knots</name>
    <Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -157.0,20.0 -156.0,20.0 -156.0,21.0 -157.0,21.0 -157.0,20.0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
    <Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -157.0,19.0 -156.0,19.0 -156.0,20.0 -157.0,20.0 -157.0,19.0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  </Folder>
  <Folder><name>Wind Speed 64 Knots</name>
    <Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -156.8,20.2 -156.4,20.2 -156.4,20.6 -156.8,20.6 -156.8,20.2
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  </Folder>
</Document></kml>`;

const TRACK_KML = `<kml><Document>
  <Placemark><LineString><coordinates>
    -155.0,19.7 -156.0,20.1 -157.0,20.6 -158.0,21.2
  </coordinates></LineString></Placemark>
  <Placemark><Point><coordinates>-156.0,20.1,0</coordinates></Point></Placemark>
  <Placemark><Point><coordinates>-157.0,20.6,0</coordinates></Point></Placemark>
</Document></kml>`;

const radiiRings = coordBlocks(RADII_KML).filter((r) => r.length > 2);
eq("wind radii fixture: finds every quadrant ring across folders", radiiRings.length, 3);
eq("wind radii fixture: each ring keeps its own coordinates, not merged",
  radiiRings[0][0], [-157.0, 20.0]);
eq("wind radii fixture: rings stay closed (first point equals last)",
  radiiRings.every((r) => r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]),
  true);

const trackBlocks = coordBlocks(TRACK_KML);
const trackLines = trackBlocks.filter((b) => b.length > 1);
const trackPoints = trackBlocks.filter((b) => b.length === 1).map((b) => b[0]);
eq("track fixture: separates the line from the standalone points", trackLines.length, 1);
eq("track fixture: keeps both point placemarks", trackPoints.length, 2);
eq("track fixture: a bare point's z coordinate is dropped, not parsed as a 3rd axis",
  trackPoints[0], [-156.0, 20.1]);

/* Real KMZ structure, not a synthetic guess. Both fixtures are the actual KML
 * out of Hurricane Lowell advisory 36, fetched 2026-09-05, with the coordinate
 * lists truncated and the styling stripped so they stay readable. The shape
 * that matters, which Placemark carries which geometry type and what its name
 * is, is untouched.
 *
 * These pin the thing that was actually wrong: arrival time is LineStrings,
 * and treating it as polygons drew filled blobs where NHC draws contour lines. */
const REAL_WIND_KML = String.raw`<?xml version="1.0" encoding="utf-8" ?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document id="root_doc">
<Schema name="wind_field" id="wind_field">
        <SimpleField name="Name" type="string"></SimpleField>
        <SimpleField name="Description" type="string"></SimpleField>
</Schema>
<Folder><name>wind_field</name>
  <Placemark><name>34</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>-161.379944,15.5426741 -161.339371,15.5401411 -161.298889,15.5369225 -161.258514,15.5330181</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>50</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>-161.38855,14.54737 -161.366013,14.54883 -161.34343,14.5499067 -161.32077,14.5505962</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>64</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>-161.393066,14.0487919 -161.379547,14.0504045 -161.365967,14.0517864 -161.352325,14.0529366</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Folder></Document></kml>`;

const REAL_TOA_KML = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
    <Document>
        <name>Most-Likely Time of Arrival: EP122026_Adv36</name>
        <ExtendedData>
            <Data name="timezone">
                <value>HST</value>
            </Data>
            <Data name="storm">
                <value>Hurricane Lowell</value>
            </Data>
            <Data name="atcfid">
                <value>EP122026</value>
            </Data>
            <Data name="advisoryNum">
                <value>36</value>
            </Data>
            <Data name="pubAdvTime">
                <value>500 PM HST Fri Sep 04 2026</value>
            </Data>
        </ExtendedData>
        <Placemark id="label1a">
            <styleUrl>#style1a</styleUrl>
            <Point>
                <coordinates>-163.60495,13.39984,0.0</coordinates>
            </Point>
        </Placemark>
<Placemark id="label1b">
            <styleUrl>#style1b</styleUrl>
            <Point>
                <coordinates>-163.30029,14.52970,0.0</coordinates>
            </Point>
        </Placemark>
<Placemark> 
            <Snippet maxLines="0">empty</Snippet>
            <styleUrl>#toa_line</styleUrl>
            <LineString>
                <coordinates>-163.206299,11.3173437,0.0 -163.170837,11.6846085,0.0 -163.170837,11.8661032,0.0 -163.251297,12.0595779,0.0</coordinates> 
            </LineString>
        </Placemark>
<Placemark> 
            <Snippet maxLines="0">empty</Snippet>
            <styleUrl>#toa_line</styleUrl>
            <LineString>
                <coordinates>-165.412064,12.4473343,0.0 -165.401215,12.5590534,0.0 -165.321152,12.7078800,0.0 -165.246506,12.8636036,0.0</coordinates> 
            </LineString>
        </Placemark>
<Placemark> 
            <Snippet maxLines="0">empty</Snippet>
            <styleUrl>#toa_line</styleUrl>
            <LineString>
                <coordinates>-167.059128,16.0510197,0.0 -166.975739,16.0405006,0.0 -166.794556,16.0405006,0.0 -166.613373,16.1032982,0.0</coordinates> 
            </LineString>
        </Placemark>
</Folder></Document></kml>`;

const windPm = placemarks(REAL_WIND_KML);
eq("real wind KMZ: every placemark is a Polygon", windPm.every((p) => p.type === "Polygon"), true);
eq("real wind KMZ: three wind thresholds, not four quadrants", windPm.length, 3);
eq("real wind KMZ: names are the knot thresholds, kept in order",
  windPm.map((p) => p.name), ["34", "50", "64"]);
eq("real wind KMZ: a threshold parses to a number for styling",
  parseInt(windPm[2].name, 10), 64);

const toaPm = placemarks(REAL_TOA_KML);
eq("real arrival KMZ: carries no Polygon at all",
  toaPm.some((p) => p.type === "Polygon"), false);
eq("real arrival KMZ: isochrones are LineStrings",
  toaPm.filter((p) => p.type === "LineString").length, 3);
eq("real arrival KMZ: label anchors are Points and stay separable",
  toaPm.filter((p) => p.type === "Point").length, 2);
eq("real arrival KMZ: a line keeps more than one coordinate",
  toaPm.find((p) => p.type === "LineString").coords.length > 1, true);

const bigRing = Array.from({ length: 400 }, (_, i) => [i * 0.01, i * 0.01]);
const thinned = decimate(bigRing, 150);
eq("decimate: shrinks a 400 point ring to at most 150", thinned.length <= 150, true);
eq("decimate: keeps the ring's true last point so it still closes",
  thinned[thinned.length - 1], bigRing[bigRing.length - 1]);

/* ---- ATCF model-track ("spaghetti") parsing ---- */
console.log("\natcf model tracks");

eq("parseAtcfLatLon: tenths of a degree, hemisphere sign",
  parseAtcfLatLon("132N", "1453W"), [-145.3, 13.2]);
eq("parseAtcfLatLon: southern/eastern hemispheres too",
  parseAtcfLatLon("54S", "1720E"), [172.0, -5.4]);

eq("parseAtcfLine: reads cycle/tech/tau/lat/lon from a real a-deck row",
  parseAtcfLine("CP, 02, 2026081906, 03, AC00,   0,  92N, 1357W,  21, 1010, XX,  34, NEQ,    0,    0,    0,    0, "),
  { cycle: "2026081906", tech: "AC00", tau: 0, lon: -135.7, lat: 9.2 });
eq("parseAtcfLine: too few fields is null, not a crash", parseAtcfLine("CP, 02"), null);
eq("parseAtcfLine: blank line is null", parseAtcfLine(""), null);

/* A trimmed but real-shaped a-deck fixture: two cycles (so the older one
   must be dropped), two allowed models plus one non-allowed ensemble member
   (AP01, which must not appear), a duplicate tau on AVNI from a second wind
   radii row (must be deduped to the first value, not doubled), and TVCN
   consensus. Field values are lifted from the shape of real NHC rows, not
   invented numbers. */
const ATCF_FIXTURE = [
  "EP, 12, 2026090312, 03, AVNI,   0, 136N, 1581W,  55,  985, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, AVNI,  12, 141N, 1605W,  58,  980, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, AVNI,  12, 141N, 1605W,  58,  980, XX,  50, NEQ,   0,", // dup tau, same tech
  "EP, 12, 2026090312, 03, AVNI,  24, 148N, 1630W,  60,  975, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, UKXI,   0, 136N, 1581W,  50,  990, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, UKXI,  12, 139N, 1598W,  52,  988, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, TVCN,   0, 136N, 1581W,  54,  986, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, TVCN,  12, 140N, 1602W,  56,  982, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, AP01,   0, 136N, 1581W,  51,  989, XX,  34, NEQ,   0,", // not in MODEL_TRACK_ALLOW
  "EP, 12, 2026090312, 03, AP01,  12, 142N, 1610W,  53,  984, XX,  34, NEQ,   0,",
  "EP, 12, 2026090312, 03, CMCI,   0, 136N, 1581W,  49,  991, XX,  34, NEQ,   0,", // only 1 point: dropped
  "EP, 12, 2026090306, 03, AVNI,   0, 130N, 1560W,  40,  995, XX,  34, NEQ,   0,", // older cycle: dropped
  "EP, 12, 2026090306, 03, AVNI,  12, 133N, 1570W,  42,  993, XX,  34, NEQ,   0,",
].join("\n");

const modelResult = atcfModelTracks(ATCF_FIXTURE);
const byTech = Object.fromEntries((modelResult ? modelResult.features : []).map((f) => [f.properties.tech, f]));

eq("atcfModelTracks: keeps AVNI and UKXI and TVCN, drops the 1-point CMCI",
  Object.keys(byTech).sort(), ["AVNI", "TVCN", "UKXI"]);
eq("atcfModelTracks: AP01 (not in MODEL_TRACK_ALLOW) never appears",
  modelResult.features.some((f) => f.properties.tech === "AP01"), false);
eq("atcfModelTracks: duplicate tau on AVNI deduped to 3 points, not 4",
  byTech.AVNI.geometry.coordinates.length, 3);
eq("atcfModelTracks: AVNI line follows tau order, older cycle's [130N,1560W] excluded",
  byTech.AVNI.geometry.coordinates, [[-158.1, 13.6], [-160.5, 14.1], [-163.0, 14.8]]);
eq("atcfModelTracks: friendly name is carried on the feature",
  byTech.AVNI.properties.name, "GFS");
eq("atcfModelTracks: no rows at all returns null", atcfModelTracks(""), null);
eq("atcfModelTracks: rows present but none pass the allow-list or point-count filter returns null",
  atcfModelTracks("EP, 12, 2026090312, 03, AP01,   0, 136N, 1581W,  51,  989, XX,  34, NEQ,   0,"), null);

/* ---- NHC public advisory text parsing ---- */
console.log("\npublic advisory text");

/* A real bulletin, fetched live 2026-09-04 from
   https://www.nhc.noaa.gov/text/HFOTCPCP4.shtml (Hurricane Lowell, Advisory
   30). Pinned verbatim, not reconstructed, so a future format change in
   NHC's bulletins shows up here first. */
const REAL_ADVISORY = `599
WTPA34 PHFO 032036
TCPCP4

BULLETIN
Hurricane Lowell Advisory Number  30
NWS Central Pacific Hurricane Center Honolulu HI   EP122026
Issued by NWS National Hurricane Center Miami FL
1100 AM HST Thu Sep 03 2026

...LOWELL EXPECTED TO REMAIN A MAJOR HURRICANE FOR THE NEXT SEVERAL
DAYS...
...INTERESTS IN THE HAWAIIAN ISLANDS SHOULD MONITOR THE PROGRESS
OF LOWELL...


SUMMARY OF 1100 AM HST...2100 UTC...INFORMATION
-----------------------------------------------
LOCATION...13.6N 158.1W
ABOUT 465 MI...750 KM SSW OF HILO HAWAII
ABOUT 585 MI...945 KM S OF LIHUE HAWAII
MAXIMUM SUSTAINED WINDS...140 MPH...220 KM/H
PRESENT MOVEMENT...W OR 275 DEGREES AT 10 MPH...17 KM/H
MINIMUM CENTRAL PRESSURE...945 MB...27.91 INCHES


WATCHES AND WARNINGS
--------------------
There are no coastal watches or warnings in effect.

Interests in the Hawaiian Islands should monitor the progress of
Lowell.


DISCUSSION AND OUTLOOK
----------------------
At 1100 AM HST (2100 UTC), the center of Hurricane Lowell was
located near latitude 13.6 North, longitude 158.1 West. Lowell is
moving toward the west near 10 mph (17 km/h). This general motion
with a gradual decrease in forward speed is expected during the next
couple of days, followed by a turn toward the northwest and north
this weekend.

Maximum sustained winds are near 140 mph (220 km/h) with higher
gusts. Lowell is a category 4 hurricane on the Saffir-Simpson
Hurricane Wind Scale. Some fluctuations in intensity are expected
during the next few days. However, Lowell is expected to remain a
major hurricane through the weekend.

Hurricane-force winds extend outward up to 40 miles (65 km) from the
center and tropical-storm-force winds extend outward up to 140 miles
(220 km).

The estimated minimum central pressure is 945 mb (27.91 inches).


HAZARDS AFFECTING LAND
----------------------
Key messages for Lowell can be found in the Tropical Cyclone
Discussion under AWIPS header HFOTCDCP4 and WMO header WTPA44
PHFO.

SURF: Swells from Lowell are likely to cause life-threatening surf
and rip current conditions during the next several days. Please
consult products from your local weather office.


NEXT ADVISORY
-------------
Next complete advisory at 500 PM HST.

$$
Forecaster Reinhart

`;

const adv = parseAdvisoryText(REAL_ADVISORY);
eq("real advisory: label drops the double space", adv.label, "Hurricane Lowell Advisory Number 30");
eq("real advisory: issued time", adv.issued, "1100 AM HST Thu Sep 03 2026");
eq("real advisory: headline spans reassembled across wrapped source lines", adv.headline, [
  "LOWELL EXPECTED TO REMAIN A MAJOR HURRICANE FOR THE NEXT SEVERAL DAYS",
  "INTERESTS IN THE HAWAIIAN ISLANDS SHOULD MONITOR THE PROGRESS OF LOWELL",
]);
eq("real advisory: finds all 5 labelled sections in order",
  adv.sections.map((s) => s.title),
  [
    "SUMMARY OF 1100 AM HST...2100 UTC...INFORMATION",
    "WATCHES AND WARNINGS",
    "DISCUSSION AND OUTLOOK",
    "HAZARDS AFFECTING LAND",
    "NEXT ADVISORY",
  ]);
eq("real advisory: a paragraph's own word-wrap is rejoined into one line",
  adv.sections[2].paragraphs[0],
  "At 1100 AM HST (2100 UTC), the center of Hurricane Lowell was located near latitude 13.6 North, longitude 158.1 West. Lowell is moving toward the west near 10 mph (17 km/h). This general motion with a gradual decrease in forward speed is expected during the next couple of days, followed by a turn toward the northwest and north this weekend.");
eq("real advisory: WATCHES AND WARNINGS keeps its 2 separate paragraphs, not merged",
  adv.sections[1].paragraphs.length, 2);
eq("real advisory: blank/malformed text returns null, not a throw", parseAdvisoryText("nothing useful here"), null);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
