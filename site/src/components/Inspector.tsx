import { useEffect, useRef } from "react";
import { useArtifact } from "../data/useArtifact";
import { BOUNDARIES, COUNTRIES, INDICATORS, NARRATIVES } from "../data/artifacts";
import { inspector, atlas, useStore, view, years as yearsStore } from "../state/scenes";
import { layoutFor, latestYear, valueOfInd } from "../scenes/director";
import { narrativeFamilies, unitFor, type Ind } from "../model/atlas";
import { render, type Inputs } from "../model/narratives";
import { HonestyChip } from "./HonestyChip";
import { Statuses } from "./StateUI";
import { d1, int, money } from "../data/copy";

/**
 * Country Inspector (interaction 9): a story-card panel (D right, T/M bottom sheet) with the
 * country's region, CURRENT WB income label, rank and value in the indicator on screen (with its
 * unit), the template narratives that render for it, and the territory-break note. Esc closes and
 * focus returns to whatever opened it.
 */
export function Inspector() {
  const { iso, returnTo } = useStore(inspector);
  const v = useStore(view), a = useStore(atlas), y = useStore(yearsStore);
  const [cs] = useArtifact(COUNTRIES, false);
  const [ind] = useArtifact(INDICATORS, false);
  const [nr, retryNr] = useArtifact(NARRATIVES, !!iso);
  const [bd, retryBd] = useArtifact(BOUNDARIES, !!iso);
  const ref = useRef<HTMLElement>(null);
  const openedIn = useRef<string | null>(null);
  // L17: the inspector belongs to the scene that opened it; leaving that scene closes it
  useEffect(() => {
    if (!iso) { openedIn.current = null; return; }
    if (openedIn.current === null) openedIn.current = v.scene;
    else if (v.scene !== openedIn.current) inspector.set({ iso: null, returnTo: null });
  }, [iso, v.scene]);
  const close = () => { inspector.set({ iso: null, returnTo: null }); (returnTo ?? document.querySelector<HTMLElement>(`#${v.scene}-title`))?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!iso) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  if (!iso || cs.status !== "ready" || ind.status !== "ready") return null;
  const c = cs.data.countries.find((x) => x.iso3 === iso);
  if (!c) return null;
  // the indicator on screen: ATLAS's, else GDP per capita PPP (S03a: its year)
  const id = v.scene === "atlas" ? a.shownInd : "gdppc_ppp";
  const I = ind.data.indicators.find((x) => x.id === id) as unknown as Ind;
  const year = v.scene === "atlas" ? (a.year || I.latest_year) : v.scene === "years" && y.year ? y.year : latestYear();
  const L = layoutFor(year, id), r = L ? L.order.indexOf(iso) : -1, val = valueOfInd(id, iso, year);
  const value = val === null ? "NO DATA" : I.price_basis ? money(val, I.price_basis) : `${d1(val)} ${unitFor(I)}`;
  const inputs = nr.status === "ready" ? (nr.data.countries.find((x) => x.iso3 === iso)?.inputs as Inputs | undefined) : undefined;
  const texts = inputs && nr.status === "ready" ? narrativeFamilies(id).map((f) => nr.data.templates.find((t) => t.id === f)).filter(Boolean).map((t) => render(t!, inputs)).filter((x): x is string => !!x) : [];
  const brk = bd.status === "ready" ? bd.data.rows.find((x) => x.iso3 === iso && x.territory_break_year !== null) : undefined;
  return (
    <section ref={ref} className="inspector" role="dialog" aria-modal="false" aria-labelledby="inspector-name" tabIndex={-1}>
      <div className="inspector__top">
        <span className="story-card__chip">{iso} · {c.region.toUpperCase()} · {c.income_group.toUpperCase()} (CURRENT WB LABEL)</span>
        <button type="button" className="btn-square inspector__close" onClick={close}>CLOSE (ESC)</button>
      </div>
      <h3 id="inspector-name" className="inspector__name serif">{c.name}</h3>
      <p className="tnum inspector__val">{I.label.toUpperCase()} · {year}: {value}</p>
      <p className="tnum">{r >= 0 && L ? `RANK ${int(r + 1)} OF ${int(L.order.length)} COUNTRIES WITH DATA` : `NOT RANKED IN ${year} (NO VALUE)`}</p>
      <Statuses items={[["narratives", nr, retryNr], ["boundaries", bd, retryBd]]} />
      <div className="inspector__narr">{texts.map((t) => <p key={t}>{t}</p>)}</div>
      {brk ? <p className="inspector__brk">TERRITORY NOTE: {brk.event.toUpperCase()} ({brk.event_year}, {brk.event_evidence.replace("_", " ")}). {brk.treatment.toUpperCase()}</p> : null}
      <p className="s03-chips"><HonestyChip tag="OBSERVED" detail="WDI VALUE" /><HonestyChip tag="DERIVED" detail="RANK, NARRATIVE" /></p>
    </section>
  );
}
