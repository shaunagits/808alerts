/* Live check of /api/power against Hawaiian Electric's newsroom.
 *
 * Runs the deployed worker's own module for all four counties and prints what
 * the board would show. Not a unit test: it hits the live site on purpose,
 * because every bug this has had came from real copy changing, not from logic.
 *
 *   node test-power.mjs
 */
import worker from "./src/index.js";

const COUNTIES = ["HIC001", "HIC003", "HIC007", "HIC009"];

for (const c of COUNTIES) {
  const res = await worker.fetch(
    new Request("https://x/api/power?county=" + c, {
      headers: { Origin: "https://808alerts.com" },
    })
  );
  const d = await res.json();
  console.log("\n===== " + c + "  " + (d.countyShort || "") + " =====");
  if (d.error) {
    console.log("  error:", d.error);
    continue;
  }
  if (d.utility) {
    console.log("  utility:", d.utility, "|", d.note);
    continue;
  }
  console.log("  available          ", d.available);
  console.log("  out                ", d.outQualifier || "", d.out);
  console.log("  totalStatewide     ", d.statewideQualifier || "", d.totalStatewide);
  console.log("  percentRestored    ", d.percentRestored, "scope:", d.percentRestoredScopeName || d.percentRestoredScope);
  console.log("  newest release     ", d.published, "(" + d.daysSince + " days ago)");
  console.log("  title              ", (d.title || "").slice(0, 78));
  console.log("  asOf               ", d.asOf);
  console.log("  eventActive        ", d.eventActive, d.eventHeadline ? "| " + d.eventHeadline.slice(0, 60) : "");
}
