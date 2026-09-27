# Feed design (2026-09-23): the current home page

The design handoff for the alert feed that replaced the board, map and bands
home page on 2026-09-23. It supersedes every earlier handoff in `docs/` for the
home page. The earlier files stay as history.

Live canvas (private to the owner until shared from its Share menu):
https://claude.ai/artifact/AWidAf7dwXebGqkiKgT3PT

These files are a copy of that canvas as of 2026-09-26. `canvas.json` is the
layout; each `.dc.html` is one artboard. They render on the canvas, not as
plain pages in a browser (they expect the canvas's `support.js`).

| Artboard | What it shows |
|---|---|
| `Main.dc.html` | Mobile feed, all islands (Tropical Storm Nolo, 2026-09-23) |
| `Mobile-Kauai.dc.html` | Mobile feed filtered to Kauaʻi: nothing in effect, honest empty state |
| `Desktop.dc.html` | Desktop feed, all islands |
| `Detail.dc.html` | Alert detail: Hurricane Watch with "Find your area" per-zone ratings |
| `Quiet.dc.html` | Nothing in effect anywhere (uses Mon Sep 21, a real quiet day) |
| `Warning.dc.html` | A warning pinned above the feed (scenario, sample cards) |
| `Stale.dc.html` | NWS unreachable: banner plus AS OF tags on NWS cards |

What shipped differs from the canvas in a few places, decided after the design:
- The top of the page is only the brand bar, the updated time, a MAP button and
  the island dropdown. Get Ready links sit at the end of the feed, not in the header.
- The dropdown switches between pages (All, Kauaʻi, Oʻahu, Maui County, Hawaiʻi
  Island) instead of filtering in place; Molokaʻi and Lānaʻi are under Maui County.
- Alerts open at real addresses (`/alert/<slug>`), and the pages are rendered on
  Cloudflare before they are sent. See "How the pages are built and served" in
  CLAUDE.md.
- HI-EMA and Governor cards on the canvas are illustrative only: those sources
  are not wired (no feed yet).

The code that renders all of this is in `tools/site/src/`; the canvas is the
visual reference, not the source.
