import { useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { CONVERGENCE, PANEL } from "../data/artifacts";
import { S05 } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { ArtifactStatus, Statuses } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { useMotion } from "../scroll/hooks";
import { LAB_DEFAULT, lab, useStore, type Basis } from "../state/scenes";
import { pointsFor } from "../model/plane";
import { labRecordId, recordOf } from "./director";
import { PlaneOverlay } from "./Plane";
import { Ledger, DataTable } from "./S04CatchUp";

const WINDOWS: Record<Basis, number[]> = { ppp: [1990, 2000, 2010], const: [1960, 1980, 2000] };
const SAMPLES = ["primary", "sensitivity_all", "tercile_low", "tercile_mid", "tercile_high", "pop_weighted", "pop_weighted_ex_chn_ind"];

function Radio<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; text: string; off?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="opt-row" role="radiogroup" aria-label={label}>
      <span className="mono-label opt-row__label" aria-hidden="true">{label}</span>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} aria-disabled={!!o.off || undefined} title={o.off}
          className={`opt ${value === o.v ? "is-on" : ""}`} onClick={() => !o.off && onChange(o.v)}>{o.text}</button>
      ))}
    </div>
  );
}

/** S05 Catch-up Lab (interaction 6): BASIS, WINDOW, SAMPLE over the 42 published fits. */
export function S05Lab({ def }: { def: SceneDef }) {
  const [cv, retry] = useArtifact(CONVERGENCE, false);
  const [pan, retryPan] = useArtifact(PANEL, false);
  const L = useStore(lab);
  const motion = useMotion();
  const [sheet, setSheet] = useState(false);
  const set = (p: Partial<typeof L>) => lab.set({ ...p, live: true });
  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-lab">
      <ArtifactStatus file="convergence" state={cv} retry={retry} empty="">
        {(c) => {
          // the record on screen follows the basis drawn (it swaps inside the neutral phase); controls show the choice
          const shownId = labRecordId(L.shownBasis, L.shownBasis === L.basis ? L.start : WINDOWS[L.shownBasis][0]!, L.shownBasis === L.basis ? L.sample : "primary");
          const rec = recordOf(labRecordId(L.basis, L.start, L.sample)) ?? recordOf(shownId)!;
          const drawn = recordOf(shownId) ?? rec;
          const slice = (ind: string) => (pan.status === "ready" ? { iso3: pan.data.iso3, years: pan.data.years, values: pan.data.series[ind]!.values } : null);
          const off = (b: Basis, s: number, smp: string) => {
            const r = recordOf(labRecordId(b, s, smp));
            if (!r) return "NOT PUBLISHED";
            if (smp !== "sensitivity_all" || pointsFor(r, c.beta, slice(r.indicator))) return undefined;
            // only the constant-USD 1960/1980 windows are truly unpublished (the panel starts in 1990); otherwise the panel is still loading or failed
            if (r.start < 1990) return S05.notPublished;
            return pan.status === "error" ? "PANEL_INCOME FAILED TO LOAD: SEE RETRY" : "LOADING PANEL_INCOME";
          };
          return (
            <>
              {motion ? <PlaneOverlay rec={drawn} show={{ zero: 1, fit: true }} /> : null}
              <div className="col col--plane">
                <div className="col__head">
                  <p className="scene-kicker">LAB · {L.live ? `YOUR CHOICE: EACH COMBINATION IS ONE OF THE ${c.beta.length} PUBLISHED FITS` : "GUIDED: FOUR SAMPLES, PPP 1990"}</p>
                  <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="statement" key={String(L.live)}>{L.live ? S05.statement2 : S05.statement1}</h2>
                </div>
                <button type="button" className="btn-square sheet-toggle" aria-expanded={sheet} aria-controls="lab-controls" onClick={() => setSheet(!sheet)}>{sheet ? "CLOSE CONTROLS" : "CONTROLS"}</button>
                <div id="lab-controls" className={`weight-controls lab-controls ${sheet ? "is-open" : ""}`}>
                  <Radio label="BASIS" value={L.basis} onChange={(b: Basis) => set({ basis: b, start: WINDOWS[b][0]!, sample: off(b, WINDOWS[b][0]!, L.sample) ? "primary" : L.sample })}
                    options={[{ v: "ppp" as Basis, text: "PPP" }, { v: "const" as Basis, text: "CONSTANT US$" }]} />
                  <Radio label="WINDOW" value={L.start} onChange={(s: number) => set({ start: s, sample: off(L.basis, s, L.sample) ? "primary" : L.sample })}
                    options={WINDOWS[L.basis].map((s) => ({ v: s, text: String(s), off: off(L.basis, s, L.sample) }))} />
                  <div className="opt-row opt-row--wrap" role="radiogroup" aria-label="SAMPLE">
                    <span className="mono-label opt-row__label" aria-hidden="true">SAMPLE</span>
                    {SAMPLES.map((s) => {
                      const o = off(L.basis, L.start, s);
                      return <button key={s} type="button" role="radio" aria-checked={L.sample === s} aria-disabled={!!o || undefined} title={o}
                        className={`opt ${L.sample === s ? "is-on" : ""}`} onClick={() => !o && set({ sample: s })}>{S05.samples[s]}</button>;
                    })}
                  </div>
                  <button type="button" className="btn-square weight-reset" onClick={() => set({ ...LAB_DEFAULT })}>RESET</button>
                </div>
                <Statuses items={[["panel_income", pan, retryPan]]} />
                <div className="plane-read">
                  <Ledger r={rec} />
                  {rec.sample.startsWith("tercile") ? <p className="ledger__small">{c.copy.interpretation!.toUpperCase()}</p> : null}
                  {rec.sample.startsWith("pop_weighted") ? <p className="ledger__small">{S05.weighted}</p> : null}
                  <p className="s03-chips"><HonestyChip tag="DERIVED" detail={`${rec.id.toUpperCase()}`} /></p>
                </div>
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
