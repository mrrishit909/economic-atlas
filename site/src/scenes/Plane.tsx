import { useEffect, useState } from "react";
import { fitAt, pointsFor, xTicks, type BetaRecord } from "../model/plane";
import { planeRect } from "./freestates";
import { cssClass, stageH, stageW } from "../graphics/canvas";
import { domain, dataView } from "./director";
import { S04, unitOf } from "../data/copy";

function useStage() {
  const [s, set] = useState(() => ({ w: stageW(), h: stageH(), cls: cssClass() }));
  useEffect(() => {
    const on = () => set({ w: stageW(), h: stageH(), cls: cssClass() });
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return s;
}

/**
 * The catch-up plane's SVG layer (VISUAL_DESIGN 3.4 S04/S05, criterion 1): a zero-growth line, mono
 * x labels at 1K..100K in the record's basis, the fit (#58B8E1, from intercept + beta over the
 * record's x range) and its 95% band as a 45° hatch with no edge. No gridlines, no frame, no ticks,
 * no legend box. Fits crossfade by record id; they never tween.
 */
export function PlaneOverlay({ rec, show, labels = 8 }: { rec: BetaRecord; show: { zero: number; fit: boolean }; labels?: number }) {
  const { w, h, cls } = useStage();
  const dom = domain(rec.indicator);
  if (!dom) return null;
  const r = planeRect(cls, w, h);
  const X = (x: number) => r.x0 + ((x - dom.x[0]) / (dom.x[1] - dom.x[0])) * (r.x1 - r.x0);
  const Y = (y: number) => r.y1 - ((y - dom.y[0]) / (dom.y[1] - dom.y[0])) * (r.y1 - r.y0);
  const [x0, x1] = rec.x_domain, xs = Array.from({ length: 25 }, (_, i) => x0 + ((x1 - x0) * i) / 24);
  const up = xs.map((x) => { const f = fitAt(rec, x); return `${X(x).toFixed(1)},${Y(f.y + f.half).toFixed(1)}`; });
  const dn = xs.map((x) => { const f = fitAt(rec, x); return `${X(x).toFixed(1)},${Y(f.y - f.half).toFixed(1)}`; }).reverse();
  const conv = dataView.conv;
  const pts = conv ? pointsFor(rec, conv.beta, null) ?? rec.points : rec.points;
  // direct labels: the 4 largest positive and 4 largest negative residuals (D only; tap on M)
  const resid = pts ? pts.iso3.map((iso, i) => ({ iso, i, e: pts.y[i]! - fitAt(rec, pts.x[i]!).y })).sort((a, b) => b.e - a.e) : [];
  // greedy declutter: a label is drawn only if its box clears every label already placed
  const lab: typeof resid = [], placed: [number, number][] = [];
  if (cls === "D" && pts) for (const l of [...resid.slice(0, labels / 2), ...resid.slice(-labels / 2)]) {
    const lx = X(pts.x[l.i]!) + 7, ly = Y(pts.y[l.i]!) + 4;
    if (placed.some(([px, py]) => Math.abs(px - lx) < 34 && Math.abs(py - ly) < 14)) continue;
    placed.push([lx, ly]); lab.push(l);
  }
  return (
    <svg className="plane" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" data-basis={rec.price_basis}>
      <defs>
        <pattern id="ci-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#58B8E1" strokeWidth="1" opacity="0.5" />
        </pattern>
        {/* L16: axis words and iso labels sit on a black plate so seeds passing behind never drop their contrast */}
        <filter id="plane-plate" x="-0.06" y="-0.25" width="1.12" height="1.5"><feFlood floodColor="#000" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {show.zero > 0 && dom.y[0] < 0 && dom.y[1] > 0 ? (
        <line x1={r.x0} x2={r.x0 + (r.x1 - r.x0) * show.zero} y1={Y(0)} y2={Y(0)} className="plane__zero" />
      ) : null}
      {show.zero > 0 ? (
        <g className="plane__x" style={{ opacity: show.zero }}>
          {xTicks(dom).map((t) => <text key={t.v} x={X(t.x)} y={r.y1 + 22} textAnchor="middle">{t.label}</text>)}
          {cls === "M" ? (
            <text x={r.x1} y={r.y1 + 38} textAnchor="end" className="plane__unit" filter="url(#plane-plate)"><tspan x={r.x1}>{`GDP PER CAPITA IN ${rec.start}`}</tspan><tspan x={r.x1} dy={14}>{unitOf(rec.price_basis)}</tspan></text>
          ) : (
            <text x={r.x1} y={r.y1 + 40} textAnchor="end" className="plane__unit" filter="url(#plane-plate)">{`GDP PER CAPITA IN ${rec.start} · ${unitOf(rec.price_basis)}`}</text>
          )}
          {[-4, -2, 2, 4, 6, 8].filter((v) => v > dom.y[0] && v < dom.y[1]).map((v) => (
            <text key={v} x={cls === "M" ? r.x1 - 2 : r.x1 + 8} y={Y(v) + 4} textAnchor={cls === "M" ? "end" : "start"} className="plane__y" filter="url(#plane-plate)">{v > 0 ? `+${v}%` : `${v}%`}</text>
          ))}
          <text x={r.x0 + 4} y={r.y0 + 14} className="plane__unit" filter="url(#plane-plate)">{S04.yUnit}</text>
        </g>
      ) : null}
      {show.fit ? (
        <g key={rec.id} className="plane__fit" data-fit={rec.id} data-slope={rec.beta}>
          <polygon points={[...up, ...dn].join(" ")} fill="url(#ci-hatch)" />
          <line x1={X(x0)} x2={X(x1)} y1={Y(fitAt(rec, x0).y)} y2={Y(fitAt(rec, x1).y)} className="plane__line" />
          {lab.map((l) => <text key={l.iso} x={X(pts!.x[l.i]!) + 7} y={Y(pts!.y[l.i]!) + 4} className="plane__lab" filter="url(#plane-plate)">{l.iso}</text>)}
        </g>
      ) : null}
    </svg>
  );
}
