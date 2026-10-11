import { useRef } from "react";
import { useArtifact } from "../data/useArtifact";
import { FACTS, INDICATORS, META, SEED_LATEST } from "../data/artifacts";
import { S00 } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { Legend } from "../components/Legend";
import { NoDataSet } from "../components/NoDataSet";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useProgress } from "../scroll/hooks";
import { windowed } from "../motion/progress";
import { easeSymmetric } from "../motion/ease";
import { viewportClass } from "../graphics/canvas";
import { motionEnabled } from "../state/motion";
import type { LoadState } from "../data/loader";
import { Footer } from "../components/Footer";

/** One status line for the first-paint files the disc needs: the first loading or failing file wins. */
function DiscStatus({ items }: { items: [string, LoadState<unknown>, () => void][] }) {
  const err = items.find(([, s]) => s.status === "error");
  if (err) {
    const [file, s, retry] = err;
    return <ErrorLine file={file.replace(".json", "")} reason={(s as { reason: string }).reason} attempt={s.attempt} onRetry={retry} />;
  }
  const ld = items.find(([, s]) => s.status === "loading");
  if (ld) {
    const s = ld[1] as { loaded: number; total: number | null };
    return <div className="state-delay"><LoadingLine file={ld[0].replace(".json", "")} loaded={s.loaded} total={s.total} /></div>;
  }
  return null;
}

/**
 * S00 "The Sort" corner labels, chip and legend over the static hero (index.html), and the S01
 * scrub: the headline shrinks to the top, the scrim and corner labels fade as the disc moves to G1.
 */
export function S00Layer({ introPlaying }: { introPlaying: boolean }) {
  const [f] = useArtifact(FACTS, false);
  const [m] = useArtifact(META, false);
  const [lay, retryLay] = useArtifact(SEED_LATEST, false);
  const [ind, retryInd] = useArtifact(INDICATORS, false);
  const fade = useRef<HTMLDivElement>(null);
  const kicker = useRef<HTMLParagraphElement>(null);

  useProgress("eight-billion", (p) => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]"), scrim = document.querySelector<HTMLElement>(".hero-scrim");
    const t = motionEnabled() ? windowed(p, 0, 0.4, easeSymmetric) : 0; // reduced motion: in flow, nothing scrubs
    if (h) {
      const cls = viewportClass(innerWidth), top = cls === "D" ? 96 : cls === "T" ? 72 : 56;
      const dy = (top - h.offsetTop) * t;
      h.style.transform = t > 0 ? `translateY(${dy}px) scale(${1 - 0.5 * t})` : "";
    }
    if (scrim) scrim.style.opacity = String(1 - t);
    if (fade.current) fade.current.style.opacity = String(1 - windowed(p, 0, 0.2));
    if (kicker.current) kicker.current.style.opacity = String(windowed(p, 0.45, 0.6));
  });

  const ready = f.status === "ready";
  const edges = ind.status === "ready" ? ind.data.indicators.find((i) => i.id === "gdppc_ppp")!.display : null;
  const noData = lay.status === "ready" ? lay.data.years[0]!.no_data : [];
  return (
    <>
      <div ref={fade} className="s00-fade">
        <div className="s00-tl" data-intro-corner>
          <p className="wordmark">{S00.wordmark}</p>
          {ready && noData.length ? <div className="s00-nodata"><NoDataSet rows={noData} caption={S00.noDataLatest(f.data)} /></div> : null}
        </div>
        <div className="s00-tr" data-intro-corner>
          {ready ? <p className="tnum">{S00.line1(f.data)}</p> : <p aria-hidden="true">&nbsp;</p>}
          <p className="muted">{S00.line2}</p>
        </div>
        <div className="s00-foot" data-intro-late style={introPlaying ? { opacity: 0 } : undefined}>
          <p className="s00-chips">
            <HonestyChip tag="OBSERVED" detail={S00.chip} />
            <HonestyChip tag="DERIVED" detail={S00.layoutChip} />
          </p>
          {edges ? <Legend edges={edges.bins} labels={edges.edge_labels} unit={S00.legendUnit} note={S00.legendNote} /> : null}
        </div>
        <div className="s00-status">
          <DiscStatus items={[["seedhead/gdppc_ppp_latest.json", lay, retryLay], ["indicators.json", ind, retryInd]]} />
        </div>
      </div>
      <p ref={kicker} className="s01-kicker scene-kicker" style={{ opacity: 0 }}>S01 · EIGHT BILLION · STATEMENT AND CARDS BUILT IN STAGE B</p>
      {m.status === "ready" ? <div className="s01-footer"><Footer /></div> : null}
    </>
  );
}
