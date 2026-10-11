"""Contact sheets for an evidence folder (P03 pattern): python3 tests/contact-sheet.py ../artifacts/evidence/<run>
Writes sheet-<WxH>.png (all frames) and sheet-contact-<WxH>.png (240px-tall tiles, ENGINEERING_DECISIONS #17)."""
import os, re, sys
from PIL import Image, ImageDraw
root = sys.argv[1]
for vp in sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and re.fullmatch(r"\d+x\d+", d)):
    w0, h0 = map(int, vp.split("x"))
    files = sorted(f for f in os.listdir(os.path.join(root, vp)) if f.endswith(".png"))
    if not files: continue
    for name, cols, scale in (("sheet", 6 if w0 < 800 else 4, None), ("sheet-contact", 6, 240 / h0)):
        sc = scale or (1800 / cols) / w0
        w, h = int(w0 * sc), int(h0 * sc)
        rows = (len(files) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (w + 6), rows * (h + 22)), (40, 40, 40))
        dr = ImageDraw.Draw(sheet)
        for i, f in enumerate(files):
            im = Image.open(os.path.join(root, vp, f)).convert("RGB").resize((w, h), Image.LANCZOS)
            x, y = (i % cols) * (w + 6), (i // cols) * (h + 22)
            sheet.paste(im, (x, y + 18)); dr.text((x + 2, y + 3), f[:40], fill=(255, 255, 0))
        sheet.save(os.path.join(root, f"{name}-{vp}.png"))
    print(vp, len(files))
