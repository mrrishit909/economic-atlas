# QA report: P05 Economic Atlas (task P05-QA-001)

Independent QA reviewer (qa-reviewer, Claude Opus 5.5), 2026-10-11. I did not build this site.
Build under test: `main` at `efa96a0` (includes `170b453` and docs `3ea68ce`), fresh `npm run build`, served
by `site/tests/serve.mjs` (production `vite preview`, restart loop) on port 4341. Machine: Mac15,6 (M3 Pro),
load average 9 to 52 during the session (other agents plus my own runs; each measurement below states its load).

**Verdict: FAILED.** 2 blockers, 8 majors. The measured rows pass: performance, suites and axe are all clean.
The failures are visual and composition (reduced motion, S02 cards, phone headers), honesty during
transitions (S05 basis swap, criterion 7), silent artifact failures (L4), and UX (inspector persistence,
S07 landing, ATLAS phone composition).

## 1. What I ran

| Check | Command / probe | Result |
|---|---|---|
| Python | `uv run pytest -q` (no seed-head rebuild) | **59 passed** (38.8 s) |
| Types | `npm run typecheck` | clean |
| Lint | `npm run lint` | clean |
| Vitest | `npm test` | **110 passed** (9 files) |
| Playwright | `npx playwright test --workers 1 --retries 0` | **153 passed, 72 skipped, 0 failed** (13.6 min, load 13 to 29). No reruns needed |
| Evidence harness | `site/tests/evidence-harness.mjs` + `evidence.config.json`, headed Chromium, renderer **ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro)** | 7 required viewports + 1280x720 + classic-scrollbar 1024x768 / 768x1024 + reduced 1440x900 / 390x844; S00 frozen intro frames (7 clocks), 35 to 68 states per viewport, 111-step scroll pass, contact sheets, `.webm` recordings (gitignored) |
| axe | `probes/a11y.mjs` (wcag2a/aa, 21a/aa), 11 landings x {1440, 390} x {normal, reduced}, landed by the nav jump path | **44 scans, 0 violations** (`a11y.json`) |
| Keyboard | `probes/a11y.mjs` keyboard journey | 19 of 19 behaviours work (`keyboard.json`). One probe miss (S06 ORDER BY) was a probe key choice; rechecked with type-ahead "a": ORDER BY AGR SHARE gives rho -0.88, n 174 |
| L4 route-block | `probes/routeblock.mjs`: 49 artifact-scene pairs x {1440, 390}, 404 until RETRY, real-pointer RETRY | 59 of 98 pass; failures analysed in D-004 (`routeblock.json`) |
| L4 extra | `probes/extra.mjs`: 16 per-indicator seedheads x 2 viewports, S02 cards at their own positions, inspector files | seedheads **32 of 32 pass** (alert visible, real-pointer RETRY, exactly 1 refetch, recovered); S02 cards **8 of 8 pass**; inspector **0 of 4** |
| Lessons | `probes/lessons.mjs`: L1/L2/L3/L5/L7/L8/L9/L11/L12/L13/L14 at all 8 viewports, reduced at 5, classic at 2 | `lessons.log`, `lessons/*.json` |
| L16 | `probes/lessons.mjs` text-hidden capture + `probes/contrast.py` (p95 background under each box, alpha-composited) at 1440/768/390 | 27 of 624 boxes under 4.5:1 (`contrast.txt`) |
| Lighthouse | `site/tests/run-lighthouse.sh` x3, mobile and desktop (lighthouse@13, headless) | mobile perf **0.99/0.99/0.99**, LCP **1.85/1.81/1.83 s**, CLS 0, TBT 53/0/0 ms; desktop perf **1.0** x3, LCP 0.41 s; a11y 1.0; BP 0.96 (favicon 404). Load **29 to 36** throughout (`lighthouse/summary.jsonl`) |
| Frame pacing | harness `--pacing-only` (ATLAS Reflow PPP to agriculture share and back) + `probes/pacing-s00.mjs` (S00 sort), headed, ANGLE Metal, M3 Pro, load 29 to 32 | ATLAS Reflow: p50 8.3 / p95 10.2 ms unthrottled, p95 10.4 ms at 4x CPU (1440 and 390), at most 0.7% of frames over 16.7 ms. S00 sort: p50 8.3 to 8.4 / p95 10.0 to 10.4 ms, at most 1% over 16.7 ms. A 120 Hz display, so roughly 100 to 120 fps |

## 2. Defect register (severity-ranked)

Severity scale: blocker (fails a hard rejection criterion or makes a first view unusable) > major > minor > low.
Evidence paths are relative to `artifacts/evidence/qa/`. Paths under `../recordings/qa-local-only/` are kept locally
only (size budget) and are not committed.

### P05-D-001 · BLOCKER · reduced motion: S00 overlay and S01 print on top of each other at first paint
- **Where:** S00 and S01 (`src/scenes/S00Layer.tsx`, S01 statement and cards; reduced-motion flow CSS). Seen at 1440x900, 768x1024, 390x844, 375x812 and 360x800, all reduced.
- **Repro:** set `prefers-reduced-motion: reduce`, load `/economic-atlas/`, and do not scroll.
- **Expected:** MOTION_SYSTEM 8: "S00: the intro shows its end state at once", and "S01: statement, the disc at G1, and the cards" in normal flow. Each layer is readable on its own.
- **Actual:** the S01 statement ("Per person, the richest economy produces 131 times what the poorest does.") and both notification cards render on top of the S00 headline, the corner labels, the no-data set, the honesty chips and the legend. The first viewport is unreadable for every reduced-motion visitor. The collision probe flags 6+ overlaps per viewport: for example "NO GDP PER CAPITA ... 32 COUNTRIES" x the statement (236x67 px at 1440), and "OBSERVED · WORLD BANK WDI" x the statement (648x33 at 768).
- **Evidence:** `screenshots/1440x900-reduced/00-s00-end.jpg`, `screenshots/390x844-reduced/00-s00-end.jpg`, `lessons.log` (sections ending `-reduced`).
- **Verification test:** reduced motion at 1440/768/390/375/360: the bbox collision test over the S00 overlay and the S01 track at scrollY 0 and at S01's top returns no pairs, plus a screenshot read.

