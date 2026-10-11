# Motion system: Economic Atlas

This is the phase 17 motion bible. It pairs with `VISUAL_DESIGN.md`, and all references point there:

- scene ids S00-S08 and ATLAS
- geometry states G0 (giant), G1 (aside), G2 (years), G3 (weight), PL (plane), G4a/G4b (groups, relations) and G5 (atlas)
- interaction numbers 1-11

Every value here is binding for the frontend engineer. A deviation needs a written reason in `docs/ENGINEERING_DECISIONS.md` (the orchestrator owns that file).

## Contents

1. [Global principles and the six motion layers](#1-global-principles-and-the-six-motion-layers)
2. [Hard rules](#2-hard-rules)
3. [Token mapping](#3-token-mapping)
4. [The scroll engine and the seed transition model](#4-the-scroll-engine-and-the-seed-transition-model)
5. [Animation specifications](#5-animation-specifications)
6. [Navigation, chapter jumps, interruption](#6-navigation-chapter-jumps-interruption)
7. [Operational state motion](#7-operational-state-motion)
8. [Reduced motion](#8-reduced-motion)
9. [Performance budgets and rendering](#9-performance-budgets-and-rendering)
10. [Technical stack recommendation](#10-technical-stack-recommendation)
11. [Motion test plan](#11-motion-test-plan)

---

## 1. Global principles and the six motion layers

1. **Motion performs the analysis. Nothing moves to decorate.** Every motion is the visible form of an analytical operation:

   | Motion | Operation |
   |---|---|
   | Grains *sort* | ranking |
   | Territories *re-flow* | changing the indicator |
   | Seeds *coalesce* into one per country, and *burst* back | weighting by countries or by people |
   | Hollowing | setting aside a sample |
   | The disc *flies* into the plane | from levels to growth |
   | Seeds *dim* outside a tercile | sub-sampling |
   | Seeds *grow* by weight | WLS |
   | The disc *splits* into three | grouping |

2. **Straight, never around.** Grains travel on straight eased paths between two real positions. Nothing rotates, nothing sweeps, and nothing travels along the circumference. The lattice's golden-angle spiral is static geometry, never an animated spin (P01 owns the stepping dial, and P04 bans rotation).
3. **Two motion modes,** from the reference:
   - **Scrubbed.** A pure function of scroll progress, reversible and stateless: G-state camera moves, the flight, card decks, word reveals.
   - **Stepped.** A threshold triggers a timed, retargetable transition: weight steps, window steps, group splits, relation pairs, argument cards, the echo.
4. **Data is shown only at real states.**
   - Every year, indicator, record (fit) and pair on screen is a published state.
   - A change is either a **crossfade** between two real states (years, fits) or a **keyed travel** of grains between two real layouts (indicator, count, flight).
   - **No value is ever interpolated.** A grain in flight keeps its source colour until it lands, then takes the destination colour, so it never shows a colour that belongs to no state.
   - **Fit lines crossfade (200ms). They never tween slope or intercept**, because an intermediate line would be a fit that does not exist.
5. **Never between bases.** A change of price basis (PPP, constant USD, current USD) is a three-phase swap: neutral, swap, recolour (5.7). No frame holds two bases.
6. **One luminous form at a time:**
   - In S00 and S08 it is the giant disc (plus its grain glow at 14%).
   - From S01 to ATLAS it is the disc, the plane or the group discs at scene size. In S02 it dims to 20%, and in S07 to 15%, behind the cards.
7. **Slow structure, quick data.** Camera moves (G-states) take 800-1200ms or are scrubbed. Reflows and flights take 1200ms. Crossfades take 200ms, and numerals 600ms.
8. **Keyed continuity:**
   - every grain by `(iso3, k)`, where k is 0..count-1 in lattice order within its territory
   - every country seed (COUNTRIES mode, plane, group discs) by `iso3`
   - every fit by `record.id`
   - every pair by the unordered `{a, b}`

   Keyed things travel. They never swap identity in a crossfade between different positions.
9. **Settle, don't bounce.** There is no overshoot on data marks. Springs (damping ratio 1.0 or more) are allowed only on bottom sheets.
10. **The visitor always wins.** Any input retargets or completes an animation immediately. Nothing queues and nothing blocks scroll.

### The six motion layers (directive requirement)

| Layer | Where it lives | Spec |
|---|---|---|
| 1. Intro | S00 The Sort: dust, speckle, sort, seams, labels, headline and nav | 5.1 |
| 2. Navigation transitions | Bottom bar active block, MENU pill, chapter jumps with a stage fade, focus moves | 6 |
| 3. Scroll storytelling | G-state moves, the year scrub, weight steps, the flight, window steps, group split, relation pairs, the echo | 4, 5.3-5.9, 5.13 |
| 4. Component interaction | Segmented controls, comboboxes, pickers, the inspector, bottom sheets, the ATLAS rail, seed hover | 5.12, 5.14 |
| 5. Data transitions | The Reflow, coalesce and burst, year crossfades, fit crossfades, keyed seed moves, numerals, legend swaps | 5.5-5.10 |
| 6. Microinteractions | Hover, press and focus on squares and chips, tooltips, ✓ marks, the RESET confirmation, combobox chips | 5.14, 7 |

## 2. Hard rules

Each rule is checked in QA.

| Rule | Test |
|---|---|
| **LCP:** `h1[data-hero]` is in the HTML and painted from first paint as ghost text (opacity 0.55, `filter: blur(12px)`, ENGINEERING_DECISIONS #10), never at opacity 0. The display font is preloaded, with a metric-matched fallback. The WebGL canvas is created after first paint | Lighthouse: the LCP element is `h1[data-hero]`, LCP is 2.5s or less and CLS is 0.1 or less (mobile and desktop presets) |
| **Nothing heavy on the LCP path.** First paint needs only `facts.json`, `meta.json`, `countries.json` and `seedhead/gdppc_ppp_latest.json` (DR-1, under 6 KB gz). Everything else loads at idle or on scene entry (9.3) | A Lighthouse waterfall shows no panel, narratives or other seedhead request before FCP |
| **No value tween, no basis tween.** Grains change colour only on landing or in a crossfade. Fit lines only crossfade. A basis change goes through the neutral phase | Vitest on the transition builder: no attribute stream mixes two bins with a weight strictly between 0 and 1 for more than 200ms. Playwright samples 10 frames of a BASIS swap: never two unit strings in the DOM, and never two bin palettes on the canvas (debug hook) |
| **Area rule.** Total drawn seed area / `s²` equals people / 1M within 0.5% at every rest state in PEOPLE mode | Debug hook at S00 end, S03a p 0.5 and the ATLAS default |
| **Straight paths only.** Grain paths are linear in position (eased in time). No rotation uniform exists | Code review plus a Vitest on the shader inputs: positions are `mix(from, to, e(t))` |
| Animate only `transform`, `opacity` and `filter` (at most 14 word spans at once) in the DOM. The canvas draws its own pixels. Never animate layout properties or `backdrop-filter` | A DevTools trace shows no Layout events inside scrubbed frames |
| **One `requestAnimationFrame` loop** owns everything: Lenis, progress, tweens and the GL draw | Grep finds one `requestAnimationFrame` call site (`src/motion/loop.ts`) |
| **Integer display.** The S03a `mix` between two years is non-zero only during a crossfade of 200ms or less | Vitest on the state controller: after 250ms with no input, `mix` is 0 or 1 |
| No artificial delays, no fake progress, no fake spinner | Code review: no `setTimeout` gates any data display |
| No drawing on hidden stages. The canvas redraws only when dirty (progress changed, a transition is active, the glow is active) | Playwright: with S07 centred, the canvas frame counter is flat for 2s once the cards settle |

## 3. Token mapping

| Token | Value | Used for |
|---|---|---|
| `--motion-fast` | 200ms | Nav hover (reference `0.2s ease-in-out`), tooltips, **year crossfades**, **fit crossfades**, legend swaps, the neutral phase of a basis swap, pill label swap |
| `--motion-standard` | 350ms | Argument card stack (reference `all .35s ease-in-out`), intro completion on input, chapter-jump stage fade, segmented active block, inspector exit |
| `--motion-panel` | 600ms | Numeral tweens, hollowing (set aside), tercile dimming, weight growth (seed area by `weight`), inspector enter, data entering after load |
| `--motion-card` | 800ms | Story-card settle, G-state moves on a jump or a non-scrubbed change, the inverse flight (S05 to S06), coalesce and burst |
| `--motion-scene` | 1200ms | **The Reflow**, the group split, window steps in S04, keyed moves in the lab (the reference's `transform 1.2s cubic-bezier(.33,1,.68,1)`), the dissolve in the S08 echo |
| `--ease-premium` `cubic-bezier(.5,0,0,1)` | | Entrances and departures: cards, nav enter, inspector, S00 dust |
| `--ease-symmetric` `cubic-bezier(.5,0,.5,1)` | | Every scrubbed interpolation (G-state camera, the flight) and the S00 sort, so reverse scroll feels identical |
| `--ease-smooth` `cubic-bezier(.33,1,.68,1)` | | Stepped settles: the Reflow, coalesce and burst, window steps, numeral tweens, word sharpening |
| `linear` | | Story progress segments, coverage comb draw, loading percentages (no easing on measurements) |
| `ease-in-out` | | Nav hover only (matches the reference) |

These all fall inside the directive's ranges:

| Directive category | Directive range (ms) | Our value (ms) |
|---|---|---|
| Hover | 120-250 | 200 |
| Buttons | 150-300 | 200-350 |
| Panels | 250-600 | 350-600 |
| Charts | 400-1000 | 600-800 |
| Section transitions | 700-1800 | 800-1200 |
| Cinematic | 1000-3000 | 1200-1600, plus the 4.6s composite intro |

## 4. The scroll engine and the seed transition model

Reuse the app shell already ported through P01-P04 (`site/src/motion`, `scroll`, the loader and the nav). Do not rebuild it.

**The scroll engine:**

- **Tracks.** A `<section>` with the track height from VISUAL_DESIGN 3.1, and a sticky `100dvh` stage inside it. Progress is `p = clamp((scrollY - trackTop) / (trackHeight - innerHeight), 0, 1)` from Lenis's value, with geometry cached and re-measured on resize.
- **Active set.** Only the scene at the viewport centre and the next scene receive `update(p, dt)`. The single canvas is shared by every scene except S07's cards. Each frame it draws only the active scene's state.
- **Scrubbed** functions take the form `s = ease((p - a) / (b - a))`, clamped. They hold no state.
- **Stepped** thresholds use **hysteresis ±0.02**.
- **Lenis:** `lerp 0.1` on D, native touch scroll on T/M (`syncTouch: false`), and off under reduced motion.

**The seed transition model** (`src/gl/transition.ts`):

- **World space.** Seeds live in world units: a disc state places slot `i` at `(sqrt(i + 0.5) cos(i·φ), sqrt(i + 0.5) sin(i·φ))`, with φ the golden angle. The **camera** uniform `(c, s)` maps world units to CSS px, so G-state moves are uniform-only and cost no per-seed work. Plane states place seeds in plane space with the identity camera.
- **A transition** is one buffer upload of per-seed attributes:

  | Attribute | Meaning |
  |---|---|
  | `aFrom`, `aTo` | Position at each end |
  | `aBinFrom`, `aBinTo` | Colour bin at each end |
  | `aSizeFrom`, `aSizeTo` | Seed size |
  | `aHollowFrom`, `aHollowTo` | Hollow flag |
  | `aDelay` | Start delay |
  | `aSwitch` | When colour switches |

  It also sets the uniforms `uT0` (start time), `uDur` and the ease id. The vertex shader computes `e = ease(clamp((now - uT0 - aDelay) / uDur, 0, 1))`, then `pos = mix(aFrom, aTo, e)` and `size = mix(aSizeFrom, aSizeTo, e)`. Colour is `aBinFrom` until `e ≥ aSwitch`, then `aBinTo`: **the colour switches, it never blends.** The one exception is the 200ms crossfade mode used for years, which blends two real states only.
- **Retargeting.** On a new transition mid-flight, the CPU evaluates the current `pos`, `size` and bin for every seed (8,005 x a few flops, well under 1ms) and uses them as the new `aFrom`. No queue.
- **Keyed mapping** between two layouts: the k-th seed of country c (in lattice order inside its old territory) maps to the k-th slot of c's new territory.
  - If c gains slots (a later year), the extra seeds fade in at their slots (opacity 0 to 1 over the last 30% of the transition).
  - If it loses slots, the surplus seeds fade out in place over the first 30%.
  - A country leaving the data (no value) travels to the no-data set; one entering travels from it.

## 5. Animation specifications

Format for each entry:

- **Trigger**
- **Initial → End**
- **Duration / Easing**
- **Sync** (scrubbed or stepped)
- **Interruption**
- **Input**
- **Reduced motion**
- **Performance**

### 5.1 S00 intro: "The Sort" (4.6s total)

| Time (ms) | What happens | Duration / easing |
|---|---|---|
| 0 | Black. Layer order is **canvas, then scrim, then h1**. The left scrim (D) or bottom scrim (T/M) is present at full strength from frame 0, black on black. `h1[data-hero]` sits **above** the scrim and is visible from first paint as ghost text (0.55, blur 12px). SKIP INTRO is visible (bottom right) | n/a |
| 200-500 | Corner labels fade in: `ECONOMIC ATLAS` top-left, `{{year}} · {{people_with_data_bn}} BN OF {{world_pop_bn}} BN PEOPLE · {{n}} COUNTRIES` top-right | 300ms premium |
| 400-1000 | **Dust.** All N grains appear **at full G0 size and position**, each at the slot `perm[i]` of a seeded shuffle (seed 20261010), as neutral `#5A5A5A` at radius 0.25 s, opacity 0 to 0.6. From this frame on, the disc's visible extent is already giant. The no-data hollow set fades in (top-left) | 600ms premium |
| 1000-1600 | **Speckle.** Each grain takes its own country's bin colour **in place** (a switch, staggered by a seeded 0-300ms delay) and grows to 0.40 s: the unsorted world | 300ms per grain, smooth |
| 1600-3400 | **The sort.** Every grain travels in a straight line from its shuffled slot to its owned slot (keyed by `(iso3, k)`). Its delay is `aDelay` = seeded 0-200ms, and its duration 1600ms, symmetric. It keeps its colour (its colour *is* its country). The core gathers bright grains and the rim magenta ones | 1600ms + up to 200ms delay |
| 3400-3700 | **Seams.** Seam grains shrink from 0.40 s to 0.22 s. Territories resolve, and the 6 most populous iso3 labels fade in (300ms) | 300ms smooth |
| 3400-3800 | The glow layer (grains at 1/4 resolution, 24px blur) fades from 0 to 14% | 400ms smooth |
| 3600-4300 | The headline sharpens word by word (5.2, time-based, 80ms stagger). The scrim does not animate | 700ms premium |
| 4200-4600 | Nav enters (translateY 16px to 0, opacity). The chip and legend appear bottom-left | 400ms premium |

- **What it is not.** The disc never grows from a point or shrinks, nothing rotates or sweeps, and no radial wave runs from the centre: all grains move at once, each along its own straight line.
- **Interruption.** Any wheel, touch-scroll, key or SKIP completes to the end state within 350ms. All grains retarget to their owned slots with a 350ms smooth tween, seams snap, and labels appear. Re-entry within the session starts at the end state.
- **Reduced motion.** The end state renders at once. REPLAY plays the 0ms version.
- **Performance.** One instanced draw of N quads. The transition is evaluated on the GPU, so the JS per frame is the camera uniform and `now`. The glow is rendered once after the seams settle (not per frame) and composited. The DPR cap is in 9.2.

### 5.2 Word blur reveal (S00 headline, S01 statement, S08 paragraph, statement swaps)

As P01-P04 5.2: words go from ghost (0.55, blur 12px) to sharp (1, 0px), at most 14 spans animating `filter` at once.

- Scrubbed in S01 and S08: each word owns a p sub-range.
- Time-based in S00: 80ms stagger, 350ms per word, smooth.
- **Statement swaps** (S05, S06): the old line exits (opacity to 0, y −8px, 350ms premium) and the new one reveals.

### 5.3 Disc camera moves (G0 → G1 → G2 → G3, G4b, G5, and back to G0)

- **Trigger:** scene progress windows (VISUAL_DESIGN 3.4), or a jump.
- **Interpolation.** The centre `c` is linear. The spacing `s` interpolates in **log space**. Labels are re-placed at territory centroids each frame (cheap: about 30 labels).
- **Sync:** scrubbed, symmetric (S01 0-0.4, S02 final 15%, S03a 0.94-1, S08 0-0.35). On a chapter jump, the target state renders directly (6.2). A non-scrubbed change (resize) snaps.
- **Never:** rotation (the lattice's angular frame is fixed forever), non-uniform scale, or a camera push past G0.
- **Performance:** uniform-only.

### 5.4 Story-card choreography (S02)

Identical to P03/P04 5.4 (the shared deck): the first card rises from below the fold, then the row translates left so each card centres. The progress segment fills `linear`. Settles are 800ms premium on jumps, otherwise scrubbed.

Card visuals:

| Card | Motion |
|---|---|
| 1 | The 79 aggregate squares turn hollow and slide to their block (600ms smooth, 4ms stagger), then the ✓ marks draw (200ms each) |
| 2 | The three unit rows enter one by one (350ms, 120ms stagger). The `≠` glyphs fade in after (200ms) |
| 3 | The comb ticks draw left to right (`linear`, 600ms per indicator) |
| 4 | The 9 spread bars scaleX from their centre (600ms, 60ms stagger) |

### 5.5 Year scrub (S03a)

- **Trigger:** scroll p 0.06-0.94 maps to years 1990 to latest (integer, `floor`).
- **Year change** (a 200ms crossfade between two real layouts, in place):
  - Grains whose owner changes switch colour through a 200ms opacity crossfade of the two real states (old grain out, new grain in, same slot). **Grains never travel during the year scrub:** slots are fixed because `s` is constant.
  - Slots added at the rim (population growth) fade in (200ms). Slots removed fade out.
  - Seams recompute per layout and crossfade with their grains.
  - The readout numerals tween (600ms; the year text swaps instantly). The sigma bracket on the legend retargets its width (600ms smooth). That is a readout of a real value, not a data mark.
  - The FOLLOW outline crossfades to the new territory (200ms).
- **Rapid scrub** (more than 6 years/s): hard-step with no crossfade (0ms).
- **Reduced motion:** 4 static discs (VISUAL_DESIGN interaction 2).
- **Performance:** a crossfade is two instanced draws for 200ms. Layouts for all years are decoded once (base64 to `Uint8Array`) at S03a entry.

### 5.6 Weight: coalesce, burst, set aside (S03b)

| p | Motion | Sync |
|---|---|---|
| 0.32 | **Coalesce** (PEOPLE → COUNTRIES). Every grain of country c travels to c's COUNTRIES-mode slot. Grain `k = 0` grows to the COUNTRIES seed size, and grains `k > 0` arrive and fade out over the last 25%. Total 800ms smooth, with a delay staggered by territory size (largest last, 0-200ms), so China visibly collapses into one seed after the small countries have settled | stepped |
| 0.54 | **YEAR 1990 ↔ latest** in COUNTRIES mode. Seeds travel between the two rankings' slots (keyed by iso3, 1200ms smooth) and switch colour on landing. Countries absent in one year go to or from the no-data set. The sigma bracket retargets (600ms) | stepped (two settles across the window) |
| 0.76 | **Burst** (COUNTRIES → PEOPLE): the inverse of coalesce (800ms). Then **SET ASIDE**: China's and India's grains switch to hollow (600ms, an outline drawn in the bin colour as the fill fades). The slope ledger numerals tween (600ms) | stepped |

- **Interactive** (any p): COUNT, YEAR and SET ASIDE fire the same transitions.
- **Reverse:** exact inverses, with the same timing.
- **Reduced motion:** static discs (VISUAL_DESIGN interaction 3). Toggles are instant.

### 5.7 The Flight (S04), the transformation, and the basis swap

| p | Motion | Sync |
|---|---|---|
| 0.08-0.40 | **The flight.** Each COUNTRIES seed travels from its disc slot (camera G3) to its plane position (camera PL). `P(t) = mix(disc(iso3), plane(iso3), ease_symmetric(t))`. Both ends are evaluated in CSS px, so the camera blend and the flight share one parameter. Seeds keep their colour (the 1990 PPP bin) | scrubbed, symmetric |
| 0.40-0.52 | The zero line draws (stroke-dashoffset, scrubbed). x labels fade in (scrubbed). Drop-out seeds switch to hollow and slide to the left-margin set (600ms smooth, stepped at 0.42) | scrubbed, plus one step |
| 0.55 / 0.70 / 0.85 | **Window steps.** Seeds move to the new record's (x, y) (keyed by iso3, 1200ms smooth). Seeds entering or leaving the sample hollow or fill (600ms). The **fit line and hatch crossfade** (200ms; never a slope tween). The ledger numerals tween (600ms). The half-life line swaps text (200ms) | stepped, hysteresis ±0.02 |
| 0.90 | The verdict card enters (translateY 24px to 0, 600ms premium) | stepped |

- **The basis swap** (used by S05 BASIS and the ATLAS indicator families):
  1. **Neutral** (200ms): every seed switches to `#5A5A5A` and the legend and unit strings fade out.
  2. **Swap** (instant, while neutral): the axes, unit strings, legend and ledger are replaced atomically.
  3. **Move** (1200ms smooth): seeds travel to the new positions while still neutral.
  4. **Recolour** (200ms): seeds switch to the new basis's bins as they land, and the new legend fades in.

  At no instant are two bases drawn or written.
- **Reverse:** exact. The flight is scrubbed, and steps reverse with the same timing.
- **Reduced motion:** the end state, plus a 3-frame static strip of the flight.
- **Performance:** 185 seeds. Trivial.

### 5.8 The Catch-up Lab (S05)

- **The guided tour** (p 0-0.3) steps through 4 SAMPLE states at the thresholds 0.06 / 0.13 / 0.20 / 0.27, each a lab transition.
- **Lab transitions:**

  | Change | Motion |
  |---|---|
  | **SAMPLE: terciles** | Seeds outside the tercile dim to 20% opacity (600ms). The fit crossfades (200ms) and spans only the tercile's x range |
  | **SAMPLE: weighted** | Seed area tweens to ∝ `points.weight` (600ms smooth). Area grows from the seed's centre and never displaces it. China and India go hollow in `…_ex_chn_ind` (600ms) |
  | **WINDOW** | Keyed moves (1200ms smooth) and the fit crossfade. Seeds without the new start year go to the left-margin set |
  | **BASIS** | The basis swap (5.7) |

- **Numerals:** 600ms tweens, tabular, in a fixed `ch` box. The half-life line swaps text (200ms) and never counts up to "no half-life".
- **Interruption:** any new control retargets from the current positions.
- **Reduced motion:** instant swaps.

### 5.9 Likeness (S06)

| p | Motion | Sync |
|---|---|---|
| 0.05 | **The split.** The COUNTRIES disc (165 clustered seeds) travels into three group discs (G4a), keyed by iso3, 1200ms smooth. Inside each group, seeds take their silhouette-ordered slots. The 52 unclustered seeds go hollow and slide to the left set. Captions fade in (350ms) after landing | stepped |
| 0.30 | **METHOD → WARD.** Seeds whose matched Ward group differs switch to hollow (600ms). The count numeral tweens (600ms). **They do not move:** a different method is a disagreement, not a re-layout | stepped |
| 0.55 | **The merge.** The three discs travel back into one COUNTRIES disc ordered by A (G4b, 1200ms) | stepped |
| 0.62 / 0.74 / 0.86 | **Pairs.** A change of A moves seeds to the new A-rank slots (1200ms keyed). A change of B recolours seeds on a seeded 0-300ms stagger (each a 200ms crossfade between the two real bins). The readout swaps (200ms) and numerals tween (600ms). `not_causal` never fades out | stepped |

- **Interactive** (p ≥ 0.92): the free pickers fire the same transitions.
- **Reduced motion:** static discs (VISUAL_DESIGN interaction 7).

### 5.10 Data transitions (keyed, everywhere)

| Element | Key | Transition |
|---|---|---|
| Grains, new layout of the same people (indicator change, the Reflow) | `(iso3, k)` | Straight travel, 1200ms smooth, with a seeded 0-150ms delay. Colour switches on landing |
| Grains, new year (S03a) | slot | 200ms crossfade between two real states, in place |
| PEOPLE ↔ COUNTRIES | iso3 | Coalesce or burst, 800ms smooth (5.6) |
| Country seeds, new record, ranking or group | iso3 | Straight travel, 1200ms smooth |
| A country without data in the new state | iso3 | Travels to or from the no-data set (1200ms) and turns hollow on arrival |
| Set aside / out of sample | iso3 | Hollow switch, 600ms |
| Fit line and CI hatch | record id | 200ms crossfade |
| Legend and unit strings | indicator id, basis | 200ms crossfade. Inside a basis swap: out during neutral, in on recolour |
| Numerals (readouts, ledgers, inspector) | field id | A 600ms tween, tabular, in a fixed `ch` box. Integers round per frame. Units and signs are always shown |
| Paths (ATLAS) | iso3 | 200ms crossfade on indicator, period or VALUES change. The y-scale tweens (600ms). The line breaks at nulls |
| Empty data | n/a | Grains fade to neutral dust (600ms). The copy fades in (350ms). Scales keep their last domain |

### 5.11 Argument stack (S07)

Identical to P01-P04 5.11 (the shared component), with 7 exchanges:

- The objection enters (translateY 40px to 0, 350ms ease-in-out).
- `THE ATLAS IS TYPING...` appears only during the 350ms between cards (skipped under reduced motion).
- The answer enters offset (+24, +16) on D.
- Older cards dim through the palette (never by opacity below the AA threshold) and scale to 0.96.
- On M, cards older than 2 collapse to slivers.
- **Mini-visuals:**
  - CI bars scaleX from their centre (600ms).
  - The k-scan bars scaleY from 0 (600ms, 60ms stagger, with k = 3 marked after).
  - Unit rows enter (350ms, 120ms stagger).
  - The ✓ marks draw (200ms each, in order).
  - Numerals tween.
- **Reverse:** cards retract in order.

### 5.12 ATLAS and the Reflow

- **The Reflow** (indicator or year change):
  - **Same basis family:** a keyed grain travel (5.10, 1200ms).
  - **Different basis:** the basis swap (5.7).
  - **Not yet loaded:** grains switch to neutral dust (200ms) while the indicator's layout loads (the real-percentage line is shown), then the Reflow runs from dust.
- **Selection:** a selected territory's grains stay at 100% while all others dim to 30% (350ms). A deselected territory returns (350ms). Selection chips enter (scale 0.96 to 1, opacity, 200ms).
- **COUNT:** coalesce or burst (5.6).
- **LIGHT BY:** the B recolour stagger (5.9).
- **VALUES (LEVEL ↔ INDEX):** paths crossfade (200ms), and the y-scale and unit swap (600ms / 200ms). The disc is unchanged.
- **Inspector:**
  - D: enters from the right (x 24px to 0, opacity, 600ms premium).
  - T/M: a bottom sheet (350ms premium, critically damped drag release).
  - The inspected territory gets a 1px white outline (200ms), and the inspector updates in place on a state change (numerals tween).
- **RESET:** all controls tween to their defaults (350ms), one Reflow, and the button shows `RESET ✓` for 1.2s.
- **Offscreen:** no transitions are started offscreen. A pending layout load completes, and its Reflow is applied as an instant state on re-entry.

### 5.13 Closing: the world, re-sorted (S08)

| p | Motion | Sync |
|---|---|---|
| 0-0.35 | G5 (or the current state) to G0: the centre goes to the G0 centre, and `s` grows in log space to the G0 value. If the visitor's state is COUNTRIES mode or the plane, it bursts back to PEOPLE first (800ms, stepped at p 0.02). The scrim fades in (S08 has no LCP constraint) | scrubbed, symmetric |
| 0.35-0.65 | Paragraph word reveal (5.2 scrubbed) | scrubbed |
| 0.70 | **The echo** (stepped, once per down-crossing). The corner labels fade in (300ms). **Dissolve:** every grain travels back to its S00 shuffled slot, the seams open (seam grains grow to 0.40 s) and labels fade (1200ms symmetric). **Re-sort:** the S00 sort (1600ms + 200ms delays), then the seams (300ms) and the glow (400ms). The caption fades in (350ms) after the seams. The disc size never changes during the echo | stepped |
| 0.80-1 | The links fade in (350ms, 60ms stagger) | stepped |

- **Reverse.** Re-crossing above 0.68 resets the echo: the disc is shown sorted, with no replay. The caption never duplicates.
- **Reduced motion.** The static giant disc with caption and links.
- **Performance.** As S00, including the glow (rendered once on entry).

### 5.14 Component microinteractions

| Component | Behaviour |
|---|---|
| Square buttons and chips | Hover: background to white and text to black (200ms ease-in-out). Press: scale 0.97 (120ms). Focus: a 2px white outline offset 2px on `:focus-visible` |
| Parameter segmented controls | The active block is **`#690DE2` with white text** and slides between items (Motion `layoutId`, 350ms premium). The nav's active block stays white (shared shell) |
| Comboboxes (FOLLOW, COUNTRIES, A/B pickers) | The list opens with a clip-path reveal (200ms premium). The active option is highlighted white with black text. Typed filtering is instant. A selected country becomes a chip that enters (200ms) and leaves with its × (150ms) |
| Disabled controls | 50% white and a 45° hatch at 25%. No hover motion. The tooltip appears after 80ms and gives the reason |
| Territories and seeds (pointer on D) | Hover gives the hovered territory a 1px white outline (120ms), and the tooltip `{{name}} · {{value}} {{unit}} · RANK {{r}} OF {{n}}`. In the plane, the hovered seed grows 1.25x (120ms) |
| Tooltips | Opacity 0 to 1 and y 4px to 0 (200ms, 80ms delay). Out in 120ms. They follow the pointer at a 12px offset, clamped to the viewport |
| ✓ / ✗ marks | The stroke draws over 200ms. ✗ uses `--state-error` and never animates repeatedly |
| Status line | Text crossfade 200ms. Loading percentages jump (they are measurements) |

## 6. Navigation, chapter jumps, interruption

### 6.1 Nav

The nav is the shared shell, identical to P01-P04 6.1:

- **D bar.** Bottom centre, `--surface-glass` with a static 16px blur, and square 13px mono items. The white active block slides (350ms premium) and hover is 200ms ease-in-out. The right end holds REPLAY INTRO and MOTION ON/OFF.
- **T/M MENU pill.** A 160x32 white pill showing the current label (200ms crossfade). A tap opens a clip-path list upward (300ms premium, 30ms item stagger), and the icon morphs from "=" to "-". Close is 250ms.
- **Labels:** EIGHT BILLION · SOURCES · YEARS · WEIGHT · CATCH-UP · LAB · LIKENESS · EVIDENCE · ATLAS. S08 keeps ATLAS active.

### 6.2 Direct chapter jumps: instant, with a stage fade

We jump instantly (the reference reached its target within 190ms). Smooth-scrolling across S03a would replay 35 years of crossfades and S04 the whole flight, which is noise. **Procedure:**

1. `lenis.scrollTo(target, {immediate: true})`.
2. The DOM layer fades in over 350ms. The canvas renders the target state directly (one buffer upload, no transition).
3. Every stepped state between the old and new positions is resolved without animation.
4. The hash is written with `replaceState` (`#catch-up`). `popstate` jumps the same way.
5. Focus moves to the scene heading.

**Landing progress per scene.** Each value sits at least 0.03 clear of every threshold ± hysteresis.

| Scene | Landing p | Why |
|---|---|---|
| S01 | 0.78 | Statement revealed, cards typing |
| S02 | 0.14 | Card 1 centred |
| S03a | 0.70 | A mid-2010s year, the disc large |
| S03b | 0.43 | COUNTRIES, latest, coalesced and settled |
| S04 | 0.95 | Plane formed, the 2010 window, verdict shown |
| S05 | 0.40 | Lab live, PPP 1990 primary |
| S06 | 0.20 | Group discs settled (k-means) |
| S07 | 0.05 | First objection |
| ATLAS | section top | |

### 6.3 Scroll interruption

| Case | Behaviour |
|---|---|
| Reverse scroll | Scrubbed phases reverse exactly. Steps use hysteresis. Transitions retarget from current positions. |
| Rapid scroll / fling | Years hard-step above 6 per second. Weight, window, group and pair steps go straight to the final state. A scene entered and left within 200ms gets its stepped state set directly. The S04 flight is scrubbed, so a fling simply shows the target flight level. |
| Mid-transition exit | Transitions finish their remaining time (GPU-evaluated, so free), then the scene pauses. A scene re-entered within 1.2s continues from its current values. |
| Resize / orientation | A `ResizeObserver` (debounced 150ms) records the scene and p, snaps transitions to their ends, re-measures, recomputes the G-state geometry from the D/T/M table (breakpoints 768 / 1024), resizes the canvas (DPR cap) and restores scrollY. Nothing animates during a resize. |
| Tab hidden | The loop stops. GPU transitions are time-based, so on return they are evaluated at their end (`now` past `uT0 + uDur`). |
| Long task | Frames are skipped, never queued. Transitions are time-based. |
| WebGL context lost | Switch to the Canvas2D fallback (9.1) with the same state. Restore WebGL on `webglcontextrestored`. A status line notes `REDUCED RENDERER` once. |

## 7. Operational state motion

| State | Motion |
|---|---|
| **Initial** | Neutral dust at 25% if the lattice is known (the slot count needs only DR-1's `slots`), otherwise nothing. No shimmer. |
| **Loading** | The mono line `LOADING {ARTIFACT} · {n}%` with real byte progress (jumps, no tween). It fades in (200ms) only if loading lasts 150ms or longer. |
| **Ready** | Dust takes colour in place (300ms switch stagger), then the scene's own transition runs (a Reflow or a sort). |
| **Empty** | Grains fade to neutral dust (600ms). The copy fades in (350ms). Controls stay live. |
| **Error** | The loading line crossfades (200ms) to `COULD NOT LOAD {ARTIFACT} ({reason})` in `--state-error`, plus `RETRY`. No shake. A schema-guard failure reads `{ARTIFACT} FAILED ITS CHECKS`. The last good state stays on screen. |
| **Retry** | The same fetch re-runs. The button shows `RETRYING`. A second failure adds `(ATTEMPT 2)`. |
| **Disabled** | 50% white plus hatch, `aria-disabled`, and a tooltip with the reason. No hover motion. |
| **Reset** | Values tween to the defaults (350ms controls, then one Reflow), and the button shows `RESET ✓` for 1.2s (`aria-live`). |

## 8. Reduced motion

It is triggered by `prefers-reduced-motion: reduce` **or** the MOTION OFF toggle. The tokens zero their durations and blur. In addition:

1. The intro shows its end state at once. REPLAY plays the 0ms version.
2. Lenis is off, and native scroll is used.
3. **Pinned tracks become normal flow:**

| Scene | Static rendering |
|---|---|
| S01 | Statement, the disc at G1, and the cards |
| S02 | 4 cards stacked vertically |
| S03a | 4 discs (1990, 2000, 2010, latest): a row on D, 2x2 on T, stacked on M. FOLLOW redraws all 4 |
| S03b | 4 discs (PEOPLE latest, COUNTRIES latest, PEOPLE 1990, PEOPLE latest set aside) with ledgers; the controls are live on a fifth |
| S04 | A 3-frame flight strip, then the plane with the 1990 fit (interactive hover) |
| S05 | The lab, live, with instant swaps |
| S06 | The 3 group discs (k-means), a WARD-disagreement disc, then 3 relation discs and one live picker disc |
| S07 | All 7 exchanges as a vertical list |
| ATLAS | Fully functional, instant updates (no travel: positions and colours switch) |
| S08 | The static giant disc, caption and links |

4. No glow fade, no sort, no stagger, no blur and no word reveals.

**Tests (Playwright `reducedMotion: 'reduce'`):**

- The document height is below the pinned height.
- No sticky positioning inside scenes.
- The canvas frame counter is stable after idle.
- Every control still changes the visible state.

## 9. Performance budgets and rendering

### 9.1 Rendering decisions

**Rendering: raw WebGL2 instanced quads for the seeds, with a Canvas2D fallback.**

| Option | Cost | Verdict |
|---|---|---|
| R3F + three.js (MASTER_PLAN default) | About 150-180 KB gz for flat 2D points | Rejected: nothing here is 3D (the same reasoning as P03 #19 and P04 #21) |
| Canvas2D arcs | 8,005 `arc` + `fill` calls per frame during the sort, Reflow and flight. Mobile frame time would exceed the 33ms budget | Rejected as the main path. **Kept as the fallback**, using pre-rendered seed sprites per bin and size (`drawImage`), with transitions shortened to 600ms |
| SVG / DOM | 8,005 nodes | Rejected |
| **Raw WebGL2** | One program (about 120 lines of GLSL in total), one instanced draw (`drawArraysInstanced`, reference 32), transitions evaluated in the vertex shader. About 8 KB of our own code | **Chosen.** Raw WebGL2 has precedent in P03 (#19) |

- **The seed shader.** Per instance: the attributes in section 4. The fragment shader draws a disc with an analytic 1-device-pixel anti-aliased edge and the bin's radial highlight (tint at 42% / 38%, bin colour at the edge). Hollow seeds draw a 0.8px ring in the bin colour (or white at 60% for no-data).
- **The glow pass** (S00 and S08 only): the same draw into a 1/4-resolution framebuffer, a separable 24px blur (2 passes), composited at 14% under the seeds. It is rendered **once** per S00/S08 entry after the seams settle, then reused as a texture.
- **The SVG overlay** (`src/plane/*.tsx`) holds the plane's labels, fit line, CI hatch (a `<pattern>`) and zero line, plus the group captions. It has 10-30 elements, so there is no per-frame work beyond the flight's scrubbed label opacity.
- **Seams** come from the 6-NN of the lattice (computed once per N in a worker at idle, about 8,005 x 6 indices: brute force on a spatial grid, under 20ms) and the layout's `owner` array.
- **Picking** (hover and click): a CPU spatial grid over the current rest positions. In disc states, the territory under the pointer is the `owner` of the nearest slot. No GPU picking.

### 9.2 Budgets

| Item | Desktop D | Tablet T / Mobile M | LOW tier |
|---|---|---|---|
| Frame budget | 16.7ms (60fps); JS 4ms or less | 33ms (30fps); JS 8ms or less | same targets |
| Canvas DPR cap | 2 | 1.5 | 1 |
| Seeds per draw | 8,005 at most (latest PEOPLE), 185 in COUNTRIES mode and the plane | same | same |
| Transition setup (buffer build + upload) | 2ms or less for 8,005 seeds | 4ms or less | same |
| Glow | Rendered once per S00/S08 entry, 1/4 resolution, 24px blur, at 14% | same | off |
| Year crossfade | 2 draws for 200ms | same | hard step |
| Sort / Reflow | GPU-evaluated, 1600 / 1200ms | same | Canvas2D fallback: 600ms, no delays |
| Territory solve | **Never in the browser** (DR-1, offline) | same | same |

- **Tier detection.** Measure the median frame time over the first 60 frames after the intro. Above 22ms on D or 40ms on M means LOW. The result is recorded in `window.__atlasQuality`. `?quality=low|high` forces a tier. No WebGL2 means LOW with the Canvas2D fallback.
- **Offscreen pause.** The canvas draws only when dirty, and draws nothing in S07 once the cards settle.
- **Measured, not claimed.** FPS, LCP, TBT and transition frame times come only from real runs (Lighthouse desktop and mobile presets, a Playwright trace with frame pacing on a stated device, and the evidence harness).

### 9.3 Loading budget (Lighthouse perf 90+, LCP 2.5s or less, CLS 0.1 or less)

The sizes below are gzip values from `meta.artifact_bytes` where they exist, or DR estimates where they do not.

| Resource | Budget (gz) | When |
|---|---|---|
| HTML + critical CSS (headline, ghost state) | 25 KB or less | first paint |
| Main JS (React, shell, loop, Lenis, Motion lazy core, seed renderer, d3-scale/d3-array subset) | 150 KB or less | deferred module |
| Fonts (2 latin woff2, display preloaded) | 120 KB or less | first paint |
| `facts` (1.8 KB), `meta` (about 1.5 KB), `countries` (5.0 KB), `seedhead/gdppc_ppp_latest` (DR-1, under 6 KB) | 15 KB or less | in parallel with JS |
| `seedhead/gdppc_ppp` (all years, DR-1), `rankings` (25.3 KB), `coverage` (7.4 KB), `reconciliation` (1.6 KB), `longrun` (4.9 KB), `indicators` (2.0 KB) | 110 KB or less | idle after the intro |
| `convergence` (35.1 KB + DR-6), `clusters` (3.9 KB + DR-5), `correlations` (2.9 KB + DR-4), `validation` (1.2 KB) | 60 KB or less | S03b entry |
| `panel_income` (123.3 KB), `panel_structure` (143.7 KB), `narratives` (24.5 KB + DR-8), `boundaries` (1.5 KB) | 300 KB or less | S06 entry, or an ATLAS deep link |
| `seedhead/<indicator>` (DR-1, about 12 KB each) | per indicator, on first selection | ATLAS |

## 10. Technical stack recommendation

| Layer | Choice | Reason |
|---|---|---|
| App | React 18 + TypeScript strict + Vite, using the shared shell (`site/src/motion`, `scroll`, loader, nav, primitives) | Program standard. No rebuild |
| Styles | `tokens.css` + CSS Modules. Project overrides: `--accent-primary: #FF6A2B`, `--accent-secondary: #FF2F7A`, `--control-fill: #690DE2` (fill only), `--orb-*: var(--orb-spectral)`, plus the 7 bin variables of VISUAL_DESIGN section 0 | Tokens own the language |
| Scroll | Lenis plus the one rAF loop | Same as P01-P04 |
| GSAP | Not used | The intro is a keyframe table run by the shared tween and the GPU transition model (P01 decision 6) |
| Component motion | Motion (`motion/react`, `LazyMotion` + `domAnimation`) | `layoutId` active blocks, inspector, sheets, chips |
| Seeds | **Raw WebGL2** in `src/gl/` (`seeds.ts` program and buffers, `transition.ts` keyed mapping and retargeting, `glow.ts`), with the Canvas2D fallback in `src/gl/seeds2d.ts` | 9.1 |
| Plane, paths, card mini-visuals | SVG components with `d3-scale` and `d3-array`; `d3-shape` only for the ATLAS path lines | Stays in the visual language, with no chart-library defaults |
| Models | Pure functions, each with Vitest parity against artifact fixtures: `src/model/units.ts` (`basisOf`, the TS mirror of `assert_same_basis`), `layout.ts` (DR-1 decode, keyed mapping, seams), `weight.ts` (counts, area scale, median person), `narratives.ts` (template rendering, with parity against `narratives.examples`), `fit.ts` (line and DR-6 band), `copy.ts` (the verdict branches, and the causal-verb lint over copy files) | |
| Data | `fetch` with stream progress, plus hand-written type guards from the JSON Schemas | Validation at the trust boundary |

## 11. Motion test plan

Playwright runs against `npm run build && npm run preview` at D, T and M.

1. **Intro.**
   - SKIP is visible at 100ms, and the nav appears within 400ms of the click.
   - A wheel at 1s completes the intro within 400ms.
   - A same-session reload starts at the end state.
   - Under reduced motion, the end state shows in the first screenshot.
2. **LCP and CLS.** In the Lighthouse JSON, the LCP element is `h1[data-hero]`, LCP is 2.5s or less, CLS is 0.1 or less, and only the four first-paint data files precede FCP.
3. **Track release.** At each scene's end plus 10px, the next heading is in view. No traps.
4. **Reverse and rapid.**
   - Fling S01 to S06 and back: the final frames match a direct load (screenshot diff under 0.5%).
   - S03b at p 0.43 shows COUNTRIES mode both forward and backward.
   - S04 at p 0.30, reached in reverse, matches a forward load.
5. **Chapter jumps.** For every nav item: scrollY lands within 2px of the landing progress within 200ms, the hash updates, back/forward work, and focus is on the heading.
6. **Resize mid-scene.** At S04 p 0.30 (mid-flight), resize 1440 to 390: the scene and p are preserved within ±0.01, there are no console errors, and the PL-M geometry matches the table.
7. **Area rule.** Debug hook at the S00 end, S03a p 0.5 and the ATLAS default: Σ drawn seed area / `s²` equals people/1M within 0.5%, and per-country slot counts equal `max(1, round(pop/1e6))`.
8. **No mixed bases.** During 10 sampled frames of a BASIS swap (S05) and of an ATLAS indicator change across families: never two unit strings in the DOM, and the debug hook reports one bin palette id on the canvas.
9. **Integer and real states.**
   - During slow S03a scrubs, sampled `mix` values are 0 or 1 whenever no change happened in the previous 250ms.
   - During a window step, no frame shows a fit line whose slope is not one of the two records' slopes (debug hook).
10. **Flight geometry.** At S04 t = 0 and t = 1, debug-hook positions of 3 seeds are within 1px of their disc slots and of their plane positions.
11. **Keyed continuity.** Across a Reflow, each `(iso3, k)` grain's landing slot is inside its country's new territory (debug hook, all grains).
12. **ATLAS scroll safety.** On M, a vertical swipe starting on the disc or a chip row scrolls the page. Nothing captures vertical pan.
13. **Reduced motion.** No sticky in scenes, no animated filter, a stable canvas counter, and every control still works.
14. **Pause offscreen.** With S07 centred (after the cards settle), the canvas frame counter is flat for 2s.
15. **Giant geometry and the P01/P02/P03/P04 confusion check (QA evidence).**
    - A debug hook reports the disc radius at or above the G0 value (D 640, T 626, M 528) from 400ms into S00 to its end, never decreasing, and again at S08 p 0.75.
    - The evidence harness writes `artifacts/evidence/<stage>/p01-p04-vs-p05-open-close.png`: S00 frames (0.5s, 1.5s, 3s, end) and S08 frames (p 0.3, 0.75, 0.9) of all five sites, at D and M, as 240px-tall tiles.
    - An independent QA reviewer confirms that no P05 frame shows any of these:
      - a stroked ring
      - nodes on a circumference
      - chords
      - wedges or spokes
      - a smooth glow disc
      - a small orb or marker
      - square cells or a limb
      - a rising horizon arc
      - a disc without visible grain gaps

      Rejection criteria 2, 5 and 19 apply. (The design-time version of this sheet is `design/sketches/distinctness-sheet.png`.)
16. **Frame pacing** (evidence harness). Scroll recordings at D and M report p50/p95 frame times on a stated device and browser, including the S00 sort and one ATLAS Reflow. These are recorded, never estimated.
