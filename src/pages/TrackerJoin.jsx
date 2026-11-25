import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trackerService } from '../services/trackerService';
import { Card, CardBody } from '../components/Card';

const PENDING_INVITE_KEY = 'pending_tracker_invite';

export default function TrackerJoin() {
  const { session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying tracker invite...');
  const [trackerId, setTrackerId] = useState(null);

  const attemptedRef = useRef(false);

  useEffect(() => {
    // 1. Read token from URL hash (#t=<token>)
    let token = null;
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      token = params.get('t');

      // Immediately remove fragment from URL so token never leaks or remains in history
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. If token found in URL, save to sessionStorage
    if (token) {
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
    } else {
      // Check if previously stored before login redirect
      token = sessionStorage.getItem(PENDING_INVITE_KEY);
    }

    // If auth is still initializing, wait
    if (authLoading) return;

    // 3. If not logged in, redirect to login preserving intent
    if (!session) {
      if (token) {
        sessionStorage.setItem(PENDING_INVITE_KEY, token);
      }
      navigate('/login', {
        state: { from: { pathname: '/trackers/join' } },
        replace: true,
      });
      return;
    }

    // 4. If logged in but no token found
    if (!token) {
      setStatus('error');
      setMessage('No invite token was found in the link. Please ask the tracker administrator for a valid invite link.');
      return;
    }

    // 5. Prevent double execution in React StrictMode
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    // 6. Submit invite token
    (async () => {
      try {
        setStatus('processing');
        setMessage('Accepting invite and joining tracker...');

        const res = await trackerService.acceptInvite(token);
        sessionStorage.removeItem(PENDING_INVITE_KEY);

        setStatus('success');
        setMessage(res.message || 'Successfully joined tracker!');
        setTrackerId(res.trackerId);

        // Auto-redirect to tracker after 1.5 seconds
        if (res.trackerId) {
          setTimeout(() => {
            navigate(`/trackers/${res.trackerId}`, { replace: true });
          }, 1500);
        }
      } catch (err) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setStatus('error');

        const errCode = err.data?.error || '';
        if (err.status === 410 || errCode === 'INVITE_REVOKED') {
          setMessage('This invite has been revoked by the tracker administrator.');
        } else if (err.status === 410 || errCode === 'INVITE_EXPIRED') {
          setMessage('This invite link has expired.');
        } else if (err.status === 410 || errCode === 'INVITE_MAX_USES') {
          setMessage('This invite link has reached its maximum allowed uses.');
        } else if (err.status === 404 || errCode === 'INVITE_NOT_FOUND') {
          setMessage('This invite link was not found or is invalid.');
        } else {
          setMessage(err.data?.message || err.message || 'Failed to accept invite.');
        }
      }
    })();
  }, [session, authLoading, navigate, location]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center p-6 sm:p-8">
        <CardBody className="p-0">
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Joining Tracker</h2>
              <p className="text-sm text-gray-500">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Welcome to the Tracker!</h2>
              <p className="text-sm text-gray-600">{message}</p>
              {trackerId && (
                <Link
                  to={`/trackers/${trackerId}`}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition shadow-xs"
                >
                  <span>Go to Tracker</span>
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Unable to Join Tracker</h2>
              <p className="text-sm text-gray-600">{message}</p>
              <div className="mt-4 flex gap-3">
                <Link
                  to="/trackers"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
                >
                  <Users size={16} />
                  <span>Back to Trackers</span>
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
