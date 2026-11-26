import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TimerProvider } from './context/TimerContext';
import FloatingQuickWidget from './components/widgets/FloatingQuickWidget';
import { Sidebar } from './components/Sidebar';
import { Spinner } from './components/States';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddProblem from './pages/AddProblem';
import Library from './pages/Library';
import ProblemDetail from './pages/ProblemDetail';
import EditProblem from './pages/EditProblem';
import RevisionCenter from './pages/RevisionCenter';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Trackers from './pages/Trackers';
import TrackerJoin from './pages/TrackerJoin';
import TrackerDetail from './pages/TrackerDetail';
import AdminOverview from './pages/AdminOverview';
import AdminTrackerDetail from './pages/AdminTrackerDetail';
import AdminAudit from './pages/AdminAudit';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ProtectedAdminRoute } from './components/admin/ProtectedAdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';


// ─── Layout wrapper ────────────────────────────────────────────────────────────
function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0">
        <div className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto w-full min-w-0">
          {children}
        </div>
      </main>
      <FloatingQuickWidget />
    </div>
  );
}

// ─── Auth guard: redirects to /login if not authenticated ─────────────────────
function RequireAuth({ children }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  // Show a minimal spinner while the initial session check runs
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    // Preserve the intended destination so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ─── Guest guard: redirects authenticated users away from auth pages ───────────
function GuestOnly({ children }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  // Already logged in — send to dashboard
  if (session) return <Navigate to="/" replace />;

  return children;
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <TimerProvider>
        <Routes>
          {/* ── Public auth routes ── */}
          <Route
            path="/login"
            element={<GuestOnly><Login /></GuestOnly>}
          />
          <Route
            path="/register"
            element={<GuestOnly><Register /></GuestOnly>}
          />

          {/* ── Protected app routes ── */}
          <Route
            path="/"
            element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>}
          />
          <Route
            path="/add"
            element={<RequireAuth><Layout><AddProblem /></Layout></RequireAuth>}
          />
          <Route
            path="/library"
            element={<RequireAuth><Layout><Library /></Layout></RequireAuth>}
          />
          <Route
            path="/problems/:id"
            element={<RequireAuth><Layout><ProblemDetail /></Layout></RequireAuth>}
          />
          <Route
            path="/problems/:id/edit"
            element={<RequireAuth><Layout><EditProblem /></Layout></RequireAuth>}
          />
          <Route
            path="/revision"
            element={<RequireAuth><Layout><RevisionCenter /></Layout></RequireAuth>}
          />
          <Route
            path="/analytics"
            element={<RequireAuth><Layout><Analytics /></Layout></RequireAuth>}
          />
          <Route
            path="/settings"
            element={<RequireAuth><Layout><Settings /></Layout></RequireAuth>}
          />

          {/* ── Trackers routes ── */}
          <Route
            path="/trackers"
            element={<RequireAuth><Layout><Trackers /></Layout></RequireAuth>}
          />
          <Route
            path="/trackers/join"
            element={<Layout><TrackerJoin /></Layout>}
          />
          <Route
            path="/trackers/:id"
            element={<RequireAuth><Layout><TrackerDetail /></Layout></RequireAuth>}
          />

          {/* ── Admin routes ── */}
          <Route
            path="/admin/login"
            element={<Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <AdminOverview />
                </AdminLayout>
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/trackers/:id"
            element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <AdminTrackerDetail />
                </AdminLayout>
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <AdminAudit />
                </AdminLayout>
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-24 gap-3">
                <p className="text-5xl font-bold text-gray-200">404</p>
                <p className="text-gray-500">Page not found</p>
                <Link to="/admin" className="text-indigo-600 text-sm hover:underline mt-2">
                  ← Go to Admin Overview
                </Link>
              </div>
            }
          />

          {/* ── 404 ── */}
          <Route
            path="*"
            element={
              <RequireAuth>
                <Layout>
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <p className="text-5xl font-bold text-gray-200">404</p>
                    <p className="text-gray-500">Page not found</p>
                    <Link to="/" className="text-indigo-600 text-sm hover:underline mt-2">
                      ← Go to Dashboard
                    </Link>
                  </div>
                </Layout>
              </RequireAuth>
            }
          />
        </Routes>
        </TimerProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
