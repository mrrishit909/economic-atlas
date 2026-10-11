import { useArtifact } from "../data/useArtifact";
import { FACTS, META } from "../data/artifacts";

/** Provenance footer (VISUAL_DESIGN section 0): vintage and WDI attribution on every scene from S01; S08 adds Maddison, the IMF line and not-advice. */
export function Footer({ full = false }: { full?: boolean }) {
  const [f] = useArtifact(FACTS, false);
  const [m] = useArtifact(META, false);
  if (f.status !== "ready" || m.status !== "ready") return null;
  const s = f.data.strings;
  const lines = [m.data.vintage.text, s.attribution_wdi, ...(full ? [s.attribution_owid, s.imf_excluded, s.not_advice] : [])];
  return (
    <footer className="scene-footer">
      {lines.map((l) => <p key={l}>{l}</p>)}
    </footer>
  );
}
