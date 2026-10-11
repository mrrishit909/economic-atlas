# Testing

## Data and engine (pytest)

`uv run pytest -q` runs `tests/` (59 tests). Tests marked `slow` (36 of the 59 pass without raw data) read `data/raw` or `data/interim`, which are gitignored.

| File | What it proves |
|---|---|
| `tests/test_cleaning.py` | ledger invariants per indicator; 296 entities = 79 aggregates + 217 countries; ISO3 valid or documented; no aggregate in any analysis; no interpolation; published reconciliation equals raw |
| `tests/test_units.py` | `assert_same_basis` raises for PPP vs nominal; every money level has a basis; cluster features and published results use a single basis; base year matches basis |
| `tests/test_convergence.py` | planted-slope recovery; a no-relation case gives a CI covering zero; half-life formula; sigma sane; territory breaks in window; published records sane |
| `tests/test_clusters.py` | k-means reproducible; published cluster properties; seed-stability helper; standardization |
| `tests/test_coverage_rankings.py` | rankings only include countries with data; coverage matches the panel; hhi5 range and coverage claim; latest-year rule |
| `tests/test_dr_other.py` | facts and display rules requested by the frontend (DR-3..DR-8): values reproduce rho, Ward matching, vcov, pair templates |
| `tests/test_seedhead.py` | half-up minimum-one slot counts independent of order; exact counts, determinism, warm-start counts; slot counts equal rounded populations; connectivity published; rank-radius Spearman bound met and recomputed from the owner array; bright core; DR-9 value bins; byte-identical rerun (the 45-minute test) |
| `tests/test_artifacts.py` | every artifact validates and has a schema and size budget; no NaN tokens; validation all passed; vintage and licence in meta; not-causal copy present; no IMF endpoint called; facts cover copy numbers; narratives render only from inputs; deterministic rebuild |
| `tests/test_contracts.py` | schemas valid and complete; artifacts validate; no U+2014/U+2015 in tracked files or decoded JSON strings |

## Commands run (2026-10-11, HEAD 322be7a, working tree with `data/raw` and `data/interim` present)

| Command | Result |
|---|---|
| `uv run pytest -q` | 59 passed (44.55 s) |
| `uv run pytest -q -m "not slow"` | 15 passed, 44 deselected (3.50 s) |
| `uv run pytest -q` in a fresh `git clone` (no raw data, as in CI) | 51 passed, 1 failed, 7 errors (25.53 s); all 8 need `data/interim` |
| the CI invocation (see `.github/workflows/ci.yml`: 8 raw-dependent tests deselected) in that clone | 51 passed, 8 deselected (3.53 s) |
| `npm run typecheck` (site) | clean |
| `npm run lint` (site) | clean |
| `npm test` (site, Vitest) | 9 files, 110 tests passed (0.48 s) |

CI therefore runs the 51 tests that need only committed files. The 8 skipped there are checked locally: `test_clusters.py` (4), `test_deterministic_rebuild`, `test_reconciliation_published_matches_raw`, `test_coverage_matches_panel`, and `test_layout_byte_identical_on_rerun` (re-solves the layouts, about 45 minutes).

## Site tests

| Layer | What it proves |
|---|---|
| Vitest (`site/src/**/*.test.ts`) | `loader` typed states; `copy` agrees with `facts.json`; atlas, likeness, narratives (parity with the Python reference), plane and seed-state models; seed layout decoding against a fixture |
| Playwright (`site/e2e/`: `shell`, `prototype`, `stageb`, `qa`) | shell, intro, nav, keyboard and focus; zero external requests across every scene; reduced-motion in-flow rendering; S00 disc rules; one price basis per visual element; slot and seed counts in the DOM equal published facts; 404 on a layout shows COULD NOT LOAD and RETRY recovers; S04 flight lands on plane positions; ATLAS rules (no aggregates, INDEX disabled for shares, RESET); axe-core with no serious or critical violations in the Stage B scenes; QA lessons L1 to L10 (no text collisions at 390x844 and 1280x720, classic scrollbars). Runs against the production build (`npm run e2e`, served by `site/tests/serve.mjs` on port 4341) at 1440x900, 768x1024 and 390x844 |

Not run in this pass (the frontend owner builds production): `npm run build`, `npm run e2e`. The builder reported 151 e2e tests passed (`docs/BUILD_STATUS.md`); this release pass did not reproduce it: `TBD (pending QA)`.

## Performance, accessibility, visual QA

| Item | Result |
|---|---|
| Lighthouse, mobile (production build, builder-measured, pending independent QA) | LCP 1.81 s; performance 88 / 99 / 99 across three runs; accessibility 100 |
| Lighthouse, desktop (builder-measured, pending independent QA) | performance 100; accessibility 100 |
| Frame pacing | builder measured on software GL only; real-device pacing `TBD (pending QA)` |
| axe-core | covered by `site/e2e/stageb.spec.ts`; independent re-run `TBD (pending QA)` |
| Independent visual QA, deployed URL screenshot, curl checks | `TBD (pending QA)` |

Builder evidence (screenshots, contact sheets, Lighthouse JSON) is under `artifacts/evidence/stage-b/`.
