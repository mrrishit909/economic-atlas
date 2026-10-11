import { useCallback } from "react";

/**
 * Intro hooks. SKIP and REPLAY are no-op placeholders until the Creative Director's
 * intro exists (docs/VISUAL_DESIGN.md); the nav is always shown and nothing plays.
 */
export function useIntro() {
  const skip = useCallback(() => {}, []);
  const replay = useCallback(() => scrollTo(0, 0), []);
  return { playing: false, navIn: true, skip, replay };
}
