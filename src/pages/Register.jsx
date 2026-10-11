import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  validateUsername,
  validatePassword,
  validateConfirmPassword,
} from '../services/authService';
import { Input, Button } from '../components/FormControls';

const ERROR_MESSAGES = {
  USERNAME_TAKEN: 'That username is already taken. Please choose another.',
};

// Password strength meter (purely cosmetic helper)
function PasswordStrength({ password }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-500'];
  const widths = ['', 'w-1/4', 'w-2/4', 'w-3/4', 'w-full'];

  return (
    <div className="mt-1 space-y-1">
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${colors[score]} ${widths[score]}`} />
      </div>
      <p className="text-xs text-gray-400">{label && `Strength: ${label}`}</p>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => { const n = { ...er }; delete n[field]; return n; });
    if (errors.form) setErrors((er) => { const n = { ...er }; delete n.form; return n; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = {};
    const uErr = validateUsername(form.username);
    if (uErr) errs.username = uErr;
    const pErr = validatePassword(form.password);
    if (pErr) errs.password = pErr;
    const cErr = validateConfirmPassword(form.password, form.confirm);
    if (cErr) errs.confirm = cErr;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      await register({ username: form.username, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: ERROR_MESSAGES[err.message] ?? 'Registration failed. Please try again.' });
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
          <p className="text-sm text-gray-500 mt-0.5">Create your learning journal</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-7">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Create an account</h2>

          {/* Form-level error */}
          {errors.form && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Username */}
            <div className="flex flex-col gap-1">
              <Input
                label="Username"
                required
                autoComplete="username"
                autoFocus
                value={form.username}
                onChange={set('username')}
                error={errors.username}
                placeholder="e.g. alex_codes"
              />
              {!errors.username && (
                <p className="text-xs text-gray-400">3–30 chars · letters, digits, _ or -</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-lg outline-none transition-colors placeholder-gray-400 text-gray-900
                    ${errors.password
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  placeholder="At least 8 characters"
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
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-lg outline-none transition-colors placeholder-gray-400 text-gray-900
                    ${errors.confirm
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : form.confirm && form.confirm === form.password
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  placeholder="Repeat your password"
                />
                {form.confirm && form.confirm === form.password && !errors.confirm && (
                  <CheckCircle size={15} className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-500" />
                )}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
            </div>

            <Button
              type="submit"
              className="w-full mt-1"
              loading={submitting}
              disabled={submitting}
            >
              Create account
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
