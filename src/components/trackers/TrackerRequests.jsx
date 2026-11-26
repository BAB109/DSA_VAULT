import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardBody } from '../Card';
import { adminService } from '../../services/adminService';

export function TrackerRequests({ trackerId, onRequestCountChange, service = adminService }) {
  const activeService = service || adminService;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const data = await activeService.getJoinRequests(trackerId);
      const list = data || [];
      setRequests(list);
      onRequestCountChange?.(list.length);
    } catch (err) {
      setError(err.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [trackerId, onRequestCountChange, activeService]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleDecide = async (reqId, decision) => {
    setDecidingId(reqId);
    try {
      await activeService.decideJoinRequest(trackerId, reqId, decision);
      setRequests((prev) => {
        const next = prev.filter((r) => r.id !== reqId);
        onRequestCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      alert(err.message || `Failed to ${decision} request.`);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Join Requests"
        subtitle="Review and decide on join requests submitted with your public tracker code."
      />
      <CardBody className="p-5">
        {loading ? (
          <p className="text-xs text-gray-400 py-3">Loading requests...</p>
        ) : error ? (
          <p className="text-xs text-red-600 py-3">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">No pending join requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-gray-900">{req.username}</span>
                    <span className="text-[11px] text-gray-400">
                      Requested {new Date(req.created_at || req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {req.message && (
                    <p className="text-xs text-gray-600 mt-0.5 italic">"{req.message}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDecide(req.id, 'approve')}
                    disabled={decidingId === req.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {decidingId === req.id ? 'Saving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleDecide(req.id, 'reject')}
                    disabled={decidingId === req.id}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
