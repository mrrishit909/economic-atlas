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

## Final release counts (2026-10-11, product HEAD 2bd5930, QA commit 211f436)

| Check | Result |
|---|---|
| pytest (`uv run pytest -q`, raw data present) | 59 passed |
| Vitest (`npm test`, site) | 111 passed |
| Playwright e2e (production build, 1440x900, 768x1024, 390x844) | 181 passed, 0 failed |
| axe-core | 44 scans, 0 violations |
| typecheck, lint | clean |
| Independent QA | pass 1 FAILED (P05-QA-001, 2 blockers, 8 majors); pass 2 FAILED (P05-QA-002, D-023, D-024); pass 3 PASSED with minors (P05-QA-003, no blocker or major open). See `docs/QA_REPORT.md` |

CI runs the 51 pytest tests that need only committed files; the 8 raw-data tests are checked locally: `test_clusters.py` (4), `test_deterministic_rebuild`, `test_reconciliation_published_matches_raw`, `test_coverage_matches_panel`, and `test_layout_byte_identical_on_rerun` (about 45 minutes).

## Site tests

| Layer | What it proves |
|---|---|
| Vitest (`site/src/**/*.test.ts`) | `loader` typed states; `copy` agrees with `facts.json`; atlas, likeness, narratives (parity with the Python reference), plane and seed-state models; seed layout decoding against a fixture |
| Playwright (`site/e2e/`: `shell`, `prototype`, `stageb`, `qa`) | shell, intro, nav, keyboard and focus; zero external requests across every scene; reduced-motion in-flow rendering; S00 disc rules; one price basis per visual element; slot and seed counts in the DOM equal published facts; 404 on a layout shows COULD NOT LOAD and RETRY recovers; S04 flight lands on plane positions; ATLAS rules; axe-core on the scenes; QA lessons L1 to L20. Runs against the production build (`npm run e2e`, `site/tests/serve.mjs`, port 4341) |

## Performance, accessibility, visual QA

Independent measurements are in `docs/QA_REPORT.md` (pass 3, `artifacts/evidence/qa-3/`). Deployed-site measurements (Lighthouse x3 mobile and desktop, curl, Playwright on the live URL, screenshots) are in `artifacts/evidence/live/` and summarized in `docs/BUILD_STATUS.md`. Frame pacing was measured on software GL only; real-device pacing is not measured.
