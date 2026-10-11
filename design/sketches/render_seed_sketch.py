"""Design sketches for P05 "The Seed Head" from the real artifacts in site/public/data (read only).

Run from the project root:  uv run --with numpy python design/sketches/render_seed_sketch.py
then rasterize:            NODE_PATH=../03-climate-signal-observatory/site/node_modules node design/sketches/render_sheet.mjs
then compose:              uv run --with pillow python design/sketches/compose_sheet.py

Encoding (VISUAL_DESIGN section 0): 1 seed = 1 million people, max(1, round(pop / 1M)) per country (a country under
0.5M holds one slot drawn at its true area). Seeds sit on a fixed-spacing Vogel lattice (equal area per slot), and each
country owns one contiguous territory (territories.py), seeded by rank so the highest value sits at the core. Area is
carried by slots (one slot = s^2 per rounded million people, scaled by area_scale = pop / (slots x 1M)); grains are glyphs
of radius r_base x sqrt(area_scale). Colour is the binned Spectral ramp of the sorted indicator. Seams are symmetric and
rank-neutral: every grain on either side of a border has r_base 0.30 s instead of 0.40 s; territories of 6 slots or fewer
never seam. Countries without a value are a separate
hollow set beside the disc, never at its rim. The production layout is computed by the pipeline (DR-1), not here.
"""
import json
import math
from pathlib import Path

import numpy as np

import territories as T

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "site/public/data"
OUT = Path(__file__).parent
MONO = 'font-family="JetBrains Mono, ui-monospace, monospace"'
SERIF = 'font-family="Newsreader, Georgia, serif"'
# Binned Spectral ramp (tokens.css --orb-spectral family, extended one step darker and one step lighter).
# Edges are sketch values; production edges come from DR-10.
EDGES = [2_500, 5_000, 10_000, 20_000, 40_000, 80_000]
BINS = [("#9a3ce0", "#c58cf0"), ("#c21fd6", "#e070ff"), ("#ff2f7a", "#ff8cb5"), ("#ff4f3f", "#ff9c8a"),
        ("#ff6a2b", "#ffb07d"), ("#ffb26b", "#ffe0bf"), ("#ffe6c9", "#ffffff")]

panel = json.loads((DATA / "panel_income.json").read_text())
facts = json.loads((DATA / "facts.json").read_text())
meta = json.loads((DATA / "meta.json").read_text())
countries = {c["iso3"]: c["name"] for c in json.loads((DATA / "countries.json").read_text())["countries"]}
ISO, YEARS = panel["iso3"], panel["years"]
GDP, POP = panel["series"]["gdppc_ppp"]["values"], panel["series"]["population"]["values"]


def bin_of(v):
    return sum(v >= e for e in EDGES)


def defs():
    g = "".join(f'<radialGradient id="b{i}" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="{hi}"/>'
                f'<stop offset="1" stop-color="{lo}"/></radialGradient>' for i, (lo, hi) in enumerate(BINS))
    return f"<defs>{g}</defs>"


def rows_for(year):
    yi = YEARS.index(year)
    have = [(ISO[i], GDP[i][yi], POP[i][yi]) for i in range(len(ISO)) if GDP[i][yi] is not None and POP[i][yi]]
    have.sort(key=lambda r: (-r[1], r[0]))  # rankings.json order: descending, ties by iso3
    missing = [(ISO[i], POP[i][yi]) for i in range(len(ISO)) if GDP[i][yi] is None and POP[i][yi]]
    return have, missing


