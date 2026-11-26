import { adminApi, clearAdminToken, getAdminToken, hasValidAdminToken } from './adminApi';

export const adminService = {
  // Authentication
  logout: () => {
    clearAdminToken();
  },
  isAuthenticated: () => hasValidAdminToken(),
  getToken: () => getAdminToken(),

  // Trackers overview & management
  getTrackers: () => adminApi('/admin/trackers'),
  getTracker: (id) => adminApi(`/admin/trackers/${id}`),
  createTracker: (data) =>
    adminApi('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTracker: (id, data) =>
    adminApi(`/admin/trackers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTracker: (id, confirmName) =>
    adminApi(`/admin/trackers/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName }),
    }),

  // Sheet operations
  getSheet: (id) => adminApi(`/admin/trackers/${id}/sheet`),
  previewSheet: (id, { csv, mode = 'replace' }) =>
    adminApi(`/admin/trackers/${id}/sheet/preview`, {
      method: 'POST',
      body: JSON.stringify({ csv, mode }),
    }),
  confirmSheet: (id, { csv, mode = 'replace' }) =>
    adminApi(`/admin/trackers/${id}/sheet/confirm`, {
      method: 'POST',
      body: JSON.stringify({ csv, mode }),
    }),
  addSheetItem: (id, { lc_number, position }) =>
    adminApi(`/admin/trackers/${id}/sheet/items`, {
      method: 'POST',
      body: JSON.stringify({ lc_number, position }),
    }),
  deleteSheetItem: (id, catalogId) =>
    adminApi(`/admin/trackers/${id}/sheet/items/${catalogId}`, {
      method: 'DELETE',
    }),
  reorderSheet: (id, order) =>
    adminApi(`/admin/trackers/${id}/sheet/order`, {
      method: 'PUT',
      body: JSON.stringify({ order }),
    }),
  clearUpcoming: (id) =>
    adminApi(`/admin/trackers/${id}/sheet/clear-upcoming`, {
      method: 'POST',
    }),

  // Tracker membership & invites (Admin token authenticated)
  getMembers: (id) => adminApi(`/admin/trackers/${id}/members`),
  getJoinRequests: (id) => adminApi(`/admin/trackers/${id}/requests`),
  decideJoinRequest: (id, reqId, decision) =>
    adminApi(`/admin/trackers/${id}/requests/${reqId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  getInvites: (id) => adminApi(`/admin/trackers/${id}/invites`),
  createInvite: (id, { expiresInDays = 7, maxUses = 10 } = {}) =>
    adminApi(`/admin/trackers/${id}/invites`, {
      method: 'POST',
      body: JSON.stringify({ expiresInDays, maxUses }),
    }),
  revokeInvite: (trackerId, inviteId) =>
    adminApi(`/admin/trackers/${trackerId}/invites/${inviteId}`, { method: 'DELETE' }),
  removeMember: (trackerId, userId) =>
    adminApi(`/admin/trackers/${trackerId}/members/${userId}/remove`, { method: 'POST' }),

  // Audit log
  getAudit: (trackerId = null, limit = 50) => {
    const params = new URLSearchParams();
    if (trackerId) params.set('trackerId', trackerId);
    if (limit) params.set('limit', String(limit));
    return adminApi(`/admin/audit?${params.toString()}`);
  },

  // Catalog search (can use adminApi for admin views)
  searchCatalog: (query) => {
    if (!query || !query.trim()) return Promise.resolve([]);
    return adminApi(`/admin/catalog?q=${encodeURIComponent(query.trim())}`);
  },
};
