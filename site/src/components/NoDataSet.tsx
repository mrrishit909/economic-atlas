/**
 * Countries without a value in the active year: never in the disc and never at its rim. A separate
 * hollow set beside the disc, one 1px white ring at 60% per million people (same per-country
 * rounding as the slots), captioned with the count and people.
 */
export function NoDataSet({ rows, caption, cols = 26 }: { rows: { iso3: string; population: number }[]; caption: string; cols?: number }) {
  const n = rows.reduce((a, r) => a + Math.max(1, Math.floor(r.population / 1e6 + 0.5)), 0);
  const pitch = 6, h = Math.ceil(n / cols) * pitch;
  return (
    <figure className="nodata">
      <svg width={cols * pitch} height={h} viewBox={`0 0 ${cols * pitch} ${h}`} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <circle key={i} cx={(i % cols) * pitch + 3} cy={Math.floor(i / cols) * pitch + 3} r={2} />
        ))}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
