import { useMemo, useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { CONVERGENCE, COUNTRIES, FACTS, INDICATORS, PANEL, SEED_YEARS, type SeedheadYear, type Sigma } from "../data/artifacts";
import { S03A, S00, noData } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { Legend } from "../components/Legend";
import { NoDataSet } from "../components/NoDataSet";
import { StaticDisc } from "../components/StaticDisc";
import { ArtifactStatus, Statuses } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { useMotion } from "../scroll/hooks";
import { useStore, years as yearsStore } from "../state/scenes";
import { followIso, followState, meanLn, staticState, valueOf } from "./director";
import { jumpTo } from "../scroll/engine";

const sigmaAt = (s: Sigma | undefined, year: number) => {
  if (!s?.years) return null;
  const i = s.years.indexOf(year);
  return i < 0 ? null : s.sd_log[i] ?? null;
};

/** The first year the middle person's country differs from the year before (DERIVED from DR-1 median_person). */
function firstChange(layouts: Map<number, SeedheadYear> | null) {
  if (!layouts) return null;
  const arr = [...layouts.values()];
  const i = arr.findIndex((y, k) => k > 0 && y.median_person.iso3 !== arr[k - 1]!.median_person.iso3);
  return i < 0 ? null : { year: arr[i]!.year, a: arr[i - 1]!.median_person.iso3, b: arr[i]!.median_person.iso3 };
}

/** S03a Thirty-Five Years (interaction 2): integer year scrub, FOLLOW a country, the disc grows with people. */
export function S03aYears({ def }: { def: SceneDef }) {
  const [ys, retry] = useArtifact(SEED_YEARS, false);
  const [cv, retryCv] = useArtifact(CONVERGENCE, false);
  const [f, retryF] = useArtifact(FACTS, false);
  const [cs, retryCs] = useArtifact(COUNTRIES, false);
  const [ind, retryInd] = useArtifact(INDICATORS, false);
  const [pan, retryPan] = useArtifact(PANEL, false);
  const { year, follow } = useStore(yearsStore);
  const motion = useMotion();
  const [q, setQ] = useState("");

  const layouts = useMemo(() => (ys.status === "ready" ? new Map(ys.data.years.map((y) => [y.year, y])) : null), [ys]);
  const list = layouts ? [...layouts.keys()] : [];
  const latest = list.at(-1) ?? 0;
  const y = layouts?.get(year) ?? layouts?.get(latest);
  const names = useMemo(() => new Map(cs.status === "ready" ? cs.data.countries.map((c) => [c.iso3, c.name]) : []), [cs]);
  const sig = cv.status === "ready" ? cv.data.sigma : [];
  const sC = sig.find((s) => s.id === "gdppc_ppp_1990_2025_unbalanced"), sP = sig.find((s) => s.id === "gdppc_ppp_1990_2025_pop_weighted");
  const disp = ind.status === "ready" ? ind.data.indicators.find((i) => i.id === "gdppc_ppp")!.display : null;
  const change = useMemo(() => firstChange(layouts), [layouts]);

  const pick = (v: string) => {
    setQ(v);
    const iso = [...names].find(([i, n]) => n.toUpperCase() === v.toUpperCase() || i === v.toUpperCase())?.[0];
    if (iso || !v) followIso(iso ?? null);
  };
  const followLine = (yy: number) => {
    if (!follow) return null;
    const L = layouts?.get(yy), name = names.get(follow) ?? follow, r = L ? L.order.indexOf(follow) : -1, v = valueOf(follow, yy);
    return r >= 0 && v !== null ? S03A.follow(name, r + 1, L!.order.length, v) : S03A.followNone(name, yy);
  };
  const sd = y ? sigmaAt(sP, y.year) : null, mu = y && pan.status === "ready" ? meanLn(y.year, true) : null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" || !list.length) return;
    e.preventDefault();
    const k = Math.max(0, Math.min(list.length - 1, list.indexOf(year) + (e.key === "ArrowRight" ? 1 : -1)));
    jumpTo(def.id, 0.06 + (0.88 * (k + 0.5)) / list.length);
  };

  const followBox = (
    <div className="follow">
      <label htmlFor="follow-input" className="mono-label">FOLLOW</label>
      <input id="follow-input" className="follow__input" list="follow-list" placeholder="ANY COUNTRY" value={q} onChange={(e) => pick(e.target.value)} autoComplete="off" spellCheck={false} />
      <datalist id="follow-list">{[...names].map(([iso, n]) => <option key={iso} value={n}>{iso}</option>)}</datalist>
      {follow ? <button type="button" className="btn-square" onClick={() => pick("")}>CLEAR</button> : null}
    </div>
  );

  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-years">
      <div className="col">
      <div className="col__head">
        <p className="scene-kicker">{S03A.kicker}</p>
        <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="statement">{S03A.statement}</h2>
      </div>
      {followBox}
      <Statuses items={[["panel_income", pan, retryPan], ["facts", f, retryF], ["countries", cs, retryCs], ["indicators", ind, retryInd]]} />
      <div className="years-readout" tabIndex={0} onKeyDown={onKey} aria-label="Year readout. Left and right arrows step the year.">
        <ArtifactStatus file="seedhead/gdppc_ppp" state={ys} retry={retry} empty={S03A.notPublished(year)}>
          {() => y ? (
            <>
              <p className="years-readout__year tnum" data-year aria-live="polite">{y.year}</p>
              <p className="tnum" data-seed-count={y.slots}>{S03A.seeds(y.slots, y.people_millions)}</p>
              <p className="tnum">{S03A.middle(y.median_person.iso3, y.median_person.value)}</p>
              <p className="years-readout__nodata">{noData(y.no_data.length, y.no_data.reduce((a, r) => a + r.population, 0) / 1e9)}</p>
              {cv.status === "ready" ? <p className="tnum">{S03A.spread(sigmaAt(sC, y.year), sd)}</p> : <ArtifactStatus file="convergence" state={cv} retry={retryCv} empty="">{() => null}</ArtifactStatus>}
              {follow ? <p className="tnum follow__line">{followLine(y.year)}</p> : null}
              {change && y.year >= change.year ? <p className="years-note"><HonestyChip tag="DERIVED" /> {S03A.note(change.year, change.a, change.b)}</p> : null}
              <p className="s03-chips"><HonestyChip tag="OBSERVED" detail="WORLD BANK WDI VALUES" /><HonestyChip tag="DERIVED" detail="LAYOUT, MEDIAN, SPREAD" /></p>
            </>
          ) : <p>{S03A.notPublished(year)}</p>}
        </ArtifactStatus>
      </div>
      <div className="col__legend">
        {disp ? <Legend edges={disp.bins} labels={disp.edge_labels} unit={S00.legendUnit} note={S00.legendNote}
          sigma={sd !== null && mu !== null ? { mean: mu, sd, label: "±1 SD OF LN INCOME, PEOPLE-WEIGHTED" } : null} /> : null}
      </div>
      </div>
      <Footer />
      {y && f.status === "ready" ? (
        <div className="years-nodata">
          <NoDataSet rows={y.no_data} caption={noData(y.no_data.length, y.no_data.reduce((a, r) => a + r.population, 0) / 1e9)} />
        </div>
      ) : null}
      {!motion && layouts ? (
        <div className="static-row" aria-label="The disc in 1990, 2000, 2010 and the latest year">
          {[1990, 2000, 2010, latest].filter((yy) => layouts.has(yy)).map((yy) => {
            const L = layouts.get(yy)!;
            return (
              <div key={yy} className="static-cell">
                <StaticDisc state={staticState({ mode: "people", year: yy, setAside: false })} overlay={follow ? followState(yy, follow) : null}
                  scaleSlots={layouts.get(latest)!.slots} size={260} label={`${yy} · ${S03A.seeds(L.slots, L.people_millions)}`} />
                {follow ? <p className="tnum static-cell__follow">{followLine(yy)}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Track>
  );
}
