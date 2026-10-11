import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { jumpTo, registerTrack, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { NAV_ITEMS, SCENES, navActive, type SceneDef } from "./scenes";
import { useIntro } from "./useIntro";
import { getStore } from "../data/loader";
import { CONVERGENCE, COUNTRIES, FACTS, INDICATORS, META, PANEL, SEED_LATEST, SEED_YEARS } from "../data/artifacts";
import { startDirector } from "../scenes/director";
import { S00Layer } from "../scenes/S00Layer";
import { S03aYears } from "../scenes/S03aYears";
import { S03bWeight } from "../scenes/S03bWeight";
import { Footer } from "../components/Footer";
import { useStore, view } from "../state/scenes";

function Placeholder({ s, full }: { s: SceneDef; full?: boolean }) {
  return (
    <Track id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id} scene--placeholder`}>
      <div className="placeholder">
        <p className="scene-kicker">{s.code} · {s.nav ?? "CLOSING"} · BUILT IN STAGE B</p>
        <h2 id={`${s.id}-title`} tabIndex={-1} data-scene-heading className="placeholder__title">{s.title}</h2>
      </div>
      <Footer full={full} />
    </Track>
  );
}

/** App: the static S00/S01 track (index.html) plus the React scenes, the seed canvases and the nav. */
export function App() {
  const active = useActiveScene();
  const intro = useIntro();
  const gl = useRef<HTMLCanvasElement>(null);
  const flat = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLParagraphElement>(null);
  const v = useStore(view);
  useLayoutEffect(() => {
    const el = document.getElementById("eight-billion");
    return el ? registerTrack("eight-billion", el, SCENES[0]!.landing) : undefined;
  }, []);
  useEffect(() => {
    // first paint (MOTION_SYSTEM 9.3): facts, meta, countries, the latest layout; then colours (deviation: values are not in DR-1)
    for (const s of [FACTS, META, COUNTRIES, SEED_LATEST]) getStore(s as never).prefetch();
    for (const s of [PANEL, INDICATORS]) getStore(s as never).prefetch();
    startDirector(gl.current!, flat.current!, labels.current!, tip.current!);
    resolveInitialHash();
  }, []);
  useEffect(() => {
    // idle after the intro: the 36-year layouts and the convergence file (S03a, S03b)
    if (!intro.navIn) return;
    const go = () => { getStore(SEED_YEARS).prefetch(); getStore(CONVERGENCE).prefetch(); };
    const ric = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    if (ric) ric(go); else go();
  }, [intro.navIn]);
  const portal = document.getElementById("eb-portal");
  return (
    <>
      <canvas ref={gl} className="seed-layer" aria-hidden="true" />
      <canvas ref={flat} className="seed-layer" aria-hidden="true" hidden />
      <div ref={labels} className="seed-labels" aria-hidden="true" />
      <p ref={tip} className="seed-tip" role="status" hidden />
      {v.lost ? <p className="gl-note state-line" role="status">REDUCED RENDERER</p> : null}
      {portal ? createPortal(<S00Layer introPlaying={intro.playing} />, portal) : null}
      {SCENES.slice(1).map((s) =>
        s.id === "years" ? <S03aYears key={s.id} def={s} /> : s.id === "weight" ? <S03bWeight key={s.id} def={s} /> : <Placeholder key={s.id} s={s} full={s.id === "resorted"} />,
      )}
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