### P05-D-002 · BLOCKER · S05 BASIS swap shows two price bases at once (criterion 4)
- **Where:** S05 Lab (`src/scenes/S05Lab.tsx`, `Plane.tsx`). Seen at 1440x900 and 390x844.
- **Repro:** at the S05 lab (p 0.5, PPP 1990), click CONSTANT US$ with a real pointer. Then sample the plane `<text>`, `.plane-read` and the record chip every 25 ms.
- **Expected:** VISUAL_DESIGN S05 and MOTION_SYSTEM 5.7: the axes and units swap atomically while the plane is neutral, and no frame shows two bases (rejection criterion 4: "two price bases on one axis, legend ... or readout at the same time").
- **Actual:** for about 180 ms (7 of 74 samples, t 13 to 181 ms), the readout and chip already show the constant-USD record (`SLOPE -0.03 ... N 102`, `GDPPC_CONST_1960_2024_PRIMARY`, window 1960). The x axis still reads `GDP PER CAPITA IN 1990 · CONSTANT 2021 INTL $ (PPP)`, the PPP iso3 labels (GUY, GNQ, BIH, NRU) are still drawn, and the PPP fit line is visible. The builder's test samples only `#lab .plane text`, so it cannot see the readout.
- **Evidence:** `extra.log` (`s05_basis_swap`), `screenshots/1440x900/s05-06-basis-t120.jpg`, `screenshots/390x844/s05-06-basis-t120.jpg`.
- **Verification test:** sample the axis text, `.plane-read`, the chip and `debug().palette` together every 25 ms across the swap. The union of bases is at most 1 in every sample.

### P05-D-003 · MAJOR · S02 cards 2 and 4 overprint their own text at desktop sizes (L2)
- **Where:** S02 (`src/scenes/S02Sources.tsx`, card CSS). Seen at 1920x1080, 1440x900, 1280x720 and 1440 reduced.
- **Repro:** jump to `sources` at p 0.314 (card 2) and p 0.694 (card 4).
- **Expected:** card anatomy (VISUAL_DESIGN S02) with no text collisions.
- **Actual:**
  - Card 4: the 1820 and 1870 spread bars and their labels run through the serif title "another dollar."
  - Card 4: the IMF and Maddison attribution lines are overprinted by the body "MADDISON'S LONG-RUN SERIES ..." at 1440, and are fully illegible at 1280.
  - Card 2: the title's last line overlaps "INDONESIA · THE MIDDLE PERSON'S COUNTRY", and the "CURRENT US$ · 2024" chip overlaps the body.
  - The builder's L2 tests run only at 1024/768/390/1280 and only at landing p 0.14, so they never see cards 2 or 4 at 1440. DOM boxes also miss the text that overflows a fixed-height visual zone.
- **Evidence:** `screenshots/1440x900/s02-01-card2.jpg`, `screenshots/1440x900/s02-03-card4.jpg`, `contact-sheets/1280x720.jpg` (frames 16 to 18), `lessons.log` ("Three different dollars." x "INDONESIA ..." at 1920/1440/1280).
- **Verification test:** a collision test at every card position (p 0.124/0.314/0.504/0.694) and every viewport, with `scrollHeight <= clientHeight` on each card's visual zone and body.

### P05-D-004 · MAJOR · silent artifact failures in five scenes and the inspector (L4)
- **Where:** S03a and S03b (facts, countries, indicators, `seedhead/gdppc_ppp_latest`, panel_income are read without a RETRY handle: `S03bWeight.tsx:34-39`), S06 (facts), S07 (facts, meta: `S07Evidence.tsx:36-37`), ATLAS (meta: `Atlas.tsx:24`), Inspector (narratives, boundaries: `Inspector.tsx:22-23`). Seen at 1440x900 and 390x844.
- **Repro:** route `facts.json` (or the file named) to 404, then deep-link `#weight`, `#evidence`, `#likeness` or `#atlas`.
- **Expected:** QA L4. Every scene that consumes an artifact renders its own inline `COULD NOT LOAD … · RETRY` in view, and RETRY recovers after one refetch.
- **Actual:**
  - facts blocked:
    - S03b's spread ledger, slope ledger and not-causal copy vanish with no line.
    - S07 shows only "How we know." and an empty stage: all seven exchanges are gone.
    - S06 loses its silhouette and ARI ledger.
    - The only alert lives in the S00 portal (`eb-portal`), which is not in view.
  - `seedhead/gdppc_ppp_latest` blocked:
    - S03b's YEAR toggle reads `1990 | 0`.
    - The readout reads `0 SEEDS · 1 PER COUNTRY · 0` over neutral dust.
  - meta blocked: the ATLAS status line loses the WDI vintage (`· WDI`).
  - Inspector:
    - With narratives blocked, the narrative paragraphs disappear.
    - With boundaries blocked, Germany's `TERRITORY NOTE: REUNIFICATION` disappears.
    - Neither failure is shown in the inspector.
  - Passing: every per-indicator seedhead (32/32), convergence, clusters, correlations, validation, coverage, boundaries (S07), longrun, reconciliation and panel_income (S02 cards) pass with real-pointer RETRY and exactly one refetch.
- **Evidence:**
  - `routeblock.json` (39 failing rows; the S02 and ATLAS below-the-fold rows are re-tested at their own positions in `extra.json`, `l4_extra`)
  - `extra/silent-facts-weight.jpg`, `extra/silent-facts-evidence.jpg`, `extra/silent-seedhead_gdppc_ppp_latest-weight.jpg`, `extra/silent-meta-atlas.jpg`
  - `extra/l4-inspector-*.jpg`
- **Verification test:** the route-block matrix in `probes/routeblock.mjs` (every file x every consumer, at 1440 and 390) asserts an in-view alert in that scene, a real-pointer RETRY, and exactly one refetch.

### P05-D-005 · MAJOR · the inspector stays open after leaving ATLAS, covers other scenes and blocks the S08 links (L12)
- **Where:** `src/components/Inspector.tsx`. Seen at 1440x900, 1024x768, 360x800 and 390 reduced.
- **Repro:** in ATLAS add a country, open its inspector from the chip, then scroll or jump to any other scene.
- **Expected:** the inspector belongs to the scene that opened it (VISUAL_DESIGN interaction 9).
- **Actual:**
  - The dialog stays fixed over every later and earlier scene: the 1024 scroll pass shows it in all 111 frames.
  - Outside ATLAS its content silently switches to GDP per capita PPP: at S08 it says PPP while the S08 caption says AGRICULTURE VALUE ADDED.
  - At 1440 a real-pointer click on `→ OPEN THE ATLAS` in S08 lands on the inspector's chip (`story-card__chip | JPN · EAST ASIA`) and nothing happens.
  - At 1440 the inspector is taller than the viewport, so its CLOSE button is below the fold (`elementFromPoint` returns null). Esc still works and returns focus correctly.
- **Evidence:** `contact-sheets/1024x768.jpg`, `screenshots/1024x768/s08-01-echo-end.jpg`, `screenshots/390x844-reduced/s04-04-w1990.jpg`, `extra.log` (`l12_sweep_1440`), `extra/l12-inspector-1440.jpg`.
- **Verification test:** open the inspector in ATLAS, `jumpTo('resorted', 0.95)`, then assert that `.inspector` is hidden and that a real-pointer click on each S08 link navigates. CLOSE's centre is inside the viewport at 1440 and 390.

