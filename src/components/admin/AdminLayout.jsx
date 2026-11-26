import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  ScrollText,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ToastProvider } from './AdminToast';

function AdminNavLink({ to, icon: Icon, label, onClick, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
          isActive
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-gray-300 hover:text-white hover:bg-gray-800'
        }`
      }
    >
      <Icon size={14} />
      <span>{label}</span>
    </NavLink>
  );
}

export function AdminLayout({ children }) {
  const { logout, warningState, isRefreshing, refreshSession } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900 font-sans">
        {/* ── Admin Top Navigation Shell ── */}
        <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Left: Brand & Navigation */}
              <div className="flex items-center gap-6">
                {/* Admin Badge */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold text-xs tracking-tight">DSA Vault</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Admin
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Nav Items */}
                <nav className="hidden md:flex items-center gap-1.5">
                  <AdminNavLink to="/admin" icon={LayoutDashboard} label="Overview" end />
                  <AdminNavLink to="/admin/audit" icon={ScrollText} label="Audit Log" />
                </nav>
              </div>

              {/* Right: Return to App & Logout */}
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
                  title="Return to user DSA Vault application"
                >
                  <ArrowLeft size={13} />
                  <span>Main Vault</span>
                </Link>

                <div className="h-4 w-px bg-gray-700" />

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/50 transition-colors"
                  title="Sign out of Admin session"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-label="Toggle admin navigation"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 pt-3 pb-4 space-y-2">
              <nav className="flex flex-col gap-1">
                <AdminNavLink
                  to="/admin"
                  icon={LayoutDashboard}
                  label="Overview"
                  onClick={() => setMobileMenuOpen(false)}
                  end
                />
                <AdminNavLink
                  to="/admin/audit"
                  icon={ScrollText}
                  label="Audit Log"
                  onClick={() => setMobileMenuOpen(false)}
                />
              </nav>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-100"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Main Vault</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ── Main Content Area ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-6">
          {/* Admin Session Expiration Warning Banners */}
          {warningState && warningState.type === 'ending_soon' && (
            <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Your admin session ends soon</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your session will expire in {warningState.minutesLeft} minute{warningState.minutesLeft !== 1 ? 's' : ''} due to inactivity.
                  </p>
                </div>
              </div>
              <button
                onClick={refreshSession}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 active:bg-amber-400 rounded-xl transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Stay signed in</span>
              </button>
            </div>
          )}

          {warningState && warningState.type === 'cap_near' && (
            <div className="mb-6 bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-rose-900">Maximum session length reached</h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Maximum session length reached at {warningState.formattedTime}, finish your work and sign in again.
                </p>
              </div>
            </div>
          )}

          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

export default AdminLayout;
