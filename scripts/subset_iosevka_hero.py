# Brique 11 — subsetting des Iosevka Extended pour le nombre héro.
# Usage : python scripts/subset_iosevka_hero.py <dir-des-TTF-complets>
#
# Charset héro : chiffres 0-9, $ ' + - . , % espace, et U+2212 (signe
# moins typographique rendu par fmtPctSignedDeCH / fmtUsdSignedDeCH).
# Features layout : tnum,zero conservées si présentes dans la source.
import sys
import os
import io
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

HERO_CHARS = " $%'+,-.0123456789−"
OUT_DIR = os.path.join('public', 'fonts', 'iosevka-extended')
FILES = ['Iosevka-Extended', 'Iosevka-ExtendedBold']


def list_features(font):
    feats = set()
    for tbl in ('GSUB', 'GPOS'):
        if tbl in font:
            t = font[tbl].table
            if t.FeatureList:
                feats |= {fr.FeatureTag for fr in t.FeatureList.FeatureRecord}
    return feats


def woff2_size(font):
    font.flavor = 'woff2'
    buf = io.BytesIO()
    font.save(buf)
    return len(buf.getvalue())


def main(src_dir):
    for base in FILES:
        src = os.path.join(src_dir, base + '.ttf')
        font = TTFont(src)
        feats = list_features(font)
        wanted = [f for f in ('tnum', 'zero') if f in feats]
        full_w2 = woff2_size(TTFont(src))

        opts = Options()
        opts.flavor = 'woff2'
        if wanted:
            opts.layout_features = wanted
        subsetter = Subsetter(options=opts)
        subsetter.populate(text=HERO_CHARS)
        subsetter.subset(font)

        out = os.path.join(OUT_DIR, base + '.woff2')
        font.save(out)
        sub_size = os.path.getsize(out)

        kept = TTFont(out)
        cmap = sorted(kept.getBestCmap())
        print(f'{base}:')
        print(f'  features source tnum/zero : {wanted or "absentes"}')
        print(f'  full TTF  : {os.path.getsize(src):>9,} o')
        print(f'  full woff2: {full_w2:>9,} o')
        print(f'  subset    : {sub_size:>9,} o  ({kept["maxp"].numGlyphs} glyphes)')
        print('  cmap      : ' + ' '.join(f'U+{c:04X}' for c in cmap))


if __name__ == '__main__':
    main(sys.argv[1])
