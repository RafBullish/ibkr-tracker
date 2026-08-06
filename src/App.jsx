import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LazyMotion, domAnimation } from 'framer-motion';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useFxAutoRefresh } from './hooks/useFxAutoRefresh';
import { useFxLiveSync } from './hooks/useFxLiveSync';
import FxStaleBanner from './components/fx/FxStaleBanner';
import FxInvalidBanner from './components/fx/FxInvalidBanner';
// É4 §5.2 — Dashboard EAGER (page reine, landing) ; TOUTES les autres
// routes en lazy (même mécanique que Chain/Greeks/Analytics depuis
// l'origine : ErrorBoundary + Suspense route-loader). Le chunk index
// ne porte plus que le shell + le Dashboard.
import Dashboard from './pages/Dashboard';

const PreMarketBriefing = lazy(() => import('./pages/PreMarketBriefing'));
const Positions = lazy(() => import('./pages/trading/Positions'));
const History = lazy(() => import('./pages/trading/History'));
const Chain = lazy(() => import('./pages/trading/Chain'));
const Greeks = lazy(() => import('./pages/trading/Greeks'));
const Analytics = lazy(() => import('./pages/insights/Analytics'));
const Journal = lazy(() => import('./pages/insights/Journal'));
const Calendar = lazy(() => import('./pages/insights/Calendar'));
const General = lazy(() => import('./pages/settings/General'));
const Import = lazy(() => import('./pages/settings/Import'));
const Api = lazy(() => import('./pages/settings/Api'));

// É3 §4.3 — fallback de route code-split : discret, sans carte verre,
// sans saut de mise en page (anatomie unique des états de chargement).
const Loader = () => <div className="route-loader">Chargement…</div>;

// Une seule barrière Suspense + ErrorBoundary pour toutes les routes
// lazy (l'Outlet est rendu DANS AppShell — la barrière vit au-dessus).
function LazyBoundary() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  // FX cascade : Frankfurter (boot + 5min auto, fallback) puis Yahoo live
  // (poll 60s, source canonique). useFxLiveSync écrit dans settings.liveRate
  // dès qu'un quote live frais est dispo → ticker + footer + cockpit +
  // conversions + FX Impact tous alimentés par la MÊME valeur.
  useFxAutoRefresh();
  useFxLiveSync();
  return (
    <LazyMotion features={domAnimation}>
      <BrowserRouter>
        <ErrorBoundary>
          <FxInvalidBanner />
          <FxStaleBanner />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<LazyBoundary />}>
                <Route path="/premarket" element={<PreMarketBriefing />} />
                <Route path="/trading/positions" element={<Positions />} />
                <Route path="/trading/history" element={<History />} />
                <Route
                  path="/trading/orders"
                  element={<Navigate to="/trading/history" replace />}
                />
                <Route path="/trading/chain" element={<Chain />} />
                <Route path="/trading/greeks" element={<Greeks />} />
                <Route path="/insights/analytics" element={<Analytics />} />
                <Route path="/insights/journal" element={<Journal />} />
                <Route path="/insights/calendar" element={<Calendar />} />
                <Route path="/settings/general" element={<General />} />
                <Route path="/settings/import" element={<Import />} />
                <Route path="/settings/api" element={<Api />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      <VercelAnalytics />
      <SpeedInsights />
    </LazyMotion>
  );
}
