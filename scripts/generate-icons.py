"""
Generate EduVerify app icons (PWA, Apple touch icon, favicon).

    python-backend/venv/Scripts/python.exe scripts/generate-icons.py

Draws the brand mark (white shield with a check) on the brand teal, supersampled 4x for
smooth edges. Outputs to public/icons/ and app/favicon.ico.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEAL = (0, 83, 91, 255)       # --primary #00535b
WHITE = (255, 255, 255, 255)
SS = 4                        # supersampling factor


def _quad(p0, p1, p2, steps=24):
    """Points along a quadratic Bezier curve (excluding the start point)."""
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        out.append((x, y))
    return out


def shield_points(cx: float, cy: float, w: float, h: float):
    """Classic shield: gently arched top, straight upper sides, convex curves to the point."""
    top, bottom = cy - h / 2, cy + h / 2
    left, right = cx - w / 2, cx + w / 2
    shoulder = top + h * 0.10
    side_end = top + h * 0.45
    pts = [(left, shoulder)]
    pts += _quad((left, shoulder), (cx, top - h * 0.06), (right, shoulder))      # arched top
    pts.append((right, side_end))                                                 # right side
    pts += _quad((right, side_end), (right, bottom - h * 0.12), (cx, bottom))     # right curve
    pts += _quad((cx, bottom), (left, bottom - h * 0.12), (left, side_end))       # left curve
    return pts


def draw_icon(size: int, *, rounded: bool, mark_scale: float) -> Image.Image:
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=TEAL)
    else:
        d.rectangle([0, 0, S, S], fill=TEAL)  # full-bleed (maskable / Apple add their own mask)

    w, h = S * 0.46 * mark_scale, S * 0.54 * mark_scale
    cx, cy = S / 2, S / 2 + S * 0.01
    d.polygon(shield_points(cx, cy, w, h), fill=WHITE)

    # check mark cut out in teal
    stroke = max(2, int(w * 0.13))
    check = [(cx - w * 0.22, cy + h * 0.01), (cx - w * 0.05, cy + h * 0.17), (cx + w * 0.25, cy - h * 0.15)]
    d.line(check, fill=TEAL, width=stroke, joint='curve')
    r = stroke / 2
    for x, y in (check[0], check[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=TEAL)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = ROOT / 'public' / 'icons'
    out.mkdir(parents=True, exist_ok=True)
    draw_icon(192, rounded=True, mark_scale=1.0).save(out / 'icon-192.png')
    draw_icon(512, rounded=True, mark_scale=1.0).save(out / 'icon-512.png')
    # Maskable: full-bleed background, mark kept inside the 80% safe zone.
    draw_icon(512, rounded=False, mark_scale=0.78).save(out / 'maskable-512.png')
    draw_icon(180, rounded=False, mark_scale=0.9).save(out / 'apple-touch-icon.png')
    fav = draw_icon(256, rounded=True, mark_scale=1.05)
    fav.save(ROOT / 'app' / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('icons written to', out)


if __name__ == '__main__':
    main()