### P05-D-006 · MAJOR · S05 shows the people-weighted slope without its set-aside counterpart (criterion 7)
- **Where:** S05 Lab (`S05Lab.tsx`). All viewports.
- **Repro:** S05 live, then select SAMPLE PEOPLE-WEIGHTED (any basis or window).
- **Expected:** rejection criterion 7: "the people-weighted slope shown without its set-aside counterpart" fails the build. S03b does show both.
- **Actual:** the readout shows only `SLOPE -0.82 ... N 102 · R² 0.45` (constant USD 1960) or `-1.60` (PPP 1990). The set-aside value appears only if the visitor picks the other option.
- **Evidence:** `extra.log` (`crit7_weighted_readout`), `screenshots/390x844/s05-10-sheet-closed.jpg`.
- **Verification test:** for every `*_pop_weighted` record shown, `.plane-read` also contains the `*_pop_weighted_ex_chn_ind` slope and CI.

### P05-D-007 · MAJOR · phone S00/S03 headers: the basis line is hidden and the legend numerals are unreadable (L11, unit in every view)
- **Where:** S00, S03a and S03b corner and legend blocks. Seen at 390x844, 375x812 and 360x800.
- **Repro:** load at 390x844 and look at the S00 end state.
- **Expected:** the top-right line 2 `SORTED BY GDP PER CAPITA, PPP · CONSTANT 2021 INTL $ (PPP)` stays readable, and the legend edge labels are legible.
- **Actual:**
  - Line 2 sits under the OBSERVED chip: 358x9 px overlap at 390 and 343x23 at 375. At 360 only its top pixels show.
  - The 7-swatch legend's edge labels run together as `2824536110.1K16K 28K48.1K` in S00, S03a and S03b.
  - The USA, IDN, IND and CHN seed labels sit on the S03a readout and legend text (L13).
- **Evidence:** `screenshots/390x844/00-s00-end.jpg`, `screenshots/360x800/00-s00-end.jpg`, `screenshots/390x844/s03a-03-follow-nga.jpg`, `lessons.log` (390/375/360).
- **Verification test:** a collision test over the DOM text plus `.seed-label` boxes at 360/375/390, plus a minimum gap of 4 px between adjacent legend edge labels.

### P05-D-008 · MAJOR · ATLAS and S03a phone compositions: no controls sheet, and the disc is buried (criterion 11)
- **Where:** ATLAS (`Atlas.tsx`, phone CSS) and S03a M. Seen at 390x844, 375x812 and 360x800.
- **Expected:** VISUAL_DESIGN ATLAS M: "A single CONTROLS square opens a bottom sheet with every control in 44px rows", with comboboxes full-sheet. Rejection criterion 11 names the ATLAS bottom sheet explicitly. ED #57 accepts the phone sheet for the S05 lab only.
- **Actual:**
  - The rail is reflowed inline under the disc.
  - The G5 disc shows only as a strip between the status panel and the legend panel.
  - On S03a M the readout and legend panels cover most of the disc, so the FOLLOW outline cannot be seen.
- **Evidence:** `screenshots/390x844/atlas-00-default.jpg`, `screenshots/390x844/atlas-04-reflow-settled.jpg`, `screenshots/390x844/s03a-03-follow-nga.jpg`.
- **Verification test:** at 390 a CONTROLS toggle exists and opens a sheet, and the disc's visible area outside opaque panels is at least 50% of its bounding box.

### P05-D-009 · MAJOR · ATLAS text does not match the view's indicator or unit
- **Where:** `Atlas.tsx:80-92` and the VALUES control. Seen at 1440x900 (all viewports by code path).
- **Actual:**
  - (a) With 2 countries and AGRICULTURE VALUE ADDED, the narratives are the PPP income pair templates ("In 2025, GDP per capita in India (10,039 ...) ... (PPP)"). `pairsAllowed` is true for unit-less indicators.
  - (b) With 2 countries and a constant or current USD indicator, only the first country's single-country narrative is shown. `ATLAS_COPY.pppOnly` is unreachable.
  - (c) With VALUES = INDEX, the status line reads `GDP PER CAPITA, PPP · INDEX, 2000 = 100 · 2025`, while the disc and legend still show level PPP bins (`2824 ... 48.1K CONSTANT 2021 INTL $ (PPP)`). Two units appear in one view.
- **Expected:** narratives "the template family that fits the indicator" (VISUAL_DESIGN ATLAS). The unit is named consistently in every view.
- **Evidence:** `screenshots/1440x900/atlas-04-reflow-settled.jpg` (a), `extra.log` (`atlas_agr_two_countries_narrative`), `extra/l12-inspector-1440.jpg` (c).
- **Verification test:** a Vitest over `(indicator, n selected, values)` confirms the narrative families come from that indicator and that status, legend and paths share one unit string.

### P05-D-010 · MAJOR · the EVIDENCE nav jump lands on an empty stage
- **Where:** S07 landing p 0.05 (`scenes.ts` landing, `S07Evidence.tsx`). Seen at 1440x900 and 390x844.
- **Repro:** click EVIDENCE in the nav.
- **Expected:** MOTION_SYSTEM 6.2 "S07 0.05: first objection", with the disc dimmed to 15%.
- **Actual:** only "How we know." and the receipt are shown over a full-brightness disc. No objection card is visible until further scroll.
- **Evidence:** `screenshots/1440x900/s07-00-ex1.jpg`, `screenshots/390x844/s07-00-ex1.jpg`.
- **Verification test:** after `jumpTo('evidence', 0.05)` at least one `.ev-stack` card is visible in the viewport.

### P05-D-011 · minor · pixel-sampled contrast under 4.5:1 (L16)
- **Where:**
  - S00 top-right corner lines over grains: line 1 3.90:1, line 2 **2.61:1** (1440).
  - DERIVED chip text on the purple S01 card 2: **3.40:1** (1440, 768).
  - S02 card 3 coverage labels over the tick comb: **2.03:1** (1440).
  - S07 limitations text over the orange IMF card: **2.28:1** (390).
- **Evidence:** `contrast.txt`, `lessons-contrast/contrast-boxes/*.json`, `screenshots/1440x900/00-s00-end.jpg`.
- **Note:** the plane axis-unit rows (2.4 to 2.7:1) are probe-inconclusive. The text was not fully hidden in the capture, and visually they are 50% white on black.
- **Verification test:** `probes/contrast.py` reports 0 boxes under 4.5:1 at 1440/768/390.

### P05-D-012 · minor · iso3 seed labels collide with headline and corner text (L13)
- **Where and actual:**
  - IND sits inside the S00 headline at 1920/1440/1280/1024.
  - IDN sits on corner line 2 at 1024.
  - NGA sits on the S03a OBSERVED chip at 768.
  - Phone labels are covered in D-007.
- **Evidence:** `screenshots/1440x900/00-s00-end.jpg`, `screenshots/1024x768/00-s00-end.jpg`, `lessons.log`.
- **Verification test:** `.seed-label` boxes are included in the collision helper.

