/** Scene registry (VISUAL_DESIGN 3.1, MOTION_SYSTEM 6.2 landings). S00 is the overlay on the S01 track. */
export interface SceneDef { id: string; code: string; nav: string | null; track: string; landing: number; title: string }

export const SCENES: SceneDef[] = [
  { id: "eight-billion", code: "S01", nav: "EIGHT BILLION", track: "200vh", landing: 0.78, title: "The bright core and the long rim" },
  { id: "sources", code: "S02", nav: "SOURCES", track: "300vh", landing: 0.14, title: "Where the numbers come from" },
  { id: "years", code: "S03a", nav: "YEARS", track: "250vh", landing: 0.7, title: "Thirty-five years" },
  { id: "weight", code: "S03b", nav: "WEIGHT", track: "250vh", landing: 0.43, title: "Count people, not countries" },
  { id: "catch-up", code: "S04", nav: "CATCH-UP", track: "300vh", landing: 0.95, title: "Did the poor grow faster?" },
  { id: "lab", code: "S05", nav: "LAB", track: "250vh", landing: 0.4, title: "Change the window, change the answer" },
  { id: "likeness", code: "S06", nav: "LIKENESS", track: "300vh", landing: 0.2, title: "Who looks alike, what travels together" },
  { id: "evidence", code: "S07", nav: "EVIDENCE", track: "250vh", landing: 0.05, title: "How we know" },
  { id: "atlas", code: "ATLAS", nav: "ATLAS", track: "auto", landing: 0, title: "Compare any economies, on one footing" },
  { id: "resorted", code: "S08", nav: null, track: "200vh", landing: 0.75, title: "The world, re-sorted" },
];

export const NAV_ITEMS = SCENES.filter((s) => s.nav).map((s) => ({ id: s.id, label: s.nav! }));
/** S08 keeps ATLAS active (MOTION_SYSTEM 6.1). */
export const navActive = (id: string | null) => (id === "resorted" ? "atlas" : id ?? SCENES[0]!.id);
