import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { StoryDeck, type DeckCard } from "../components/StoryDeck";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine, Statuses } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { COUNTRIES, COVERAGE, FACTS, INDICATORS, LONGRUN, META, PANEL, RECONCILIATION, factNum, type MetaFull } from "../data/artifacts";
import { S02, int, money, unitOf } from "../data/copy";
import type { LoadState } from "../data/loader";

const COMB = ["gdppc_ppp", "gdppc_const", "gdp_growth", "agr_share", "trade_open", "hhi5"];
/** Card visual fallback: a failed artifact shows UNAVAILABLE plus RETRY on its card only. */
function Unavailable({ file, s, retry }: { file: string; s: LoadState<unknown>; retry: () => void }) {
  if (s.status === "error") return <ErrorLine file={file} reason={s.reason} attempt={s.attempt} onRetry={retry} />;
  return <p className="state-line">{s.status === "loading" || s.status === "initial" ? `LOADING ${file.toUpperCase()}` : "UNAVAILABLE"}</p>;
}

/** S02 Origin of the data (interaction 4): four story cards, each bound to its artifact. */
export function S02Sources({ def }: { def: SceneDef }) {
  const [f, retryF] = useArtifact(FACTS, false);
  const [m] = useArtifact(META, false);
  const [cs] = useArtifact(COUNTRIES, false);
  const [rc, retryRc] = useArtifact(RECONCILIATION, false);
  const [pan, retryPan] = useArtifact(PANEL, false);
  const [ind] = useArtifact(INDICATORS, false);
  const [cov, retryCov] = useArtifact(COVERAGE, false);
  const [lr, retryLr] = useArtifact(LONGRUN, false);
  if (f.status !== "ready") return <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-sources"><h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="sr-only">{def.title}</h2><div className="sources-head"><Statuses items={[["facts", f, retryF]]} /></div></Track>;
  const F = f.data;

  // card 1: 296 squares, the 79 aggregates hollow in their own block; the identity recomputed per indicator
  const nAgg = factNum(F, "aggregates"), nCtry = factNum(F, "countries");
  const c1 = (
    <div className="ent">
      <div className="ent__grid" aria-hidden="true">{Array.from({ length: nCtry }, (_, i) => <i key={i} />)}</div>
      <p className="ent__cap">{int(nCtry)} COUNTRIES</p>
      <div className="ent__grid ent__grid--agg" aria-hidden="true">{Array.from({ length: nAgg }, (_, i) => <i key={i} />)}</div>
      <p className="ent__cap">{int(nAgg)} AGGREGATES · NEVER RANKED</p>
      {rc.status === "ready" ? (
        <p className="ent__check">
          {rc.data.rows.map((r) => {
            const ok = r.raw_rows === r.aggregate_rows + r.country_rows;
            return <span key={r.indicator} className={ok ? "ok" : "bad"} title={r.indicator}>{ok ? "✓" : "✗"}</span>;
          })}
          <span className="ent__rule">RAW ROWS = AGGREGATE + COUNTRY ROWS · {rc.data.rows.filter((r) => r.raw_rows === r.aggregate_rows + r.country_rows).length} / {rc.data.rows.length} INDICATORS</span>
        </p>
      ) : <Unavailable file="reconciliation" s={rc} retry={retryRc} />}
    </div>
  );

  // card 2: the median-person country in three bases, three rows, no shared axis
  const iso = String((F.median_person_iso3 as { value: string }).value);
  const name = cs.status === "ready" ? cs.data.countries.find((c) => c.iso3 === iso)?.name ?? iso : iso;
  const rows = pan.status === "ready" && ind.status === "ready"
    ? (["gdppc_ppp", "gdppc_const", "gdppc_nominal"] as const).map((id) => {
      const x = ind.data.indicators.find((i) => i.id === id)!, ci = pan.data.iso3.indexOf(iso), yi = pan.data.years.indexOf(x.latest_year);
      const v = pan.data.series[id]!.values[ci]?.[yi] ?? null;
      return { id, basis: x.price_basis!, year: x.latest_year, v };
    }) : null;
  const c2 = rows ? (
    <div className="dollars" data-three-bases>
      <p className="dollars__who">{name.toUpperCase()} · THE MIDDLE PERSON'S COUNTRY</p>
      {rows.map((r, i) => (
        <div key={r.id} className="dollars__row">
          {i ? <span className="dollars__ne" aria-label="not equal to">≠</span> : null}
          <span className="dollars__v tnum">{r.v === null ? "NO DATA" : money(r.v, r.basis)}</span>
          <span className="dollars__chip">{unitOf(r.basis)} · {r.year}</span>
        </div>
      ))}
    </div>
  ) : <Unavailable file="panel_income" s={pan} retry={retryPan} />;

  // card 3: coverage comb (n / 217 per year), latest-year tick in light blue
  const c3 = cov.status === "ready" ? (
    <div className="comb">
      {COMB.map((id) => {
        const c = cov.data.indicators[id]!, yrs = c.n_by_year.length, ly = c.latest_year - 1990;
        return (
          <figure key={id} className="comb__row">
            <svg viewBox={`0 0 ${yrs * 4} 24`} preserveAspectRatio="none" role="img" aria-label={`${id}: countries with data per year, 1990 to ${1990 + yrs - 1}`}>
              {c.n_by_year.map((n, k) => <rect key={k} x={k * 4} width={1.4} y={24 - (n / 217) * 24} height={(n / 217) * 24} className={k === ly ? "comb__latest" : ""} />)}
            </svg>
            <figcaption>{id.toUpperCase()} · LATEST {c.latest_year} (N {c.latest_year_n})</figcaption>
          </figure>
        );
      })}
      <p className="comb__readout">{S02.c3Readout(F)}</p>
      {m.status === "ready" ? <p className="comb__rule">{(m.data as MetaFull).latest_year_rule.text.toUpperCase()}</p> : null}
    </div>
  ) : <Unavailable file="coverage" s={cov} retry={retryCov} />;

  // card 4: Maddison spread bars on their own axis and unit
  const c4 = lr.status === "ready" ? (
    <div className="spread">
      {lr.data.sigma.years.map((y, i) => (
        <div key={y} className="spread__row">
          <span className="tnum">{y}</span>
          <span className="spread__bar" style={{ ["--w" as string]: `${(lr.data.sigma.sd_log[i]! / Math.max(...lr.data.sigma.sd_log)) * 100}%` }} />
          <span className="tnum spread__n">N {lr.data.sigma.n[i]}</span>
        </div>
      ))}
      <p className="spread__readout">{S02.c4Readout(F)}</p>
      <p className="spread__unit">{S02.c4Unit}</p>
      <p className="spread__src">{F.strings.attribution_owid}</p>
    </div>
  ) : <Unavailable file="longrun" s={lr} retry={retryLr} />;

  const cards: DeckCard[] = [
    { variant: "dark", chip: "SOURCE 01 · ENTITIES", title: S02.c1Title(F), body: S02.c1Body(F), visual: c1, tag: <HonestyChip tag="OBSERVED" /> },
    { variant: "violet", chip: "SOURCE 02 · UNITS", title: S02.c2Title, body: F.strings.ppp_vs_nominal!.toUpperCase(), visual: c2, tag: <HonestyChip tag="OBSERVED" /> },
    { variant: "dark", chip: "SOURCE 03 · COVERAGE", title: S02.c3Title, body: S02.c3Body, visual: c3, tag: <HonestyChip tag="DERIVED" /> },
    { variant: "dark", chip: "SOURCE 04 · LONG RUN", title: S02.c4Title, body: S02.c4Body, visual: c4, tag: <HonestyChip tag="OBSERVED" detail="VALUES · SPREAD DERIVED" /> },
  ];
  return (
    <Track id={def.id} height={def.track} landing={def.landing} className="scene scene-sources">
      <div className="sources-head">
        <p className="scene-kicker">{S02.kicker}</p>
        <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="sr-only">{def.title}</h2>
      </div>
      <StoryDeck track={def.id} cards={cards} />
      {m.status === "ready" ? <p className="sources-pipeline">PIPELINE v{(m.data as MetaFull).pipeline_version} · {m.data.vintage.text} {F.strings.attribution_wdi}</p> : null}
    </Track>
  );
}
