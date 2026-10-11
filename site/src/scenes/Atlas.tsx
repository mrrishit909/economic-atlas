import { useEffect, useMemo, useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { useArtifact } from "../data/useArtifact";
import { COUNTRIES, INDICATORS, META, NARRATIVES, PANEL, PANEL_STRUCT, seedheadOf, type IndicatorFull } from "../data/artifacts";
import { ATLAS_COPY, int, d1, d2 } from "../data/copy";
import { HonestyChip } from "../components/HonestyChip";
import { Legend } from "../components/Legend";
import { ArtifactStatus, Statuses } from "../components/StateUI";
import { Footer } from "../components/Footer";
import { ATLAS_DEFAULT, atlas, inspector, useStore } from "../state/scenes";
import { GROUPS, atlasView, pathOf, type Ind } from "../model/atlas";
import { render, renderPair, type Inputs } from "../model/narratives";
import { ensureIndicator, layoutFor, yearsOf } from "./director";

const COLORS = ["#ffffff", "#58B8E1", "#FFB26B", "#8FA2FF"]; // path lines: white, then the tag tints (never violet)
const fmtV = (i: Ind, v: number) => (i.price_basis || i.kind === "count" ? int(v) : i.id === "hhi5" ? d2(v) : d1(v));

/** ATLAS (interaction 8): countries x indicator x year/period x level-or-index, one unit at a time. */
export function Atlas({ def }: { def: SceneDef }) {
  const A = useStore(atlas);
  const [ind, retryInd] = useArtifact(INDICATORS, false);
  const [cs, retryCs] = useArtifact(COUNTRIES, false);
  const [m, retryM] = useArtifact(META, false);
  const [pan, retryPan] = useArtifact(PANEL, false);
  const [ps, retryPs] = useArtifact(PANEL_STRUCT, false);
  const [nr, retryNr] = useArtifact(NARRATIVES, false);
  const [lay, retryLay] = useArtifact(seedheadOf(A.ind), false);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  useEffect(() => { ensureIndicator(A.ind); }, [A.ind]);
  useEffect(() => { if (!resetOk) return; const t = setTimeout(() => setResetOk(false), 1200); return () => clearTimeout(t); }, [resetOk]);

  const inds = useMemo(() => new Map(ind.status === "ready" ? ind.data.indicators.map((i) => [i.id, i as unknown as Ind & IndicatorFull]) : []), [ind]);
  const names = useMemo(() => new Map(cs.status === "ready" ? cs.data.countries.map((c) => [c.iso3, c.name]) : []), [cs]);
  const shown = inds.get(A.shownInd), choice = inds.get(A.ind);
  const years = lay.status === "ready" ? yearsOf(A.shownInd) : [];
  const year = A.year && years.includes(A.year) ? A.year : years.at(-1) ?? 0;
  const L = layoutFor(year, A.shownInd);
  const set = (p: Partial<typeof A>) => atlas.set({ ...p, touched: true });
  const pick = (v: string) => {
    setQ(v);
    const iso = [...names].find(([i, n]) => n.toUpperCase() === v.toUpperCase() || i === v.toUpperCase())?.[0];
    if (iso && !A.selected.includes(iso) && A.selected.length < 4) { set({ selected: [...A.selected, iso] }); setQ(""); }
  };
  const series = (id: string) => (pan.status === "ready" && pan.data.series[id] ? pan.data : ps.status === "ready" && ps.data.series[id] ? ps.data : null);
  const indexable = !!choice?.display.indexable;
  const index = A.values === "index" && !!shown?.display.indexable;
  const first = shown?.first_year ?? 1990, last = shown?.latest_year ?? 2025;
  const period: [number, number] = [Math.max(first, A.period[0] || 2000), Math.min(last, A.period[1] || last)];

  // paths panel (SVG, no gridlines): one 2px line per selected country, breaks at nulls, direct end labels
  const paths = shown && A.selected.length ? (() => {
    const src = series(shown.id);
    if (!src) return null;
    const lines = A.selected.map((iso) => ({ iso, pts: pathOf(src.series[shown.id]!.values[src.iso3.indexOf(iso)] ?? [], src.years, period, index) }));
    const vals = lines.flatMap((l) => l.pts.map((p) => p.v).filter((v): v is number => v !== null));
    if (!vals.length) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals), W = 320, H = 170;
    const x = (y: number) => 4 + ((y - period[0]) / Math.max(1, period[1] - period[0])) * (W - 70), y = (v: number) => H - 6 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 16);
    return (
      <figure className="paths">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${shown.label} paths for the selected countries, ${period[0]} to ${period[1]}`}>
          {lines.map((l, k) => {
            let d = "", pen = false, lastPt: { year: number; v: number } | null = null;
            for (const p of l.pts) { if (p.v === null) { pen = false; continue; } d += `${pen ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.v).toFixed(1)}`; pen = true; lastPt = { year: p.year, v: p.v }; }
            return (
              <g key={l.iso} className="paths__g" style={{ ["--c" as string]: COLORS[k] }}>
                <path d={d} />
                {lastPt ? <text x={x(lastPt.year) + 4} y={y(lastPt.v) + 4}>{l.iso} {fmtV(shown, lastPt.v)}</text> : null}
              </g>
            );
          })}
        </svg>
        <figcaption>{atlasView(shown, A.values, period[0], A.selected.length).pathsUnit} · {period[0]} TO {period[1]}</figcaption>
      </figure>
    );
  })() : null;

  // the view's text (one unit for status and legend, the paths caption, the narrative families): one pure selector
  const view = shown ? atlasView(shown, A.values, period[0], A.selected.length) : null;
  // narratives: template renderings only. Pairs (GDP per capita PPP only); otherwise each selected country's
  // families that fit the indicator, so the text always matches the indicator on screen (QA D-009)
  const narratives = nr.status === "ready" && shown && view ? (() => {
    const inputs = new Map(nr.data.countries.map((c) => [c.iso3, c.inputs as Inputs]));
    if (view.pairs) {
      const [a, b] = A.selected as [string, string];
      return nr.data.pair_templates.map((t) => renderPair(t, inputs.get(a) ?? {}, inputs.get(b) ?? {})).filter((x): x is string => !!x);
    }
    const tpl = view.families.map((f) => nr.data.templates.find((t) => t.id === f)).filter(Boolean);
    return A.selected.flatMap((iso) => tpl.map((t) => render(t!, inputs.get(iso) ?? {}))).filter((x): x is string => !!x);
  })() : null;

  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-atlas">
      <div className="atlas">
        <header className="atlas__head panel-glass">
          <p className="mono-label">THE ATLAS</p>
          <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="atlas__line serif">{ATLAS_COPY.line}</h2>
          {shown && L ? (
            <p className="atlas__status tnum" data-status>
              {shown.label.toUpperCase()} · {view!.statusUnit} · {year} · {int(L.order.length)} COUNTRIES WITH DATA · {m.status === "ready" ? m.data.vintage.wdi_lastupdated : ""} WDI
            </p>
          ) : null}
          <Statuses items={[["indicators", ind, retryInd], ["countries", cs, retryCs], ["meta", m, retryM]]} />
          <ArtifactStatus file={`seedhead/${A.ind}`} state={lay} retry={retryLay} empty={ATLAS_COPY.few(0, year)}>{() => null}</ArtifactStatus>
          {shown && L && L.order.length < 30 ? <p className="state-line state-line--empty">{ATLAS_COPY.few(L.order.length, year)}</p> : null}
          <Footer />
        </header>
        <div className="atlas__legend panel-glass">
          {shown ? <Legend edges={shown.display.bins} labels={shown.display.edge_labels} unit={atlasView(shown, A.values, period[0], 0).legendUnit} note={A.count === "people" ? "1 SEED ≈ 1 MILLION PEOPLE" : "1 SEED = 1 COUNTRY"} /> : null}
          <p className="s03-chips"><HonestyChip tag="OBSERVED" detail="WDI VALUES" /><HonestyChip tag="DERIVED" detail="LAYOUT" /></p>
        </div>
        <aside className="rail" aria-label="Atlas controls">
          <button type="button" className="btn-square atlas-sheet-toggle" aria-expanded={sheet} aria-controls="atlas-controls" onClick={() => setSheet(!sheet)}>{sheet ? "CLOSE CONTROLS" : "CONTROLS"}</button>
          <div id="atlas-controls" className={`rail__controls ${sheet ? "is-open" : ""}`}>
          {sheet ? <button type="button" className="btn-square rail__sheet-close" onClick={() => setSheet(false)}>CLOSE CONTROLS</button> : null}
          <div className="rail__block">
            <label htmlFor="atlas-country" className="mono-label">COUNTRIES (UP TO 4)</label>
            <input id="atlas-country" className="follow__input" list="atlas-list" placeholder="ADD A COUNTRY" value={q} onChange={(e) => pick(e.target.value)} autoComplete="off" disabled={A.selected.length >= 4} />
            <datalist id="atlas-list">{[...names].filter(([iso]) => !A.selected.includes(iso)).map(([iso, n]) => <option key={iso} value={n}>{iso}</option>)}</datalist>
            <ul className="chips" aria-label="Selected countries">
              {A.selected.map((iso) => {
                const none = !!L && !L.order.includes(iso);
                return (
                  <li key={iso} className={`chipsel ${none ? "is-none" : ""}`}>
                    <button type="button" className="chipsel__name" onClick={(e) => { const t = sheet ? document.querySelector<HTMLElement>(".atlas-sheet-toggle") : e.currentTarget; setSheet(false); inspector.set({ iso, returnTo: t }); }}>{names.get(iso)?.toUpperCase() ?? iso}{none ? ` · ${ATLAS_COPY.noData(year)}` : ""}</button>
                    <button type="button" className="chipsel__x" aria-label={`Remove ${names.get(iso) ?? iso}`} onClick={() => set({ selected: A.selected.filter((x) => x !== iso) })}>×</button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rail__block">
            <label htmlFor="atlas-ind" className="mono-label">INDICATOR</label>
            <select id="atlas-ind" value={A.ind} onChange={(e) => set({ ind: e.target.value, year: 0, values: inds.get(e.target.value)?.display.indexable ? A.values : "level" })}>
              {GROUPS.map((g) => <optgroup key={g.head} label={g.head}>{g.ids.map((id) => <option key={id} value={id}>{inds.get(id)?.label ?? id}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="rail__row">
            <label className="rail__block">
              <span className="mono-label">YEAR</span>
              <select value={year} onChange={(e) => set({ year: Number(e.target.value) })} disabled={!years.length}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="rail__block">
              <span className="mono-label">FROM</span>
              <select value={period[0]} onChange={(e) => set({ period: [Number(e.target.value), A.period[1]] })}>
                {Array.from({ length: last - first + 1 }, (_, k) => first + k).filter((y) => y < period[1]).map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label className="rail__block">
              <span className="mono-label">TO</span>
              <select value={period[1]} onChange={(e) => set({ period: [A.period[0] || 2000, Number(e.target.value)] })}>
                {Array.from({ length: last - first + 1 }, (_, k) => first + k).filter((y) => y > period[0]).map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div className="opt-row" role="radiogroup" aria-label="VALUES">
            <span className="mono-label opt-row__label" aria-hidden="true">VALUES</span>
            <button type="button" role="radio" aria-checked={A.values === "level"} className={`opt ${A.values === "level" ? "is-on" : ""}`} onClick={() => set({ values: "level" })}>LEVEL</button>
            <button type="button" role="radio" aria-checked={A.values === "index"} aria-disabled={!indexable || undefined} title={indexable ? undefined : ATLAS_COPY.indexOff}
              className={`opt ${A.values === "index" ? "is-on" : ""}`} onClick={() => indexable && set({ values: "index" })}>INDEX = 100 AT {period[0]}</button>
          </div>
          <div className="opt-row" role="radiogroup" aria-label="COUNT">
            <span className="mono-label opt-row__label" aria-hidden="true">COUNT</span>
            {(["people", "countries"] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={A.count === c} className={`opt ${A.count === c ? "is-on" : ""}`} onClick={() => set({ count: c })}>{c.toUpperCase()}</button>)}
          </div>
          <button type="button" className="btn-square" aria-live="polite" onClick={() => { atlas.set({ ...ATLAS_DEFAULT, shownInd: A.shownInd, touched: false }); setResetOk(true); }}>{resetOk ? "RESET ✓" : "RESET"}</button>
          <p className="ledger__small">{ATLAS_COPY.note}</p>
          </div>
          {pan.status === "error" ? <ArtifactStatus file="panel_income" state={pan} retry={retryPan} empty="">{() => null}</ArtifactStatus> : null}
          {ps.status === "error" ? <ArtifactStatus file="panel_structure" state={ps} retry={retryPs} empty="">{() => null}</ArtifactStatus> : null}
          {paths}
          <div className="narr" aria-live="polite">
            <ArtifactStatus file="narratives" state={nr} retry={retryNr} empty="">{() => null}</ArtifactStatus>
            {narratives?.map((t) => <p key={t}>{t}</p>)}
            {narratives && A.selected.length && !narratives.length ? <p className="ledger__small">{"NO NARRATIVE: THE TEMPLATES FOR THIS INDICATOR NEED AN INPUT THAT IS MISSING FOR THIS COUNTRY"}</p> : null}
            {narratives?.length ? <p className="s03-chips"><HonestyChip tag="DERIVED" detail="TEMPLATE RENDERINGS OF PUBLISHED INPUTS" /></p> : null}
          </div>
        </aside>
      </div>
    </Track>
  );
}
