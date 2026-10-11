/** Placeholder scene registry. Titles, track heights and landings are neutral until docs/VISUAL_DESIGN.md. */
export interface SceneDef { id: string; nav: string; track: string; landing: number; title: string }

const TITLES = ["Opening", "Scene One", "Scene Two", "Scene Three", "Scene Four", "Scene Five", "Scene Six", "Scene Seven", "Closing"];
export const SCENES: SceneDef[] = TITLES.map((t, i) => {
  const n = String(i).padStart(2, "0");
  return { id: `s${n}`, nav: `S${n}`, track: i === 0 ? "200vh" : "250vh", landing: 0.3, title: `S${n} ${t}` };
});

export const NAV_ITEMS = SCENES.map((s) => ({ id: s.id, label: s.nav }));