### P05-D-013 · minor · S07 receipt and limitations overlap the answer cards on tablet and phones
- **Where:** 768x1024: the RECEIPT/meta.json block and LIMITATIONS overlap the IMF answer card (612x15 px). 390/375/360: the open limitations list overlaps the "WHERE IS THE IMF?" card.
- **Evidence:** `lessons.log` (`evidence@0.95`), `screenshots/390x844/s07-03-ex7.jpg`.
- **Verification test:** a collision test at `evidence` p 0.95 with limitations open.

### P05-D-014 · minor · S04 flight frames carry no honesty chip and no unit (L3)
- **Where:** S04 p 0.08 to 0.40, all viewports.
- **Evidence:** `screenshots/1440x900/s04-02-flight-mid.jpg`, `lessons.log` ("catch-up@0.24: L3").
- **Verification test:** the L3 probe at p 0.24 finds one in-viewport chip and a unit line.

### P05-D-015 · minor · plane x-axis unit line clipped at 360 (S04, S05)
- **Evidence:** `lessons.log` (360x800: text outside viewport "GDP PER CAPITA IN 2010 · CONST..."), `screenshots/360x800/s04-02-w2010-verdict.jpg`.

### P05-D-016 · minor · S07 receipt shows an unbound number "meta.json 0 BYTES GZIP"
- **Where:** `S07Evidence.tsx:107`. `meta` is not a key of `meta.artifact_bytes`, so the `?? 0` fallback prints 0.
- **Evidence:** `screenshots/1440x900/s07-03-ex7.jpg`.
- **Verification test:** every receipt number is bound to a published field or shows "NOT PUBLISHED".

### P05-D-017 · minor · S05 lab landing keeps the guided tour's last sample
- **Detail:** at p 0.40/0.45 the lab is live with PEOPLE-WEIGHTED WITHOUT CHINA + INDIA. MOTION_SYSTEM 6.2 and VISUAL_DESIGN S04-to-S05 say PPP 1990 PRIMARY.
- **Evidence:** `screenshots/1440x900/s05-04-live.jpg`.

### P05-D-018 · minor · tab order: the nav comes last, with no skip-to-chapters link
- **Detail:** the first Tab stop from the top of the page is an S02 story segment. The chapter nav is reached only after every scene's controls.
- **Evidence:** `keyboard.json` (first stop `button.seg`).

### P05-D-019 · minor · phone S06 and S08 text collisions (L11)
- **Detail:**
  - At 390/360 the "NOT GROUPED: 52 COUNTRIES" caption sits on its hollow set, and at 360 the WARD radio touches the caption.
  - At 360 the S08 links overlap the ECONOMIC ATLAS corner label and the line "2025 · 7.98 BN ...".
  - At 360 the S08 paragraph touches the footer.
- **Evidence:** `lessons.log` (360x800), `screenshots/390x844/s06-00-kmeans.jpg`.

### P05-D-020 · low · `/favicon.ico` 404 (console error; Lighthouse best practices 0.96)
- **Evidence:** `lighthouse/mobile-1.report.json` (errors-in-console).

### P05-D-021 · low · the area rule holds only to 4-decimal rounding
- **Detail:** Σ counts x area_scale = 7,979.248 M against people 7,979.278 M (relative 3.8e-6). MOTION_SYSTEM test 7 asks for 1e-9. `area_scale` is published at 4 decimals, and the builder's Vitest tolerance follows the rounding.
- **Assessment:** not visible, but the written spec is not met.
- **Evidence:** this report, section 4.

### P05-D-022 · low · the S04/S05 plane has no growth values on the y axis (only the zero line)
- **Detail:** readers cannot read growth magnitudes except through a tap. The spec does not require y labels, so this is a recorded UX note.

