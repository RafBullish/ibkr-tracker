import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LazyMotion, domAnimation } from 'framer-motion';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useFxAutoRefresh } from './hooks/useFxAutoRefresh';
import { useFxLiveSync } from './hooks/useFxLiveSync';
import FxStaleBanner from './components/fx/FxStaleBanner';
import FxInvalidBanner from './components/fx/FxInvalidBanner';
import Dashboard from './pages/Dashboard';
import PreMarketBriefing from './pages/PreMarketBriefing';
import Positions from './pages/trading/Positions';
import History from './pages/trading/History';
import Journal from './pages/insights/Journal';
import Calendar from './pages/insights/Calendar';
import General from './pages/settings/General';
import Import from './pages/settings/Import';
import Api from './pages/settings/Api';

const Chain = lazy(() => import('./pages/trading/Chain'));
const Greeks = lazy(() => import('./pages/trading/Greeks'));
const Analytics = lazy(() => import('./pages/insights/Analytics'));

// É3 §4.3 — fallback de route code-split : discret, sans carte verre,
// sans saut de mise en page (anatomie unique des états de chargement).
const Loader = () => <div className="route-loader">Chargement…</div>;

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
              <Route path="/premarket" element={<PreMarketBriefing />} />
              <Route path="/trading/positions" element={<Positions />} />
              <Route path="/trading/history" element={<History />} />
              <Route path="/trading/orders" element={<Navigate to="/trading/history" replace />} />
              <Route
                path="/trading/chain"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                      <Chain />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/trading/greeks"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                      <Greeks />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/insights/analytics"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                      <Analytics />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route path="/insights/journal" element={<Journal />} />
              <Route path="/insights/calendar" element={<Calendar />} />
              <Route path="/settings/general" element={<General />} />
              <Route path="/settings/import" element={<Import />} />
              <Route path="/settings/api" element={<Api />} />
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
