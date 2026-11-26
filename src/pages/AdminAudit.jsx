import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, RefreshCw, AlertCircle, Shield } from 'lucide-react';
import { adminService } from '../services/adminService';
import { TableSkeleton } from '../components/admin/AdminSkeleton';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setError(null);
      const data = await adminService.getAudit(null, limit);
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit log.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    setLoading(true);
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const formatAction = (action) => {
    if (!action) return 'Unknown Action';
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
              <ScrollText size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Audit & Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Log</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Immutable log of all administrative actions, sheet modifications, and membership decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Limit selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="audit-limit" className="text-xs font-semibold text-gray-600">
              Limit:
            </label>
            <select
              id="audit-limit"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={25}>25 entries</option>
              <option value={50}>50 entries</option>
              <option value={100}>100 entries</option>
              <option value={200}>200 entries</option>
            </select>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchAuditLogs();
            }}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors disabled:opacity-50"
            title="Refresh audit log"
            aria-label="Refresh audit log"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
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
              fetchAuditLogs();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ScrollText size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-900">No audit records</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
            No administrative mutation records have been recorded yet.
          </p>
        </div>
      ) : (
        /* ── Audit Log Table ── */
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Admin</th>
                  <th className="py-3 px-4">Tracker Room</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {logs.map((log) => {
                  const dateObj = new Date(log.created_at);
                  const timeStr = dateObj.toLocaleTimeString();
                  const dateStr = dateObj.toLocaleDateString();

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap font-sans text-xs">
                        <div className="font-medium text-gray-900">{dateStr}</div>
                        <div className="text-[10px] text-gray-400">{timeStr}</div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap font-sans">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {formatAction(log.action)}
                        </span>
                      </td>

                      {/* Admin User */}
                      <td className="py-3 px-4 text-gray-800 font-medium whitespace-nowrap font-sans">
                        {log.admin_username ? (
                          <div className="flex items-center gap-1.5">
                            <Shield size={12} className="text-indigo-500" />
                            <span>{log.admin_username}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">System / Unknown</span>
                        )}
                      </td>

                      {/* Tracker */}
                      <td className="py-3 px-4 font-sans text-xs whitespace-nowrap">
                        {log.tracker_name ? (
                          log.tracker_id ? (
                            <Link
                              to={`/admin/trackers/${log.tracker_id}`}
                              className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                            >
                              {log.tracker_name}
                            </Link>
                          ) : (
                            <span className="text-gray-700">{log.tracker_name}</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs sm:max-w-md truncate text-gray-600">
                        {log.details ? (
                          <span
                            title={JSON.stringify(log.details, null, 2)}
                            className="bg-gray-100 px-2 py-0.5 rounded text-[10px] border border-gray-200"
                          >
                            {typeof log.details === 'object'
                              ? Object.entries(log.details)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ')
                              : String(log.details)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
