// ═══════════════════════════════════════════════════════════════
//  TRADE HISTORY — 4K refonte Phase C.2 / C.2.5 / C.2.6 (scale-up)
//
//  Table dense 12 colonnes (les 3 cols Edge / C-Tier / Exit Reason
//  ont été fusionnées en 1 col "Sniper" avec placeholder discret —
//  Phase C.2.6.2). Sorted desc by exit date. Header sticky avec
//  backdrop-blur + shadow, body scrollable, footer agrégé 6 cells
//  (Σ P&L · Win Rate · Avg Win · Avg Loss · Σ Comm · Best Day).
//
//  Phase C.2.5 :
//    - Sub-header (Σ Hold · Best Ticker · Worst Ticker + badge W/L)
//    - Footer 6e cell « BEST DAY » (meilleur jour P&L agrégé)
//    - Top 3 gains / pertes : background subtle via data-attr
//
//  Phase C.2.6 :
//    - Sub-header 4 contextes : Σ Hold · Best · Worst · Σ Window · PF
//    - Badge unique W/L → 2 badges séparés (WINS / LOSSES)
//    - Fusion Edge / C-Tier / Exit Reason → 1 col "Sniper"
//    - Typo & paddings bumpés (4K scale)
//
//  Phase C.2.7 (fix alignement + IBKR shape) :
//    - <colgroup> + table-layout: fixed → widths déterministes, plus
//      d'écarts headers vs cells selon contenu de chaque cell
//    - renderType() fix : IBKR stocke ty='CALL'/'PUT' (pas 'C'/'P')
//      et as='Action'/'Option' (pas 'STK'/'OPT'). Bug C.2.6.2 silent.
//    - Sniper placeholder enrichi (dot + "pending" pill)
//
//  Phase C.2.8 (pixel-perfect alignment) :
//    - Chaque th et chaque td porte explicitement
//      __th--left/--center/--right (et idem __td) → source unique
//      d'alignement. Header et cell partagent le même text-align.
//    - tabular-nums sur les cols numériques right-aligned.
//    - Sniper pill repassé en amber (sémantique "data live waiting").
//    - Padding 14 px latéraux uniformes (header/subheader/td/footer).
//
//  Phase C.2.9 (Bloomberg-pro) — 12 → 14 colonnes :
//    + DTE Entry (insertée après Strike) — dteAtEntry stocké lors de
//      la FIFO pair (cf. closedTrades.js:131).
//    + Spark P&L (insérée après P&L %) — mini-chart synthétique
//      J0→Jclose.
//
//  Phase C.2.10 — Spark P&L upgrade : mountain chart amplifié.
//    Random walk Park-Miller + bruit gaussien (somme 3 RNG) +
//    pondération fuseau (sin(t·π)) + cubic Bezier smooth + area
//    fill avec linearGradient (top opacity 0.35 → 0 bottom).
//    Signature visuelle unique par trade, endpoints exacts.
//
//  Phase C.2.10-V3 — DROP col Spark P&L. Random walk synthétique
//    sur trade FERMÉ = donnée inventée, aucune valeur trading.
//    14 → 13 cols. Col Sniper conservée (placeholder exit reason).
//    Composant TradeSparkline + constantes SPARK_* + CSS associé
//    supprimés (sparkline 7J reste utile sur LivePositions car
//    trades vivants = données qui bougent réellement).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { tradePnlUsd } from '../../utils/calculations';
// É3.3 — famille fmt CENTRALE (langue & formats) : dates dd.mm.yy,
// montants à milliers suisses, plus aucun toFixed local.
import { fmtDate, fmtStrike, fmtUsd2, fmtUsdSigned2, fmtUsdSigned0 } from '../../utils/format';

const RANGE_OPTIONS = [
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'ALL' },
];

// ─── Formatters (fins wrappers sur utils/format — É3.3) ─────────

const fmtHold = (di, doExit) => {
  if (!di || !doExit) return '—';
  const d1 = new Date(di);
  const d2 = new Date(doExit);
  if (!Number.isFinite(d1.getTime()) || !Number.isFinite(d2.getTime())) return '—';
  const days = Math.round((d2 - d1) / 86_400_000);
  return `${days} j`;
};

