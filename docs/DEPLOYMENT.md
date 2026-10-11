# Deployment

Target: GitHub Pages at https://mrrishit909.github.io/economic-atlas/ (deployed 2026-10-11 from the public repo https://github.com/mrrishit909/economic-atlas, Pages source `gh-pages` at `/`).

## How

`scripts/deploy_site_pages.sh <repo-name>` (copy of the shared `~/data-frontier/shared/deployment/deploy_site_pages.sh`):

```bash
scripts/deploy_site_pages.sh economic-atlas
```

It runs `npm run build` in `site/` (which runs `tsc --noEmit` first), writes `site/dist` to a temporary worktree on the `gh-pages` branch with `.nojekyll`, pushes `gh-pages`, then creates or updates the Pages source to `gh-pages` at `/` through the GitHub API using the git credential helper's token. Run it from a clean checkout with an `origin` remote.

Base path `/economic-atlas/` is set in `site/vite.config.ts`; `npm run preview` (Vite, port 4341) and `site/tests/serve.mjs` (used by Playwright) serve the same path.

## Assets: no external requests

Fonts (Latin subsets of Newsreader and JetBrains Mono, woff2) are bundled and served from the site's own assets; there is no CDN, third-party host or font service, and the e2e suite asserts zero external requests across every scene. Data is plain JSON under `/data/` (16 artifacts) and `/data/seedhead/` (18 layout files, fetched lazily per indicator; only the 4.9 KB `gdppc_ppp_latest.json` is on the first-paint path). A missing artifact is a real 404 (`appType: "mpa"`); the loader shows the error and retry state. The WebGL2 renderer falls back to Canvas 2D when WebGL is unavailable.

## Pre-deploy checklist (the release gate)

1. `uv run pytest -q`, then in `site/`: `npm run typecheck`, `lint`, `test`, `e2e`.
2. `npm run build && npm run preview`; screenshots at 1440x900, 768x1024 and 390x844 and a scroll recording; an independent QA pass reads the images.
3. Lighthouse and axe on the production build.
4. Deploy, then verify: `curl -sI https://mrrishit909.github.io/economic-atlas/` returns 200; `curl -sI` on `.../data/facts.json` and `.../data/seedhead/gdppc_ppp_latest.json` returns 200; take a real screenshot of the live URL.
5. Add the case study to the projects site (`~/data-frontier/portfolio/05-economic-atlas/project.json` is the draft; schema `contracts/portfolio.schema.json`) and verify every link.

Results: steps 1 to 3 PASSED (independent QA pass 3, `docs/QA_REPORT.md`). Steps 4 and 5: live checks are saved under `artifacts/evidence/live/` and summarized in `docs/BUILD_STATUS.md`; the case study is on the projects site branch `add-economic-atlas` pending the orchestrator merge.

## Licence

No code licence file (`LICENSE`) is included. The choice of licence is a pending owner decision; until then the code is published without one (all rights reserved by default). Data attributions are in `docs/DATA_SOURCES.md`.

## CI

`.github/workflows/ci.yml` runs on push and pull request; it does not deploy. Python job: `uv sync --frozen` and pytest with the 8 raw-data tests deselected (51 tests). Site job: `npm ci`, typecheck, lint, Vitest, build. Deployment stays a manual script so a failing gate cannot publish.

## Rebuilding the data

Not part of deployment. `uv run python -m pipelines.run_all --fetch` re-downloads WDI (the vintage will change) and re-solves the seed-head layouts (about 45 minutes); committed artifacts are the published snapshot (WDI last updated 2026-10-08).

## Rollback

Pages serves the `gh-pages` branch; revert by force-pushing a previous `gh-pages` commit or re-running the script from an earlier tag.
