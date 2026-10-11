import { useRef, useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { WordReveal } from "../components/WordReveal";
import { Footer } from "../components/Footer";
import { HonestyChip } from "../components/HonestyChip";
import { Statuses } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { FACTS, INDICATORS, META } from "../data/artifacts";
import { S00, S08_COPY } from "../data/copy";
import { jumpTo } from "../scroll/engine";
import { useMotion, useProgress } from "../scroll/hooks";
import { stepState, windowed } from "../motion/progress";
import { atlas, useStore } from "../state/scenes";
import { unitFor, type Ind } from "../model/atlas";
import { latestOf } from "./director";

const REPO = "https://github.com/mrrishit909/economic-atlas";

/** S08 The Re-sort (interaction 11): back to the giant disc, the paragraph, then the S00 shuffle-and-sort echo. */
export function S08Resort({ def, onReplay }: { def: SceneDef; onReplay: () => void }) {
  const motion = useMotion();
  const A = useStore(atlas);
  const [f, retryF] = useArtifact(FACTS, false);
  const [m, retryM] = useArtifact(META, false);
  const [ind, retryInd] = useArtifact(INDICATORS, false);
  const [stage, setStage] = useState(0); // 0 none, 1 corner labels + echo, 2 caption, 3 links
  const sRef = useRef(0);
  const scrim = useRef<HTMLDivElement>(null);
  useProgress(def.id, (p) => {
    if (scrim.current) scrim.current.style.opacity = String(motion ? windowed(p, 0.2, 0.35) : 1);
    const s = stepState(sRef.current, p, [0.7, 0.76, 0.8]);
    if (s !== sRef.current) { sRef.current = s; setStage(s); }
  });
  const useAtlas = A.touched;
  const I = ind.status === "ready" ? (ind.data.indicators.find((i) => i.id === (useAtlas ? A.shownInd : "gdppc_ppp")) as unknown as Ind | undefined) : undefined;
  const year = useAtlas ? A.year || latestOf(A.shownInd) : f.status === "ready" ? (f.data.gdppc_ppp_latest_year as { value: number }).value : 0;
  const st = motion ? stage : 3;
  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-resorted">
      <div ref={scrim} className="hero-scrim s08-scrim" aria-hidden="true" />
      <WordReveal as="h2" id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="s08-para serif" text={S08_COPY.paragraph}
        mode={motion ? { kind: "scrub", track: def.id, from: 0.35, to: 0.65 } : { kind: "value", t: 1 }} />
      {st >= 1 ? (
        <div className="s08-corners">
          <p className="wordmark">{S00.wordmark}</p>
          {I && f.status === "ready" ? <p className="s08-tr">{useAtlas ? `${year} · ${I.label.toUpperCase()}` : S00.line1(f.data)}</p> : null}
        </div>
      ) : null}
      {st >= 2 && I ? (
        <p className="s08-caption" data-caption>
          {year} · SORTED BY {I.label.toUpperCase()} · {unitFor(I)} · {useAtlas ? <HonestyChip tag="OBSERVED" detail="YOUR VIEW" /> : <HonestyChip tag="OBSERVED" />}
        </p>
      ) : null}
      {st >= 3 ? (
        <nav className="s08-links" aria-label="Where next">
          <button type="button" className="s08-link" onClick={() => jumpTo("atlas", 0, { push: true, focus: true })}>{S08_COPY.links[0]}</button>
          <button type="button" className="s08-link" onClick={onReplay}>{S08_COPY.links[1]}</button>
          <a className="s08-link" href={`${REPO}/blob/main/docs/METHODOLOGY.md`} rel="noopener">{S08_COPY.links[2]}</a>
          <a className="s08-link" href={REPO} rel="noopener">{S08_COPY.links[3]}</a>
        </nav>
      ) : null}
      <div className="s08-status"><Statuses items={[["facts", f, retryF], ["meta", m, retryM], ["indicators", ind, retryInd]]} /></div>
      <div className="s08-foot">
        <Footer full />
        {m.status === "ready" ? <p className="s08-disc">{(m.data as unknown as { disclaimers: string[] }).disclaimers.find((d) => d.startsWith("Not sponsored"))?.toUpperCase() ?? ""}</p> : null}
      </div>
    </Track>
  );
}