// IBKR stocke asset class en `'Action'` / `'Option'` (sections.js:74)
// — pas en `'STK'` / `'OPT'` comme documenté dans le brief Phase C.2.
// Garde aussi les sigles courts au cas où legacy data.
const isStockAsset = (asset) => asset === 'Action' || asset === 'STK';

const fmtStrikeCell = (val, asset) => (isStockAsset(asset) ? '—' : fmtStrike(val));

const fmtCommission = (val) => {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  return `−${fmtUsd2(Math.abs(n))}`;
};

const fmtPctSigned = (val) => {
  if (val == null || !Number.isFinite(val)) return '—';
  const sign = val >= 0 ? '+' : '−';
  return `${sign}${Math.abs(val).toFixed(1)}%`;
};

// IBKR stocke `ty` en `'CALL'` / `'PUT'` (sections.js:77/144) — pas en
// `'C'` / `'P'`. C'est ce mismatch qui faisait que la col Type
// affichait '—' partout. On accepte les deux formats par défense.
const renderType = (ty, asset) => {
  if (isStockAsset(asset)) {
    return <span className="trade-history__badge trade-history__badge--stock">STK</span>;
  }
  if (ty === 'CALL' || ty === 'C') {
    return <span className="trade-history__badge trade-history__badge--call">CALL</span>;
  }
  if (ty === 'PUT' || ty === 'P') {
    return <span className="trade-history__badge trade-history__badge--put">PUT</span>;
  }
  return '—';
};

// ─── Main component ─────────────────────────────────────────────

