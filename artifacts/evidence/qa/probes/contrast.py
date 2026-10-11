"""P05-QA-001 L16: pixel-sampled contrast. For each text-hidden screenshot from lessons.mjs, take the p95-luminance
background pixel inside each small-text box and compute WCAG contrast of the element's computed colour (alpha and
ancestor opacity composited over that pixel). Reports boxes under 4.5:1.
Usage: python3 contrast.py <lessons/contrast dir> > contrast.txt"""
import json, os, re, sys
from PIL import Image
root = sys.argv[1]
lin = lambda c: (c / 255) / 12.92 if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4
L = lambda p: 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
fails, total = [], 0
for f in sorted(os.listdir(root)):
    if not f.endswith(".json"): continue
    im = Image.open(os.path.join(root, f[:-5] + ".png")).convert("RGB")
    for b in json.load(open(os.path.join(root, f))):
        m = re.findall(r"[\d.]+", b["color"]); r, g, bl = map(float, m[:3]); a = (float(m[3]) if len(m) > 3 else 1.0) * b["op"]
        px = [im.getpixel((x, y)) for y in range(int(b["y"]), int(b["y"] + b["h"]), 2) for x in range(int(b["x"]), int(b["x"] + b["w"]), 2)
              if 0 <= x < im.width and 0 <= y < im.height]
        if not px or a < 0.05: continue
        total += 1
        px.sort(key=L); bg = px[int(len(px) * 0.95)]
        fg = tuple(a * c + (1 - a) * k for c, k in zip((r, g, bl), bg))
        lb, lf = L(bg), L(fg); ratio = (max(lb, lf) + 0.05) / (min(lb, lf) + 0.05)
        if ratio < 4.5: fails.append(f"{ratio:4.2f}:1  {f[:-5]}  '{b['t'][:40]}'  fs {b['fs']}  bg p95 rgb{bg}")
print(f"{len(fails)} of {total} small-text boxes under 4.5:1")
print("\n".join(fails))
