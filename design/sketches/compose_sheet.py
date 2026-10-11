"""Composes distinctness-sheet.png at contact-sheet scale (ED #17: 240px-tall frames), 3 x 2:
P01 real frame | P02 real S00 frame (orb) | P03 G0 reconstruction from its spec
P04 S00 sketch | P05 S00 sketch (D) | P05 S03b sketch (D)
plus the P05 mobile S00 sketch in a narrow third row tile. Run: uv run --with pillow python design/sketches/compose_sheet.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).parent
PJ = HERE / "../../.."
tiles = [
    (PJ / "01-atlas-human-mobility/artifacts/evidence/stage-b3/1440x900/06-futures-a-busier.png", "P01 REAL FRAME: STROKED RING OF NODES"),
    (PJ / "02-market-microstructure-lab/artifacts/evidence/stage-a/1440x900/00-s00-t1250.png", "P02 REAL FRAME: ELECTRIC ORB, S00"),
    (HERE / "p03-g0-reconstruction.png", "P03 G0 SOLAR ORB (RECONSTRUCTED FROM SPEC)"),
    (PJ / "04-pulse-energy-grid/design/sketches/rose-s00-d.png", "P04 SKETCH: THE DAY ROSE, S00"),
    (HERE / "seed-s00-d.png", "P05 SKETCH: THE SEED HEAD, S00 (REAL WDI)"),
    (HERE / "seed-s03b-d.png", "P05 SKETCH: S03B WEIGHT (REAL WDI)"),
]
W, H, LAB = 384, 240, 18
sheet = Image.new("RGB", (3 * W + 4 * 8 + 244, 2 * (H + LAB) + 3 * 8), "#111")
d = ImageDraw.Draw(sheet)
for i, (p, label) in enumerate(tiles):
    x, y = 8 + (i % 3) * (W + 8), 8 + (i // 3) * (H + LAB + 8)
    sheet.paste(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), (x, y + LAB))
    d.text((x + 2, y + 3), label, fill="#fff")
m = Image.open(HERE / "seed-s00-m.png").convert("RGB")
mh = 2 * (H + LAB) - LAB + 8
mw = round(m.width * mh / m.height)
x = 8 + 3 * (W + 8)
sheet.paste(m.resize((mw, mh), Image.LANCZOS), (x, 8 + LAB))
d.text((x + 2, 11), "P05 S00 M", fill="#fff")
sheet.save(HERE / "distinctness-sheet.png")
print("sheet", sheet.size)
