import { BIN_COLORS, legendPos } from "../model/bins";

interface Props {
  edges: number[];
  labels: string[];
  unit: string;
  note?: string;
  /** ±1 SD of ln value around the mean (DERIVED), drawn on the colour scale itself */
  sigma?: { mean: number; sd: number; label: string } | null;
}

/** 7-swatch mono strip with its edges written underneath (never a gradient bar). */
export function Legend({ edges, labels, unit, note, sigma }: Props) {
  const lo = sigma ? legendPos(Math.exp(sigma.mean - sigma.sd), edges) : 0;
  const hi = sigma ? legendPos(Math.exp(sigma.mean + sigma.sd), edges) : 0;
  return (
    <figure className="legend" aria-label={`Colour legend: ${unit}`}>
      <div className="legend__strip">
        {BIN_COLORS.map((c) => <span key={c} style={{ background: c }} />)}
        {sigma ? (
          <span className="legend__sigma" style={{ left: `${(lo / 7) * 100}%`, width: `${((hi - lo) / 7) * 100}%` }} aria-hidden="true" />
        ) : null}
      </div>
      <div className="legend__edges" aria-hidden="true">
        {labels.map((l, i) => <span key={l} style={{ left: `${((i + 1) / 7) * 100}%` }}>{l}</span>)}
      </div>
      {sigma ? <p className="legend__sigma-label">{sigma.label}</p> : null}
      <figcaption>
        <span>{unit}</span>
        {note ? <span className="legend__note">{note}</span> : null}
      </figcaption>
    </figure>
  );
}
