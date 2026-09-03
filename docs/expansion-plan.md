# Expansion plan: action-first layout + directories

Decided 2026-08-21 with the owner, after reviewing an outside brainstorm doc
(MVP concepts 1 through 6). Supersedes parts of "Planned additions (decided
2026-08-19)" in CLAUDE.md where they conflict. This file is the plan of record
for the work below.

## Decisions made

1. **Adopt:** action-first home layout, resource directory (MVP 1), pet and
   animal layer (MVP 4), recovery directory (MVP 5).
2. **Layout:** the five action buttons go **above the existing board**. The
   board, map, bands, folds, and all current routes stay. Nothing is removed.
3. **The "only self-managing feeds" rule (2026-08-19) is reversed** for
   evergreen directory resources. Hand-curated entries are allowed when they
   carry source, verified-at, and expiry, and are re-verified periodically.
   Per-event hand-entered status (water pressure, school closures, etc.)
   remains governed by prior decisions.
4. **Not adopted:** community check-in board (MVP 6). Needs accounts,
   moderation, and abuse handling. Parked, not rejected forever.
5. **Architecture does not change.** Single file, no build step, no framework,
   no runtime backend dependency. A Supabase admin console may come later as a
   curation tool that emits static JSON (served by the worker or baked into
   the file), never as something the page needs to render.

## What the brainstorm got wrong (do not implement)

The brainstorm doc was written without knowledge of this codebase. Three of
its technical recommendations are known-bad here:

- Resolving zones via `/points` at runtime. Reintroduces the Hurricane Lala
  bug. Keep hardcoded zones and the point-plus-zone merge (see CLAUDE.md,
  "Fetching alerts").
- Proxying all NWS traffic through a server. CORS-open hosts stay direct;
  the worker exists only where CORS forces it.
- React/TypeScript/Supabase/Vercel-functions stack. Defeats the offline
  single-file property that is the point of this site.
- Its severity-colored status banner is the severity color system that was
  built, rejected, and removed. Band colors stay fixed per category.

Also note: MVP 2 and MVP 3 are effectively already shipped (the board, the
map, the shelter cards). Do not rebuild them.

## Phases

### Phase 1: action-first home

Five large action buttons between the location strip and the board, using the
existing hash router:

    WHAT'S HAPPENING NOW   -> #weather (exists)
    FIND A SAFE PLACE      -> #emergency (exists; shelters live here)
    GET HELP               -> #help (new, directory)
    PETS AND ANIMALS       -> #pets (new, directory filtered)
    REPORT OR RECOVER      -> #recover (new)

Constraints: the five-value palette is closed, so buttons use existing values
(likely ink ground, accent step numbers, same pattern as the plan panel).
Radius 0, Archivo, sizes from the handoff tables. Test at 375px. The handoff
does not draw these buttons, so get the owner's sign-off on the visual
treatment before building (see open questions).

### Phase 2: directory data model

New inlined registry array `RESOURCES` (mirrored in `sources.json`), one entry
per resource:

    {id, name, cat, island, county, lat, lon, addr, phone, url,
     eligibility, pets, access, notes,
     srcName, srcUrl, verifiedAt, expiresAt}

- `resourceOK()` gates rendering exactly as `reportOK()` does: no srcName,
  srcUrl, or verifiedAt means the entry does not render. Invariant 3.
- Past `expiresAt`, the card renders with a "status needs verification" flag.
  It never silently implies open. Invariant 1 applies to a food bank the same
  as to a shelter.
- Categories: food, water, charging, medical, shelter-adjacent, transport,
  animal (vet, boarding, foster, rescue, supplies), recovery (damage report,
  cleanup, FEMA/insurance, volunteer), agency (211, DEM, HI-EMA).
- Seed Oʻahu first (target 75 to 150 vetted entries), then the other islands.
  Vet every link per "Vetting a new external link" in CLAUDE.md.

### Phase 3: directory views

- `#help`: list first, no map requirement. Category filter chips (existing
  chip pattern), distance sort via the existing haversine, cards with
  directions and call actions, source and verified-at line on every card.
- `#pets`: the same machinery filtered to animal categories, plus pet rules
  for shelters (NSS carries pet fields; see feed-verification.md).
- `#recover`: recovery categories plus the already-agreed "after the storm"
  fold content.
- Empty states stay honest per invariant 6: no entries for an island means
  say so and point at the county agency.

### Phase 4: layer live data back in

Nothing existing moves. Additions on top:

- FEMA/Red Cross NSS open-shelters feed (verified 2026-08-19, see
  feed-verification.md) feeds FIND A SAFE PLACE for the three counties with
  no live shelter source. Run the CORS check first; it is still unverified.
- Hand-flipped recovery mode highlights REPORT OR RECOVER during recovery.
- The rest of the 2026-08-19 shortlist (NWPS stages, CO-OPS tides, wind
  timing) proceeds unchanged; it is orthogonal to this plan.

## Open questions for the owner

1. Visual treatment of the five action buttons (no handoff drawing exists).
   Describe and ask before building; do not invent decoration.
2. Whether directory seeding beyond Oʻahu happens before or after Phase 4.
3. When curation load justifies the Supabase-to-static-JSON admin tool.
