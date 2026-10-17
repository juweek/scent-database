import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import WheelPage from './pages/WheelPage';
import { Loading } from './components/Status';

// The perfume explorer carries d3-chord and its own data layer, and most
// visitors never open it. Split so the three wheels do not pay for it.
const PerfumePage = lazy(() => import('./pages/PerfumePage'));

// The builder carries a 210 KB inverted index of its own and is a deliberate
// destination, never the landing page. Split so nobody pays for it by accident.
const BuilderPage = lazy(() => import('./pages/BuilderPage'));
const CoffeePage = lazy(() => import('./pages/CoffeePage'));
const NoteMatchPage = lazy(() => import('./pages/NoteMatchPage'));

/**
 * One route per surface. The wheel slug is a param (/wheel/accord) so every
 * view is a URL — shareable, and a host site can iframe one wheel directly.
 * Router basename keeps links correct if the app is served from a subpath
 * (import.meta.env.BASE_URL === the `base` knob in vite.config.js).
 */
export default function App() {
  return (
    <Router
      basename={import.meta.env.BASE_URL}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Layout>
        <Routes>
          <Route
            path="/coffee"
            element={
              <Suspense fallback={<Loading />}>
                <CoffeePage />
              </Suspense>
            }
          />
          <Route path="/" element={<HomePage />} />
          <Route path="/wheel" element={<Navigate to="/wheel/accord" replace />} />
          <Route path="/wheel/:slug" element={<WheelPage />} />
          <Route
            path="/perfume"
            element={
              <Suspense fallback={<Loading />}>
                <PerfumePage />
              </Suspense>
            }
          />
          <Route
            path="/perfume/:id"
            element={
              <Suspense fallback={<Loading />}>
                <PerfumePage />
              </Suspense>
            }
          />
          <Route
            path="/builder"
            element={
              <Suspense fallback={<Loading />}>
                <BuilderPage />
              </Suspense>
            }
          />
          <Route
            path="/note-match"
            element={
              <Suspense fallback={<Loading />}>
                <NoteMatchPage />
              </Suspense>
            }
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
