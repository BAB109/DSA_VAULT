import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, BookOpen, RotateCcw,
  BarChart2, Settings, BookMarked, Menu, X, LogOut,
  GraduationCap,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/add', icon: PlusCircle, label: 'Add Problem' },
  { to: '/library', icon: BookOpen, label: 'Problem Library' },
  { to: '/revision', icon: RotateCcw, label: 'Revision Center' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/cs-fundamentals', icon: GraduationCap, label: 'CS Fundamentals' },
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
      {/* Mobile Top Header Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 border-b border-gray-800 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shrink-0">
              <BookMarked size={14} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">DSA Vault</span>
          </div>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 flex flex-col z-50
          transition-transform duration-200 ease-in-out shadow-2xl lg:shadow-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex shrink-0
        `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-700/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
              <BookMarked size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">DSA Vault</p>
              <p className="text-gray-400 text-xs mt-0.5">Learning Journal</p>
            </div>
          </div>
          <button
            onClick={closeMobile}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
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