def mosaic(year, cx, cy, s, hollow=(), label_min=90e6, label=True):
    """Draw the seed head. s = seed spacing in px (slot area s^2, constant across years, so the disc grows with people)."""
    rows, _ = rows_for(year)
    pops = np.array([p for *_, p in rows])
    counts = T.counts_for(pops)
    G, own, _ = T.assign(counts)
    n = len(G)
    P = G * s * math.sqrt(n)
    d2 = ((P[:, None, :] - P[None, :, :]) ** 2).sum(-1)
    nn = np.argsort(d2, 1)[:, 1:7]
    seam = ((own[nn] != own[:, None]).any(1)) & (counts[own] > 6)  # both sides of every border: rank-neutral
    out = []
    for g, (x, y) in enumerate(P):
        c = own[g]
        iso, v, p = rows[c]
        r = s * (0.30 if seam[g] else 0.40) * math.sqrt(p / (counts[c] * 1e6))  # glyph area follows area_scale
        if iso in hollow:
            out.append(f'<circle cx="{cx + x:.1f}" cy="{cy + y:.1f}" r="{max(r, .6):.2f}" fill="none" stroke="{BINS[bin_of(v)][0]}" stroke-width=".8"/>')
        else:
            out.append(f'<circle cx="{cx + x:.1f}" cy="{cy + y:.1f}" r="{max(r, .5):.2f}" fill="url(#b{bin_of(v)})"/>')
    if label:
        for c, (iso, v, p) in enumerate(rows):
            if p > label_min:
                m = P[own == c].mean(0)
                out.append(f'<text x="{cx + m[0]:.0f}" y="{cy + m[1] + 4:.0f}" fill="#fff" {MONO} font-size="11" text-anchor="middle" '
                           f'style="paint-order:stroke" stroke="#000" stroke-width="3">{iso}</text>')
    return "\n".join(out), n, s * math.sqrt(n), rows


def nodata(year, x0, y0, s, cols=9):
    """Countries without a value: a separate hollow set (1 hollow seed = 1M people), never part of the disc."""
    _, missing = rows_for(year)
    k = int(sum(max(1, round(p / 1e6)) for _, p in missing))
    out = [f'<circle cx="{x0 + (i % cols) * s:.1f}" cy="{y0 + (i // cols) * s:.1f}" r="{s * .32:.2f}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>'
           for i in range(k)]
    return "\n".join(out), len(missing), sum(p for _, p in missing) / 1e9, k


def legend(x, y, unit):
    out, w = [], 44
    for i, (lo, _) in enumerate(BINS):
        out.append(f'<rect x="{x + i * w}" y="{y}" width="{w - 2}" height="8" fill="url(#b{i})"/>')
    for i, e in enumerate(EDGES):
        out.append(f'<text x="{x + (i + 1) * w - 1}" y="{y + 22}" fill="#fff" fill-opacity=".5" {MONO} font-size="10" text-anchor="middle">{e // 1000}K</text>')
    out.append(f'<text x="{x}" y="{y - 8}" fill="#fff" fill-opacity=".5" {MONO} font-size="10">{unit}</text>')
    return "\n".join(out)


def nav(active, w=1440, y=856):
    labels = ["EIGHT BILLION", "SOURCES", "YEARS", "WEIGHT", "CATCH-UP", "LAB", "LIKENESS", "EVIDENCE", "ATLAS"]
    x, out = w / 2 - sum(len(l) * 7 + 16 for l in labels) / 2, []
    for lab in labels:
        bw, on = len(lab) * 7 + 16, lab == active
        out.append(f'<rect x="{x:.0f}" y="{y}" width="{bw}" height="26" fill="{"#fff" if on else "rgba(242,242,242,.1)"}"/>'
                   f'<text x="{x + 8:.0f}" y="{y + 17}" fill="{"#000" if on else "#fff"}" {MONO} font-size="11">{lab}</text>')
        x += bw
    return "\n".join(out)


def svg(body, w=1440, h=900):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{defs()}'
            f'<rect width="{w}" height="{h}" fill="#000"/>\n{body}\n</svg>')