export default function TradeHistory({ data, liveRate, area = 'history' }) {
  const [range, setRange] = useState(15);

  // Enrich + sort desc by exit date.
  const enrichedTrades = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const rate = Number.isFinite(liveRate) ? liveRate : 1;
    return data
      .slice()
      .sort((a, b) => (b.do || '').localeCompare(a.do || ''))
      .map((t) => {
        const pnl = tradePnlUsd(t, rate);
        const entryPrice = parseFloat(t.pi) || 0;
        const qty = parseFloat(t.ct) || 0;
        const mul = parseFloat(t.mu) || 1;
        const cost = entryPrice * qty * mul;
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : null;
        const tone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'mute';
        return { ...t, _pnl: pnl, _pnlPct: pnlPct, _tone: tone };
      });
  }, [data, liveRate]);

  const visibleTrades = useMemo(() => {
    if (range === 'all') return enrichedTrades;
    return enrichedTrades.slice(0, range);
  }, [enrichedTrades, range]);

  // Phase C.2.5 — top 3 gains / pertes (basés sur la slice visible).
  const { topGainSet, topLossSet } = useMemo(() => {
    if (!visibleTrades.length) return { topGainSet: new Set(), topLossSet: new Set() };
    const byDesc = visibleTrades.slice().sort((a, b) => b._pnl - a._pnl);
    return {
      topGainSet: new Set(byDesc.slice(0, 3).filter((t) => t._pnl > 0)),
      topLossSet: new Set(byDesc.slice(-3).filter((t) => t._pnl < 0)),
    };
  }, [visibleTrades]);

  const totalCount = data?.length || 0;
  const visibleCount = visibleTrades.length;

  const aggStats = useMemo(() => {
    if (!visibleTrades.length) {
      return {
        sum: 0,
        winRate: 0,
        wins: 0,
        losses: 0,
        avgWin: 0,
        avgLoss: 0,
        commission: 0,
        sumTone: 'mute',
      };
    }
    let sum = 0;
    let wins = 0;
    let losses = 0;
    let sumWins = 0;
    let sumLosses = 0;
    let commission = 0;
    for (const t of visibleTrades) {
      sum += t._pnl;
      commission += parseFloat(t.cm) || 0;
      if (t._pnl > 0) {
        wins++;
        sumWins += t._pnl;
      } else if (t._pnl < 0) {
        losses++;
        sumLosses += Math.abs(t._pnl);
      }
    }
    const decisive = wins + losses;
    return {
      sum,
      winRate: decisive > 0 ? (wins / decisive) * 100 : 0,
      wins,
      losses,
      avgWin: wins > 0 ? sumWins / wins : 0,
      avgLoss: losses > 0 ? sumLosses / losses : 0,
      commission,
      sumTone: sum > 0 ? 'profit' : sum < 0 ? 'loss' : 'mute',
    };
  }, [visibleTrades]);

  // Phase C.2.5 — avg holding days sur la slice visible.
  const avgHoldDays = useMemo(() => {
    if (!visibleTrades.length) return 0;
    let total = 0;
    let count = 0;
    for (const t of visibleTrades) {
      if (!t.di || !t.do) continue;
      const d1 = new Date(t.di);
      const d2 = new Date(t.do);
      if (!Number.isFinite(d1.getTime()) || !Number.isFinite(d2.getTime())) continue;
      total += Math.max(0, (d2 - d1) / 86_400_000);
      count++;
    }
    return count > 0 ? total / count : 0;
  }, [visibleTrades]);

  // Phase C.2.5 — best/worst single-trade ticker dans la slice visible.
  const { bestTicker, worstTicker } = useMemo(() => {
    if (!visibleTrades.length) return { bestTicker: '—', worstTicker: '—' };
    let best = visibleTrades[0];
    let worst = visibleTrades[0];
    for (const t of visibleTrades) {
      if (t._pnl > best._pnl) best = t;
      if (t._pnl < worst._pnl) worst = t;
    }
    return {
      bestTicker: best._pnl > 0 && best.tk ? best.tk : '—',
      worstTicker: worst._pnl < 0 && worst.tk ? worst.tk : '—',
    };
  }, [visibleTrades]);

  // Phase C.2.5 — best aggregated day (somme P&L groupée par t.do).
  const bestDay = useMemo(() => {
    if (!visibleTrades.length) return null;
    const byDay = new Map();
    for (const t of visibleTrades) {
      const day = t.do;
      if (!day) continue;
      byDay.set(day, (byDay.get(day) || 0) + t._pnl);
    }
    let best = null;
    for (const [day, pnl] of byDay) {
      if (!best || pnl > best.pnl) best = { day, pnl };
    }
    return best && best.pnl > 0 ? best : null;
  }, [visibleTrades]);

  // Phase C.2.6 — Window P&L sum + profit factor sur la slice visible.
  const windowPnl = useMemo(() => {
    if (!visibleTrades.length) return { sum: 0, pf: null };
    let sum = 0;
    let wins = 0;
    let losses = 0;
    for (const t of visibleTrades) {
      sum += t._pnl;
      if (t._pnl > 0) wins += t._pnl;
      else if (t._pnl < 0) losses += Math.abs(t._pnl);
    }
    return {
      sum,
      pf: losses > 0 ? wins / losses : wins > 0 ? Infinity : null,
    };
  }, [visibleTrades]);

  const windowSumTone =
    windowPnl.sum > 0 ? 'profit' : windowPnl.sum < 0 ? 'loss' : 'mute';
  const windowPfTone =
    windowPnl.pf == null
      ? 'mute'
      : windowPnl.pf === Infinity || windowPnl.pf >= 1.5
        ? 'profit'
        : windowPnl.pf >= 1
          ? 'mute'
          : 'loss';
  const windowPfLabel =
    windowPnl.pf == null
      ? '—'
      : windowPnl.pf === Infinity
        ? '∞×'
        : `${windowPnl.pf.toFixed(2)}×`;

  const hasTrades = visibleCount > 0;

  return (
    <section className="trade-history" style={{ gridArea: area }}>
      <header className="trade-history__header">
        <div className="trade-history__title-wrap">
          {/* É3.3 — langue : une seule voix (règle des héros scellés). */}
          <span className="trade-history__title">Historique</span>
          <span className="trade-history__sub">
            {visibleCount} / {totalCount} trades
          </span>
        </div>
        <div className="trade-history__range-selector" role="tablist" aria-label="Range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={range === opt.value}
              data-active={range === opt.value || undefined}
              onClick={() => setRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* S1 (É4-a) — sous-en-tête gaté sur hasTrades (comme LivePositions) :
          plus de bande « Σ Durée 0.0 j · … · GAGNANTS 0 · PERDANTS 0 » au-dessus
          du « Aucun trade fermé » sur base vide. */}
      {hasTrades && (
      <div className="trade-history__subheader">
        <div className="trade-history__ctx">
          Σ Durée{' '}
          <span className="trade-history__ctx-val">{avgHoldDays.toFixed(1)} j</span>
        </div>
        <div className="trade-history__dot">·</div>
        <div className="trade-history__ctx">
          Meilleur ticker{' '}
          <span className="trade-history__ctx-val trade-history__ctx-val--profit">
            {bestTicker}
          </span>
        </div>
        <div className="trade-history__dot">·</div>
        <div className="trade-history__ctx">
          Pire ticker{' '}
          <span className="trade-history__ctx-val trade-history__ctx-val--loss">
            {worstTicker}
          </span>
        </div>
        <div className="trade-history__dot">·</div>
        <div className="trade-history__ctx">
          Σ Fenêtre{' '}
          <span
            className={`trade-history__ctx-val trade-history__ctx-val--${windowSumTone}`}
          >
            {fmtUsdSigned0(windowPnl.sum)}
          </span>
        </div>
        <div className="trade-history__dot">·</div>
        <div className="trade-history__ctx">
          PF Fenêtre{' '}
          <span
            className={`trade-history__ctx-val trade-history__ctx-val--${windowPfTone}`}
          >
            {windowPfLabel}
          </span>
        </div>
        <div className="trade-history__ctx-spacer" />
        <div className="trade-history__ctx-badge trade-history__ctx-badge--wins">
          GAGNANTS {aggStats.wins}
        </div>
        <div className="trade-history__ctx-badge trade-history__ctx-badge--losses">
          PERDANTS {aggStats.losses}
        </div>
      </div>
      )}

      {hasTrades ? (
        <div className="trade-history__body">
          <table className="trade-history__table">
            <colgroup>
              <col className="trade-history__col-ticker" />
              <col className="trade-history__col-type" />
              <col className="trade-history__col-strike" />
              <col className="trade-history__col-dteentry" />
              <col className="trade-history__col-entry" />
              <col className="trade-history__col-exit" />
              <col className="trade-history__col-hold" />
              <col className="trade-history__col-entrydol" />
              <col className="trade-history__col-exitdol" />
              <col className="trade-history__col-comm" />
              <col className="trade-history__col-pnl" />
              <col className="trade-history__col-pnlpct" />
              <col className="trade-history__col-sniper" />
            </colgroup>
            <thead>
              <tr>
                <th className="trade-history__th trade-history__th--left">Ticker</th>
                <th className="trade-history__th trade-history__th--center">Type</th>
                <th className="trade-history__th trade-history__th--right">Strike</th>
                <th className="trade-history__th trade-history__th--right">DTE entrée</th>
                <th className="trade-history__th trade-history__th--left">Entrée</th>
                <th className="trade-history__th trade-history__th--left">Sortie</th>
                <th className="trade-history__th trade-history__th--right">Durée</th>
                <th className="trade-history__th trade-history__th--right">Entrée $</th>
                <th className="trade-history__th trade-history__th--right">Sortie $</th>
                <th className="trade-history__th trade-history__th--right">Comm</th>
                <th className="trade-history__th trade-history__th--right trade-history__th--divider">
                  P&amp;L Net
                </th>
                <th className="trade-history__th trade-history__th--right">P&amp;L %</th>
                <th className="trade-history__th trade-history__th--center trade-history__th--divider">
                  Sniper
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((t, i) => {
                const isTopGain = topGainSet.has(t);
                const isTopLoss = topLossSet.has(t);
                const rowCls = [
                  'trade-history__tr',
                  t._tone === 'profit' ? 'trade-history__tr--profit' : '',
                  t._tone === 'loss' ? 'trade-history__tr--loss' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const rowKey = `${t.tk || '?'}-${t.di || '?'}-${t.do || '?'}-${i}`;
                return (
                  <tr
                    key={rowKey}
                    className={rowCls}
                    data-top-gain={isTopGain || undefined}
                    data-top-loss={isTopLoss || undefined}
                  >
                    <td className="trade-history__td trade-history__td--left trade-history__td--ticker">
                      {t.tk || '—'}
                    </td>
                    <td className="trade-history__td trade-history__td--center">
                      {renderType(t.ty, t.as)}
                    </td>
                    <td className="trade-history__td trade-history__td--right">
                      {fmtStrikeCell(t.st, t.as)}
                    </td>
                    <td className="trade-history__td trade-history__td--right">
                      {Number.isFinite(t.dteAtEntry) ? `${t.dteAtEntry} j` : '—'}
                    </td>
                    <td className="trade-history__td trade-history__td--left">{fmtDate(t.di)}</td>
                    <td className="trade-history__td trade-history__td--left">{fmtDate(t.do)}</td>
                    <td className="trade-history__td trade-history__td--right">
                      {fmtHold(t.di, t.do)}
                    </td>
                    <td className="trade-history__td trade-history__td--right">
                      {fmtUsd2(t.pi)}
                    </td>
                    <td className="trade-history__td trade-history__td--right">
                      {fmtUsd2(t.po)}
                    </td>
                    <td className="trade-history__td trade-history__td--right trade-history__td--mute">
                      {fmtCommission(t.cm)}
                    </td>
                    <td
                      className={`trade-history__td trade-history__td--right trade-history__td--divider trade-history__td--${t._tone}`}
                    >
                      {fmtUsdSigned2(t._pnl)}
                    </td>
                    <td
                      className={`trade-history__td trade-history__td--right trade-history__td--${t._tone}`}
                    >
                      {fmtPctSigned(t._pnlPct)}
                    </td>
                    <td className="trade-history__td trade-history__td--center trade-history__td--divider trade-history__td--sniper">
                      <span className="trade-history__sniper-placeholder">
                        <span className="trade-history__sniper-dot" aria-hidden="true" />
                        <span>pending</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trade-history__empty">
          <span className="trade-history__empty-label">Aucun trade fermé</span>
          <span className="trade-history__empty-sub">
            Les trades apparaîtront ici dès la première clôture
          </span>
        </div>
      )}

      {/* S1 (É4-a) — pied gaté sur hasTrades : plus de « Win Rate 0.0% (0/0) »
          (mensonge : le win-rate est indéfini à 0 trade, pas 0 %) ni de bande
          $0 sur base vide. Le corps montre déjà l'état « Aucun trade fermé ». */}
      {hasTrades && (
      <footer className="trade-history__footer">
        <div className="trade-history__footer-cell">
          <span className="trade-history__footer-label">Σ P&amp;L</span>
          <span
            className={`trade-history__footer-value trade-history__footer-value--${aggStats.sumTone}`}
          >
            {fmtUsdSigned2(aggStats.sum)}
          </span>
        </div>
        <div className="trade-history__footer-cell">
          <span className="trade-history__footer-label">Win Rate</span>
          <span className="trade-history__footer-value">
            {aggStats.winRate.toFixed(1)}% ({aggStats.wins}/{visibleCount})
          </span>
        </div>
        <div className="trade-history__footer-cell">
          <span className="trade-history__footer-label">Gain moy.</span>
          <span className="trade-history__footer-value trade-history__footer-value--profit">
            {fmtUsdSigned2(aggStats.avgWin)}
          </span>
        </div>
        <div className="trade-history__footer-cell">
          <span className="trade-history__footer-label">Perte moy.</span>
          <span className="trade-history__footer-value trade-history__footer-value--loss">
            {fmtUsdSigned2(-aggStats.avgLoss)}
          </span>
        </div>
        <div className="trade-history__footer-cell">
          <span className="trade-history__footer-label">Σ Comm</span>
          <span className="trade-history__footer-value trade-history__footer-value--mute">
            {fmtCommission(aggStats.commission)}
          </span>
        </div>
        {/* É3.1 (contrôle D) — audit : PAS de fuite de scope, le calcul
            consomme bien visibleTrades (fenêtre). Le title dit le scope
            et la date pour lever l'ambiguïté du constat 15.08. */}
        <div
          className="trade-history__footer-cell"
          title={`RÉAL · fenêtre affichée (${range === 'all' ? 'tous les trades' : `${range} derniers trades`}) — Σ P&L par date de sortie, puis max${bestDay ? ` · ${bestDay.day}` : ''}`}
        >
          <span className="trade-history__footer-label">Meilleur jour</span>
          <span className="trade-history__footer-value trade-history__footer-value--profit">
            {bestDay ? fmtUsdSigned2(bestDay.pnl) : '—'}
          </span>
        </div>
      </footer>
      )}
    </section>
  );
}
