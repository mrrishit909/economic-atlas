import { useEffect, useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { CLUSTERS, CORRELATIONS, FACTS, factNum } from "../data/artifacts";
import { S06 } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { likeness, useStore } from "../state/scenes";
import { pairOf } from "../model/likeness";
import { groupCentres, ungroupedXY } from "./freestates";
import { cssClass, stageH, stageW } from "../graphics/canvas";

/** Variable names for the pickers: the DR-4 transform text, shortened to its head. */
const short = (id: string) => id.replace(/^ln_/, "LN ").replace("_asinh", " (ASINH)").replace(/_/g, " ").toUpperCase();

/** S06 Likeness (interaction 7): three descriptive group discs, then ORDER BY A, LIGHT BY B. */
export function S06Likeness({ def }: { def: SceneDef }) {
  const [cl, retryCl] = useArtifact(CLUSTERS, false);
  const [co, retryCo] = useArtifact(CORRELATIONS, false);
  const L = useStore(likeness);
  const [f] = useArtifact(FACTS, false);
  const [box, setBox] = useState(() => ({ w: stageW(), h: stageH(), cls: cssClass() }));
  useEffect(() => { const on = () => setBox({ w: stageW(), h: stageH(), cls: cssClass() }); addEventListener("resize", on); return () => removeEventListener("resize", on); }, []);
  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-likeness">
      <div className="col col--plane">
        <div className="col__head">
          <p className="scene-kicker">LIKENESS · {L.part === 1 ? "PEER GROUPS (K-MEANS, K = 3)" : "RELATIONS ACROSS COUNTRIES"}</p>
          <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="statement" key={L.part}>{L.part === 1 ? S06.statement1 : S06.statement2}</h2>
        </div>
        {L.part === 1 ? (
          <ArtifactStatus file="clusters" state={cl} retry={retryCl} empty="">
            {(c) => (
              <div className="plane-read">
                <div className="opt-row" role="radiogroup" aria-label="METHOD">
                  <span className="mono-label opt-row__label" aria-hidden="true">METHOD</span>
                  {(["kmeans", "ward"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={L.method === m} className={`opt ${L.method === m ? "is-on" : ""}`} onClick={() => likeness.set({ method: m })}>{m === "kmeans" ? "K-MEANS" : "WARD"}</button>
                  ))}
                </div>
                {f.status === "ready" ? <p className="tnum">{S06.ledger(factNum(f.data, "cluster_silhouette"), factNum(f.data, "cluster_stability_ari"), factNum(f.data, "cluster_hier_ari"))}</p> : null}
                {L.method === "ward" ? <p className="tnum" data-ward>{S06.ward(c.hierarchical.disagree_count, c.inclusion.complete_cases)}</p> : <p className="ledger__small">HOLLOW SEEDS: NEGATIVE SILHOUETTE (THEY FIT ANOTHER GROUP ABOUT AS WELL)</p>}
                <p className="ledger__small">{S06.colourNote}</p>
                <p className="s03-chips"><HonestyChip tag="PREDICTED" detail="DESCRIPTIVE GROUP" /><HonestyChip tag="DERIVED" detail="FEATURES" /></p>
                <p className="ledger__causal" data-not-causal>{(c.tag_detail ?? "").toUpperCase()}</p>
              </div>
            )}
          </ArtifactStatus>
        ) : (
          <ArtifactStatus file="correlations" state={co} retry={retryCo} empty="PER-COUNTRY VALUES NOT PUBLISHED">
            {(c) => {
              const pr = pairOf(c, L.a, L.b);
              return (
                <div className="plane-read">
                  <p className="tnum">{S06.order(short(L.a), short(L.b))}</p>
                  {pr ? <p className="tnum rho" data-rho={pr.rho}>{S06.rho(pr.rho, pr.ci95[0], pr.ci95[1], pr.n)}</p> : <p>SAME VARIABLE: PICK TWO</p>}
                  <div className="pickers">
                    {(["a", "b"] as const).map((k) => (
                      <label key={k} className="picker">
                        <span className="mono-label">{k === "a" ? "ORDER BY A" : "LIGHT BY B"}</span>
                        <select value={L[k]} onChange={(e) => likeness.set({ [k]: e.target.value, free: true })}>
                          {c.indicators.map((v) => <option key={v} value={v} disabled={v === (k === "a" ? L.b : L.a)}>{short(v)}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <p className="ledger__small">{c.transforms[L.a]?.toUpperCase()}</p>
                  <p className="s03-chips"><HonestyChip tag="DERIVED" detail="SPEARMAN, COLOUR = RANK SEVENTH OF B" /></p>
                  <p className="ledger__causal" data-not-causal>{c.not_causal.toUpperCase()}</p>
                </div>
              );
            }}
          </ArtifactStatus>
        )}
      </div>
      <Footer />
      {L.part === 1 && cl.status === "ready" ? (
        <div className="group-caps" aria-label="Three descriptive groups">
          {(() => {
            const gc = groupCentres(box.cls, box.w, box.h);
            // captions sit under (D, T) or beside (M) their disc, never wider than the gap between discs
            const room = box.cls === "M" ? Math.min(190, box.w - gc.pts[0]![0] - 70) : Math.min(220, gc.pts[1]![0] - gc.pts[0]![0] - 12);
            return gc.pts.map(([x, y], i) => {
              const g = cl.data.clusters[i]!, R = gc.sp * Math.sqrt(g.size);
              const tx = box.cls === "M" ? x + R + 8 : Math.min(box.w - room - 8, Math.max(8, x - room / 2)), ty = box.cls === "M" ? y - 20 : y + R + 10;
              return <p key={g.id} className="group-cap" style={{ transform: `translate(${tx}px, ${ty}px)`, width: room }}>{S06.caption(i, cl.data.chosen_k, g.size, g.signature)}</p>;
            });
          })()}
          <p className="group-cap group-cap--ungrouped" style={{ transform: `translate(${ungroupedXY(box.cls, box.w, box.h)[0]}px, ${ungroupedXY(box.cls, box.w, box.h)[1] - (box.cls === "M" ? 26 : 34)}px)` }}>{S06.notGrouped(cl.data.inclusion.countries - cl.data.inclusion.complete_cases)}</p>
        </div>
      ) : null}
    </Track>
  );
}
