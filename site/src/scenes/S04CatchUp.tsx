import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { CONVERGENCE } from "../data/artifacts";
import { S04, d2, money, unitOf } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { useMotion, useProgress } from "../scroll/hooks";
import { useStore, catchup } from "../state/scenes";
import { fitAt, halfLifeShown, recordId, verdictOf, type BetaRecord } from "../model/plane";
import { windowed } from "../motion/progress";
import { PlaneOverlay } from "./Plane";
import { useState } from "react";

const compactPhone = () => typeof innerWidth === "number" && innerWidth < 768;

/** The verdict ledger (S04 and S05): slope with both CIs, n, R², half-life only when defined. */
export function Ledger({ r }: { r: BetaRecord }) {
  return (
    <div className="verdict-ledger" data-record={r.id}>
      <p className="tnum">{S04.slope(r.beta, r.ci95[0], r.ci95[1], r.ci95_boot[0], r.ci95_boot[1], r.n, r.r2)}</p>
      <p className="tnum" data-half-life>{halfLifeShown(r) ? S04.halfLife(r.half_life_years!) : S04.noHalfLife}</p>
    </div>
  );
}

export function DataTable({ r }: { r: BetaRecord }) {
  if (!r.points) return null;
  return (
    <details className="data-table">
      <summary>→ {S04.table}</summary>
      <table>
        <thead><tr><th>ISO3</th><th>{r.start} VALUE</th><th>GROWTH % / YR</th><th>RESIDUAL</th></tr></thead>
        <tbody>
          {r.points.iso3.map((iso, i) => (
            <tr key={iso}><td>{iso}</td><td className="tnum">{money(Math.exp(r.points!.x[i]!), r.price_basis)}</td><td className="tnum">{d2(r.points!.y[i]!)}</td><td className="tnum">{d2(r.points!.y[i]! - fitAt(r, r.points!.x[i]!).y)}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** S04 The Flight (interaction 5): the COUNTRIES disc of 1990 flies into the catch-up plane; three windows. */
export function S04CatchUp({ def }: { def: SceneDef }) {
  const [cv, retry] = useArtifact(CONVERGENCE, false);
  const { step, flight } = useStore(catchup);
  const motion = useMotion();
  const [p, setP] = useState(0);
  useProgress(def.id, (q) => { const r = Math.round(q * 100) / 100; if (r !== p) setP(r); });
  const start = [1990, 1990, 2000, 2010][step]!;
  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-catchup">
      <ArtifactStatus file="convergence" state={cv} retry={retry} empty="NO COUNTRIES WITH BOTH ENDPOINTS">
        {(c) => {
          const rec = c.beta.find((r) => r.id === recordId("gdppc_ppp", motion ? start : 1990, 2025, "primary"))!;
          const zero = motion ? windowed(p, 0.4, 0.52) : 1, v = verdictOf(rec);
          return (
            <>
              <PlaneOverlay rec={rec} scene={def.id} show={{ zero, fit: !motion || p >= 0.52 }} />
              <div className="col col--plane">
                <div className="col__head">
                  <p className="scene-kicker">CATCH-UP · {flight < 0.5 && motion ? S04.encodingDisc : S04.encodingPlane(rec.start, rec.end)}</p>
                  <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="statement">{S04.statement}</h2>
                  <p className="s03-chips"><HonestyChip tag="DERIVED" detail={`INCOME IN ${rec.start} · ${unitOf(rec.price_basis)} · GROWTH % / YR`} /></p>
                </div>
                {(zero > 0 || !motion) && !(p >= 0.9 && compactPhone()) ? (
                  <div className="plane-read">
                    <Ledger r={rec} />
                    <p className="plane-drop">{S04.dropped(rec.dropped_no_start_data, rec.start, rec.excluded_territory_changes.length)}</p>
                    <p className="s03-chips"><HonestyChip tag="DERIVED" detail="GROWTH FROM OBSERVED LEVELS · OLS + HC3" /></p>
                  </div>
                ) : null}
                {p >= 0.9 || !motion ? (
                  <article className="verdict-card">
                    <p className="verdict-card__line">{S04.verdict[v](rec.start)}</p>
                    <p className="tnum">{v === "below" ? S04.verdictSub.below(rec.beta, rec.ci95[0], rec.ci95[1], halfLifeShown(rec) ? rec.half_life_years : null) : S04.verdictSub[v](rec.beta, rec.ci95[0], rec.ci95[1])}</p>
                    <p>{c.copy.absolute_only!.toUpperCase()}</p>
                    <p className="s03-chips"><HonestyChip tag="DERIVED" detail="OLS + HC3 FIT" /></p>
                  </article>
                ) : null}
                <p className="ledger__causal" data-not-causal>{c.copy.not_causal!.toUpperCase()}</p>
                <DataTable r={rec} />
              </div>
              <Footer />
            </>
          );
        }}
      </ArtifactStatus>
    </Track>
  );
}