def s00_d():
    yr = facts["gdppc_ppp_latest_year"]["value"]
    disc, n, R, rows = mosaic(yr, 900, 470, 7.15)
    nd, nd_n, nd_bn, _ = nodata(yr, 36, 92, 6.0, cols=26)
    world = facts["world_pop_billion_latest"]["value"]
    with_data = sum(p for *_, p in rows) / 1e9
    body = [disc,
            '<defs><linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".92"/>'
            '<stop offset=".6" stop-color="#000" stop-opacity=".78"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>',
            '<rect x="0" y="590" width="1000" height="250" fill="url(#scrim)"/>',
            f'<text x="96" y="690" fill="#fff" {SERIF} font-size="88">The world, explained</text>',
            f'<text x="96" y="778" fill="#fff" {SERIF} font-size="88">through economic forces.</text>',
            f'<text x="32" y="40" fill="#fff" {MONO} font-size="13">ECONOMIC ATLAS</text>',
            f'<text x="1408" y="40" fill="#fff" {MONO} font-size="13" text-anchor="end">{yr} · {with_data:.2f} BN OF {world:.2f} BN PEOPLE · {len(rows)} COUNTRIES</text>',
            f'<text x="1408" y="60" fill="#fff" fill-opacity=".5" {MONO} font-size="13" text-anchor="end">SORTED BY GDP PER CAPITA, PPP · CONSTANT 2021 INTL $</text>',
            nd,
            f'<text x="32" y="78" fill="#fff" fill-opacity=".5" {MONO} font-size="10">NO PPP VALUE: {nd_n} COUNTRIES · {nd_bn:.2f} BN PEOPLE (NOT RANKED)</text>',
            f'<text x="96" y="816" fill="#fff" {MONO} font-size="11">OBSERVED · WORLD BANK WDI · 1 SEED = 1 MILLION PEOPLE · HIGHEST INCOME AT THE CORE</text>',
            legend(820, 812, "CONSTANT 2021 INTL $ PER PERSON (PPP)"),
            nav(None),
            f'<text x="1408" y="884" fill="#fff" fill-opacity=".5" {MONO} font-size="11" text-anchor="end">SKETCH · WDI {meta["vintage"]["wdi_lastupdated"]}</text>']
    (OUT / "seed-s00-d.svg").write_text(svg("\n".join(body)))
    return n, R


def s00_m():
    yr = facts["gdppc_ppp_latest_year"]["value"]
    disc, n, R, rows = mosaic(yr, 195, 270, 5.7, label_min=250e6)
    body = [disc,
            '<defs><linearGradient id="scrimm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/>'
            '<stop offset=".2" stop-color="#000" stop-opacity=".88"/><stop offset=".85" stop-color="#000" stop-opacity=".88"/>'
            '<stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>',
            '<rect x="0" y="480" width="390" height="250" fill="url(#scrimm)"/>',
            f'<text x="16" y="572" fill="#fff" {SERIF} font-size="40">The world, explained</text>',
            f'<text x="16" y="616" fill="#fff" {SERIF} font-size="40">through economic</text>',
            f'<text x="16" y="660" fill="#fff" {SERIF} font-size="40">forces.</text>',
            f'<text x="16" y="28" fill="#fff" {MONO} font-size="11">ECONOMIC ATLAS</text>',
            f'<text x="374" y="28" fill="#fff" {MONO} font-size="11" text-anchor="end">{yr} · 1 SEED = 1M PEOPLE</text>',
            f'<text x="16" y="694" fill="#fff" {MONO} font-size="10">OBSERVED · WDI · HIGHEST INCOME AT THE CORE</text>',
            '<rect x="115" y="796" width="160" height="32" fill="#fff"/>',
            f'<text x="195" y="817" fill="#000" {MONO} font-size="12" text-anchor="middle">= MENU</text>']
    (OUT / "seed-s00-m.svg").write_text(svg("\n".join(body), 390, 844))


