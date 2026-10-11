# Architecture

Two halves joined by a contract: an offline Python pipeline that turns World Bank WDI and one OWID/Maddison series into small versioned JSON artifacts, and a static browser site that reads them. The hardest computation, the seed-head territory layouts, is solved offline and shipped as data; the browser only draws and lightly recomputes.

```
data/raw (gitignored)       pipelines/ingestion/fetch.py       (WDI API + one OWID CSV; sha256, lastupdated in data/manifests/)
  -> cleaning + ledger      pipelines/cleaning/clean.py        (217 countries / 79 aggregates, counted drops, no interpolation)
  -> analytics              analytics/{convergence,clustering,correlations,boundaries,longrun,narratives,units,display}.py
  -> seed-head layouts      analytics/seedhead.py, pipelines/seedhead.py   (offline solver, about 45 min)
  -> site/public/data/*     pipelines/publish.py               (tracked JSON, honesty tag per artifact and field)
  -> data/contracts/*.json  pipelines/contracts.py             (JSON Schema per artifact)
```

Entry point `pipelines/run_all.py` (`--fetch` downloads); `pipelines/validate_artifacts.py` and `pipelines/validation.py` check artifacts. Paths and constants: `pipelines/common.py`. `analytics/units.py::assert_same_basis` guards every level comparison so PPP, constant USD, current USD and Maddison dollars are never mixed.

## Data contract

`data/contracts/*.schema.json` (17 files) validate the 16 artifacts in `site/public/data/` and the seed-head layouts (`seedhead.schema.json`): boundaries, clusters, convergence, correlations, countries, coverage, facts, indicators, longrun, meta, narratives, panel_income, panel_structure, rankings, reconciliation, validation (see `docs/DATA_CONTRACTS.md` for the exact list). `site/public/data/seedhead/` holds 18 lazily loaded layout files (one per indicator; `gdppc_ppp_latest.json` is the 4.9 KB first-paint file). `facts.json` is the single source of numbers in site copy (`src/data/copy.ts`, guarded by `copy.test.ts`). Sizes per file are in `meta.json`.

## Site (`site/`)

Vite 8, React 18, TypeScript strict, Tailwind CSS v4, Lenis smooth scroll, self-hosted variable fonts, raw WebGL2 instanced quads with a Canvas 2D fallback. Base path `/economic-atlas/` (`site/vite.config.ts`), `appType: "mpa"` so a missing artifact is a real 404 as on Pages. Static output, no server, no external requests.

| Area | Files | Role |
|---|---|---|
| Shell | `src/main.tsx`, `src/app/{App,scenes,useIntro,ErrorBoundary}` | Scene registry (`scenes.ts`: id, code, track height, landing point), intro, error boundary |
| Data layer | `src/data/{loader,artifacts,copy,useArtifact}.ts` | Typed loaders with loading/ready/empty/error/retry states; copy generated from facts |
| Scroll | `src/scroll/{engine,hooks,Track}` | Pinned tracks, progress per frame |
| Motion | `src/scenes/director.ts`, `src/gl/transition.ts`, `src/state/motion.ts` | Scene state from (scene, progress, time); quality tiers (high, low, no-GL); reduced-motion in-flow rendering |
| Graphics | `src/gl/seeds.ts`, `src/graphics/{canvas,orb}.ts`, `src/scenes/{geometry,Plane}` | The seed disc, disc-to-plane flight, Canvas 2D fallback |
| Model | `src/model/{atlas,bins,layout,likeness,narratives,plane,seedstates}.ts` | Atlas comparison engine, value bins, layout lookup, likeness, template narratives, regression points derived in the browser |
| State | `src/state/{scenes,motion}.ts` | Active scene and motion state |
| Scenes | `src/scenes/S00Layer` to `S08Resort`, `Atlas.tsx` | S01 to S08 and ATLAS |
| Components | `src/components/` | Nav, Inspector, Legend, HonestyChip, StoryCard/Deck, StateUI, NotificationCard, NoDataSet, Tooltip |
| Dev | `src/dev/Gallery.tsx` | Component gallery (`npm run build:gallery`), excluded from the production page |

### Scene map (`src/app/scenes.ts`)

| Code | Id | Scene |
|---|---|---|
| S01 (S00 intro overlay) | eight-billion | The bright core and the long rim |
| S02 | sources | Where the numbers come from |
| S03a | years | Thirty-five years |
| S03b | weight | Count people, not countries |
| S04 | catch-up | Did the poor grow faster? |
| S05 | lab | Change the window, change the answer |
| S06 | likeness | Who looks alike, what travels together |
| S07 | evidence | How we know |
| ATLAS | atlas | Compare any economies, on one footing |
| S08 | resorted | The world, re-sorted |

Fonts are Latin subsets built by `site/scripts/subset-fonts.py`. Evidence capture and serving helpers are in `site/tests/` (`serve.mjs` serves the production build on port 4341 at the Pages base path).
