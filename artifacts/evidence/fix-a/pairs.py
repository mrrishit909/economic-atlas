"""P05-FIXA-001: before/after pairs for every frame QA_REPORT.md cites. Before = artifacts/evidence/qa/screenshots,
after = artifacts/evidence/fix-a/screenshots (same harness step names). Output: fix-a/before-after/<defect>__<vp>__<step>.jpg
Usage: python3 pairs.py (from anywhere)"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
QA = os.path.join(HERE, "..", "qa", "screenshots")
FX = os.path.join(HERE, "screenshots")
OUT = os.path.join(HERE, "before-after")
CITED = [
    ("D-001", "1440x900-reduced", "00-s00-end"), ("D-001", "390x844-reduced", "00-s00-end"),
    ("D-002", "1440x900", "s05-06-basis-t120"), ("D-002", "390x844", "s05-06-basis-t120"),
    ("D-003", "1440x900", "s02-01-card2"), ("D-003", "1440x900", "s02-03-card4"),
    ("D-005", "390x844-reduced", "s04-04-w1990"),
    ("D-006", "390x844", "s05-10-sheet-closed"),
    ("D-007", "390x844", "00-s00-end"), ("D-007", "390x844", "s03a-03-follow-nga"),
    ("D-008", "390x844", "atlas-00-default"), ("D-008", "390x844", "atlas-04-reflow-settled"),
    ("D-009", "1440x900", "atlas-04-reflow-settled"),
    ("D-010", "1440x900", "s07-00-ex1"), ("D-010", "390x844", "s07-00-ex1"),
    ("D-011", "1440x900", "00-s00-end"),
    ("D-013", "390x844", "s07-03-ex7"),
    ("D-014", "1440x900", "s04-02-flight-mid"),
    ("D-016", "1440x900", "s07-03-ex7"),
    ("D-017", "1440x900", "s05-04-live"),
    ("D-019", "390x844", "s06-00-kmeans"),
]
os.makedirs(OUT, exist_ok=True)
missing = []
for d, vp, step in CITED:
    a, b = os.path.join(QA, vp, step + ".jpg"), os.path.join(FX, vp, step + ".jpg")
    if not (os.path.exists(a) and os.path.exists(b)):
        missing.append(f"{d} {vp} {step} before={os.path.exists(a)} after={os.path.exists(b)}")
        continue
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    s = 700 / max(A.height, B.height)
    A = A.resize((int(A.width * s), int(A.height * s))); B = B.resize((int(B.width * s), int(B.height * s)))
    im = Image.new("RGB", (A.width + B.width + 30, max(A.height, B.height) + 30), "#222")
    im.paste(A, (0, 30)); im.paste(B, (A.width + 30, 30))
    g = ImageDraw.Draw(im)
    g.text((6, 8), f"{d} BEFORE (qa) {vp} {step}", fill="#fff"); g.text((A.width + 36, 8), "AFTER (fix-a)", fill="#fff")
    im.save(os.path.join(OUT, f"{d}__{vp}__{step}.jpg"), quality=72)
print("missing:", *missing, sep="\n  ") if missing else print("all pairs written")
