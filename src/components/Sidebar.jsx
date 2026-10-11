import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, BookOpen, RotateCcw,
  BarChart2, Settings, BookMarked, Menu, X, LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/add', icon: PlusCircle, label: 'Add Problem' },
  { to: '/library', icon: BookOpen, label: 'Problem Library' },
  { to: '/revision', icon: RotateCcw, label: 'Revision Center' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

/** Derive initials from a username for the avatar */
function initials(username = '') {
  return username.slice(0, 2).toUpperCase() || '??';
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 flex flex-col z-40
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <BookMarked size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">DSA Vault</p>
            <p className="text-gray-400 text-xs mt-0.5">Learning Journal</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onClick={closeMobile} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-700">
          {session ? (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials(session.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-xs font-medium truncate">{session.username}</p>
                <p className="text-gray-500 text-xs">DSA prep</p>
              </div>
              {/* Logout */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sign out"
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40"
                aria-label="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <p className="text-gray-600 text-xs italic">Not signed in</p>
          )}
        </div>
      </aside>
    </>
  );
}
