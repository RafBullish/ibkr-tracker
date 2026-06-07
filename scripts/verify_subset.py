"""Verify the subsetted woff2 files still contain every required glyph."""
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTDIR = ROOT / "public" / "fonts" / "iosevka-extended"

CHARS = list("0123456789$+-'.% ") + ["−"]

for name in ["Iosevka-Extended.woff2", "Iosevka-ExtendedBold.woff2"]:
    f = TTFont(str(FONTDIR / name))
    cmap = f.getBestCmap()
    missing = [c for c in CHARS if ord(c) not in cmap]
    print(f"{name}: glyphs={len(cmap)}, missing={missing if missing else 'NONE'}")
    f.close()
