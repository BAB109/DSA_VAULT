import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ADMIN_EXPIRED_KEY } from '../../services/adminApi';

/**
 * ProtectedAdminRoute
 * Rules:
 * - no normal session -> redirect to /login (remember the target path)
 * - normal session, valid admin token -> render
 * - normal session whose stored isAdmin is true but admin token is missing or expired ->
 *     redirect to /login with "Your admin session expired, please sign in again"
 * - normal session, not admin -> render the app's normal not-found page (reveal nothing)
 * - render nothing until checks finish (no flash)
 */
export function ProtectedAdminRoute({ children }) {
  const { session, isLoading: authLoading } = useAuth();
  const { isAdminAuthed, isLoading: adminLoading } = useAdminAuth();
  const location = useLocation();

  // Render nothing while either check is loading (prevent flash)
  if (authLoading || adminLoading) {
    return null;
  }

  // 1. No normal session -> redirect to /login preserving target path
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Normal session, valid admin token -> render
  if (isAdminAuthed) {
    return children;
  }

  // 3. Normal session whose stored isAdmin is true but admin token is missing or expired ->
  //    redirect to /login with session expired message
  if (session.isAdmin) {
    try {
      sessionStorage.setItem(ADMIN_EXPIRED_KEY, 'Your admin session expired, please sign in again.');
    } catch {
      // Ignore storage errors
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Normal session, not admin -> render app's normal not-found page (reveal nothing)
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <p className="text-5xl font-bold text-gray-200">404</p>
      <p className="text-gray-500">Page not found</p>
      <Link to="/" className="text-indigo-600 text-sm hover:underline mt-2">
        ← Go to Dashboard
      </Link>
    </div>
  );
}

export default ProtectedAdminRoute;
