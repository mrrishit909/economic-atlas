# Economic Atlas

**The World, Explained Through Economic Forces.** A scroll story and comparison engine over World Bank WDI data for 217 countries (1990 to 2025) plus one long-run Maddison series: are poorer countries catching up, who looks alike, and what changes when you change the window. The visual form is the Seed Head: a lattice of about one-million-person grains laid out as country territories. Static site, no backend, no live data.

This repository holds the pipeline, analytics, tests and versioned JSON artifacts. The site lives in `site/`.

Live site (placeholder until deployed): https://mrrishit909.github.io/economic-atlas/

Part of The Data Frontier program (project 05). Status: `docs/BUILD_STATUS.md`. Educational explainer; not investment, policy or economic advice. Not sponsored or endorsed by the World Bank, Our World in Data or the Maddison Project.

## Run

Requires Python 3.12 with [uv](https://docs.astral.sh/uv/) and Node 24. The published artifacts are committed, so the site steps work without the pipeline.

```
# data and engine
uv sync
uv run python -m pipelines.run_all --fetch   # downloads WDI + one OWID CSV into data/raw, then builds everything
uv run python -m pipelines.run_all           # rebuild from data/raw (about 10 s, plus the seed-head step below)
uv run pytest -q
uv run python -m pipelines.validate_artifacts

# site
cd site
npm ci
npm run typecheck && npm run lint && npm test
npm run build && npm run preview             # http://localhost:4341/economic-atlas/
npm run e2e                                  # Playwright against the production build
```

The seed-head territory layouts (`site/public/data/seedhead/*.json`) are solved offline by `pipelines/seedhead.py` (also run by `run_all`). The full layout build takes about 45 minutes; `tests/test_seedhead.py::test_layout_byte_identical_on_rerun` repeats it to prove determinism. Seeds are fixed (20261010).

Layout: `pipelines/` (ingestion, cleaning, publish, contracts, seedhead, validation), `analytics/` (convergence, clustering, correlations, boundaries, longrun, narratives, seedhead layout solver), `data/contracts/` (JSON Schema per artifact), `site/` (Vite + React 18 + TypeScript, raw WebGL2 with Canvas 2D fallback, Lenis), `site/public/data/` (16 artifacts plus 18 seed-head layouts), `tests/` (pytest). See `docs/ARCHITECTURE.md`. Deploy: `scripts/deploy_site_pages.sh economic-atlas` (`docs/DEPLOYMENT.md`).

## Docs
`docs/`: PROBLEM, DATA_SOURCES, DATA_CONTRACTS, METHODOLOGY, VISUAL_DESIGN, MOTION_SYSTEM, ARCHITECTURE, TESTING, LIMITATIONS, DEPLOYMENT, BUILD_STATUS.

## Honesty tags

Every number carries a tag, visible in the UI.

| Tag | Meaning |
|---|---|
| OBSERVED | Read directly from WDI or the Maddison series |
| DERIVED | Deterministic computation on observed data (regressions, rankings, hhi5, seed-head layouts) |
| PREDICTED | A model output; here only the unsupervised cluster assignment (k = 3) |
| SIMULATED | None published |
| SYNTHETIC | None published |

Convergence, correlations and clusters are descriptive and not causal.

## Data credits and licences

- World Bank, World Development Indicators, CC BY 4.0. "Source: World Bank, World Development Indicators (CC BY 4.0)." Vintage: WDI last updated 2026-10-08, retrieved 2026-10-11. Some series are third-party (UN, ILO, Comtrade) redistributed under the WDI catalogue entry; the per-indicator credit is in `indicators.json`.
- Bolt and van Zanden, Maddison Project Database 2023, CC BY 4.0, via Our World in Data (last updated 2024-04-26). Long-run context only; never combined with WDI PPP.
- IMF World Economic Outlook is not used (terms prohibit automated bulk download without written permission).
- Fonts, self-hosted Latin subsets (SIL OFL 1.1): Newsreader Variable and JetBrains Mono Variable via `@fontsource-variable`.
- Code in this repository is the author's. The visual language is original; no reference-site fonts, images or scripts are copied.

## Measured results

Builder-measured Lighthouse, pending independent QA: mobile LCP 1.81 s, performance 88 / 99 / 99 across three runs, accessibility 100; desktop 100 / 100. Independent QA, deployed-URL checks and frame pacing: `TBD (pending QA)`. See `docs/TESTING.md`.
