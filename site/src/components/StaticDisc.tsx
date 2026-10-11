import { useEffect, useRef } from "react";
import { paintState } from "../gl/seeds";
import type { SeedState } from "../gl/transition";
import { fitCanvas } from "../graphics/canvas";

/**
 * Reduced-motion and fallback figure: one resting state painted with the Canvas2D sprite painter
 * (the same painter as the no-WebGL tier). `scaleSlots` fixes s across a row so the disc's area
 * stays people (1990 smaller than 2025).
 */
export function StaticDisc({ state, overlay, scaleSlots, size, label }: { state: SeedState | null; overlay?: SeedState | null; scaleSlots: number; size: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !state) return;
    const { ctx, width, height } = fitCanvas(c, 2);
    ctx.clearRect(0, 0, width, height);
    let rw = 0;
    for (let i = 0; i < state.key.length; i++) rw = Math.max(rw, Math.hypot(state.x[i]!, state.y[i]!));
    const cam = { cx: width / 2, cy: height / 2, s: (Math.min(width, height) / 2 - 4) / Math.sqrt(scaleSlots), rw };
    paintState(ctx, cam, state);
    if (overlay) paintState(ctx, cam, overlay);
  }, [state, overlay, scaleSlots, size]);
  return (
    <figure className="static-disc">
      <canvas ref={ref} style={{ width: size, height: size }} role="img" aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}
