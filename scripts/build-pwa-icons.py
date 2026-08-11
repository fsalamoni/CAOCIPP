"""
build-pwa-icons.py — Gera PNGs do logo SIGO a partir do SVG vetorial
para uso como PWA icons (192, 512, 512-maskable) e favicon.

Uso: python3 scripts/build-pwa-icons.py
"""
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parent.parent
ICONS_DIR = REPO / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

# SVG template (mesmo design do componente Logo.jsx)
SVG_TEMPLATE = '''<svg width="{size}" height="{size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="55%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="arrow" x1="20" y1="32" x2="48" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.75"/>
    </linearGradient>
    <radialGradient id="shine" cx="46" cy="18" r="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#bg)"/>
  <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#shine)"/>
  <line x1="14" y1="20" x2="14" y2="44" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.35" stroke-linecap="round"/>
  <circle cx="14" cy="20" r="1.6" fill="#ffffff" fill-opacity="0.55"/>
  <circle cx="14" cy="32" r="1.9" fill="#ffffff" fill-opacity="0.8"/>
  <circle cx="14" cy="44" r="2.2" fill="#ffffff" fill-opacity="1"/>
  <path d="M 24 22 L 46 32 L 24 42" stroke="url(#arrow)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''


def render_svg_to_png(svg_str: str, size: int) -> Image.Image:
    """Renderiza SVG string para PNG usando Pillow + cairosvg se disponível, fallback para rendering manual."""
    try:
        import cairosvg
        png_bytes = cairosvg.svg2png(bytestring=svg_str.encode("utf-8"), output_width=size, output_height=size)
        from io import BytesIO
        return Image.open(BytesIO(png_bytes)).convert("RGBA")
    except ImportError:
        # Fallback: render via Pillow com gradiente manual
        return render_manual(size)


def render_manual(size: int) -> Image.Image:
    """Renderiza o logo SEM cairosvg, usando Pillow puro. Resultado: logo simplificado
    (sem radial gradient exato, mas visualmente similar)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fundo rounded rect com gradiente (linear vertical)
    radius = max(2, int(size * 0.22))  # 14/64 = 0.22
    for y in range(size):
        t = y / max(1, size - 1)
        # gradient indigo (#4f46e5) → violet (#a855f7)
        r = int(79 + (168 - 79) * t)
        g = int(70 + (85 - 70) * t)
        b = int(229 + (247 - 229) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mascara para deixar rounded
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)

    draw = ImageDraw.Draw(out)

    # Brilho no canto superior direito (subtle white circle)
    glow_size = int(size * 0.7)
    glow = Image.new("RGBA", (glow_size, glow_size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(glow_size // 2, 0, -2):
        a = int(35 * (1 - r / (glow_size / 2)))
        if a < 1: continue
        gd.ellipse([(glow_size // 2 - r, glow_size // 2 - r),
                    (glow_size // 2 + r, glow_size // 2 + r)],
                   fill=(255, 255, 255, a))
    out.paste(glow, (int(size * 0.4), -int(size * 0.1)), glow)

    draw = ImageDraw.Draw(out)

    # Linha vertical (timeline)
    line_x = int(size * 14 / 64)
    line_top = int(size * 20 / 64)
    line_bottom = int(size * 44 / 64)
    draw.line([(line_x, line_top), (line_x, line_bottom)], fill=(255, 255, 255, 90), width=max(1, int(size * 1.5 / 64)))

    # 3 partículas
    for i, op in enumerate([140, 205, 255]):
        cy = line_top + (line_bottom - line_top) * i // 2
        r = int(size * (1.6 + i * 0.3) / 64)
        draw.ellipse([(line_x - r, cy - r), (line_x + r, cy + r)], fill=(255, 255, 255, op))

    # Seta principal
    sx_start = int(size * 24 / 64)
    sx_tip = int(size * 46 / 64)
    sy_top = int(size * 22 / 64)
    sy_tip = int(size * 32 / 64)
    sy_bot = int(size * 42 / 64)
    sw = max(2, int(size * 5 / 64))
    draw.line([(sx_start, sy_top), (sx_tip, sy_tip)], fill=(255, 255, 255, 245), width=sw)
    draw.line([(sx_tip, sy_tip), (sx_start, sy_bot)], fill=(255, 255, 255, 245), width=sw)

    return out


def add_safe_zone(img: Image.Image, maskable: bool = False) -> Image.Image:
    """Para maskable icons, adiciona safe zone de 20% nas bordas."""
    if not maskable:
        return img
    w, h = img.size
    pad = int(w * 0.10)  # 10% de cada lado = 20% safe zone total
    bg = Image.new("RGBA", (w, h), (124, 58, 237, 255))  # violet background
    # centraliza o logo
    inner = img.crop((0, 0, w - 2 * pad, h - 2 * pad))
    inner = inner.resize((w - 2 * pad, h - 2 * pad), Image.LANCZOS)
    bg.paste(inner, (pad, pad), inner)
    return bg


def main():
    sizes = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "icon-512-maskable.png": 512,
        "apple-touch-icon.png": 180,
        "favicon-32.png": 32,
        "favicon-16.png": 16,
    }

    for fname, size in sizes.items():
        maskable = "maskable" in fname
        svg = SVG_TEMPLATE.format(size=size * 4)  # super-sample 4x para nitidez
        img = render_svg_to_png(svg, size * 4)
        img = img.resize((size, size), Image.LANCZOS)
        img = add_safe_zone(img, maskable=maskable)
        out = ICONS_DIR / fname
        img.save(out, "PNG", optimize=True)
        print(f"  wrote {out} ({size}x{size}{', maskable' if maskable else ''})")

    # favicon.ico (32x32)
    svg = SVG_TEMPLATE.format(size=128)
    img = render_svg_to_png(svg, 128)
    img = img.resize((32, 32), Image.LANCZOS)
    out = REPO / "public" / "favicon.ico"
    img.save(out, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  wrote {out} (multi-size ICO)")

    print("Done.")


if __name__ == "__main__":
    main()
