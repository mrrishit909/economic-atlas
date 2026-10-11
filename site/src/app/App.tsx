import { useEffect } from "react";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { jumpTo, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { NAV_ITEMS, SCENES, type SceneDef } from "./scenes";
import { useIntro } from "./useIntro";

function Placeholder({ s }: { s: SceneDef }) {
  return (
    <Track id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id}`}>
      <div className="placeholder">
        <p className="scene-kicker">PLACEHOLDER SCENE</p>
        <WordReveal as="h2" id={`${s.id}-title`} tabIndex={-1} data-scene-heading className="placeholder__title"
          text={s.title} mode={{ kind: "scrub", track: s.id, from: 0, to: 0.45 }} />
      </div>
    </Track>
  );
}

/** App shell: scene tracks, nav, hash deep links. Scene content arrives with the visual design. */
export function App() {
  const active = useActiveScene();
  const intro = useIntro();
  useEffect(() => { resolveInitialHash(); }, []);
  return (
    <>
      {SCENES.map((s) => <Placeholder key={s.id} s={s} />)}
      <Nav
        items={NAV_ITEMS}
        active={active ?? SCENES[0]!.id}
        onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={!intro.navIn}
        onSkip={intro.skip}
        onReplay={intro.replay}
      />
    </>
  );
}
