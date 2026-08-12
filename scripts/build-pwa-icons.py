"""
build-pwa-icons.py — Gera PNGs do logo oficial SIGO a partir do SVG vetorial.

Logo oficial: fundo navy #33495C com cantos arredondados + dois cursores
brancos entrelaçados. 100% flat, fiel ao Design System V2 Minimalista.

Gera:
  - public/favicon.ico (multi-size 16/32/48)
  - public/icons/favicon-16.png
  - public/icons/favicon-32.png
  - public/icons/apple-touch-icon.png (180x180, iOS)
  - public/icons/icon-192.png (PWA)
  - public/icons/icon-512.png (PWA)
  - public/icons/icon-512-maskable.png (PWA, com safe zone de 10%)

Uso: python3 scripts/build-pwa-icons.py
"""
import sys
from pathlib import Path
from io import BytesIO

try:
    import cairosvg
    HAS_CAIRO = True
except ImportError:
    HAS_CAIRO = False

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
ICONS_DIR = REPO / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

# SVG template — viewBox 64x64, fundo navy + símbolo de dois cursores entrelaçados.
# O símbolo é composto por:
#   • Cursor 1 (top-left): cabeça arredondada apontando para a DIREITA + haste descendo
#   • Cursor 2 (bottom-right): cabeça arredondada apontando para a ESQUERDA + haste subindo
#   • Os dois se cruzam no centro formando um padrão de entrelaçamento
SVG_TEMPLATE = '''<svg width="{size}" height="{size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo navy com cantos arredondados -->
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="#33495C"/>

  <!-- Símbolo: dois cursores entrelaçados -->
  <g fill="#FFFFFF">
    <!-- Cursor 1 (superior-esquerdo, aponta para a DIREITA) -->
    <rect x="15" y="24" width="9" height="30" rx="4.5" ry="4.5" transform="rotate(-20 19.5 39)"/>
    <path d="M 18 8 C 16 6.5 13 8 13 10.5 L 13 28.5 C 13 31 16 32.5 18 31 L 33 24 C 35.5 22.7 35.5 19.3 33 18 Z"/>

    <!-- Cursor 2 (inferior-direito, aponta para a ESQUERDA) — espelhado -->
    <rect x="40" y="10" width="9" height="30" rx="4.5" ry="4.5" transform="rotate(-20 44.5 25)"/>
    <path d="M 46 56 C 48 57.5 51 56 51 53.5 L 51 35.5 C 51 33 48 31.5 46 33 L 31 40 C 28.5 41.3 28.5 44.7 31 46 Z"/>
  </g>
</svg>'''


def render_svg_to_png(svg_str: str, size: int) -> "Image.Image":
    """Renderiza SVG para PNG. Usa cairosvg se disponível (melhor qualidade),
    senão fallback com Pillow."""
    if HAS_CAIRO:
        png_bytes = cairosvg.svg2png(
            bytestring=svg_str.encode("utf-8"),
            output_width=size,
            output_height=size,
        )
        return Image.open(BytesIO(png_bytes)).convert("RGBA")
    return _render_pillow_fallback(svg_str, size)


def _render_pillow_fallback(svg_str: str, size: int) -> "Image.Image":
    """Fallback Pillow: renderiza logo simplificado quando cairosvg não está disponível."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fundo rounded com navy
    radius = max(2, int(size * 0.22))
    draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=(51, 73, 92, 255))

    # Cursor 1 (cabeça arredondada + haste) — superior-esquerdo
    head1_x = int(size * 13 / 64)
    head1_y_top = int(size * 7 / 64)
    head1_y_bot = int(size * 31 / 64)
    head1_right = int(size * 35 / 64)
    # cabeça (triângulo arredondado)
    draw.polygon([
        (head1_x, head1_y_top),
        (head1_x, head1_y_bot),
        (head1_right, (head1_y_top + head1_y_bot) // 2),
    ], fill=(255, 255, 255, 255))
    # haste
    h1_x = int(size * 18 / 64)
    h1_top = int(size * 28 / 64)
    h1_bot = int(size * 50 / 64)
    h1_w = int(size * 7 / 64)
    draw.rounded_rectangle(
        [(h1_x, h1_top), (h1_x + h1_w, h1_bot)],
        radius=h1_w // 2,
        fill=(255, 255, 255, 255),
    )

    # Cursor 2 (espelhado) — inferior-direito
    head2_x = int(size * 51 / 64)
    head2_y_top = int(size * 33 / 64)
    head2_y_bot = int(size * 57 / 64)
    head2_left = int(size * 29 / 64)
    draw.polygon([
        (head2_x, head2_y_top),
        (head2_x, head2_y_bot),
        (head2_left, (head2_y_top + head2_y_bot) // 2),
    ], fill=(255, 255, 255, 255))
    # haste
    h2_x = int(size * 40 / 64)
    h2_top = int(size * 14 / 64)
    h2_bot = int(size * 36 / 64)
    h2_w = int(size * 7 / 64)
    draw.rounded_rectangle(
        [(h2_x, h2_top), (h2_x + h2_w, h2_bot)],
        radius=h2_w // 2,
        fill=(255, 255, 255, 255),
    )

    return img


def add_safe_zone(img: "Image.Image", maskable: bool = False) -> "Image.Image":
    """Para maskable icons, adiciona safe zone de 20% nas bordas."""
    if not maskable:
        return img
    w, h = img.size
    pad = int(w * 0.10)
    bg = Image.new("RGBA", (w, h), (51, 73, 92, 255))
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
        # Super-sample 4x para nitidez
        svg = SVG_TEMPLATE.format(size=size * 4)
        img = render_svg_to_png(svg, size * 4)
        img = img.resize((size, size), Image.LANCZOS)
        img = add_safe_zone(img, maskable=maskable)
        out = ICONS_DIR / fname
        img.save(out, "PNG", optimize=True)
        print(f"  wrote {out} ({size}x{size}{', maskable' if maskable else ''})")

    # favicon.ico (multi-size)
    svg = SVG_TEMPLATE.format(size=128)
    img = render_svg_to_png(svg, 128)
    img = img.resize((32, 32), Image.LANCZOS)
    out = REPO / "public" / "favicon.ico"
    img.save(out, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  wrote {out} (multi-size ICO)")

    print("Done.")


if __name__ == "__main__":
    main()