Not defects (verified or accepted):
- The 121 KB `seedhead/gdppc_ppp.json` is requested before FCP. ED #26 accepts it, and LCP is 1.8 s.
- On phones, ATLAS controls sit under the MENU pill at the landing scroll position. That section is normal flow and the controls clear the pill once scrolled (ED #57).
- The S03b set-aside step appears only at p 0.88 to 0.94, which matches `WEIGHT_THRESHOLDS`.

## 3. QA lessons L1 to L16

| # | Result | Evidence |
|---|---|---|
| L1 | **PASS.** At 1024x768 and 768x1024 with a forced 15 px classic scrollbar, JS class = CSS class (D and T); the harness `shots.json` jsCls matches cssClass at all 10 viewport variants | `lessons.log` (`-classic`), `screenshots/*.json` |
| L2 | **FAIL.** S02 cards 2 and 4 at 1920/1440/1280 (D-003); S07 at 768 (D-013) | `lessons.log` |
| L3 | **FAIL (narrow).** Chips are visible at 360 to 768 everywhere except S04 flight frames at all viewports (D-014). No `display:none` on tags. Reduced-phone L3 flags come from probe scroll positions, and the reduced screenshots show chips | `lessons.log` |
| L4 | **FAIL.** D-004. 32/32 seedheads, S02 cards and the convergence/clusters/correlations/validation/coverage/longrun/reconciliation consumers pass | `routeblock.json`, `extra.json` |
| L5 | **PASS.** `scrollWidth` never exceeds the configured width in any scene, normal or reduced, at 360/375/390/768 (or any other viewport) | `lessons.log` |
| L6 | **PASS.** Mobile LCP 1.81 to 1.85 s x3 at load 29 to 36; the LCP element is `h1#hero-title span` | `lighthouse/` |
| L7 | **PASS.** No visible text under 11 px at 3 progress points per scene, 8 viewports, normal and reduced | `lessons.log` |
| L8 | **PASS.** The corner button clears the pill by at least 8 px at 768/390/375/360 | `lessons.log` |
| L9 | **PASS.** Except ATLAS normal-flow controls under the fixed pill at the landing scroll (accepted, ED #57) | `lessons.log` |
| L10 | **PASS.** No overclaims ("live", "every one", "recomputed") in copy. One unbound number (D-016) | grep, `src/data/copy.ts` |
| L11 | **FAIL.** Phone collisions at 360/375/390 (D-007, D-019) | `lessons.log` |
| L12 | **FAIL.** Real-pointer and touch sweep: SKIP, MENU pill, menu item, S05 sheet and options, S03b, S06 WARD, ATLAS VALUES/COUNT, chip to inspector, S08 links and MOTION all work at 390 and 1440, and every RETRY is hit-testable. Two exceptions (D-005): the S08 `OPEN THE ATLAS` click is blocked by the persisting inspector, and the inspector CLOSE is out of view | `extra.log` (`l12_sweep_*`) |
| L13 | **FAIL.** Seed labels collide with text (D-007, D-012) | `lessons.log` |
| L14 | **PASS.** The overflow check compares against the configured width. Fixture: a 2000 px div at 390 under `isMobile` grows `innerWidth` to 1560, so an innerWidth comparison would pass. My check (`scrollWidth 2000 > 390`) catches it. Only text clipping at 360 (D-015) | `extra.log` (`l14_fixture`) |
| L15 | **PASS.** Under reduced motion every scene canvas has a size: the S03a 4 discs at 260x260, S03b at 240x240, and the others. Screenshot PNGs are 21 to 58 KB (real pixels, not empty) at 1440 and 390 | `extra.log` (`l15_*`) |
| L16 | **FAIL.** D-011 | `contrast.txt` |

## 4. Honesty spot-checks (on screen vs artifacts)

All of these match `facts.json` or the named artifact, with the unit shown on screen:

| # | On screen | Source |
|---|---|---|
| 1 | Richest economy 131 x the poorest (SGP / BDI, 2025, PPP) | facts `gdppc_ppp_top_bottom_ratio` 130.83 |
| 2 | 7.98 BN of 8.19 BN people · 185 countries | facts 7.979 / 8.192 / 185 |
| 3 | No-data set: 32 countries · 0.21 BN | facts 32 / 0.2128 |
| 4 | Half the people live below 15,091 (constant 2021 intl $, PPP) | facts `median_person_gdppc_ppp` |
| 5 | Middle country 17,265 | facts `gdppc_ppp_median` |
| 6 | 296 entities, 217 economies, 79 aggregates; picker and disc contain no aggregates | facts; `countries.json` (217, 0 overlap with 79 aggregates); latest layout order has 185 ids, none an aggregate |
| 7 | 20.1% of cells empty | facts 20.08 |
| 8 | Long run: 53 countries, 5.2 in 1820, 56 in 2022, Maddison unit line kept apart | facts |
| 9 | 2016 readout: 7,416 seeds · 7.39 BN · middle person ZAF 14,501 · 18 countries 0.12 BN no data | `seedhead/gdppc_ppp.json` 2016 |
| 10 | "Middle person's country changed in 1994: PAK → UZB" | seedhead 1993 PAK, 1994 UZB |
| 11 | Spread countries 1.17 → 1.13, people 1.20 → 0.89 | facts sigma_* |
| 12 | Weighted slope -1.60 (CI -3.05 to -0.15), set aside -0.56 (CI -0.88 to -0.23), 38.8% of 1990 weight | facts and convergence |
| 13 | S04 2010 window: -0.35 (CI -0.56 to -0.13; bootstrap -0.57 to -0.14) · N 183 · R² 0.04 · half-life 194 years · 19 no 2010 value · 1 territory change | `convergence.beta gdppc_ppp_2010_2025_primary` |
| 14 | S05 PPP 1990 weighted ex CHN+IND: -0.56, n 173, R² 0.22, half-life 112 years | convergence |
| 15 | S05 const 1960 primary: -0.03 (CI -0.22 to 0.17), n 102, "NO HALF-LIFE" (CI spans 0) | convergence |
| 16 | S05 const 1960 weighted: -0.82 (CI -1.95 to 0.31), n 102, R² 0.45 | convergence and METHODOLOGY |
| 17 | S05 const 1980 primary -0.31 (CI -0.50 to -0.13); lower third -0.96 n 52 | convergence |
| 18 | Silhouette 0.23, seed ARI 1.00, Ward ARI 0.48 | facts |
| 19 | Groups 39 / 60 / 66 with published signatures; 52 not grouped, shown as a hollow set | `clusters.json` |
| 20 | Income x productivity rho 0.97 (CI 0.96 to 0.98) n 177 | `correlations.json` |
| 21 | Agriculture share x productivity -0.88 n 174; agriculture x industry 0.03 at n 195 (free picker) | `correlations.json` |
| 22 | 8,005 / 5,202 seeds (latest / 1990) | facts |
| 23 | Nigeria FOLLOW 2016: rank 134 of 199, 8,535 | panel and layout (internally consistent with the 2016 readout) |
| 24 | NOT PUBLISHED: WITH TERRITORY CHANGES is disabled for constant-USD 1960/1980 with the title "POINTS NOT PUBLISHED FOR THIS WINDOW"; a keyboard Enter does not apply it | `keyboard.json`, LIMITATIONS |

Rule checks:
- Unit named in every view, except the S04 flight frames (D-014).
- "Not causal" copy is present wherever rho, a slope or a group is on screen (S03b, S04, S05, S06 parts 1 and 2).
- Aggregates are never drawn or ranked.
- No-data countries form a separate hollow set (S00, S03a, S04, S05, S06).
- The WDI vintage line is in every scene footer.
- WDI and Maddison attributions and the IMF-excluded line appear in S02 card 4, S07 exchange 7 and the S08 footer.
- Narratives are template renderings (`model/narratives.ts`). They do not always fit the indicator (D-009).
- ATLAS indicator changes across families show no mixed-basis frame (29 samples, `atlas_swap`).
- The S05 swap does show a mixed-basis frame (D-002).
- No U+2014/U+2015 in `site/src`, `site/public`, `site/index.html` or `docs`.

## 5. Creative and visual review

I read every contact sheet: 1920, 1440, 1280, 1024, 768, 390, 375, 360, both classic variants and both reduced. I also read more than 45 full-resolution frames, including every S00 end state, the S02 cards, S03a/S03b states, the S04 flight and verdict, the S05 tour, swap and settled states, the S06 groups and relations, S07 landing and end, the ATLAS reflow, swap, index and inspector states, the S08 dissolve and end, and the reduced-motion frames.

- **Rejection criteria 2, 5 and 19: pass.**
  - The seed head is a grain lattice with symmetric seams and a luminance ramp.
  - There is no outline ring, no glow orb, no circle-pack look, and no wedges or rotation.
  - The S08 echo dissolves to speckle and re-sorts at constant G0.
  - Disc diameter over frame height at S00 end and at S08 p 0.75: 1.42 (1920, 1440), 1.20 (1024), 1.21 (768), 1.21 (390), 1.21 (375) and 1.20 (360). `minR` is monotonic through the intro.
  - The left arc (D), the bottom-right arc (T, from (768, 810) to (404, 1024)) and the bottom arc (M, y 741 to 780 above the pill) are visible outside the scrims.
- **The S04/S05 plane has no gridlines, frame, ticks or legend box.** Seeds keep their grain and highlight.
- **Distinct from P04 (watch pair).** I compared side by side against `04-pulse-energy-grid/artifacts/evidence/qa/screenshots/1440x900` (S00 mid and end, S03a, S08).
  - P04 is a smooth wedge rose with solid filled petals.
  - P05 is a speckled grain field that sorts into territories.
  - They share the program grammar (giant form right, serif headline bottom-left), but the forms do not read alike.
- **Strong:** the S00 sort (speckle to sorted territories), the S03b coalesce to equal country seeds, the S04 flight from disc to plane, and the S06 group discs.
- **Weak:**
  - The phone S03a and ATLAS compositions, where text panels bury the disc (D-008).
  - The reduced-motion opening (D-001).
  - The dense S02 cards at desktop sizes (D-003).
  - At 1440 the S03a/S03b disc territories are dim and low-contrast against each other, so the "bright core, long rim" reads only faintly at the scene landing.
- **Motion, all 6 layers observed in the recordings and frames:**
  - intro sort
  - nav jumps with hash and focus
  - scrubbed camera moves and the flight
  - segmented controls, sheet and inspector
  - reflow, coalesce/burst, fit crossfades and the neutral swap
  - hover, focus and RESET confirmation

## 6. Release gate

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | **FAIL** | Distinctive and not a template (criteria 2/5/19 pass; distinct from P04). D-001 (reduced-motion opening unreadable) and D-003 (S02 card overprints at 1440/1280) |
| Motion UI | **PASS** | All 6 layers present (section 5). Pacing 8.3 / 10.4 ms p50/p95 on M3 Pro ANGLE Metal |
| UX | **FAIL** | D-005 inspector persistence, D-010 empty EVIDENCE landing, D-008 ATLAS phone composition |
| Functionality | **FAIL** | D-004 silent failures (L4), D-005 blocked S08 link (L12). All other controls work by real pointer, touch and keyboard |
| AI / analytical honesty | **FAIL** | 24 numbers verified correct. D-002 mixed-basis frames (criterion 4), D-006 (criterion 7), D-009 unit and narrative mismatch |
| Performance | **PASS** | Lighthouse mobile 0.99 x3, LCP 1.81 to 1.85 s, CLS 0, TBT at most 53 ms; desktop 1.0 x3, LCP 0.41 s (load 29 to 36). Pacing about 120 fps, at most 1% of frames over 16.7 ms at 4x CPU throttle |
| Responsiveness | **FAIL** | D-007 (phone header and legend), D-008, D-003 at 1280, D-019 |
| Professional quality | **PASS** | pytest 59, Vitest 110, Playwright 153 passed / 0 failed, typecheck and lint clean, axe 0 violations in 44 scans. All 8 required docs present. The builder's L2/L4/L5 tests miss the defects above (landing-only positions, innerWidth comparison) |
| GitHub | BLOCKED | Not in QA scope; repo not yet published |
| Deployment | BLOCKED | Not deployed; the Pages LCP re-measure (ED #58) is not needed because the local LCP already passes |
| Portfolio | BLOCKED | Not in scope |

## 7. Next action

FIX pass for D-001 to D-010 (and preferably D-011 to D-019). Then run a limited QA pass 2 that reruns `probes/`
(routeblock, lessons, extra, contrast) and the harness at 1440/768/390 plus reduced mode.

---

# Pass 2 (task P05-QA-002)

Independent QA reviewer (qa-reviewer, Claude Opus 5.5), 2026-10-11, on `main` at `daf4f92` (FIX-A), fresh
`npm run build`, production preview on 4341 (`site/tests/serve.mjs`). Evidence is in `artifacts/evidence/qa-2/`
(23 MB committed). Frames and captures not committed are kept locally in
`artifacts/evidence/recordings/qa-2-local-only/` (gitignored). Load average was 10 to 22 during this pass.

**Verdict: FAILED.** All 22 pass-1 defects are verified closed, apart from D-021 (accepted, ED #75) and two partial
minors. Both blockers are gone, and the BASIS and ATLAS swaps are clean in every sampled frame. Two majors remain, one
of which I missed in pass 1:
- **D-023:** under reduced motion, S04 and S05 draw the catch-up seeds with no axes, fit line, CI band or unit.
- **D-024:** at 768 the S05 guided tour hides its honesty chip under the not-causal paragraph.

## P2.1 What I ran

| Check | Result |
|---|---|
| `uv run pytest -q` | **59 passed** |
| `npm run typecheck`, `npm run lint` | clean |
| `npm test` (Vitest) | **111 passed** |
| `npx playwright test --workers 1 --retries 0` | **170 passed, 106 skipped, 0 failed** (16.2 min, load 17 to 22). No serial reruns needed |
| Evidence harness (headed, ANGLE Metal, M3 Pro) | 7 required viewports + 1280x720 + classic 1024x768 / 768x1024 + reduced 1440x900 / 768x1024 / 390x844 (`--full`). Every contact sheet read, plus more than 40 full-resolution frames |
| L19 collision sweep (`qa-2/probes/lessons.mjs`) | Box list built from the DOM: Range client rects of every visible text node (so overflowing text is measured where it is painted), every visible control, and the `.seed-label` canvas-label layer (L13). 32 scene positions x 8 viewports, plus reduced at 5 viewports and classic at 2. **Self-test:** an injected overlapping element with a novel class name was caught at every normal viewport (2/2 per viewport). `lessons.log` |
| L16 pixel contrast (`probes/contrast.py`) | p95 background under each painted text line, 15,096 boxes. Results in P2.3 |
| L18 per-frame sampler (`qa-2/probes/pass2.mjs`) | rAF-rate sampling of every unit-bearing element plus the canvas palette. S05 BASIS swaps both ways at 1440 and 390: **0 mixed frames in 1,061**. ATLAS cross-family changes (const, nominal, agriculture share, PPP, productivity) at 1440 and 390: **0 mixed frames in 1,593**. `extra.mjs` swap sampler: 0 mixed in 77 |
| D-006 literal | Every people-weighted and ex-CHN+IND record across 2 bases x 3 windows (12 states) at 1440 and 390 shows both rows: "PEOPLE-WEIGHTED, ALL ..." and "CHINA + INDIA SET ASIDE ...". **24 of 24** |
| L4 route-block (`qa-2/probes/routeblock.mjs`, real-pointer RETRY) | 90 of 98 pass at the scene landing. The 8 remaining rows were re-run at the card or part that consumes the file: S02 cards 2/3/4 for panel_income/coverage/longrun, and S06 p 0.62 for correlations. **All 8 pass** (alert in view, RETRY hit-testable, exactly 1 refetch, recovered; `routeblock-own-positions.log`), so 98/98. `extra.mjs`: 32/32 per-indicator seedheads, 4/4 inspector files and 8/8 S02 cards pass, and every deep link with facts/meta/countries/indicators/panel/latest-seedhead blocked shows its alert in view |
| L17 | Inspector opened in ATLAS by real pointer, then a jump to each of the 9 other scenes: **closed in every scene** at 1440 and 390. The S08 `OPEN THE ATLAS` real-pointer click then navigates to ATLAS. CLOSE is in the viewport. The phone ATLAS and S05 sheets keep their open state after a jump, but are positioned in their own section and not in view elsewhere (`pass2/l17-*.jpg`): not a defect |
| L12 sweep (`extra.mjs`) | All 18 controls work by touch at 390 and by mouse at 1440, including inspector CLOSE and the S08 links. ATLAS phone CONTROLS sheet by touch: opens with every control in view, and a chip tap opens the inspector bottom sheet with CLOSE in view (`pass2/atlas-sheet-390.jpg`, `atlas-inspector-390.jpg`) |
| axe + keyboard (`probes/a11y.mjs`) | **44 scans, 0 violations**. Keyboard journey all pass. The one probe miss (S06 ORDER BY with type-ahead "t") is the pass-1 probe artefact, verified working with "a". Skip link: first Tab focuses SKIP TO CHAPTERS, and Enter moves focus to the nav (1440) or the MENU pill (390) |
| Lighthouse (`run-lighthouse.sh` x3, load 9.9 to 11.8) | mobile perf **0.99 / 1.0 / 0.99**, LCP **1.81 / 1.22 / 1.81 s**, CLS 0, TBT at most 29 ms. Desktop perf **1.0** x3, LCP 0.41 s. BP **1.0** (favicon fixed). a11y 0.98 mobile / 0.99 desktop: the only failing audit is `skip-link` ("No skip link target", D-029). LCP element `h1#hero-title span.wr-word`. #58 is not needed |
| L14 | The configured-width check still catches the 2000 px fixture under `isMobile` (`extra.log`) |
| L15 | Reduced-motion figures are sized: S03a 4 x 260x260, S03b 240x240, with real pixel content (`extra.log`) |
| S08 radius at p 0.75 | 1.42 (1920/1440), 1.21 (768), 1.21 (390), 1.21 (375), 1.20 (360) x frame height |

## P2.2 Pass-1 defects, re-verified from my frames

| ID | Status | Evidence |
|---|---|---|
| D-001 reduced S00/S01 overprint | **Closed** | `qa-2/screenshots/1440x900-reduced/00-s00-end.jpg`, `768x1024-reduced/`, `390x844-reduced/00-s00-end.jpg`; no collisions at S00 in reduced lessons |
| D-002 S05 mixed bases | **Closed** | L18 sampler 0/1,061; `1440x900/s05-06-basis-t120.jpg`: axis, readout and chip all still read PPP 1990 while the controls show the choice |
| D-003 S02 card overprint | **Closed** | `1440x900/s02-01-card2.jpg`, `s02-03-card4.jpg`, `contact-sheets/1280x720.jpg`; DOM sweep clean on every card at D |
| D-004 silent failures | **Closed** | route-block 98/98, extra 44/44, silent-deep-link probes all show alerts |
| D-005 inspector persistence | **Closed** | L17 probe; S08 link real-pointer ok |
| D-006 criterion 7 | **Closed** | 24/24 states show both rows |
| D-007 phone S00 header and legend | **Closed** | `390x844/00-s00-end.jpg`, `360x800` S00 frame (local) |
| D-008 ATLAS phone sheet (criterion 11) | **Closed** for ATLAS. S03a phone disc still largely under the readout, recorded as part of D-025 | `pass2/atlas-sheet-390.jpg`, `390x844/s03a-03-follow-nga.jpg` |
| D-009 ATLAS narratives and units | **Closed** | `D009ab` 0 mismatches over 7 indicators x {1, 2} countries at 1440 and 390; INDEX now keeps the status line level-unit and labels the paths `INDEX, 2000 = 100 · FROM CONSTANT 2021 INTL $ (PPP)` |
| D-010 EVIDENCE landing | **Closed** | 1 card in view after a nav click, disc alpha 0.15 |
| D-011 contrast | **Closed** for all 4 listed items (S00 corner lines, chip on purple, comb labels, limitations over orange). New items in D-028 | `contrast.txt` |
| D-012 seed-label collisions | **Closed** | no `[L13]` flags at any viewport |
| D-013 S07 receipt overlaps | **Closed.** The 1280/1024 flags are lines clipped inside the limitations scroll box (rects past its overflow edge), visually clear | `1024x768/s07-01-ex7.jpg` (local), `1440x900/s07-03-ex7.jpg` |
| D-014 S04 flight chip | **Closed** | no L3 flag at catch-up p 0.24 |
| D-015 360 unit line clipped | **Closed** (unit line in view); tick labels clipped, see D-026 | `360x800/s04-02-w2010-verdict.jpg` (local) |
| D-016 "0 BYTES GZIP" | **Closed** ("SIZE NOT PUBLISHED") | `390x844/s07-03-ex7.jpg` |
| D-017 lab landing sample | **Closed** (PPP 1990 PRIMARY) | `1440x900/s05-06-basis-t120.jpg` |
| D-018 tab order | **Closed** (skip link works); its missing target is D-029 | skip-link probe |
| D-019 phone S06/S08 collisions | **Partly closed**: S08 is clean, the S06 NOT GROUPED caption still sits on its hollow set at 390/360 (D-027) | `390x844/s06-00-kmeans.jpg` |
| D-020 favicon 404 | **Closed** (BP 1.0) | lighthouse |
| D-021 area rule to 4 decimals | **Accepted** (ED #75) | |
| D-022 plane y values | **Closed** (+8% to -4% labels) | `1440x900/s04-06-w2010-verdict.jpg` |

Builder-flagged probe items, ruled from my own captures:
- **S02 p 0.694 horizontal strip:** the off-screen deck cards are by design. **Artefact.**
- **S07 p 0.95 side panel at 1280/1024:** text clipped inside its own scroll box. **Artefact.**
- **Reduced-motion text passing under fixed chrome at landing positions:** normal-flow content scrolls under the fixed nav and pill, and clears it on scroll. **Accepted** (ED #57 pattern).
- **The 8 route-block rows:** all pass at their own card or part. **Artefact of the landing position.**
- **Phone "DATA TABLE FOR THIS WINDOW" collisions:** the summary is visually hidden (`clip-path: inset(50%)`, 12 px wide), so no painted overlap. **Artefact.**
- **768 ATLAS "ONE INDICATOR" under the pill:** normal flow, ED #57. **Accepted.**

## P2.3 Pass-2 defect register

### P05-D-023 · MAJOR · reduced motion: S04 and S05 planes have no axes, fit line, CI band or unit
- **Where:** `S04CatchUp.tsx:61` and `S05Lab.tsx:63` render `{motion ? <PlaneOverlay … /> : null}`, so with motion off nothing replaces the overlay. Seen at 1440x900, 768x1024 and 390x844, reduced.
- **Repro:** `prefers-reduced-motion: reduce`, then scroll to S04 or S05.
- **Expected:** MOTION_SYSTEM 8: "S04: … then the plane with the 1990 fit (interactive hover)" and "S05: the lab, live". The plane carries its x labels in the record's basis, the zero line, the fit and the CI hatch. ED #57 accepts only the missing flight strip.
- **Actual:** only the country seeds are drawn (canvas). There is no `svg.plane` in the DOM (`svg: null` at every position probed), so there are no x labels, no unit line, no zero line, no fit and no CI. The readout states a slope for a line that is not drawn. Income and growth cannot be read off the plane.
- **History:** this was present in pass 1 too (`qa/screenshots/390x844-reduced/s04-04-w1990.jpg`). I missed it then.
- **Evidence:** `qa-2/screenshots/1440x900-reduced/s04-04-w1990.jpg`, `s05-04-live.jpg`, `s05-08-basis-settled.jpg`; `qa-2/screenshots/390x844-reduced/s04-04-w1990.jpg`; `qa-2/pass2/reduced-*.jpg`.
- **Verification test:** under reduced motion, at S04 and S05 the plane SVG exists with the x unit line, at least 3 x labels, the zero line and `.plane__fit` for the shown record, and a basis change swaps them.

### P05-D-024 · MAJOR · 768: the S05 guided tour hides its honesty chip under the not-causal paragraph (L2/L3)
- **Where:** S05 p 0.05 to 0.30 (tour states). Seen at 768x1024 (normal and classic scrollbar).
- **Actual:** the `DERIVED · GDPPC_PPP_1990_2025_TERCILE_LOW` and `… POP_WEIGHTED_EX_CHN_IND` chips sit under the opaque not-causal paragraph. Only the tail "…GHTED_EX_CHN_IND" shows. The DOM sweep flags it at p 0.12 and 0.27 (185 x 2 to 8 px).
- **Evidence:** `qa-2/screenshots/768x1024/s05-01-tour-tercile.jpg`, `s05-03-tour-ex.jpg`, `qa-2/lessons.log` (768x1024 lab@0.12/0.27).
- **Verification test:** the DOM-generated collision sweep at 768 over S05 p 0.05 to 0.30 returns no pairs, and the chip is fully visible.

### P05-D-025 · minor · phone S03a: the legend strip crosses the headline and the readout still covers most of the disc
- **Where:** 390, 375 and 360.
- **Actual:** the 7-swatch legend bar runs through the descenders of "grew, and its middle moved." Below the cap of the disc, the readout panel covers the rest, so a FOLLOW outline cannot be seen.
- **Evidence:** `qa-2/screenshots/390x844/s03a-03-follow-nga.jpg`.

### P05-D-026 · minor · phone plane x tick labels clipped at the top
- **Where:** S04 and S05 at 390 and 360.
- **Actual:** the plot clip cuts the top of "10K 30K 100K".
- **Evidence:** `qa-2/screenshots/390x844/s04-06-w2010-verdict.jpg`.

### P05-D-027 · minor · S06 "NOT GROUPED: 52" caption still sits on its hollow set at 390/360 (rest of D-019)
- **Evidence:** `qa-2/screenshots/390x844/s06-00-kmeans.jpg`.

### P05-D-028 · minor · pixel contrast under 4.5:1 (L16)
- **Detail:**
  - S07 answer cards' "THE ATLAS" eyebrow: 2.35:1 on the older pink card and 3.33:1 on the orange card, at every viewport.
  - Seed labels CHN, USA and MEX over the bright core at S03a/S03b/S00 on D and T: 3.1 to 3.9:1.
  - S02 footer lines at 1024/360: 3.9 to 4.3:1.
  - Flags with a white p95 background are text under the white nav block or pill (fixed chrome) and are not counted.
- **Evidence:** `qa-2/contrast.txt`.

### P05-D-029 · low · skip link targets `#chapters`, which does not exist
- **Detail:** focus is moved by an inline `onclick`, so it works with JS. Lighthouse a11y is 0.98 (`skip-link` audit).
- **Evidence:** `qa-2/lighthouse/mobile-1.report.json`, `site/index.html:24`.

### P05-D-030 · low · S01 mid-scrub (p about 0.5) has no honesty chip in view while the disc is shown (L3)
- **Detail:** seen at all viewports.
- **Evidence:** `qa-2/screenshots/1440x900/s01-01-p50.jpg`, `qa-2/lessons.log`.

### P05-D-031 · low · the S00 IDN seed label is clipped at the top edge (1440, 1280)
- **Evidence:** `qa-2/screenshots/1440x900/00-s00-end.jpg`.

## P2.4 L1 to L20

| # | Result |
|---|---|
| L1 | PASS: classic 1024/768, JS class = CSS class |
| L2 | **FAIL**: D-024 |
| L3 | **FAIL (narrow)**: D-024 (hidden chip), D-030 (low) |
| L4 | PASS: 98/98 + 44/44 |
| L5 | PASS |
| L6 | PASS: mobile LCP 1.22 to 1.81 s |
| L7 | PASS |
| L8 | PASS |
| L9 | PASS (ATLAS normal flow under the pill, ED #57) |
| L10 | PASS |
| L11 | PASS with minors D-025, D-026, D-027 |
| L12 | PASS |
| L13 | PASS: no seed-label collisions |
| L14 | PASS: fixture caught |
| L15 | PASS for the S03a/S03b/S06 figures. D-023 is a missing reduced-motion overlay, not a zero-size canvas |
| L16 | PASS for the pass-1 items; D-028 minor |
| L17 | PASS |
| L18 | PASS: 0 mixed frames in 2,654 sampled (S05 + ATLAS, 1440 and 390) |
| L19 | PASS: DOM-generated sweep with the novel-class fixture caught |
| L20 | N/A (no timing series in P05) |

## P2.5 Release gate (pass 2)

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | PASS | Criteria 2/5/19 hold (S08 1.20 to 1.42 x height, edge arcs visible); S02, S00, ATLAS and reduced S00 compositions fixed |
| Motion UI | PASS | 6 layers; intro and transitions unchanged from pass 1 |
| UX | PASS | D-005, D-008 and D-010 closed; L17 and L12 sweeps pass |
| Functionality | **FAIL** | D-023: the reduced-motion S04/S05 plane is missing its overlay |
| AI / analytical honesty | PASS | L18 0 mixed frames; D-006 24/24; D-009 0 mismatches; S04/S05 numbers re-checked against `convergence.json` (-0.35 / -0.37, -1.60 / -0.56, -0.82 / -0.12, n 183/175/102/100) |
| Performance | PASS | Lighthouse mobile 0.99 to 1.0 x3, LCP at most 1.81 s, CLS 0; desktop 1.0. Pacing from pass 1 (no renderer changes in FIX-A) |
| Responsiveness | **FAIL** | D-024 at 768 (gate composition) |
| Professional quality | PASS | pytest 59, Vitest 111, Playwright 170/0 failed, lint/type clean, axe 0/44 |
| GitHub / Deployment / Portfolio | BLOCKED | out of QA scope |

## P2.6 Next action

A FIX-B pass:
- **D-023:** render the plane overlay (labels, zero line, fit and CI) under reduced motion.
- **D-024:** move the S05 tour chip out from under the not-causal paragraph at 768.
- **Preferably also:** D-025 to D-028.

Then a limited QA pass 3:
- rerun `qa-2/probes/lessons.mjs` at 768
- reduced-motion frames at 1440/768/390 for S04/S05
- `qa-2/probes/pass2.mjs`
