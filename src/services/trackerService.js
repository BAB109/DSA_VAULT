import { apiClient } from './apiClient';

export const trackerService = {
  // My trackers & requests
  getMyTrackers: () => apiClient('/trackers/my'),
  createTracker: (data) =>
    apiClient('/trackers', { method: 'POST', body: JSON.stringify(data) }),
  submitJoinRequest: (publicCode, message) =>
    apiClient('/trackers/requests', {
      method: 'POST',
      body: JSON.stringify({ publicCode, message }),
    }),
  cancelJoinRequest: (id) =>
    apiClient(`/trackers/requests/${id}`, { method: 'DELETE' }),
  acceptInvite: (token) =>
    apiClient('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Tracker details & members
  getTracker: (id) => apiClient(`/trackers/${id}`),
  getMembers: (id) => apiClient(`/trackers/${id}/members`),
  leaveTracker: (id) =>
    apiClient(`/trackers/${id}/leave`, { method: 'DELETE' }),

  // Assignments & Submissions
  getToday: (id) => apiClient(`/trackers/${id}/today`),
  getPending: (id) => apiClient(`/trackers/${id}/pending`),
  getBoard: (id) => apiClient(`/trackers/${id}/board`),
  submitSolution: (trackerId, assignmentId, { solutionUrl, timeTaken, notes }) =>
    apiClient(`/trackers/${trackerId}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ solutionUrl, timeTaken, notes }),
    }),

  // Admin routes
  getJoinRequests: (id) => apiClient(`/trackers/${id}/requests`),
  decideJoinRequest: (id, reqId, decision) =>
    apiClient(`/trackers/${id}/requests/${reqId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  getInvites: (id) => apiClient(`/trackers/${id}/invites`),
  createInvite: (id, { expiresInDays = 7, maxUses = 10 } = {}) =>
    apiClient(`/trackers/${id}/invites`, {
      method: 'POST',
      body: JSON.stringify({ expiresInDays, maxUses }),
    }),
  revokeInvite: (trackerId, inviteId) =>
    apiClient(`/trackers/${trackerId}/invites/${inviteId}`, { method: 'DELETE' }),
  removeMember: (trackerId, userId) =>
    apiClient(`/trackers/${trackerId}/members/${userId}/remove`, { method: 'POST' }),
  updateSettings: (id, data) =>
    apiClient(`/trackers/${id}/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  previewSheet: (id, csv) =>
    apiClient(`/trackers/${id}/sheet/preview`, {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  confirmSheet: (id, csv) =>
    apiClient(`/trackers/${id}/sheet/confirm`, {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
};

export default trackerService;
