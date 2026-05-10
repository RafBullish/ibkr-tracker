// ═══════════════════════════════════════════════════════════════
//  OPTIONS CHAIN TABLE v3.0 « Midnight Terminal »
//
//  T-layout options chain per brief §12.10 :
//    Calls (6 cols left) | Strike (center) | Puts (6 cols right)
//
//  Columns, symmetrical:
//    Calls  : Bid · Ask · Δ · ν · Θ · IV
//    Center : Strike (mono, bold)
//    Puts   : IV · Θ · ν · Δ · Bid · Ask
//
//  Features:
//   - ITM/OTM tints (profit-subtle on ITM calls, loss-subtle on ITM puts)
//   - Sniper OTM zone highlight — rows matching (|Δ| 0.25-0.35 for calls,
//     |Δ| 0.25-0.35 for puts; OI > 500; spread < 15%) get a left border
//     profit (calls) or right border loss (puts) and a subtle bg tint
//   - Volume bars overlay: tiny horizontal bars right of each side,
//     length proportional to volume within the visible strike range
//   - Click row → onRowClick(type, strike, contract) for trade preset
//   - Mobile (< 768): two tabs (Calls / Puts) instead of T layout
//
//  Data shape (per contract): { strike, bid, ask, delta, gamma, theta,
//    vega, iv, volume, openInterest, isItm }
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import InfoTooltip from '../ui/InfoTooltip';
import EmptyState from '../ui/EmptyState';
import useMediaQuery from '../../hooks/useMediaQuery';
import { Layers } from 'lucide-react';

const SNIPER_OTM_TOOLTIP = {
  title: 'Zone Sniper OTM',
  body: 'Contrats qualifiant pour la stratégie Sniper OTM : Delta absolu entre 0.25 et 0.35, Open Interest > 500, spread bid-ask relatif < 15%, mid-price entre $3 et $6.',
  formula: '|Δ| ∈ [0.25, 0.35] · OI > 500 · spread/mid < 15%',
};

function isSniperOtm(c, side) {
  if (!c) return false;
  const delta = Number(c.delta);
  const oi = Number(c.openInterest) || 0;
  const bid = Number(c.bid) || 0;
  const ask = Number(c.ask) || 0;
  if (!isFinite(delta)) return false;
  const mid = (bid + ask) / 2;
  const spread = mid > 0 ? (ask - bid) / mid : 1;
  // Calls look for 0.25..0.35; puts look for -0.35..-0.25
  const deltaOk =
    side === 'call' ? delta >= 0.25 && delta <= 0.35 : delta <= -0.25 && delta >= -0.35;
  return deltaOk && oi > 500 && spread < 0.15 && mid >= 2 && mid <= 8;
}

