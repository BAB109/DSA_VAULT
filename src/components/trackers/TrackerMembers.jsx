import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trash2, Flame, AlertTriangle, AlertCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Users, RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export function TrackerMembers({
  trackerId,
  service = adminService,
  isAdmin = false,
  currentUserId,
  onMemberCountChange,
}) {
  const activeService = service || adminService;
  const { session } = useAuth();
  const effectiveUserId = currentUserId || session?.userId;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);

  // Sorting state: default completionPct desc, then username asc
  const [sortField, setSortField] = useState('completionPct');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activeService.getMembers(trackerId);
      const list = Array.isArray(data) ? data : data?.members || [];
      setMembers(list);
      onMemberCountChange?.(list.length);
    } catch (err) {
      setError(err.message || 'Failed to load member statistics.');
    } finally {
      setLoading(false);
    }
  }, [trackerId, activeService, onMemberCountChange]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'username' ? 'asc' : 'desc');
    }
  };

  const sortedMembers = useMemo(() => {
    const list = [...members];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'username') {
        const cmp = String(valA || '').localeCompare(String(valB || ''));
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'lastActive') {
        const tA = a.lastSubmittedAt ? new Date(a.lastSubmittedAt).getTime() : 0;
        const tB = b.lastSubmittedAt ? new Date(b.lastSubmittedAt).getTime() : 0;
        const diff = tA - tB;
        if (diff !== 0) return sortDirection === 'asc' ? diff : -diff;
      } else {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        const diff = numA - numB;
        if (diff !== 0) return sortDirection === 'asc' ? diff : -diff;
      }

      // Secondary sort: username ascending
      return String(a.username || '').localeCompare(String(b.username || ''));
    });
    return list;
  }, [members, sortField, sortDirection]);

  const handleRemove = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    setRemovingUserId(userId);
    try {
      await activeService.removeMember(trackerId, userId);
      setMembers((prev) => {
        const next = prev.filter((m) => m.userId !== userId);
        onMemberCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-gray-300 opacity-60" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="text-indigo-600" />
    ) : (
      <ArrowDown size={12} className="text-indigo-600" />
    );
  };

  const getAriaSort = (field) => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Room Members"
        subtitle="Individual release and submission statistics, backlog, on-time streak, and activity."
      />

      <CardBody className="p-0">
        {/* Error Banner with Retry */}
        {error && (
          <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{typeof error === 'string' ? error : 'Failed to load member stats.'}</span>
            </div>
            <button
              onClick={fetchMembers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="p-5 space-y-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl"></div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && members.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} />
            </div>
            <h4 className="text-sm font-semibold text-gray-800">No members in this tracker</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              No members have joined this room yet. Share an invite link or approve join requests to get started.
            </p>
          </div>
        )}

        {!loading && !error && members.length === 1 && members[0].userId === effectiveUserId && !isAdmin && (
          <div className="text-center py-10 px-4 border-b border-gray-100 bg-gray-50/50">
            <Users size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-700">You are currently the only member</p>
            <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-0.5">
              Invite teammates or friends to this room to compare progress and keep each other accountable.
            </p>
          </div>
        )}

        {/* Desktop / Tablet Table View (640px and up) */}
        {!loading && !error && members.length > 0 && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th
                      scope="col"
                      aria-sort={getAriaSort('username')}
                      className="py-3.5 px-4 cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('username')}
                    >
                      <button type="button" className="inline-flex items-center gap-1.5 focus:outline-none">
                        <span>Member</span>
                        {getSortIcon('username')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('released')}
                      className="py-3.5 px-3 text-center cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('released')}
                    >
                      <button type="button" className="inline-flex items-center justify-center gap-1 focus:outline-none">
                        <span>Released</span>
                        {getSortIcon('released')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('submitted')}
                      className="py-3.5 px-3 text-center cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('submitted')}
                    >
                      <button type="button" className="inline-flex items-center justify-center gap-1 focus:outline-none">
                        <span>Submitted</span>
                        {getSortIcon('submitted')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('pending')}
                      className="py-3.5 px-3 text-center cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('pending')}
                    >
                      <button type="button" className="inline-flex items-center justify-center gap-1 focus:outline-none">
                        <span>Pending</span>
                        {getSortIcon('pending')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('completionPct')}
                      className="py-3.5 px-4 text-center cursor-pointer select-none hover:text-gray-800 transition min-w-[130px]"
                      onClick={() => handleSort('completionPct')}
                    >
                      <button type="button" className="inline-flex items-center justify-center gap-1 focus:outline-none">
                        <span>Completion %</span>
                        {getSortIcon('completionPct')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('streak')}
                      className="py-3.5 px-3 text-center cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('streak')}
                    >
                      <button type="button" className="inline-flex items-center justify-center gap-1 focus:outline-none">
                        <span>Streak</span>
                        {getSortIcon('streak')}
                      </button>
                    </th>

                    <th
                      scope="col"
                      aria-sort={getAriaSort('lastActive')}
                      className="py-3.5 px-4 text-right cursor-pointer select-none hover:text-gray-800 transition"
                      onClick={() => handleSort('lastActive')}
                    >
                      <button type="button" className="inline-flex items-center justify-end gap-1 w-full focus:outline-none">
                        <span>Last Active</span>
                        {getSortIcon('lastActive')}
                      </button>
                    </th>

                    {isAdmin && (
                      <th scope="col" className="py-3.5 px-3 text-center">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {sortedMembers.map((m) => {
                    const isYou = m.userId === effectiveUserId;
                    const completion = m.completionPct ?? (m.released > 0 ? Math.round((m.submitted / m.released) * 100) : 0);

                    return (
                      <tr
                        key={m.userId}
                        className={`hover:bg-gray-50/60 transition ${
                          isYou ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        {/* Member Name + You Badge */}
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px]">{m.username}</span>
                            {isYou && (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-md">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-normal text-gray-400 block mt-0.5">
                            Joined {new Date(m.joinedAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Released */}
                        <td className="py-3 px-3 text-center font-mono font-semibold text-gray-800">
                          {m.released}
                        </td>

                        {/* Submitted (on-time / late small text) */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="font-bold text-gray-900">{m.submitted}</div>
                          <div className="text-[10px] text-gray-400 font-normal">
                            <span>{m.onTime ?? 0} on-time</span>
                            {(m.late ?? 0) > 0 && (
                              <span className="text-amber-600 font-medium">, {m.late} late</span>
                            )}
                          </div>
                        </td>

                        {/* Pending (Warning color + icon + label, never color alone) */}
                        <td className="py-3 px-3 text-center">
                          {m.pending > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200"
                              title={`${m.pending} overdue pending assignment${m.pending > 1 ? 's' : ''}`}
                            >
                              <AlertTriangle size={12} className="text-amber-600 shrink-0" aria-hidden="true" />
                              <span>{m.pending}</span>
                              <span className="text-[10px] font-normal uppercase">late</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono">0</span>
                          )}
                        </td>

                        {/* Completion % (Progress bar + label) */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  completion >= 80
                                    ? 'bg-emerald-500'
                                    : completion >= 50
                                    ? 'bg-indigo-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, completion)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs font-semibold text-gray-700 w-9 text-right">
                              {completion}%
                            </span>
                          </div>
                        </td>

                        {/* Streak */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-gray-700">
                            {m.streak > 0 && (
                              <Flame size={13} className="text-orange-500 fill-orange-500" aria-hidden="true" />
                            )}
                            <span className={m.streak > 0 ? 'text-orange-600' : 'text-gray-400'}>
                              {m.streak}d
                            </span>
                          </div>
                        </td>

                        {/* Last Active */}
                        <td className="py-3 px-4 text-right text-gray-500 text-xs font-medium">
                          {formatRelativeTime(m.lastSubmittedAt)}
                        </td>

                        {/* Admin Action: Remove */}
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            {m.userId !== session?.userId && (
                              <button
                                onClick={() => handleRemove(m.userId)}
                                disabled={removingUserId === m.userId}
                                className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                                title="Remove member from tracker"
                                aria-label={`Remove ${m.username}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Below 640px) */}
            <div className="block sm:hidden divide-y divide-gray-100 p-3 space-y-3">
              {sortedMembers.map((m) => {
                const isYou = m.userId === effectiveUserId;
                const completion = m.completionPct ?? (m.released > 0 ? Math.round((m.submitted / m.released) * 100) : 0);

                return (
                  <div
                    key={m.userId}
                    className={`p-4 rounded-xl border border-gray-100 bg-white shadow-xs space-y-3 ${
                      isYou ? 'ring-1 ring-indigo-200 bg-indigo-50/20' : ''
                    }`}
                  >
                    {/* Header: Member Name, Badge & Remove */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{m.username}</span>
                        {isYou && (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-md">
                            You
                          </span>
                        )}
                      </div>

                      {isAdmin && m.userId !== session?.userId && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={removingUserId === m.userId}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                          title="Remove member"
                          aria-label={`Remove ${m.username}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Completion Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-medium">Completion</span>
                        <span className="font-mono font-bold text-gray-800">{completion}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            completion >= 80
                              ? 'bg-emerald-500'
                              : completion >= 50
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, completion)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats Grid: 4 columns */}
                    <div className="grid grid-cols-4 gap-2 pt-1 text-center border-t border-gray-50">
                      <div className="p-1.5 bg-gray-50 rounded-lg">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold block">Released</span>
                        <span className="font-mono font-bold text-xs text-gray-900">{m.released}</span>
                      </div>

                      <div className="p-1.5 bg-gray-50 rounded-lg">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold block">Solved</span>
                        <span className="font-mono font-bold text-xs text-gray-900">{m.submitted}</span>
                        <span className="text-[9px] text-gray-400 block font-normal">{m.onTime ?? 0} on-time</span>
                      </div>

                      <div className="p-1.5 bg-gray-50 rounded-lg">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold block">Pending</span>
                        {m.pending > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-700 font-mono font-bold text-xs">
                            <AlertTriangle size={10} className="text-amber-600 shrink-0" aria-hidden="true" />
                            <span>{m.pending}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-xs">0</span>
                        )}
                      </div>

                      <div className="p-1.5 bg-gray-50 rounded-lg">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold block">Streak</span>
                        <span className="inline-flex items-center justify-center gap-0.5 font-mono font-bold text-xs text-gray-900">
                          {m.streak > 0 && <Flame size={11} className="text-orange-500 fill-orange-500" aria-hidden="true" />}
                          <span>{m.streak}d</span>
                        </span>
                      </div>
                    </div>

                    {/* Footer: Joined date & Last Active */}
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                      <span>Joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                      <span>Active: {formatRelativeTime(m.lastSubmittedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default TrackerMembers;
