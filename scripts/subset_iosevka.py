"""Subset Iosevka Extended Regular + Bold to hero charset only.

Charset: digits 0-9, $, +, -, − (U+2212), ', ., %, space.
Output: WOFF2 (brotli), tabular figures kept.
"""
import os
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

ROOT = Path(__file__).resolve().parents[1]
SRCDIR = ROOT / "scripts" / "iosevka-source"
DSTDIR = ROOT / "public" / "fonts" / "iosevka-extended"

CHARS = list("0123456789$+-'.% ") + ["−"]  # add minus sign
UNICODES = [ord(c) for c in CHARS]

PAIRS = [
    (SRCDIR / "Iosevka-Extended.woff2", DSTDIR / "Iosevka-Extended.woff2", "Regular"),
    (SRCDIR / "Iosevka-ExtendedBold.woff2", DSTDIR / "Iosevka-ExtendedBold.woff2", "Bold"),
]


def check_glyphs(font: TTFont, label: str) -> None:
    cmap = font.getBestCmap()
    missing = [hex(u) for u in UNICODES if u not in cmap]
    if missing:
        raise SystemExit(f"{label}: missing glyphs in source: {missing}")
    print(f"{label}: all {len(UNICODES)} glyphs present in source.")


def subset_one(src: Path, dst: Path, label: str) -> None:
    font = TTFont(str(src))
    check_glyphs(font, label)

    options = Options()
    options.flavor = "woff2"
    options.with_zopfli = False
    options.desubroutinize = False
    options.hinting = True
    # Keep tabular-figure feature for stable column width; drop ligatures.
    options.layout_features = ["tnum", "kern"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = False
    options.recommended_glyphs = False
    options.drop_tables = ["GPOS"]  # no positional features needed

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(str(dst))
    font.close()

    size = dst.stat().st_size
    print(f"{label} -> {dst.name}: {size:,} bytes ({size/1024:.1f} KB)")


def main() -> None:
    for src, dst, label in PAIRS:
        if not src.exists():
            raise SystemExit(f"Missing source: {src}")
        subset_one(src, dst, label)
    print("\nFinal listing:")
    for p in sorted(DSTDIR.iterdir()):
        print(f"  {p.name}: {p.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
