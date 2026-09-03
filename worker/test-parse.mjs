/* Parser regression check against real Hawaiian Electric releases.
 *
 * Every case here is a sentence HECO actually published during Hurricane Lala,
 * 2026-08-18 to 08-28. When a future release breaks the parser, add the new
 * phrasing here first, then fix the regex.
 *
 *   node test-parse.mjs
 */
import { __test } from "./src/index.js";

const { countyBreakdown, outageCount, percentRestored, newestRelease, alertBanner, coordBlocks, decimate } = __test;

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

const bigRing = Array.from({ length: 400 }, (_, i) => [i * 0.01, i * 0.01]);
const thinned = decimate(bigRing, 150);
eq("decimate: shrinks a 400 point ring to at most 150", thinned.length <= 150, true);
eq("decimate: keeps the ring's true last point so it still closes",
  thinned[thinned.length - 1], bigRing[bigRing.length - 1]);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
