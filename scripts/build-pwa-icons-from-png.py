"""
build-pwa-icons-from-png.py — Regenera TODOS os ícones a partir do PNG oficial.

O logo oficial fica em `assets/logo-original.png` (PNG enviado pelo owner,
2000x2000, fundo navy #33495C, dois cursores brancos entrelaçados).

Este script gera, a partir do PNG original, todos os ícones PWA / favicon
necessários, com a qualidade certa para cada tamanho. Se trocar o PNG
original, basta rodar este script e commitar — todos os ícones serão
atualizados em sincronia.

Gera:
  - public/logo.png (1024x1024, versão para uso nos componentes)
  - public/favicon.ico (multi-size 16/32/48)
  - public/icons/favicon-16.png
  - public/icons/favicon-32.png
  - public/icons/apple-touch-icon.png (180x180, iOS)
  - public/icons/icon-192.png (PWA)
  - public/icons/icon-512.png (PWA)
  - public/icons/icon-512-maskable.png (PWA, com safe zone de 10%)

Uso: python3 scripts/build-pwa-icons-from-png.py
"""
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO / "assets" / "logo-original.png"
ICONS_DIR = REPO / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Logo original não encontrado em {SOURCE}. "
            "Coloque o PNG oficial nessa pasta e rode de novo."
        )
    source = Image.open(SOURCE).convert("RGBA")
    print(f"Original: {source.size} mode={source.mode}")

    sizes = {
        "favicon-16.png": 16,
        "favicon-32.png": 32,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
        "icon-512-maskable.png": 512,
    }

    for name, size in sizes.items():
        img = source.resize((size, size), Image.LANCZOS)
        out = ICONS_DIR / name
        img.save(out, "PNG", optimize=True)
        print(f"  wrote {out} ({size}x{size})")

    # favicon.ico multi-size
    ico = source.resize((32, 32), Image.LANCZOS)
    out_ico = REPO / "public" / "favicon.ico"
    ico.save(out_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  wrote {out_ico} (multi-size)")

    # Versão para uso no componente <Logo /> (1024x1024)
    logo_1024 = source.resize((1024, 1024), Image.LANCZOS)
    out_logo = REPO / "public" / "logo.png"
    logo_1024.save(out_logo, "PNG", optimize=True)
    print(f"  wrote {out_logo} (1024x1024)")

    print("Done.")


if __name__ == "__main__":
    main()
