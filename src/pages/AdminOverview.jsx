import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Copy,
  Check,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Users,
  AlertCircle,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { adminService } from '../services/adminService';
import { useToast } from '../components/admin/AdminToast';
import { ConfirmDialog } from '../components/admin/AdminDialog';
import { TableSkeleton, OverviewCardsSkeleton } from '../components/admin/AdminSkeleton';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function AdminOverview() {
  const { success, error: toastError } = useToast();

  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'archived'

  // Create Tracker Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    per_day: 2,
    start_date: new Date().toISOString().slice(0, 10),
    csv: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Archive confirmation dialog state
  const [archiveTarget, setArchiveTarget] = useState(null); // { id, name, status }
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Copied code feedback state (trackerId -> boolean)
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const fetchTrackers = useCallback(async () => {
    try {
      setError(null);
      const data = await adminService.getTrackers();
      setTrackers(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load trackers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  const handleCopyCode = (id, code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId(null);
    }, 2000);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        name: createForm.name.trim(),
        timezone: createForm.timezone,
        per_day: parseInt(createForm.per_day, 10),
        start_date: createForm.start_date,
      };

      if (createForm.csv && createForm.csv.trim()) {
        payload.csv = createForm.csv.trim();
      }

      await adminService.createTracker(payload);
      success(`Tracker room "${payload.name}" created successfully!`);
      setShowCreate(false);
      setCreateForm({
        name: '',
        timezone: 'Asia/Kolkata',
        per_day: 2,
        start_date: new Date().toISOString().slice(0, 10),
        csv: '',
      });
      fetchTrackers();
    } catch (err) {
      setCreateError(err.data?.message || err.message || 'Failed to create tracker.');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    const isArchiving = archiveTarget.status === 'active';
    const nextStatus = isArchiving ? 'archived' : 'active';
    setArchiveLoading(true);

    try {
      await adminService.updateTracker(archiveTarget.id, { status: nextStatus });
      success(`Tracker "${archiveTarget.name}" has been ${isArchiving ? 'archived' : 'unarchived'}.`);
      setTrackers((prev) =>
        prev.map((t) => (t.id === archiveTarget.id ? { ...t, status: nextStatus } : t))
      );
      setArchiveTarget(null);
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to update tracker status.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const filteredTrackers = trackers.filter((t) => {
    if (filter === 'active') return t.status === 'active';
    if (filter === 'archived') return t.status === 'archived';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Control Center
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tracker Rooms Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitor and manage all shared DSA friend groups, sequential problem pacing, and member progress.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setLoading(true);
              fetchTrackers();
            }}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors disabled:opacity-50"
            title="Refresh tracker list"
            aria-label="Refresh list"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>{showCreate ? 'Close Form' : 'Create Tracker Room'}</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner with Retry ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchTrackers();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Create Tracker Room Inline Form / Modal ── */}
      {showCreate && (
        <div className="bg-white border border-indigo-200 rounded-2xl shadow-md overflow-hidden p-5 transition-all">
          <div className="border-b border-gray-100 pb-3 mb-4">
            <h2 className="text-sm font-bold text-gray-900">Create New Tracker Room</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure a shared space with a unique public code, daily problem quota, and an optional initial LeetCode CSV sheet.
            </p>
          </div>

          {createError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Winter 2026 Grind"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Timezone *
                </label>
                <select
                  value={createForm.timezone}
                  onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pacing (Problems/Day: 1-10) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={createForm.per_day}
                  onChange={(e) => setCreateForm({ ...createForm, per_day: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Initial Sheet CSV (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Paste LeetCode question numbers or CSV lines (e.g. 1, Two Sum, Easy or simply 1&#10;2&#10;15)"
                value={createForm.csv}
                onChange={(e) => setCreateForm({ ...createForm, csv: e.target.value })}
                className="w-full font-mono text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                You can also configure, reorder, and preview problems sequentially inside the Tracker details page after creation.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {creating ? 'Creating Room...' : 'Create Room'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters & Summary Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-gray-200/60 rounded-xl w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Trackers ({trackers.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'active'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active ({trackers.filter((t) => t.status === 'active').length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'archived'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Archived ({trackers.filter((t) => t.status === 'archived').length})
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div className="space-y-4">
          <OverviewCardsSkeleton />
          <TableSkeleton rows={4} cols={8} />
        </div>
      ) : filteredTrackers.length === 0 ? (
        /* ── Empty State ── */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-900">No trackers yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
            There are currently no tracker rooms matching your filter. Create a shared room to get started.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus size={14} />
            <span>Create First Tracker Room</span>
          </button>
        </div>
      ) : (
        /* ── Main Trackers Table ── */
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tracker Name</th>
                  <th className="py-3 px-4">Public Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Pacing</th>
                  <th className="py-3 px-4">Sheet Remaining</th>
                  <th className="py-3 px-4">Today Done / Exp</th>
                  <th className="py-3 px-4">Pending Total</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTrackers.map((tracker) => {
                  const isArchived = tracker.status === 'archived';
                  const remaining = tracker.sheetSummary?.remaining ?? 0;
                  const daysLeft = tracker.sheetSummary?.estimatedDaysLeft ?? 0;
                  const todayDone = tracker.todayProgress?.done ?? 0;
                  const todayExpected = tracker.todayProgress?.expected ?? 0;
                  const pendingTotal = tracker.pendingTotal ?? 0;
                  const membersCount = tracker.memberCount ?? 0;

                  return (
                    <tr
                      key={tracker.id}
                      className="hover:bg-gray-50/70 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        <Link
                          to={`/admin/trackers/${tracker.id}`}
                          className="hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                        >
                          <span className="truncate max-w-[180px] sm:max-w-none">{tracker.name}</span>
                          <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity shrink-0" />
                        </Link>
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          <span>{tracker.timezone}</span>
                        </div>
                      </td>

                      {/* Public Code with Copy Button */}
                      <td className="py-3.5 px-4 font-mono font-medium">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-800 rounded-lg border border-gray-200/80">
                          <span>{tracker.public_code}</span>
                          <button
                            onClick={() => handleCopyCode(tracker.id, tracker.public_code)}
                            title="Copy invite code"
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            {copiedCodeId === tracker.id ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            isArchived
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isArchived ? 'Archived' : 'Active'}
                        </span>
                      </td>

                      {/* Members */}
                      <td className="py-3.5 px-4 text-gray-700 font-medium">
                        <div className="flex items-center gap-1">
                          <Users size={13} className="text-gray-400" />
                          <span>{membersCount}</span>
                        </div>
                      </td>

                      {/* Pacing */}
                      <td className="py-3.5 px-4 text-gray-700">
                        <span className="font-semibold text-gray-900">{tracker.per_day}</span>
                        <span className="text-gray-400 text-[11px]">/day</span>
                      </td>

                      {/* Sheet Remaining and Estimated Days Left */}
                      <td className="py-3.5 px-4 text-gray-700">
                        <div className="font-semibold text-gray-900">{remaining} left</div>
                        <div className="text-[10px] text-gray-400">~{daysLeft} days est.</div>
                      </td>

                      {/* Today's Done / Expected */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            todayExpected > 0 && todayDone >= todayExpected
                              ? 'text-emerald-600'
                              : todayDone > 0
                              ? 'text-indigo-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {todayDone} / {todayExpected}
                        </span>
                      </td>

                      {/* Pending Total */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            pendingTotal > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {pendingTotal}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link
                            to={`/admin/trackers/${tracker.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                          >
                            Manage
                          </Link>

                          <button
                            onClick={() =>
                              setArchiveTarget({
                                id: tracker.id,
                                name: tracker.name,
                                status: tracker.status,
                              })
                            }
                            title={isArchived ? 'Unarchive room' : 'Archive room'}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          >
                            {isArchived ? (
                              <ArchiveRestore size={14} className="text-emerald-600" />
                            ) : (
                              <Archive size={14} className="text-amber-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Accessible Archive Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
        title={archiveTarget?.status === 'active' ? 'Archive Tracker Room' : 'Unarchive Tracker Room'}
        message={
          archiveTarget?.status === 'active'
            ? `Are you sure you want to archive "${archiveTarget?.name}"? While archived, no new daily assignments will be generated.`
            : `Are you sure you want to unarchive "${archiveTarget?.name}"? Daily assignments will resume starting tomorrow.`
        }
        confirmLabel={archiveTarget?.status === 'active' ? 'Archive Tracker' : 'Unarchive Tracker'}
        variant={archiveTarget?.status === 'active' ? 'warning' : 'primary'}
        loading={archiveLoading}
      />
    </div>
  );
}
