// ═══════════════════════════════════════════════════════════════
//  NumAnat — anatomie du chiffre financier (D1.2)  ·  composant PARTAGÉ
//
//  Enveloppe la devise « $ » et les séparateurs de milliers « ' » (de-CH,
//  ASCII ' ou typographique ’) dans des spans de mise en retrait, pour que
//  les CHIFFRES mènent. Le style vit dans canonical.css (.qc-anat*).
//
//  Tiers (pilotent l'échelle du $) :
//    · display (≥40px, héros)      → $ à 58 %, aligné hauteur de capitale
//    · mid     (18-39px, KPI)       → $ à 70 %
//    · dense   (<18px, tables)      → AUCUN retrait (lisibilité d'abord, spec
//                                      D1.2) : rendu brut, juste tabular-nums
//
//  Contrat : reçoit la CHAÎNE déjà formatée (par les formatters existants) —
//  ne reformate rien, ne touche ni au store ni au signe/à la couleur (portés
//  par le conteneur, cf. loi de couleur). Sur un montant coloré (P&L), $ et
//  séparateurs suivent la teinte via .qc-anat* { color: inherit }.
// ═══════════════════════════════════════════════════════════════

const IS_CUR = (ch) => ch === '$';
const IS_GRP = (ch) => ch === "'" || ch === '’'; // ' ou ’ (de-CH)

export default function NumAnat({ children, tier = 'mid', className = '' }) {
  const str = typeof children === 'string' ? children : String(children ?? '');

  // Tier dense : pas de découpage (spec — pas de $ réduit ni séparateurs mutés
  // sous 18px). On garde juste le conteneur tabular-nums.
  if (tier === 'dense') {
    return <span className={`qc-anat qc-anat--dense ${className}`.trim()}>{str}</span>;
  }

  const parts = [];
  let buf = '';
  const flush = () => {
    if (buf) {
      parts.push(buf);
      buf = '';
    }
  };
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (IS_CUR(ch)) {
      flush();
      parts.push(<span key={i} className="qc-anat__cur">{ch}</span>);
    } else if (IS_GRP(ch)) {
      flush();
      parts.push(<span key={i} className="qc-anat__grp">{ch}</span>);
    } else {
      buf += ch;
    }
  }
  flush();

  return <span className={`qc-anat qc-anat--${tier} ${className}`.trim()}>{parts}</span>;
}
