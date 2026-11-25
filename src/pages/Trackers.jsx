import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, PlusCircle, Clock, AlertCircle, CheckCircle2,
  ArrowRight, Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trackerService } from '../services/trackerService';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Modal } from '../components/Modal';
import { Spinner, LoadingState } from '../components/States';

export default function Trackers() {
  const { session } = useAuth();
  const isAdmin = Boolean(session?.isAdmin);

  const [loading, setLoading] = useState(true);
  const [trackers, setTrackers] = useState([]);
  const [trackerStats, setTrackerStats] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [error, setError] = useState(null);

  // Request to Join state
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState(null);

  // Create Tracker state (Admin only)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    per_day: 2,
    start_date: new Date().toISOString().slice(0, 10),
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Cancelling request state
  const [cancellingId, setCancellingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await trackerService.getMyTrackers();
      const myTrackers = res.trackers || [];
      setTrackers(myTrackers);
      setPendingRequests(res.pendingRequests || []);

      // Fetch today & pending stats for each tracker
      const statsMap = {};
      await Promise.all(
        myTrackers.map(async (t) => {
          try {
            const [todayRes, pendingRes] = await Promise.all([
              trackerService.getToday(t.id).catch(() => null),
              trackerService.getPending(t.id).catch(() => null),
            ]);

            const assignments = todayRes?.assignments || [];
            const doneToday = assignments.filter((a) => Boolean(a.submission)).length;
            const totalToday = assignments.length;
            const pendingCount = pendingRes?.count ?? pendingRes?.pending?.length ?? 0;

            statsMap[t.id] = {
              doneToday,
              totalToday,
              pendingCount,
              sheetEmpty: Boolean(todayRes?.sheetEmpty),
              sheetComplete: Boolean(todayRes?.sheetComplete),
            };
          } catch {
            statsMap[t.id] = { doneToday: 0, totalToday: 0, pendingCount: 0 };
          }
        })
      );
      setTrackerStats(statsMap);
    } catch (err) {
      setError(err.message || 'Failed to load trackers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Join Request submission
  const handleJoinRequest = async (e) => {
    e.preventDefault();
    setJoinFeedback(null);
    if (!joinCode.trim()) return;

    setJoinSubmitting(true);
    try {
      const res = await trackerService.submitJoinRequest(
        joinCode.trim().toUpperCase(),
        joinMessage.trim() || undefined
      );
      setJoinFeedback({ type: 'success', message: res.message });
      setJoinCode('');
      setJoinMessage('');
      loadData();
    } catch (err) {
      if (err.status === 409) {
        setJoinFeedback({
          type: 'error',
          message: err.data?.message || 'You already requested or are already a member of this tracker.',
        });
      } else if (err.status === 429) {
        setJoinFeedback({
          type: 'error',
          message: err.data?.message || 'A cooldown is active on this tracker.',
        });
      } else {
        setJoinFeedback({
          type: 'error',
          message: err.message || 'Failed to submit join request.',
        });
      }
    } finally {
      setJoinSubmitting(false);
    }
  };

  // Handle Cancel Join Request
  const handleCancelRequest = async (reqId) => {
    setCancellingId(reqId);
    try {
      await trackerService.cancelJoinRequest(reqId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (err) {
      alert(err.message || 'Failed to cancel request.');
    } finally {
      setCancellingId(null);
    }
  };

  // Handle Create Tracker (Admin only)
  const handleCreateTracker = async (e) => {
    e.preventDefault();
    setCreateError(null);

    if (!createData.name.trim()) {
      setCreateError('Tracker name is required.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await trackerService.createTracker({
        name: createData.name.trim(),
        timezone: createData.timezone,
        per_day: parseInt(createData.per_day, 10),
        start_date: createData.start_date,
      });

      setIsCreateModalOpen(false);
      setCreateData({
        name: '',
        timezone: 'Asia/Kolkata',
        per_day: 2,
        start_date: new Date().toISOString().slice(0, 10),
      });
      loadData();
    } catch (err) {
      setCreateError(err.data?.message || err.message || 'Failed to create tracker.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading your trackers..." />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="text-indigo-600" size={26} />
            Trackers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Collaborative daily DSA practice tracking with your peers.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-xs transition"
          >
            <PlusCircle size={16} />
            Create Tracker
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Section 1: My Trackers ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>My Trackers</span>
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {trackers.length}
          </span>
        </h2>

        {trackers.length === 0 ? (
          <Card className="text-center py-12 px-4 border-dashed">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">You are not in any trackers yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
              Join an existing group using a public code or invite link, or create a tracker if you have admin privileges.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {trackers.map((t) => {
              const stats = trackerStats[t.id] || { doneToday: 0, totalToday: 0, pendingCount: 0 };
              return (
                <Link
                  key={t.id}
                  to={`/trackers/${t.id}`}
                  className="group block"
                >
                  <Card className="h-full transition duration-150 hover:shadow-md hover:border-indigo-200 flex flex-col justify-between">
                    <CardBody className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition truncate">
                            {t.name}
                          </h3>
                          <span className="shrink-0 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-mono">
                            {t.per_day}/day
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                          <Clock size={13} />
                          <span>{t.timezone}</span>
                        </div>

                        {/* Progress Stats */}
                        <div className="space-y-2 py-3 border-t border-gray-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Today's Progress</span>
                            <span className="font-medium text-gray-800">
                              {stats.sheetEmpty
                                ? 'No sheet'
                                : `${stats.doneToday} / ${stats.totalToday || t.per_day} done`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Pending Overdue</span>
                            <span
                              className={`font-medium ${
                                stats.pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            >
                              {stats.pendingCount > 0 ? `${stats.pendingCount} pending` : 'All caught up ✓'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
                        <span>Open Tracker</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Pending Join Requests (if any) ── */}
      {pendingRequests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>Pending Join Requests</span>
            <span className="text-xs font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {pendingRequests.length}
            </span>
          </h2>

          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <Card key={req.id} className="p-4 border-amber-200 bg-amber-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{req.tracker_name}</span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        Pending Admin Approval
                      </span>
                    </div>
                    {req.message && (
                      <p className="text-xs text-gray-600 mt-1 italic">
                        "{req.message}"
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Requested on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCancelRequest(req.id)}
                    disabled={cancellingId === req.id}
                    className="self-start sm:self-center px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition disabled:opacity-50"
                  >
                    {cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Request to Join ── */}
      <Card className="max-w-xl">
        <CardHeader
          title="Request to Join a Tracker"
          subtitle="Enter the 8-character public tracker code provided by your tracker administrator."
        />
        <CardBody className="p-5">
          {joinFeedback && (
            <div
              className={`p-3 rounded-lg text-sm mb-4 flex items-center gap-2.5 ${
                joinFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {joinFeedback.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-red-600" />
              )}
              <span>{joinFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleJoinRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tracker Public Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="e.g. 8K2M9PX7"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Optional Message for Admin
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="e.g. Hey, I'm Alex from batch 2026!"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={joinSubmitting || !joinCode.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
            >
              {joinSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </form>
        </CardBody>
      </Card>

      {/* ── Modal: Create Tracker (Admin Only) ── */}
      {isAdmin && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Tracker"
          size="md"
        >
          <form onSubmit={handleCreateTracker} className="p-6 space-y-4">
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tracker Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2026 FAANG Prep Group"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Problems Per Day (1-10) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={createData.per_day}
                  onChange={(e) => setCreateData({ ...createData, per_day: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Start Date (YYYY-MM-DD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={createData.start_date}
                  onChange={(e) => setCreateData({ ...createData, start_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Timezone <span className="text-red-500">*</span>
              </label>
              <select
                value={createData.timezone}
                onChange={(e) => setCreateData({ ...createData, timezone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                disabled={createSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
              >
                {createSubmitting ? 'Creating...' : 'Create Tracker'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
