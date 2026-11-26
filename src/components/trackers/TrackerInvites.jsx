import { useState, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';
import { adminService } from '../../services/adminService';

export function TrackerInvites({ trackerId, service = adminService }) {
  const activeService = service || adminService;
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ expiresInDays: 7, maxUses: 10 });
  const [creating, setCreating] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const fetchInvites = useCallback(async () => {
    try {
      setError(null);
      const data = await activeService.getInvites(trackerId);
      setInvites(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load invites.');
    } finally {
      setLoading(false);
    }
  }, [trackerId, activeService]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setNewInviteLink(null);
    try {
      const res = await activeService.createInvite(trackerId, {
        expiresInDays: parseInt(form.expiresInDays, 10),
        maxUses: parseInt(form.maxUses, 10),
      });
      const token = res.invite?.token;
      if (token) {
        const fullUrl = `${window.location.origin}/trackers/join#t=${token}`;
        setNewInviteLink(fullUrl);
      }
      fetchInvites();
    } catch (err) {
      alert(err.message || 'Failed to generate invite link.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId) => {
    if (!window.confirm('Are you sure you want to revoke this invite?')) return;
    setRevokingId(inviteId);
    try {
      await activeService.revokeInvite(trackerId, inviteId);
      setInvites((prev) =>
        prev.map((inv) => (inv.id === inviteId ? { ...inv, revoked: true } : inv))
      );
    } catch (err) {
      alert(err.message || 'Failed to revoke invite.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Invite Links"
        subtitle="Generate direct invite links for members to join immediately."
      />
      <CardBody className="p-5 space-y-5">
        {/* Generate Form */}
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Expires In (Days)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={form.expiresInDays}
              onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
              className="w-28 px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Max Uses
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              className="w-28 px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
          >
            {creating ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </form>

        {/* Reveal Box (One-time only) */}
        {newInviteLink && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                One-Time Invite Link Generated:
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newInviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={newInviteLink}
              className="w-full px-3 py-2 bg-white text-xs font-mono text-gray-800 border border-indigo-200 rounded-lg outline-none select-all"
            />
            <p className="text-xs text-amber-700">
              ⚠️ The invite token is never stored in plaintext and cannot be shown again. Copy it now.
            </p>
          </div>
        )}

        {/* Existing Invites Table */}
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            Active & Past Invites
          </h4>
          {loading ? (
            <p className="text-xs text-gray-400">Loading invites...</p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : invites.length === 0 ? (
            <p className="text-xs text-gray-400">No invite links created yet.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                  <tr>
                    <th className="py-2 px-3">Expires At</th>
                    <th className="py-2 px-3 text-center">Uses</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invites.map((inv) => {
                    const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                    const isActive = !inv.revoked && !isExpired;
                    return (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-700 font-mono">
                          {inv.useCount} / {inv.maxUses}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {inv.revoked ? (
                            <span className="text-red-600 font-medium">Revoked</span>
                          ) : isExpired ? (
                            <span className="text-gray-400">Expired</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Active</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isActive && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              disabled={revokingId === inv.id}
                              className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              {revokingId === inv.id ? 'Revoking...' : 'Revoke'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
