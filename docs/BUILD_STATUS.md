# Build status: 05-economic-atlas

Owner of this file: orchestrator only.

| Phase | Status | Evidence |
|---|---|---|
| 01-13 Sources, contracts, data, analytics | PASSED (orchestrator reran pytest 41/41; live WB API recount 296 entities, 217 non-aggregate, matches) | 9368ff9, c67ef77, 091bc97, 9d69ea1 |
| 14-17 Creative direction | PASSED (The Seed Head) | a1d0ce9, 530b306 |
| DR-1..8 layouts and facts | PASSED (orchestrator reran pytest 55/55) | 9a22145, f91a43f |
| 18-19 Shell + prototype (S00, S03a, S03b) | PASSED after layout fix (orchestrator: Vitest 87/87; stage-a2 sheet read) | 2e57a79..537e2d8; artifacts/evidence/stage-a2/ |
| 20-22 Stage B (S01-S08, ATLAS, inspector) + QA_LESSONS L1-L10 | PASSED (orchestrator: tsc, lint, Vitest 110/110; sheet read; agent e2e 151 passed; builder Lighthouse mobile LCP 1.81 s) | 460ab97, 5e0cce5, 170b453 |
| 23-28 Independent QA | FAILED (P05-QA-001: 2 blockers, 8 majors; mobile LCP 1.81 s; axe 0) -> FIXA-001 PASSED (daf4f92; Vitest 111/111) -> QA pass 2 FAILED (P05-QA-002, acecfde: D-023 reduced-motion plane overlay, D-024 768 S05 tour chip) -> FIX-B done, awaiting QA pass 3 (D-023..D-029; full gate green; artifacts/evidence/fix-b/) | c33aa78, acecfde |
| 23-28 QA pass 3 | PASSED with minors (P05-QA-003, QA commit 211f436 on product 2bd5930; D-023, D-024 closed; open minors D-025, D-030..D-033 in LIMITATIONS.md). Final counts: pytest 59, Vitest 111, Playwright 181 passed 0 failed, axe 44 scans 0 violations; release pass reran pytest, typecheck, lint, Vitest, build clean | 211f436 |
| 29-30 Release (P05-REL-001) | PASSED: public repo https://github.com/mrrishit909/economic-atlas, live https://mrrishit909.github.io/economic-atlas/ (Pages gh-pages root). curl 39/39 files 200; Playwright live 1440x900 and 390x844: 0 failed requests, 0 console errors, 0 external requests, screenshots read; Lighthouse x3: desktop perf 1.00 LCP 0.37 to 0.50 s; mobile perf 0.96/0.99/0.99 LCP 2.51 s (cold first run, load about 3) / 1.70 / 1.66 s, re-measured twice idle 1.66 s, CLS 0, a11y 1.00; case study on projects-site branch `add-economic-atlas` (d2af451) awaiting orchestrator merge; no code licence file (owner decision pending) | artifacts/evidence/live/ |
