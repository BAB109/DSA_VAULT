// ==============================================================================
// PROBLEM SERVICE - Centralized API Service for Problems, Topics & Revisions
// Direct integration with Express & PostgreSQL Backend API.
// No mock data in production application flows.
// ==============================================================================

import apiClient from './apiClient';

export const problemService = {
  /**
   * GET /api/problems with optional query parameters (search, difficulty, platform, status, topic)
   */
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.difficulty) query.append('difficulty', params.difficulty);
    if (params.platform) query.append('platform', params.platform);
    if (params.status) query.append('status', params.status);
    if (params.topic) query.append('topic', params.topic);
    if (params.reviewed !== undefined && params.reviewed !== '') query.append('reviewed', params.reviewed);
    if (params.revision) query.append('revision', params.revision);
    if (params.sort) query.append('sort', params.sort);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const queryString = query.toString();
    const endpoint = queryString ? `/problems?${queryString}` : '/problems';
    return apiClient(endpoint, { method: 'GET' });
  },

  /**
   * GET /api/problems/:id
   */
  getById: async (id) => {
    return apiClient(`/problems/${id}`, { method: 'GET' });
  },

  /**
   * POST /api/problems
   */
  create: async (data) => {
    return apiClient('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT /api/problems/:id
   */
  update: async (id, data) => {
    return apiClient(`/problems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * DELETE /api/problems/:id
   */
  delete: async (id) => {
    return apiClient(`/problems/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * POST /api/problems/:id/revisions
   */
  recordRevision: async (id, revisionData) => {
    return apiClient(`/problems/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(revisionData),
    });
  },

  /**
   * POST /api/problems/:id/reschedule
   */
  reschedule: async (id, nextRevisionDate) => {
    return apiClient(`/problems/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ nextRevisionDate }),
    });
  },

  /**
   * GET /api/topics
   */
  getTopics: async () => {
    return apiClient('/topics', { method: 'GET' });
  },

  /**
   * GET /api/analytics - Comprehensive dashboard metrics, charts, and topic progress
   */
  getAnalytics: async (tz) => {
    const timeZone = tz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
    return apiClient(`/analytics?tz=${encodeURIComponent(timeZone)}`, { method: 'GET' });
  },
};

export const settingsService = {
  get: async () => {
    const defaultTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    try {
      const serverSettings = await apiClient('/settings', { method: 'GET' });
      return {
        goals: {
          dailyProblems: serverSettings.dailyProblemGoal ?? serverSettings.dailyGoal ?? 3,
          dailyRevisions: serverSettings.dailyRevisionGoal ?? 2,
          weeklyProblems: serverSettings.weeklyGoal ?? 15,
        },
        revisionIntervals: {
          stage1: serverSettings.intervals?.[0] ?? 1,
          stage2: serverSettings.intervals?.[1] ?? 3,
          stage3: serverSettings.intervals?.[2] ?? 7,
          stage4: serverSettings.intervals?.[3] ?? 14,
          stage5: serverSettings.intervals?.[4] ?? 30,
        },
        periodicInterval: serverSettings.periodicInterval ?? 30,
        timezone: serverSettings.timezone || defaultTz,
      };
    } catch {
      return {
        goals: { dailyProblems: 3, dailyRevisions: 2, weeklyProblems: 15 },
        revisionIntervals: { stage1: 1, stage2: 3, stage3: 7, stage4: 14, stage5: 30 },
        periodicInterval: 30,
        timezone: defaultTz,
      };
    }
  },
  update: async (data) => {
    const payload = {
      intervals: [
        data.revisionIntervals?.stage1 ?? 1,
        data.revisionIntervals?.stage2 ?? 3,
        data.revisionIntervals?.stage3 ?? 7,
        data.revisionIntervals?.stage4 ?? 14,
        data.revisionIntervals?.stage5 ?? 30,
      ],
      periodicInterval: data.periodicInterval ?? 30,
      dailyGoal: data.goals?.dailyProblems ?? 3,
      dailyProblemGoal: data.goals?.dailyProblems ?? 3,
      dailyRevisionGoal: data.goals?.dailyRevisions ?? 2,
      weeklyGoal: data.goals?.weeklyProblems ?? 15,
      timezone: data.timezone,
    };
    return apiClient('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
