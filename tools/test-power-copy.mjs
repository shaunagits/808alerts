/* What the POWER band and card actually say, in every state.
 *
 * Lifts the real helpers out of index.html rather than restating them, so
 * this tests the shipped copy and not a paraphrase of it. Run after touching
 * anything in the POWER path.
 *
 *   node tools/test-power-copy.mjs
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* Pull named declarations out of the page source by name. */
function grab(names) {
  const out = [];
  for (const n of names) {
    const re = new RegExp("(?:^|\\n)(const " + n + "=[\\s\\S]*?);\\n(?=(?:const|let|function|/\\*|\\n))", "m");
    const m = src.match(re);
    if (!m) throw new Error("could not find: " + n);
    out.push(m[1]);
  }
  return out.join(";\n") + ";";
}

const helpers = grab(["powerLive", "powerQuiet", "powerCount", "powerCountLower", "powerOthers", "powerSince"]);

/* The helpers close over POWER and S as globals in the page, so bind them as
   locals of a factory and hand back the functions. */
const factory = new Function(
  "state",
  `let POWER=state.POWER, S=state.S;
   ${helpers}
   return {powerLive,powerQuiet,powerCount,powerCountLower,powerOthers,powerSince};`
);

/* The band copy, copied structurally from renderBands() in index.html. */
function band(state) {
  const H = factory(state);
  const { POWER, S } = state;
  const UTILITY = (c) => (c === "HIC007" ? "Kauaʻi Island Utility Cooperative" : "Hawaiian Electric");
  if (H.powerLive()) {
    const t = POWER.asOf ? ", as of " + POWER.asOf.replace(/\.$/, "") : "";
    const where = POWER.countyShort || POWER.countyName;
    const others = H.powerOthers();
    const rest = others.length
      ? others.map((b) => b.name + " " + b.count.toLocaleString()).join(", ") + ". "
      : "";
    return POWER.out != null
      ? { head: H.powerCount(POWER.out, POWER.outQualifier) + " without power on " + where,
          sub: rest + "Hawaiian Electric" + t + ". A snapshot, not a live reading." }
      : { head: H.powerCount(POWER.totalStatewide, POWER.statewideQualifier) + " without power statewide" +
                (POWER.percentRestored ? ", " + POWER.percentRestored + "% restored" : ""),
          sub: "Hawaiian Electric" + t + ". A snapshot, not a live reading." };
  }
  if (H.powerQuiet()) {
    return { head: "No storm outages reported for " + (POWER.countyShort || POWER.countyName),
             sub: "Hawaiian Electric has not reported one since " + H.powerSince() +
                  ". This does not cover everyday outages. Check their map for your block." };
  }
  if (POWER && POWER.utility === "KIUC") {
    return { head: "Outages here are not tracked yet",
             sub: "Kauaʻi is served by KIUC, not Hawaiian Electric, and KIUC publish no feed we can read. Check KIUC.", feed: false };
  }
  return { head: "Outage reports are not loading",
           sub: "We could not reach Hawaiian Electric's updates. That is not a reading either way. Check " + UTILITY(S.c) + ".", feed: false };
}

const CASES = [
  ["recovery, count for your island (live, 2026-08-28 Hawaiʻi Island)", {
    S: { c: "HIC001" },
    POWER: { available: true, countyShort: "Hawaiʻi Island", out: 400, outQualifier: "fewer than",
             totalStatewide: null, percentRestored: 99.4, breakdown: [], published: "2026-08-28" } }],

  ["peak, your island plus the others HECO listed (2026-08-18 shape)", {
    S: { c: "HIC003" },
    POWER: { available: true, countyShort: "Oʻahu", out: 11400, outQualifier: "about",
             totalStatewide: null, asOf: "11 a.m.", published: "2026-08-18",
             breakdown: [{ zone: "HIC001", name: "Hawaiʻi Island", count: 26900 },
                         { zone: "HIC003", name: "Oʻahu", count: 11400 },
                         { zone: "HIC009", name: "Maui County", count: 2100 }] } }],

  ["quiet, HECO published but not about your island (Oʻahu today)", {
    S: { c: "HIC003" },
    POWER: { available: false, countyShort: "Oʻahu", out: null, totalStatewide: null,
             published: "2026-08-24", daysSince: 4, eventActive: true,
             eventHeadline: "We are working to resolve remaining pocket outages on Hawaii Island" } }],

  ["Kauaʻi, KIUC territory", {
    S: { c: "HIC007" },
    POWER: { available: false, countyShort: "Kauaʻi", utility: "KIUC" } }],

  ["worker unreachable", { S: { c: "HIC003" }, POWER: false }],

  ["explicit statewide figure, if HECO ever publish one", {
    S: { c: "HIC003" },
    POWER: { available: true, countyShort: "Oʻahu", out: null, totalStatewide: 9000,
             statewideQualifier: "about", percentRestored: 80, breakdown: [], published: "2026-08-20" } }],
];

let bad = 0;
for (const [label, state] of CASES) {
  const b = band(state);
  console.log("\n" + label);
  console.log("   " + b.head);
  console.log("   " + b.sub);

  const all = (b.head + " " + b.sub).toLowerCase();
  // Invariant 1 / 6: never assert that power is on or that outages are absent.
  for (const banned of ["no outages", "no power outages", "all clear", "power is on", "fully restored"]) {
    if (all.includes(banned)) { console.log("   !! asserts absence: " + banned); bad++; }
  }
  if (b.head.includes("—")) { console.log("   !! em dash"); bad++; }
  // A count in the headline must always carry a source in the sub-line.
  if (/\d/.test(b.head) && !/hawaiian electric|kiuc/i.test(b.sub)) {
    console.log("   !! number with no source"); bad++;
  }
}
console.log("\n" + (bad ? bad + " problems" : "no problems"));
process.exit(bad ? 1 : 0);
