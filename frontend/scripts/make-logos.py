"""Prepare PolePole logo assets from the source artwork.

- Removes the white background via flood-fill from the image borders, which
  preserves interior white (the eye highlights) since they're not connected to
  the background.
- Auto-crops to the tortoise and pads to a square so no CSS cropping is needed.
- Emits specific, purpose-built files.
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public"))
SRC = os.path.join(OUT, "polepole-source.png")

SENTINEL = (255, 0, 255)  # a color not present in the artwork
THRESH = 55               # how close to the seed color counts as "background"

def load_no_bg(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    # Flood-fill the connected white background from all four corners.
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        px = im.getpixel(seed)
        if px[0] > 230 and px[1] > 230 and px[2] > 230:
            ImageDraw.floodfill(im, seed, SENTINEL, thresh=THRESH)
    # Build alpha: transparent where we painted the sentinel.
    rgba = im.convert("RGBA")
    datas = rgba.getdata()
    out = []
    for r, g, b, a in datas:
        if (r, g, b) == SENTINEL:
            out.append((255, 255, 255, 0))
        else:
            out.append((r, g, b, 255))
    rgba.putdata(out)
    return rgba

def square(im, pad_ratio=0.04):
    """Auto-crop to content, then pad to a centered transparent square."""
    bbox = im.getbbox()
    cropped = im.crop(bbox)
    cw, ch = cropped.size
    side = int(max(cw, ch) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    return canvas

def main():
    nobg = load_no_bg(SRC)

    # 1) Full transparent logo (uncropped, for social/share/reference).
    nobg.save(os.path.join(OUT, "polepole-logo.png"))

    # 2) Square tortoise mark — the glyph used throughout the UI.
    mark = square(nobg)
    mark.save(os.path.join(OUT, "polepole-mark.png"))

    # 3) Favicon (small square mark).
    fav = mark.resize((64, 64), Image.LANCZOS)
    fav.save(os.path.join(OUT, "favicon.png"))

    # 4) Apple touch / hi-res icon (App stores, PWA, OG avatar).
    icon = mark.resize((512, 512), Image.LANCZOS)
    icon.save(os.path.join(OUT, "polepole-icon-512.png"))

    print("source size:", Image.open(SRC).size)
    print("mark size:", mark.size)
    for f in ["polepole-logo.png", "polepole-mark.png", "favicon.png", "polepole-icon-512.png"]:
        p = os.path.join(OUT, f)
        print(f"  {f}: {os.path.getsize(p)} bytes")

if __name__ == "__main__":
    main()
