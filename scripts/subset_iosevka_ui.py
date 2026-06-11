# Brique 15 — subsetting des Iosevka (largeur normale) pour l'UI globale.
# Usage : python scripts/subset_iosevka_ui.py <dir-des-TTF-complets>
#
# Trois graisses (400/500/700), subset latin élargi :
#   - Latin-1 complet U+0020-00FF (texte FR/EN, ×, ±, ·, espaces)
#   - Œœ, grec (Γ Δ Θ Σ β θ ν σ … — Greeks Center), ponctuation
#     typographique (– — ' ' " " • …), flèches, opérateurs (≈ ≠ ≤ ≥ ∞),
#     U+2212 (minus), ⌘ (CommandBar), ⚠ (cockpit), ▲ ▶ ▼ ★ ✓.
#   Les glyphes absents d'Iosevka (⏸ ⓘ ⭐) tombent sur le fallback.
# Features : liste restreinte ccmp/locl + `zero` (slashed-zero consommé
# par font-variant-numeric dans les CSS). PAS de liga/calt : les
# ligatures de code d'Iosevka (->, =>, ...) embarquent des dizaines de
# glyphes composés inutiles pour de l'affichage de données et
# brouilleraient les chaînes type "A -> B".
# Objectif : < 40 Ko par fichier.
import sys
import os
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options, parse_unicodes

UNICODES = (
    'U+0020-00FF,U+0152-0153,U+0391-03C9,U+2010-2030,'
    'U+2190-2194,U+21D2,U+2212,U+221E,U+2248,U+2260,U+2264-2265,'
    'U+2318,U+23F8,U+24D8,U+25B2,U+25B6,U+25BC,U+2605,U+26A0,U+2713'
)
OUT_DIR = os.path.join('public', 'fonts', 'iosevka')
FILES = [
    ('Iosevka-Regular', 'IosevkaQC-Regular'),
    ('Iosevka-Medium', 'IosevkaQC-Medium'),
    ('Iosevka-Bold', 'IosevkaQC-Bold'),
]


def main(src_dir):
    os.makedirs(OUT_DIR, exist_ok=True)
    for src_base, out_base in FILES:
        src = os.path.join(src_dir, src_base + '.ttf')
        font = TTFont(src)

        opts = Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['ccmp', 'locl', 'mark', 'mkmk', 'zero']
        subsetter = Subsetter(options=opts)
        subsetter.populate(unicodes=parse_unicodes(UNICODES))
        subsetter.subset(font)

        # IMPORTANT : Options.flavor ne s'applique que via save_font() de
        # pyftsubset — avec font.save() direct il faut poser font.flavor
        # soi-même, sinon on écrit un TTF brut que OTS (Chrome) rejette
        # (flag OVERLAP_SIMPLE bit 6 des glyphes accentués, réservé en
        # OpenType). Le woff2 réel encode ces bits via sa transformation
        # glyf et passe OTS proprement.
        font.flavor = 'woff2'

        out = os.path.join(OUT_DIR, out_base + '.woff2')
        font.save(out)
        kept = TTFont(out)
        print(
            f'{out_base}: {os.path.getsize(src):>9,} o TTF -> '
            f'{os.path.getsize(out):>7,} o woff2 ({kept["maxp"].numGlyphs} glyphes)'
        )


if __name__ == '__main__':
    main(sys.argv[1])