def s03b_d():
    """S03b WEIGHT, step 4: PEOPLE count, China and India set aside (hollow)."""
    yr = facts["gdppc_ppp_latest_year"]["value"]
    disc, n, R, rows = mosaic(yr, 1010, 450, 3.8, hollow=("CHN", "IND"), label_min=200e6)
    f = lambda k: facts[k]["value"]
    body = [disc,
            f'<text x="96" y="130" fill="#fff" {SERIF} font-size="64">Count people,</text>',
            f'<text x="96" y="194" fill="#fff" {SERIF} font-size="64">not countries.</text>',
            f'<text x="96" y="250" fill="#fff" fill-opacity=".5" {MONO} font-size="13">WEIGHT · GDP PER CAPITA, PPP (CONSTANT 2021 INTL $) · 1990 TO {yr}</text>',
            f'<rect x="96" y="290" width="112" height="28" fill="rgba(242,242,242,.1)"/><text x="108" y="309" fill="#fff" {MONO} font-size="12">COUNTRIES</text>',
            f'<rect x="208" y="290" width="88" height="28" fill="#690de2"/><text x="222" y="309" fill="#fff" {MONO} font-size="12">PEOPLE</text>',
            f'<rect x="312" y="290" width="216" height="28" fill="#690de2"/><text x="324" y="309" fill="#fff" {MONO} font-size="12">CHINA + INDIA SET ASIDE</text>',
            f'<text x="96" y="380" fill="#fff" fill-opacity=".5" {MONO} font-size="13">SPREAD OF LN INCOME (SD), 1990 → {yr}</text>',
            f'<text x="96" y="410" fill="#fff" {MONO} font-size="20">COUNTRIES {f("sigma_ppp_1990"):.2f} → {f("sigma_ppp_latest"):.2f}</text>',
            f'<text x="96" y="440" fill="#fff" {MONO} font-size="20">PEOPLE    {f("sigma_ppp_popweighted_1990"):.2f} → {f("sigma_ppp_popweighted_latest"):.2f}</text>',
            f'<text x="96" y="500" fill="#fff" fill-opacity=".5" {MONO} font-size="13">CATCH-UP SLOPE 1990 → {yr}, PEOPLE-WEIGHTED</text>',
            f'<text x="96" y="530" fill="#fff" {MONO} font-size="20">ALL {f("beta_ppp_1990_popweighted"):.2f} · SET ASIDE {f("beta_ppp_1990_popweighted_ex_chn_ind"):.2f}</text>',
            f'<text x="96" y="556" fill="#fff" fill-opacity=".5" {MONO} font-size="13">PP PER YEAR PER LN UNIT · CHINA + INDIA = {f("beta_ppp_1990_popweighted_chn_ind_weight_pct"):.1f}% OF 1990 WEIGHT</text>',
            legend(96, 640, "CONSTANT 2021 INTL $ PER PERSON (PPP)"),
            f'<text x="96" y="760" fill="#fff" {MONO} font-size="11">DERIVED · WORLD BANK WDI · HOLLOW = SET ASIDE, STILL COUNTED IN THE DISC AREA</text>',
            f'<text x="96" y="778" fill="#fff" fill-opacity=".5" {MONO} font-size="11">DESCRIPTIVE. NOT CAUSAL.</text>',
            nav("WEIGHT"),
            f'<text x="1408" y="884" fill="#fff" fill-opacity=".5" {MONO} font-size="11" text-anchor="end">SKETCH</text>']
    (OUT / "seed-s03b-d.svg").write_text(svg("\n".join(body)))


def p03_orb():
    """P03 G0 reconstructed from P03 VISUAL_DESIGN 3.3 (no P03 frames exist yet): flat concentric Solar glow, c (720, 450), r 560."""
    body = ('<defs><radialGradient id="sol" cx="720" cy="450" r="560" gradientUnits="userSpaceOnUse">'
            '<stop offset="0" stop-color="#fff3a6"/><stop offset=".38" stop-color="#ffc23d"/><stop offset=".66" stop-color="#ff7a1f"/>'
            '<stop offset="1" stop-color="#ff4c25"/></radialGradient></defs><circle cx="720" cy="450" r="560" fill="url(#sol)"/>'
            f'<text x="720" y="880" fill="#fff" {MONO} font-size="13" text-anchor="middle">RECONSTRUCTION FROM P03 SPEC 3.3 G0 (NOT A P03 FRAME)</text>')
    (OUT / "p03-g0-reconstruction.svg").write_text(svg(body))


if __name__ == "__main__":
    n, R = s00_d()
    print(f"S00 D: {n} slots, disc radius {R:.0f}px (diameter {2 * R / 900:.2f} x frame height)")
    s00_m()
    print("S00 M: disc radius 510px at c (195, 270): bottom edge arc y 741-780, above the MENU pill (y 796)")
    s03b_d()
    p03_orb()
    print("wrote", sorted(p.name for p in OUT.glob("*.svg")))
