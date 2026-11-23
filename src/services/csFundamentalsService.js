/**
 * CS Fundamentals Learning Path API service.
 * Follows the same conventions as problemService.js.
 */
import { apiClient } from './apiClient.js';

export const csFundamentalsService = {
  /** Full curriculum with user progress overlaid */
  async getCurriculum() {
    return apiClient('/cs-fundamentals/curriculum');
  },

  /** Active (current unlocked) topic */
  async getActiveTopic() {
    return apiClient('/cs-fundamentals/active-topic');
  },

  /** Single topic detail (includes checklist, prev/next nav) */
  async getTopic(id) {
    return apiClient(`/cs-fundamentals/topics/${id}`);
  },

  /** Toggle a checklist item */
  async toggleChecklistItem(topicId, itemId, checked) {
    return apiClient(`/cs-fundamentals/topics/${topicId}/checklist/${itemId}`, {
      method: 'POST',
      body: JSON.stringify({ checked }),
    });
  },

  /** Mark the active topic as complete */
  async completeTopic(topicId) {
    return apiClient(`/cs-fundamentals/topics/${topicId}/complete`, {
      method: 'POST',
    });
  },

  /** Dashboard stats */
  async getStats() {
    return apiClient('/cs-fundamentals/stats');
  },

  // ── Daily Learning Experience ──────────────────────────────────────────────

  /** "Today's Learning" panel — active topic, goals, streak, overall stats */
  async getDaily() {
    return apiClient('/cs-fundamentals/daily');
  },

  /** Study history grouped by day */
  async getHistory() {
    return apiClient('/cs-fundamentals/history');
  },

  /** CS-only learning streak (independent from DSA streak) */
  async getLearningStreak() {
    return apiClient('/cs-fundamentals/learning-streak');
  },

  /** Record a manual study activity ('started' or 'checklist_updated') */
  async logStudyActivity(topicId, activity) {
    return apiClient('/cs-fundamentals/study-log', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, activity }),
    });
  },

  /** Retrieve CS-specific user settings */
  async getCsSettings() {
    return apiClient('/cs-fundamentals/cs-settings');
  },

  /** Update CS-specific user settings */
  async updateCsSettings(data) {
    return apiClient('/cs-fundamentals/cs-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ── Knowledge Assessments ──────────────────────────────────────────────────

  /** Assessment questions + config + past attempt summaries for a topic */
  async getAssessment(topicId) {
    return apiClient(`/cs-assessments/topics/${topicId}/assessment`);
  },

  /** Submit answers; server calculates score and returns results + explanations */
  async submitAssessment(topicId, answers) {
    return apiClient(`/cs-assessments/topics/${topicId}/assessment`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  /** Full attempt history with per-question answers and explanations */
  async getAssessmentAttempts(topicId) {
    return apiClient(`/cs-assessments/topics/${topicId}/assessment/attempts`);
  },

  /** Quick pass-status check (has user passed mandatory assessment?) */
  async getAssessmentPassStatus(topicId) {
    return apiClient(`/cs-assessments/topics/${topicId}/pass-status`);
  },

  // ── Placement & Interview Preparation ──────────────────────────────────────

  /** Get structured interview projects */
  async getPlacementProjects() {
    return apiClient('/cs-fundamentals/placement/projects');
  },

  /** Create a structured interview project */
  async createPlacementProject(data) {
    return apiClient('/cs-fundamentals/placement/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Update an interview project */
  async updatePlacementProject(id, data) {
    return apiClient(`/cs-fundamentals/placement/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /** Delete an interview project */
  async deletePlacementProject(id) {
    return apiClient(`/cs-fundamentals/placement/projects/${id}`, {
      method: 'DELETE',
    });
  },

  /** Get internship and job applications */
  async getJobApplications() {
    return apiClient('/cs-fundamentals/placement/applications');
  },

  /** Create job application */
  async createJobApplication(data) {
    return apiClient('/cs-fundamentals/placement/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Update job application */
  async updateJobApplication(id, data) {
    return apiClient(`/cs-fundamentals/placement/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /** Delete job application */
  async deleteJobApplication(id) {
    return apiClient(`/cs-fundamentals/placement/applications/${id}`, {
      method: 'DELETE',
    });
  },

  /** Get mock interview records */
  async getMockInterviews() {
    return apiClient('/cs-fundamentals/placement/mock-interviews');
  },

  /** Record a mock interview */
  async createMockInterview(data) {
    return apiClient('/cs-fundamentals/placement/mock-interviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Get timed assessment sessions */
  async getTimedAssessments() {
    return apiClient('/cs-fundamentals/placement/timed-assessments');
  },

  /** Record a timed assessment */
  async createTimedAssessment(data) {
    return apiClient('/cs-fundamentals/placement/timed-assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Get weekly revision plan (weak problems, due reviews, weak assessments, mock action items) */
  async getWeeklyRevision() {
    return apiClient('/cs-fundamentals/placement/weekly-revision');
  },
};

export default csFundamentalsService;

