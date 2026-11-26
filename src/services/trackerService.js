import { apiClient } from './apiClient';

export const trackerService = {
  // My trackers & requests
  getMyTrackers: () => apiClient('/trackers/my'),
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
};

export default trackerService;
