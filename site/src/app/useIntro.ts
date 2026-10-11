import { useCallback, useEffect, useState } from "react";
import { addFrame } from "../motion/loop";
import { Reveal } from "../motion/reveal";
import { motionEnabled } from "../state/motion";
import { INTRO_MS, intro, introTime, resetIntro } from "../scenes/director";

const KEY = "eca.intro";
const seen = () => { try { return sessionStorage.getItem(KEY) === "done"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(KEY, "done"); } catch { /* storage blocked: plays again next load */ } };

/**
 * S00 "The Sort" clock (MOTION_SYSTEM 5.1), P03 pattern. The grain timeline lives in the director;
 * this drives the DOM from the same clock: corner labels (200-500ms), the headline sharpening
 * (3600-4300ms, 80ms stagger) and the nav (4200ms). SKIP, Esc, any wheel/touch/key scroll or a
 * chapter jump complete it in 350ms; scroll is never locked. Once per session (sessionStorage in
 * try/catch); reduced motion renders the end state at once.
 */
export function useIntro() {
  const [playing, setPlaying] = useState(() => {
    const p = motionEnabled() && !seen();
    if (p) resetIntro(); // synchronous: the director's first frame must see the intro playing
    else intro.playing = false;
    return p;
  });
  const [navIn, setNavIn] = useState(() => !playing);
  const [run, setRun] = useState(0);

  const complete = useCallback(() => {
    if (!intro.playing || intro.completeFrom >= 0 || intro.frozen >= 0) return;
    const now = performance.now();
    intro.completeFrom = introTime(now);
    intro.completeAt = now;
    setNavIn(true);
  }, []);

  useEffect(() => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    const reveal = h ? new Reveal(h) : null;
    const corners = document.querySelectorAll<HTMLElement>("[data-intro-corner]");
    const late = document.querySelectorAll<HTMLElement>("[data-intro-late]");
    if (!playing) {
      intro.playing = false;
      reveal?.set(1);
      corners.forEach((c) => (c.style.opacity = ""));
      late.forEach((c) => (c.style.opacity = ""));
      return;
    }
    reveal?.set(0);
    let navShown = false;
    const off = addFrame((now) => {
      const t = introTime(now);
      const o = String(Math.min(1, Math.max(0, (t - 200) / 300)));
      corners.forEach((c) => (c.style.opacity = o));
      late.forEach((c) => (c.style.opacity = String(Math.min(1, Math.max(0, (t - 4200) / 400)))));
      reveal?.timed(t - 3600, 350, 80);
      if (!navShown && t >= 4200) { navShown = true; setNavIn(true); }
      if (t >= INTRO_MS && intro.frozen < 0) {
        off();
        intro.playing = false;
        reveal?.set(1);
        markSeen();
        setPlaying(false);
      }
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(e.key)) complete();
    };
    addEventListener("wheel", complete, { passive: true });
    addEventListener("eca:jump", complete);
    addEventListener("touchmove", complete, { passive: true });
    addEventListener("keydown", onKey);
    return () => {
      off();
      removeEventListener("wheel", complete);
      removeEventListener("eca:jump", complete);
      removeEventListener("touchmove", complete);
      removeEventListener("keydown", onKey);
    };
  }, [playing, run, complete]);

  const replay = useCallback(() => {
    scrollTo(0, 0);
    if (!motionEnabled()) return; // the 0ms version is the end state
    resetIntro();
    setNavIn(false);
    setPlaying(true);
    setRun((r) => r + 1);
  }, []);

  return { playing, navIn, skip: complete, replay };
}