function fmtNum(v, digits = 2) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function fmtPct(v) {
  if (v == null || !isFinite(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
function fmtVol(v) {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function ChainCell({ contract, fieldKey, align = 'right', tone }) {
  if (!contract) return <span className="options-chain__empty">—</span>;
  const dead = contract._dead;
  const isBidAsk = fieldKey === 'bid' || fieldKey === 'ask';
  if (dead && !isBidAsk) {
    return (
      <span
        className="options-chain__cell mono"
        style={{ textAlign: align, color: 'var(--text-tertiary)' }}
      >
        —
      </span>
    );
  }
  const v = contract[fieldKey];
  let text;
  switch (fieldKey) {
    case 'bid':
    case 'ask':
      text = v != null ? `$${fmtNum(v)}` : '—';
      break;
    case 'delta':
      text = fmtNum(v);
      break;
    case 'gamma':
      text = fmtNum(v, 3);
      break;
    case 'theta':
      text = fmtNum(v, 3);
      break;
    case 'vega':
      text = fmtNum(v, 3);
      break;
    case 'iv':
      text = fmtPct(v);
      break;
    default:
      text = v ?? '—';
  }
  const color = dead
    ? 'var(--text-tertiary)'
    : tone === 'profit'
      ? 'var(--profit-text)'
      : tone === 'loss'
        ? 'var(--loss-text)'
        : 'var(--text-secondary)';
  return (
    <span className="options-chain__cell mono" style={{ textAlign: align, color }}>
      {text}
    </span>
  );
}

function VolumeBar({ volume, maxVolume, side }) {
  if (!volume || !maxVolume) return null;
  const ratio = Math.min(1, volume / maxVolume);
  return (
    <div
      className="options-chain__vol-bar"
      data-side={side}
      style={{ '--bar-width': `${ratio * 100}%` }}
      aria-label={`Volume ${fmtVol(volume)}`}
      title={`Volume ${fmtVol(volume)}`}
    />
  );
}

function ChainRow({ call, put, strike, spot, maxVolume, onRowClick }) {
  const callItm = spot != null && strike < spot;
  const putItm = spot != null && strike > spot;
  const callSniper = isSniperOtm(call, 'call');
  const putSniper = isSniperOtm(put, 'put');

  const isSpot = spot != null && Math.abs(strike - spot) < 0.01;

  return (
    <tr className="options-chain__row" data-spot-row={isSpot || undefined}>
      {/* Calls side (left) — 6 cols */}
      <td
        className="options-chain__call"
        data-itm={callItm || undefined}
        data-sniper={callSniper || undefined}
        onClick={() => call && onRowClick?.('call', strike, call)}
      >
        <div className="options-chain__side-row">
          <VolumeBar volume={call?.volume} maxVolume={maxVolume} side="call" />
          <ChainCell contract={call} fieldKey="bid" />
          <ChainCell contract={call} fieldKey="ask" />
          <ChainCell contract={call} fieldKey="delta" tone="profit" />
          <ChainCell contract={call} fieldKey="vega" />
          <ChainCell contract={call} fieldKey="theta" tone="loss" />
          <ChainCell contract={call} fieldKey="iv" />
        </div>
      </td>

      {/* Strike center */}
      <td className="options-chain__strike">
        <span className="mono options-chain__strike-value" data-spot={isSpot || undefined}>
          {fmtNum(strike, strike % 1 === 0 ? 0 : 2)}
        </span>
      </td>

      {/* Puts side (right) — 6 cols */}
      <td
        className="options-chain__put"
        data-itm={putItm || undefined}
        data-sniper={putSniper || undefined}
        onClick={() => put && onRowClick?.('put', strike, put)}
      >
        <div className="options-chain__side-row options-chain__side-row--reverse">
          <ChainCell contract={put} fieldKey="iv" />
          <ChainCell contract={put} fieldKey="theta" tone="loss" />
          <ChainCell contract={put} fieldKey="vega" />
          <ChainCell contract={put} fieldKey="delta" tone="loss" />
          <ChainCell contract={put} fieldKey="bid" />
          <ChainCell contract={put} fieldKey="ask" />
          <VolumeBar volume={put?.volume} maxVolume={maxVolume} side="put" />
        </div>
      </td>
    </tr>
  );
}

// ── Mobile single-side view ──────────────────────────────────
function MobileSideView({ rows, side, spot, maxVolume: _maxVolume, onRowClick }) {
  return (
    <div className="options-chain-mobile__list">
      {rows.map((r, i) => {
        const c = side === 'call' ? r.call : r.put;
        const itm = spot != null && (side === 'call' ? r.strike < spot : r.strike > spot);
        const sniper = c ? isSniperOtm(c, side) : false;
        const isSpot = spot != null && Math.abs(r.strike - spot) < 0.01;
        return (
          <button
            key={i}
            type="button"
            className="options-chain-mobile__row"
            data-itm={itm || undefined}
            data-sniper={sniper || undefined}
            data-spot={isSpot || undefined}
            onClick={() => c && onRowClick?.(side, r.strike, c)}
          >
            <div className="options-chain-mobile__strike mono">{fmtNum(r.strike, 0)}</div>
            <div className="options-chain-mobile__detail">
              <div className="options-chain-mobile__row-line">
                <span className="uppercase-label">Bid/Ask</span>
                <span
                  className="mono"
                  style={c?._dead ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {c ? `$${fmtNum(c.bid)} / $${fmtNum(c.ask)}` : '—'}
                </span>
              </div>
              <div className="options-chain-mobile__row-line">
                <span className="uppercase-label">Δ · ν · Θ</span>
                <span
                  className="mono"
                  style={c?._dead ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {!c
                    ? '—'
                    : c._dead
                      ? '—'
                      : `${fmtNum(c.delta)} · ${fmtNum(c.vega, 3)} · ${fmtNum(c.theta, 3)}`}
                </span>
              </div>
              <div className="options-chain-mobile__row-line">
                <span className="uppercase-label">IV · Vol</span>
                <span
                  className="mono"
                  style={c?._dead ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {!c ? '—' : c._dead ? '—' : `${fmtPct(c.iv)} · ${fmtVol(c.volume)}`}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array<{strike:number, call?:Contract, put?:Contract}>} props.rows
 * @param {number}  [props.spot]      current spot price — used for ITM detection
 * @param {string}  [props.symbol]    underlying symbol (display)
 * @param {function} [props.onRowClick]  (side, strike, contract) => void
 */
export default function OptionsChainTable({ rows = [], spot, symbol, onRowClick, className }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobileTab, setMobileTab] = useState('call');

  const maxVolume = useMemo(() => {
    let m = 0;
    for (const r of rows) {
      if (r.call?.volume && r.call.volume > m) m = r.call.volume;
      if (r.put?.volume && r.put.volume > m) m = r.put.volume;
    }
    return m;
  }, [rows]);

  if (!rows.length) {
    return (
      <EmptyState
        size="compact"
        icon={Layers}
        title="Pas de chaîne chargée"
        description="Sélectionne un ticker et une date d'expiration pour voir les contrats disponibles."
      />
    );
  }

  if (isMobile) {
    return (
      <div className={['options-chain-mobile', className].filter(Boolean).join(' ')}>
        <div className="options-chain-mobile__head">
          {symbol && <span className="options-chain-mobile__symbol mono">{symbol}</span>}
          {spot != null && <span className="options-chain-mobile__spot mono">${fmtNum(spot)}</span>}
          <InfoTooltip content={SNIPER_OTM_TOOLTIP} size={12} />
        </div>
        <div className="options-chain-mobile__tabs" role="tablist">
          <button
            type="button"
            className="options-chain-mobile__tab"
            data-active={mobileTab === 'call' || undefined}
            onClick={() => setMobileTab('call')}
            aria-pressed={mobileTab === 'call'}
          >
            CALLS
          </button>
          <button
            type="button"
            className="options-chain-mobile__tab"
            data-active={mobileTab === 'put' || undefined}
            onClick={() => setMobileTab('put')}
            aria-pressed={mobileTab === 'put'}
          >
            PUTS
          </button>
        </div>
        <MobileSideView
          rows={rows}
          side={mobileTab}
          spot={spot}
          maxVolume={maxVolume}
          onRowClick={onRowClick}
        />
      </div>
    );
  }

  return (
    <div className={['options-chain', className].filter(Boolean).join(' ')}>
      <table
        className="options-chain__table"
        role="table"
        aria-label={`Chaîne d'options ${symbol || ''}`}
      >
        <thead>
          <tr>
            <th colSpan={1} className="options-chain__side-head" data-side="call">
              <span>CALLS</span>
              <InfoTooltip content={SNIPER_OTM_TOOLTIP} size={12} />
            </th>
            <th className="options-chain__strike-head">STRIKE</th>
            <th colSpan={1} className="options-chain__side-head" data-side="put">
              <span>PUTS</span>
              <InfoTooltip content={SNIPER_OTM_TOOLTIP} size={12} />
            </th>
          </tr>
          <tr className="options-chain__col-heads">
            <th>
              <div className="options-chain__side-row">
                <span className="options-chain__vol-head">VOL</span>
                <span>BID</span>
                <span>ASK</span>
                <span>Δ</span>
                <span>ν</span>
                <span>Θ</span>
                <span>IV</span>
              </div>
            </th>
            <th />
            <th>
              <div className="options-chain__side-row options-chain__side-row--reverse">
                <span>IV</span>
                <span>Θ</span>
                <span>ν</span>
                <span>Δ</span>
                <span>BID</span>
                <span>ASK</span>
                <span className="options-chain__vol-head">VOL</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <ChainRow
              key={i}
              call={r.call}
              put={r.put}
              strike={r.strike}
              spot={spot}
              maxVolume={maxVolume}
              onRowClick={onRowClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
