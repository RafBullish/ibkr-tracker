// ═══════════════════════════════════════════════════════════════
//  CALENDAR MINI — module Dashboard (row 4, col 7-12)
//
//  U8 : vue 7 jours condensée dérivée des MÊMES feeds que la page
//  Calendar (useCalendarFeeds → earnings + macro, déjà câblé) +
//  expirations des positions ouvertes. Aucun fetch nouveau. Chaque
//  ligne ouvre /insights/calendar (navigation pure). Empty state propre
//  quand la fenêtre 7 j est vide ; si l'API est absente/HS, earnings &
//  macro reviennent vides (dégradé propre) mais les expirations des
//  positions restent affichées (source locale).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useOpenPositions } from '../../store/useStore';

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];
const TYPE_LABEL = { earn: 'Résultats', macro: 'Macro', exp: 'Expiration' };

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR_SHORT[d.getMonth()]}`;
}

export default function CalendarMini({ area = 'calendar' }) {
  const navigate = useNavigate();
  const openPositions = useOpenPositions();
  const now = new Date();
  const todayStr = isoDay(now);
  const limitDate = new Date(now);
  limitDate.setDate(limitDate.getDate() + 7);
  const limitStr = isoDay(limitDate);

  // Earnings filtrés sur les tickers détenus (mêmes que Calendar le fait).
  const myTickers = useMemo(
    () => [...new Set((openPositions || []).map((p) => p.tk).filter(Boolean))],
    [openPositions]
  );

  const { earnings, macro } = useCalendarFeeds({
    viewYear: now.getFullYear(),
    viewMonth: now.getMonth(),
    myTickers,
    minImpact: 'medium',
  });

  // Expirations des options ouvertes (source locale, toujours dispo offline).
  const expirations = useMemo(
    () =>
      (openPositions || [])
        .filter((p) => p.as === 'Option' && p.ex)
        .map((p) => ({
          date: String(p.ex).slice(0, 10),
          type: 'exp',
          label: `${p.tk} — Exp ${p.ty || ''}${p.st ? ' $' + p.st : ''}`.trim(),
        })),
    [openPositions]
  );

  const events = useMemo(() => {
    const all = [];
    (earnings || []).forEach((e) => {
      if (!e.date || !e.symbol) return;
      all.push({ date: e.date, type: 'earn', label: `${e.symbol} — Résultats` });
    });
    (macro || []).forEach((ev) => {
      if (!ev.time) return;
      all.push({ date: String(ev.time).slice(0, 10), type: 'macro', label: ev.event });
    });
    expirations.forEach((ev) => all.push(ev));

    return all
      .filter((e) => e.date >= todayStr && e.date <= limitStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [earnings, macro, expirations, todayStr, limitStr]);

  const isEmpty = events.length === 0;

  return (
    <section className="module" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Calendrier · 7 j</span>
        <span className="module-header__hint">{events.length} évt</span>
      </header>
      <div className="module-body earnings-cal__body">
        {isEmpty ? (
          <div className="earnings-cal__empty module-empty">
            <span className="module-empty__title">Aucun événement à venir</span>
            <span className="module-empty__sub">
              Fenêtre 7 jours · résultats, macro, expirations
            </span>
          </div>
        ) : (
          <table
            className="earnings-cal__table calmini__table"
            aria-label="Événements des 7 prochains jours"
          >
            <tbody>
              {events.map((ev, i) => (
                <tr
                  key={`${ev.date}-${ev.type}-${i}`}
                  className="earnings-cal__row"
                  onClick={() => navigate('/insights/calendar')}
                  title="Ouvrir le calendrier"
                >
                  <td className="calmini__date">{fmtShort(ev.date)}</td>
                  <td className="calmini__label">{ev.label}</td>
                  <td className="calmini__type">
                    <span className={`calmini__tag calmini__tag--${ev.type}`}>
                      {TYPE_LABEL[ev.type] || ev.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
