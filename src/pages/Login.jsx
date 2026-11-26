import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookMarked, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateUsername, validatePassword } from '../services/authService';
import { setAdminToken, ADMIN_EXPIRED_KEY, ADMIN_HAD_TOKEN_KEY } from '../services/adminApi';
import { Input, Button } from '../components/FormControls';

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Incorrect username or password.',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState(null);

  useEffect(() => {
    // Check for admin session expired notice or tab token history
    try {
      const notice = sessionStorage.getItem(ADMIN_EXPIRED_KEY);
      const hadAdminToken = sessionStorage.getItem(ADMIN_HAD_TOKEN_KEY);

      if (notice) {
        setExpiredNotice(notice);
        sessionStorage.removeItem(ADMIN_EXPIRED_KEY);
      } else if (location.state?.from && String(location.state.from).includes('/admin')) {
        // Navigating to admin route without an active token
        if (hadAdminToken) {
          setExpiredNotice('Your admin session expired, please sign in again.');
        } else {
          setExpiredNotice('Please sign in to continue.');
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [location.state]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    // Clear field error on change
    if (errors[field]) setErrors((er) => { const n = { ...er }; delete n[field]; return n; });
    if (errors.form) setErrors((er) => { const n = { ...er }; delete n.form; return n; });
    if (expiredNotice) setExpiredNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = {};
    const uErr = validateUsername(form.username);
    if (uErr) errs.username = uErr;
    const pErr = validatePassword(form.password);
    if (pErr) errs.password = pErr;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const authResult = await login({ username: form.username, password: form.password });

      if (authResult?.adminToken) {
        // Store ONLY via adminApi client under dsa_admin_token in sessionStorage
        setAdminToken(authResult.adminToken, authResult.adminSessionEndsAt);

        // Navigate to originally requested admin path or /admin
        const fromPath = location.state?.from?.pathname || (location.state?.from && typeof location.state.from === 'string' ? location.state.from : null);
        const destination = fromPath && fromPath.startsWith('/admin') ? fromPath : '/admin';
        navigate(destination, { replace: true });
      } else {
        const fromPath = location.state?.from?.pathname || (location.state?.from && typeof location.state.from === 'string' ? location.state.from : null);
        const destination = fromPath && !fromPath.startsWith('/admin') ? fromPath : '/';
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setErrors({ form: ERROR_MESSAGES[err.message] || err.message || 'Login failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <BookMarked size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">DSA Vault</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sign in to your journal</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-7">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Welcome back</h2>

          {/* Expired session notice banner */}
          {expiredNotice && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 font-medium">{expiredNotice}</p>
            </div>
          )}

          {/* Form-level error */}
          {errors.form && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Username"
              required
              autoComplete="username"
              autoFocus
              value={form.username}
              onChange={set('username')}
              error={errors.username}
              placeholder="your_username"
            />

            {/* Password with show/hide toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={set('password')}
                  // Allow paste (no onPaste prevention)
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-lg outline-none transition-colors placeholder-gray-400 text-gray-900
                    ${errors.password
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full mt-1"
              loading={submitting}
              disabled={submitting}
            >
              Sign in
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-medium hover:underline">
            Create one
          </Link>
        </p>

        {/* Demo hint */}
        <p className="text-center text-xs text-gray-400 mt-3">
          Demo account: <span className="font-mono">demo</span> / <span className="font-mono">demo1234</span>
        </p>
      </div>
    </div>
  );
}
