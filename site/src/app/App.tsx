import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { jumpTo, registerTrack, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { NAV_ITEMS, SCENES, navActive, type SceneDef } from "./scenes";
import { useIntro } from "./useIntro";
import { getStore } from "../data/loader";
import { BOUNDARIES, CLUSTERS, CONVERGENCE, CORRELATIONS, COUNTRIES, COVERAGE, FACTS, INDICATORS, LONGRUN, META, NARRATIVES, PANEL, PANEL_STRUCT, RECONCILIATION, SEED_LATEST, SEED_YEARS, VALIDATION } from "../data/artifacts";
import { startDirector } from "../scenes/director";
import { S00Layer } from "../scenes/S00Layer";
import { S03aYears } from "../scenes/S03aYears";
import { S03bWeight } from "../scenes/S03bWeight";
import { S02Sources } from "../scenes/S02Sources";
import { S04CatchUp } from "../scenes/S04CatchUp";
import { S05Lab } from "../scenes/S05Lab";
import { S06Likeness } from "../scenes/S06Likeness";
import { S07Evidence } from "../scenes/S07Evidence";
import { Atlas } from "../scenes/Atlas";
import { S08Resort } from "../scenes/S08Resort";
import { Inspector } from "../components/Inspector";
import { Footer } from "../components/Footer";
import { useStore, view } from "../state/scenes";

function Placeholder({ s }: { s: SceneDef }) {
  return (
    <Track id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id} scene--placeholder`}>
      <div className="placeholder">
        <p className="scene-kicker">{s.code} · {s.nav ?? "CLOSING"} · BUILT IN STAGE B</p>
        <h2 id={`${s.id}-title`} tabIndex={-1} data-scene-heading className="placeholder__title">{s.title}</h2>
      </div>
      <Footer />
    </Track>
  );
}

const SCENE_COMPONENTS: Record<string, (p: { def: SceneDef }) => React.ReactNode> = {
  sources: S02Sources, years: S03aYears, weight: S03bWeight, "catch-up": S04CatchUp, lab: S05Lab, likeness: S06Likeness, evidence: S07Evidence, atlas: Atlas,
};

/** App: the static S00/S01 track (index.html) plus the React scenes, the seed canvases and the nav. */
export function App() {
  const active = useActiveScene();
  const intro = useIntro();
  const gl = useRef<HTMLCanvasElement>(null);
  const flat = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLParagraphElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const v = useStore(view);
  useLayoutEffect(() => {
    const el = document.getElementById("eight-billion");
    return el ? registerTrack("eight-billion", el, SCENES[0]!.landing) : undefined;
  }, []);
  useEffect(() => {
    // first paint (MOTION_SYSTEM 9.3): facts, meta, countries, the latest layout (colours from its DR-9 value_bin),
    // plus indicators.json (3.4 KB gz) for the legend's edge labels
    for (const s of [FACTS, META, COUNTRIES, SEED_LATEST, INDICATORS]) getStore(s as never).prefetch();
    startDirector(gl.current!, flat.current!, labels.current!, tip.current!, glowRef.current!);
    resolveInitialHash();
  }, []);
  useEffect(() => {
    // idle after the intro: the 36-year layouts and the convergence file (S03a, S03b)
    if (!intro.navIn) return;
    // idle after the intro (MOTION_SYSTEM 9.3): years, convergence, clusters, correlations; the large panels and narratives follow
    const go = () => {
      for (const s of [SEED_YEARS, CONVERGENCE, PANEL, CLUSTERS, CORRELATIONS, RECONCILIATION, COVERAGE, LONGRUN, VALIDATION, BOUNDARIES, PANEL_STRUCT, NARRATIVES]) getStore(s as never).prefetch();
    };
    const ric = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    if (ric) ric(go); else go();
  }, [intro.navIn]);
  const portal = document.getElementById("eb-portal");
  return (
    <>
      <canvas ref={glowRef} className="seed-glow" aria-hidden="true" />
      <canvas ref={gl} className="seed-layer" aria-hidden="true" />
      <canvas ref={flat} className="seed-layer" aria-hidden="true" hidden />
      <div ref={labels} className="seed-labels" aria-hidden="true" />
      <p ref={tip} className="seed-tip" role="status" hidden />
      {v.lost ? <p className="gl-note state-line" role="status">REDUCED RENDERER</p> : null}
      {portal ? createPortal(<S00Layer introPlaying={intro.playing} />, portal) : null}
      {SCENES.slice(1).map((s) => {
        const C = SCENE_COMPONENTS[s.id];
        return s.id === "resorted" ? <S08Resort key={s.id} def={s} onReplay={intro.replay} /> : C ? <C key={s.id} def={s} /> : <Placeholder key={s.id} s={s} />;
      })}
      <Inspector />
      <Nav
        items={NAV_ITEMS}
        active={navActive(active)}
        onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={!intro.navIn}
        onSkip={intro.skip}
        onReplay={intro.replay}
      />
    </>
  );
}
