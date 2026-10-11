import { useMemo } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { CONVERGENCE, FACTS, INDICATORS, PANEL, SEED_LATEST, SEED_YEARS, factNum } from "../data/artifacts";
import { S00, S03B } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { Legend } from "../components/Legend";
import { StaticDisc } from "../components/StaticDisc";
import { ArtifactStatus, Statuses } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { useMotion } from "../scroll/hooks";
import { useStore, view, weight, type Count } from "../state/scenes";
import { WEIGHT_DEFAULT, layoutFor, meanLn, setWeight, staticState } from "./director";

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; text: string; disabled?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="opt-row" role="radiogroup" aria-label={label}>
      <span className="mono-label opt-row__label" aria-hidden="true">{label}</span>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} aria-disabled={!!o.disabled || undefined}
          title={o.disabled} className={`opt ${value === o.v ? "is-on" : ""}`} onClick={() => !o.disabled && onChange(o.v)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** S03b Weight (interaction 3): COUNT by countries or people, YEAR, SET ASIDE China and India. */
export function S03bWeight({ def }: { def: SceneDef }) {
  const [f, retryF] = useArtifact(FACTS, false);
  const [cv, retryCv] = useArtifact(CONVERGENCE, false);
  const [ys, retryYs] = useArtifact(SEED_YEARS, false);
  const [lay, retryLay] = useArtifact(SEED_LATEST, false);
  const [ind, retryInd] = useArtifact(INDICATORS, false);
  const [pan, retryPan] = useArtifact(PANEL, false);
  const w = useStore(weight);
  const v = useStore(view);
  const motion = useMotion();
  const latest = lay.status === "ready" ? lay.data.years[0]!.year : 0;
  const year = w.year || latest;
  const has1990 = ys.status === "ready";
  const disp = ind.status === "ready" ? ind.data.indicators.find((i) => i.id === "gdppc_ppp")!.display : null;
  const aside = cv.status === "ready" ? cv.data.beta.find((b) => b.id === "gdppc_ppp_1990_2025_pop_weighted_ex_chn_ind") : undefined;
  const sigmaId = w.count === "people" ? "gdppc_ppp_1990_2025_pop_weighted" : "gdppc_ppp_1990_2025_unbalanced";
  const sig = cv.status === "ready" ? cv.data.sigma.find((s) => s.id === sigmaId) : undefined;
  const sd = sig?.years ? sig.sd_log[sig.years.indexOf(year)] ?? null : null;
  const mu = pan.status === "ready" && layoutFor(year) ? meanLn(year, w.count === "people") : null;
  const L = layoutFor(year);
  const seeds = !L ? 0 : w.count === "people" ? L.slots : L.order.length;
  const statics = useMemo(() => (!motion && has1990 && pan.status === "ready" && latest ? [
    { t: { mode: "people" as Count, year: latest, setAside: false }, label: `PEOPLE · ${latest}` },
    { t: { mode: "countries" as Count, year: latest, setAside: false }, label: `COUNTRIES · ${latest}` },
    { t: { mode: "people" as Count, year: 1990, setAside: false }, label: "PEOPLE · 1990" },
    { t: { mode: "people" as Count, year: latest, setAside: true }, label: `PEOPLE · ${latest} · CHINA + INDIA SET ASIDE` },
  ] : []), [motion, has1990, pan.status, latest]);

  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-weight">
      <div className="col">
        <div className="col__head">
          <p className="scene-kicker">WEIGHT · {S00.line2}</p>
          <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="statement">{S03B.statement}</h2>
        </div>
        <Statuses items={[["seedhead/gdppc_ppp", ys, retryYs], ["seedhead/gdppc_ppp_latest", lay, retryLay], ["facts", f, retryF], ["indicators", ind, retryInd], ["panel_income", pan, retryPan]]} />
        <div className="weight-controls">
          <Segmented label="COUNT" value={w.count} onChange={(c) => setWeight({ count: c })}
            options={[{ v: "countries", text: "COUNTRIES" }, { v: "people", text: "PEOPLE" }]} />
          <Segmented label="YEAR" value={year} onChange={(y) => setWeight({ year: y })}
            options={[{ v: 1990, text: "1990", disabled: has1990 ? undefined : "1990 LAYOUT NOT LOADED" }, { v: latest || -1, text: latest ? String(latest) : "LATEST", disabled: latest ? undefined : "LATEST LAYOUT NOT LOADED" }]} />
          <div className="opt-row">
            <span className="mono-label opt-row__label" aria-hidden="true">SET ASIDE</span>
            <button type="button" role="switch" aria-checked={w.setAside} className={`opt ${w.setAside ? "is-on" : ""}`} onClick={() => setWeight({ setAside: !w.setAside })}>
              {S03B.setAsideLabel}
            </button>
            <button type="button" className="btn-square weight-reset" onClick={() => setWeight({ ...WEIGHT_DEFAULT() })}>RESET</button>
          </div>
        </div>
        {f.status === "ready" ? (
          <div className="ledger">
            <p className="mono-label ledger__head">{S03B.spreadHead(f.data)}</p>
            <p className={`tnum ledger__row ${w.count === "countries" ? "is-lit" : ""}`}>{S03B.spreadCountries(f.data)}</p>
            <p className={`tnum ledger__row ${w.count === "people" ? "is-lit" : ""}`}>{S03B.spreadPeople(f.data)}</p>
            <p className="mono-label ledger__head">{S03B.slopeHead(f.data)}</p>
            <p className={`tnum ledger__row ${!w.setAside ? "is-lit" : ""}`}>{S03B.slopeAll(f.data)}</p>
            <ArtifactStatus file="convergence" state={cv} retry={retryCv} empty="">
              {(c) => (
                <>
                  {aside ? <p className={`tnum ledger__row ${w.setAside ? "is-lit" : ""}`}>{S03B.slopeAside(f.data, aside.ci95)}</p> : null}
                  <p className="tnum ledger__small">{S03B.weightPct(f.data)} · {S03B.unitNote}</p>
                  <p className="ledger__causal" data-not-causal>{c.copy.not_causal!.toUpperCase()}</p>
                </>
              )}
            </ArtifactStatus>
            <p className="s03-chips"><HonestyChip tag="DERIVED" detail="SPREAD AND SLOPES FROM PUBLISHED FITS" /></p>
          </div>
        ) : null}
      <div className="col__legend">
        <p className="tnum weight-count" data-seed-count={seeds} data-mode={w.count}>
          {w.count === "people" ? `${seeds.toLocaleString("en-US")} SEEDS · 1 PER MILLION PEOPLE` : `${seeds} SEEDS · 1 PER COUNTRY`} · {year}
        </p>
        {disp ? <Legend edges={disp.bins} labels={disp.edge_labels} unit={S00.legendUnit}
          sigma={sd !== null && mu !== null ? { mean: mu, sd, label: `±1 SD OF LN INCOME, ${w.count === "people" ? "PEOPLE-WEIGHTED" : "COUNTRIES"}` } : null} /> : null}
      </div>
      </div>
      <Footer />
      {!motion && statics.length && f.status === "ready" ? (
        <div className="static-row">
          {statics.map((s) => <StaticDisc key={s.label} state={staticState(s.t)} scaleSlots={factNum(f.data, "seedhead_slots_latest")} size={240} label={s.label} />)}
          <StaticDisc state={staticState({ mode: w.count, year, setAside: w.setAside })} scaleSlots={factNum(f.data, "seedhead_slots_latest")} size={240}
            label={`YOUR VIEW · ${w.count.toUpperCase()} · ${year}${w.setAside ? " · SET ASIDE" : ""}`} />
        </div>
      ) : null}
      <span hidden data-view-slots={v.slots} />
    </Track>
  );
}
