import { useMemo, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import type { SceneDef } from "../app/scenes";
import { HonestyChip } from "../components/HonestyChip";
import { Footer } from "../components/Footer";
import { Statuses } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { BOUNDARIES, CLUSTERS, CONVERGENCE, CORRELATIONS, COVERAGE, FACTS, META, VALIDATION, dataUrlOf, type MetaFull } from "../data/artifacts";
import { copyS07, limit1960, d2, type Exchange } from "../data/copy";
import { stepState } from "../motion/progress";
import { useMotion, useProgress } from "../scroll/hooks";

// the first objection is already up at the nav landing (p 0.05, MOTION_SYSTEM 6.2; QA D-010)
const THRESH = [0.01, 0.16, 0.28, 0.4, 0.52, 0.64, 0.76];

const MW = 260; // mini visuals are drawn 1:1 in CSS px so their text keeps the 11px floor (QA L7)
function CiBars({ rows, label }: { rows: [string, number, [number, number]][]; label: string }) {
  const a = Math.min(0, ...rows.map((r) => r[2][0])), b = Math.max(0, ...rows.map((r) => r[2][1]));
  const x = (v: number) => 84 + ((v - a) / (b - a)) * (MW - 92), H = rows.length * 20 + 6;
  return (
    <svg className="mini" width={MW} height={H} viewBox={`0 0 ${MW} ${H}`} role="img" aria-label={label}>
      <line x1={x(0)} x2={x(0)} y1={0} y2={H} className="mini-zero" />
      {rows.map(([n, est, [lo, hi]], i) => (
        <g key={n}>
          <text x={0} y={i * 20 + 15} className="mini-t">{n}</text>
          <rect x={x(lo)} y={i * 20 + 8} width={Math.max(1, x(hi) - x(lo))} height={7} className="mini-ci-bar" />
          <rect x={x(est) - 1} y={i * 20 + 4} width={2} height={15} className="mini-est" />
        </g>
      ))}
    </svg>
  );
}

/** S07 Evidence (interaction 10): seven objections answered with receipts; the limitations alongside. */
export function S07Evidence({ def }: { def: SceneDef }) {
  const motion = useMotion();
  const [f, retryF] = useArtifact(FACTS, false);
  const [m, retryM] = useArtifact(META, false);
  const [cv, retryCv] = useArtifact(CONVERGENCE, false);
  const [val, retryVal] = useArtifact(VALIDATION, false);
  const [cl, retryCl] = useArtifact(CLUSTERS, false);
  const [co, retryCo] = useArtifact(CORRELATIONS, false);
  const [cov, retryCov] = useArtifact(COVERAGE, false);
  const [bd, retryBd] = useArtifact(BOUNDARIES, false);
  const [shown, setShown] = useState(0);
  const sRef = useRef(0);
  useProgress(def.id, (p) => { const s = stepState(sRef.current, p, THRESH); if (s !== sRef.current) { sRef.current = s; setShown(s); } });
  const ex = useMemo((): Exchange[] | null => (f.status === "ready" && cv.status === "ready" && m.status === "ready"
    ? copyS07(f.data, cv.data.copy.not_causal!, cv.data.copy.absolute_only!, m.data.vintage.text) : null), [f, cv, m]);
  const visual = (i: number) => {
    if (i === 0 && val.status === "ready") return <p className="mini-checks">{val.data.checks.map((c) => <span key={c.id} className={c.passed ? "ok" : "bad"} title={c.description}>{c.passed ? "✓" : "✗"} {c.id.toUpperCase()}</span>)}</p>;
    if ((i === 1 || i === 2) && cv.status === "ready") {
      const r = (id: string) => cv.data.beta.find((b) => b.id === id)!;
      const rows: [string, number, [number, number]][] = i === 1
        ? [["1990 PPP", r("gdppc_ppp_1990_2025_primary").beta, r("gdppc_ppp_1990_2025_primary").ci95], ["1960 US$", r("gdppc_const_1960_2024_primary").beta, r("gdppc_const_1960_2024_primary").ci95]]
        : [["ALL", r("gdppc_ppp_1990_2025_pop_weighted").beta, r("gdppc_ppp_1990_2025_pop_weighted").ci95], ["SET ASIDE", r("gdppc_ppp_1990_2025_pop_weighted_ex_chn_ind").beta, r("gdppc_ppp_1990_2025_pop_weighted_ex_chn_ind").ci95]];
      return <CiBars rows={rows} label="Slopes with 95% intervals; the vertical line is zero" />;
    }
    if (i === 3 && cl.status === "ready") {
      const mx = Math.max(...cl.data.k_scan.map((k) => k.silhouette));
      return (
        <svg className="mini" width={MW} height={70} viewBox={`0 0 ${MW} 70`} role="img" aria-label="Silhouette for k = 2 to 8, k = 3 chosen">
          {cl.data.k_scan.map((k, j) => <g key={k.k}><rect x={j * 36 + 4} width={24} y={54 - (k.silhouette / mx) * 50} height={(k.silhouette / mx) * 50} className={k.k === cl.data.chosen_k ? "mini-est-bar" : "mini-bar"} /><text x={j * 36 + 16} y={68} className="mini-t" textAnchor="middle">K {k.k}</text></g>)}
        </svg>
      );
    }
    if (i === 4 && co.status === "ready") {
      const p = co.data.pairs.find((x) => (x.a === "ln_gdppc_ppp" && x.b === "ln_productivity") || (x.b === "ln_gdppc_ppp" && x.a === "ln_productivity"))!;
      return <CiBars rows={[["RHO", p.rho, p.ci95]]} label={`Income and productivity, rho ${d2(p.rho)} with its 95% interval`} />;
    }
    if (i === 5 && cov.status === "ready") {
      const n = cov.data.indicators.gdppc_ppp!.n_by_year;
      return <svg className="mini" width={MW} height={40} viewBox={`0 0 ${MW} 40`} role="img" aria-label="Countries with GDP per capita PPP data per year">{n.map((v, k) => <rect key={k} x={k * 7} width={3} y={40 - (v / 217) * 40} height={(v / 217) * 40} className="mini-bar" />)}</svg>;
    }
    if (i === 6 && m.status === "ready") return <ul className="mini-sources">{(m.data as MetaFull).excluded_sources.map((s) => <li key={s.name}>✗ {s.name.toUpperCase()}</li>)}</ul>;
    return null;
  };
  const n = motion ? shown : 7;
  const cur = ex?.[Math.max(0, n - 1)];
  const limits = [
    ...(bd.status === "ready" ? [bd.data.note.toUpperCase()] : []),
    ...(f.status === "ready" ? [limit1960(f.data)] : []),
    ...(val.status === "ready" ? val.data.limitations_observed.map((l) => l.toUpperCase()) : []),
  ];
  return (
    <Track id={def.id} height={def.track} landing={def.landing} label="How we know" className="scene scene-evidence">
      <h2 id={`${def.id}-title`} tabIndex={-1} data-scene-heading className="ev-title serif">How we know.</h2>
      <ol className="ev-stack" aria-label="Seven objections and their answers">
        {ex?.slice(0, n).map((e, i) => (
          <li key={e.q} className={`ev-ex ${i < n - 2 ? "is-old" : ""} ${i < n - 1 ? "is-prev" : ""}`} style={{ ["--d" as string]: n - 1 - i }}>
            <article className="ev-q"><header>A SKEPTIC</header><p>{e.q}</p></article>
            <article className="ev-a">
              <header>THE ATLAS</header>
              <p>{e.a}</p>
              {e.extra ? <p className="ev-extra">{e.extra}</p> : null}
              {visual(i)}
              <div className="ev-tag"><HonestyChip tag={e.tag} onLight detail={e.receipt.toUpperCase()} /></div>
            </article>
          </li>
        ))}
      </ol>
      <aside className="ev-side">
        <Statuses items={[["facts", f, retryF], ["meta", m, retryM], ["validation", val, retryVal], ["convergence", cv, retryCv], ["clusters", cl, retryCl], ["correlations", co, retryCo], ["coverage", cov, retryCov], ["boundaries", bd, retryBd]]} />
        {cur ? (
          <div className="receipt">
            <p className="receipt__h">RECEIPT</p>
            <a href={dataUrlOf(cur.receipt)}>{cur.receipt}</a>
            {m.status === "ready" ? (() => { const b = (m.data as MetaFull).artifact_bytes[cur.receipt.replace(".json", "")]; return <p className="tnum">{b === undefined ? "SIZE NOT PUBLISHED" : `${b.toLocaleString("en-US")} BYTES GZIP`} · PIPELINE v{(m.data as MetaFull).pipeline_version}</p>; })() : null}
          </div>
        ) : null}
        <details className="ev-limits" open={motion ? shown >= 7 && innerWidth >= 768 : true}>
          <summary>LIMITATIONS ({limits.length})</summary>
          <ul tabIndex={0} aria-label="Limitations">{limits.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      </aside>
      <Footer />
    </Track>
  );
}
