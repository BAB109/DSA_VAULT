import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, FolderGit2, Users, Timer, RotateCcw, Plus, Trash2,
  ExternalLink, CheckCircle2, Clock, AlertCircle, Award, FileText,
  Building, ChevronRight, Star, ShieldCheck, Code2
} from 'lucide-react';
import { csFundamentalsService } from '../../services/csFundamentalsService';
import { Card, CardHeader, CardBody } from '../Card';
import { LoadingState, ErrorState, EmptyState } from '../States';

export function PlacementInterviewCenter({ onOpenTopic }) {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'applications' | 'mocks' | 'timed' | 'revision'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [projects, setProjects] = useState([]);
  const [applications, setApplications] = useState([]);
  const [mockInterviews, setMockInterviews] = useState([]);
  const [timedAssessments, setTimedAssessments] = useState([]);
  const [weeklyRevision, setWeeklyRevision] = useState(null);

  // Forms states
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  const [showMockForm, setShowMockForm] = useState(false);
  const [showTimedForm, setShowTimedForm] = useState(false);

  // Form input states
  const [newProject, setNewProject] = useState({
    title: '', description: '', tech_stack: '', architecture_overview: '',
    key_tradeoffs: '', challenging_questions: '', github_url: '', live_url: '',
    defense_readiness: 3
  });

  const [newApp, setNewApp] = useState({
    company: '', role: '', job_url: '', status: 'applied',
    salary_range: '', notes: '', next_step_date: ''
  });

  const [newMock, setNewMock] = useState({
    interview_type: 'DSA', interviewer: '', topic_focus: '',
    score: 8, strengths: '', areas_for_improvement: '', feedback: ''
  });

  const [newTimed, setNewTimed] = useState({
    assessment_title: '', topic_name: '', total_questions: 10,
    correct_count: 8, time_limit_seconds: 2700, time_spent_seconds: 2400
  });

  // Loaders
  const loadTabContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'projects') {
        const res = await csFundamentalsService.getPlacementProjects();
        setProjects(res.projects || []);
      } else if (activeTab === 'applications') {
        const res = await csFundamentalsService.getJobApplications();
        setApplications(res.applications || []);
      } else if (activeTab === 'mocks') {
        const res = await csFundamentalsService.getMockInterviews();
        setMockInterviews(res.mock_interviews || []);
      } else if (activeTab === 'timed') {
        const res = await csFundamentalsService.getTimedAssessments();
        setTimedAssessments(res.timed_assessments || []);
      } else if (activeTab === 'revision') {
        const res = await csFundamentalsService.getWeeklyRevision();
        setWeeklyRevision(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load placement track data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent]);

  // Project Handlers
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.title.trim()) return;
    try {
      const res = await csFundamentalsService.createPlacementProject({
        ...newProject,
        tech_stack: newProject.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
        defense_readiness: parseInt(newProject.defense_readiness, 10) || 3
      });
      setProjects([res.project, ...projects]);
      setShowProjectForm(false);
      setNewProject({
        title: '', description: '', tech_stack: '', architecture_overview: '',
        key_tradeoffs: '', challenging_questions: '', github_url: '', live_url: '',
        defense_readiness: 3
      });
    } catch (err) {
      alert(err.message || 'Failed to add project');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!confirm('Remove this project from your defense tracker?')) return;
    try {
      await csFundamentalsService.deletePlacementProject(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  // Job App Handlers
  const handleCreateApp = async (e) => {
    e.preventDefault();
    if (!newApp.company.trim() || !newApp.role.trim()) return;
    try {
      const res = await csFundamentalsService.createJobApplication(newApp);
      setApplications([res.application, ...applications]);
      setShowAppForm(false);
      setNewApp({
        company: '', role: '', job_url: '', status: 'applied',
        salary_range: '', notes: '', next_step_date: ''
      });
    } catch (err) {
      alert(err.message || 'Failed to add application');
    }
  };

  const handleUpdateAppStatus = async (id, status) => {
    try {
      const res = await csFundamentalsService.updateJobApplication(id, { status });
      setApplications(applications.map((a) => (a.id === id ? res.application : a)));
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDeleteApp = async (id) => {
    if (!confirm('Delete this application record?')) return;
    try {
      await csFundamentalsService.deleteJobApplication(id);
      setApplications(applications.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete application');
    }
  };

  // Mock Interview Handler
  const handleCreateMock = async (e) => {
    e.preventDefault();
    if (!newMock.interview_type.trim()) return;
    try {
      const res = await csFundamentalsService.createMockInterview({
        ...newMock,
        score: parseInt(newMock.score, 10) || 5
      });
      setMockInterviews([res.mock_interview, ...mockInterviews]);
      setShowMockForm(false);
      setNewMock({
        interview_type: 'DSA', interviewer: '', topic_focus: '',
        score: 8, strengths: '', areas_for_improvement: '', feedback: ''
      });
    } catch (err) {
      alert(err.message || 'Failed to record mock interview');
    }
  };

  // Timed Assessment Handler
  const handleCreateTimed = async (e) => {
    e.preventDefault();
    if (!newTimed.assessment_title.trim()) return;
    const total = parseInt(newTimed.total_questions, 10) || 10;
    const correct = parseInt(newTimed.correct_count, 10) || 0;
    const scorePct = Math.round((correct / total) * 100);
    const passed = scorePct >= 70;
    try {
      const res = await csFundamentalsService.createTimedAssessment({
        assessment_title: newTimed.assessment_title,
        topic_name: newTimed.topic_name,
        total_questions: total,
        correct_count: correct,
        score_percentage: scorePct,
        passed,
        time_limit_seconds: parseInt(newTimed.time_limit_seconds, 10) || 2700,
        time_spent_seconds: parseInt(newTimed.time_spent_seconds, 10) || 2400
      });
      setTimedAssessments([res.timed_assessment, ...timedAssessments]);
      setShowTimedForm(false);
      setNewTimed({
        assessment_title: '', topic_name: '', total_questions: 10,
        correct_count: 8, time_limit_seconds: 2700, time_spent_seconds: 2400
      });
    } catch (err) {
      alert(err.message || 'Failed to record assessment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-2 text-sm font-medium">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FolderGit2 size={16} />
          Projects Defense (Track D)
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'applications'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Briefcase size={16} />
          Applications Tracker
        </button>

        <button
          onClick={() => setActiveTab('mocks')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'mocks'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} />
          Mock Interviews (Track E)
        </button>

        <button
          onClick={() => setActiveTab('timed')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'timed'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Timer size={16} />
          Timed Assessments (Track B)
        </button>

        <button
          onClick={() => setActiveTab('revision')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'revision'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <RotateCcw size={16} />
          Weekly Revision
        </button>
      </div>

      {loading && <LoadingState message="Loading placement data..." />}
      {error && <ErrorState message={error} onRetry={loadTabContent} />}

      {/* ───────────────── TAB 1: PROJECTS DEFENSE ───────────────── */}
      {!loading && !error && activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-600" />
                Track D: Deep Project Defense
              </h3>
              <p className="text-xs text-blue-700 mt-1 max-w-2xl">
                Top tier interviewers probe deeply into your projects: architecture decisions, trade-offs between alternatives, bottlenecks, and edge cases. Prepare bulletproof answers for each project below.
              </p>
            </div>
            <button
              onClick={() => setShowProjectForm(!showProjectForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs"
            >
              <Plus size={14} />
              {showProjectForm ? 'Cancel' : 'Add Project for Defense'}
            </button>
          </div>

          {showProjectForm && (
            <Card>
              <CardHeader title="Add Resume Project for Deep Defense" />
              <CardBody>
                <form onSubmit={handleCreateProject} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Project Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Distributed Key-Value Store / DSA Tracker"
                        value={newProject.title}
                        onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Tech Stack (comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. Node.js, PostgreSQL, Redis, Docker, C++"
                        value={newProject.tech_stack}
                        onChange={(e) => setNewProject({ ...newProject, tech_stack: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Problem Solved</label>
                    <textarea
                      rows={2}
                      placeholder="What does this system do and why did you build it?"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Architecture Overview & Core Components</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 3-tier REST API with write-through Redis caching layer, connection pooler, background job worker..."
                      value={newProject.architecture_overview}
                      onChange={(e) => setNewProject({ ...newProject, architecture_overview: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Key Trade-offs Made</label>
                      <textarea
                        rows={2}
                        placeholder="Why PostgreSQL over MongoDB? Why polling vs websockets?"
                        value={newProject.key_tradeoffs}
                        onChange={(e) => setNewProject({ ...newProject, key_tradeoffs: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hardest Technical Questions Anticipated</label>
                      <textarea
                        rows={2}
                        placeholder="How do you handle database failover? How does cache invalidation occur?"
                        value={newProject.challenging_questions}
                        onChange={(e) => setNewProject({ ...newProject, challenging_questions: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">GitHub URL</label>
                      <input
                        type="url"
                        placeholder="https://github.com/..."
                        value={newProject.github_url}
                        onChange={(e) => setNewProject({ ...newProject, github_url: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Live Demo URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={newProject.live_url}
                        onChange={(e) => setNewProject({ ...newProject, live_url: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Defense Readiness (1-5)</label>
                      <select
                        value={newProject.defense_readiness}
                        onChange={(e) => setNewProject({ ...newProject, defense_readiness: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="1">1 - Just Started</option>
                        <option value="2">2 - Needs Revision</option>
                        <option value="3">3 - Moderate Confidence</option>
                        <option value="4">4 - High Confidence</option>
                        <option value="5">5 - Interview Ready</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProjectForm(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Save Project
                    </button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {projects.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={FolderGit2}
                  title="No interview projects tracked yet"
                  description="Add 1 or 2 core projects from your resume and document their architecture, trade-offs, and failure modes so you are fully prepared to defend them in interviews."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <Card key={proj.id} className="relative group hover:border-indigo-300 transition-colors">
                  <CardBody>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{proj.title}</h4>
                        {proj.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{proj.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {proj.tech_stack.map((tech, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}

                    {proj.architecture_overview && (
                      <div className="mt-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1 mb-1">
                          <Code2 size={12} className="text-indigo-600" /> Architecture
                        </span>
                        <p className="text-xs text-gray-600 leading-relaxed">{proj.architecture_overview}</p>
                      </div>
                    )}

                    {proj.key_tradeoffs && (
                      <div className="mt-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                        <span className="text-xs font-bold text-amber-800 block mb-0.5">Key Trade-offs</span>
                        <p className="text-xs text-amber-900 leading-relaxed">{proj.key_tradeoffs}</p>
                      </div>
                    )}

                    {proj.challenging_questions && (
                      <div className="mt-2 bg-purple-50/60 p-2.5 rounded-lg border border-purple-100">
                        <span className="text-xs font-bold text-purple-800 block mb-0.5">Defense Question</span>
                        <p className="text-xs text-purple-900 leading-relaxed">{proj.challenging_questions}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1 text-amber-600 font-semibold">
                        <Star size={12} fill="currentColor" />
                        <span>Readiness: {proj.defense_readiness}/5</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {proj.github_url && (
                          <a
                            href={proj.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-500 hover:text-indigo-600 flex items-center gap-0.5"
                          >
                            <ExternalLink size={12} /> Code
                          </a>
                        )}
                        {proj.live_url && (
                          <a
                            href={proj.live_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-500 hover:text-indigo-600 flex items-center gap-0.5"
                          >
                            <ExternalLink size={12} /> Live
                          </a>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────── TAB 2: APPLICATIONS TRACKER ───────────────── */}
      {!loading && !error && activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Job & Internship Applications</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Track campus and off-campus tech placement applications simultaneously with your study path.
              </p>
            </div>
            <button
              onClick={() => setShowAppForm(!showAppForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0"
            >
              <Plus size={14} />
              {showAppForm ? 'Cancel' : 'Add Application'}
            </button>
          </div>

          {showAppForm && (
            <Card>
              <CardHeader title="Record Job Application" />
              <CardBody>
                <form onSubmit={handleCreateApp} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Google, Amazon, Atlassian, Startup"
                        value={newApp.company}
                        onChange={(e) => setNewApp({ ...newApp, company: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Role Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SDE 1 / Software Engineer Intern"
                        value={newApp.role}
                        onChange={(e) => setNewApp({ ...newApp, role: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                      <select
                        value={newApp.status}
                        onChange={(e) => setNewApp({ ...newApp, status: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="applied">Applied</option>
                        <option value="oa">Online Assessment (OA)</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="offered">Offer Received 🎉</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Salary / CTC</label>
                      <input
                        type="text"
                        placeholder="e.g. 18-24 LPA / 50k stipend"
                        value={newApp.salary_range}
                        onChange={(e) => setNewApp({ ...newApp, salary_range: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Next Step / Deadline</label>
                      <input
                        type="date"
                        value={newApp.next_step_date}
                        onChange={(e) => setNewApp({ ...newApp, next_step_date: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Job Link</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newApp.job_url}
                      onChange={(e) => setNewApp({ ...newApp, job_url: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Referral info</label>
                    <textarea
                      rows={2}
                      placeholder="Referral contact, recruiter email, questions asked in OA..."
                      value={newApp.notes}
                      onChange={(e) => setNewApp({ ...newApp, notes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAppForm(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Save Application
                    </button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {applications.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={Building}
                  title="No job applications tracked yet"
                  description="Keep track of target companies, online assessments, and interview schedules in one central dashboard."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Company & Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">CTC / Stipend</th>
                    <th className="px-4 py-3">Next Step</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{app.company}</div>
                        <div className="text-gray-500 text-[11px]">{app.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={app.status}
                          onChange={(e) => handleUpdateAppStatus(app.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border cursor-pointer ${
                            app.status === 'offered' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            app.status === 'interviewing' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            app.status === 'oa' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                            app.status === 'rejected' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                            'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="applied">Applied</option>
                          <option value="oa">OA Pending</option>
                          <option value="interviewing">Interviewing</option>
                          <option value="offered">Offer Received 🎉</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{app.salary_range || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {app.next_step_date ? new Date(app.next_step_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500" title={app.notes}>
                        {app.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {app.job_url && (
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-indigo-600"
                              title="Open link"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteApp(app.id)}
                            className="text-gray-400 hover:text-red-600 p-0.5"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── TAB 3: MOCK INTERVIEWS ───────────────── */}
      {!loading && !error && activeTab === 'mocks' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Track E: Mock Interviews & Feedback Loop
              </h3>
              <p className="text-xs text-emerald-700 mt-1 max-w-2xl">
                Simulate high-pressure technical interviews with peers, mentors, or AI. Record interviewer feedback, identify weak spots in real-time communication, and track your readiness trajectory.
              </p>
            </div>
            <button
              onClick={() => setShowMockForm(!showMockForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs"
            >
              <Plus size={14} />
              {showMockForm ? 'Cancel' : 'Record Mock Interview'}
            </button>
          </div>

          {showMockForm && (
            <Card>
              <CardHeader title="Record Mock Interview Session" />
              <CardBody>
                <form onSubmit={handleCreateMock} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Interview Type *</label>
                      <select
                        value={newMock.interview_type}
                        onChange={(e) => setNewMock({ ...newMock, interview_type: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="DSA">DSA / Problem Solving</option>
                        <option value="System Design">System Design / LLD</option>
                        <option value="CS Core">Core CS (OS/DBMS/CN)</option>
                        <option value="Behavioral">Behavioral / HR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Interviewer Name / Peer</label>
                      <input
                        type="text"
                        placeholder="e.g. Peer Mock / Senior Mentor"
                        value={newMock.interviewer}
                        onChange={(e) => setNewMock({ ...newMock, interviewer: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Score (out of 10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newMock.score}
                        onChange={(e) => setNewMock({ ...newMock, score: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Topic / Problem Focus</label>
                    <input
                      type="text"
                      placeholder="e.g. Graph BFS Shortest Path, Redis Cache Design, OS Deadlocks"
                      value={newMock.topic_focus}
                      onChange={(e) => setNewMock({ ...newMock, topic_focus: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Strengths Demonstrated</label>
                      <textarea
                        rows={2}
                        placeholder="Quick pattern recognition, clear variable naming, good edge case identification..."
                        value={newMock.strengths}
                        onChange={(e) => setNewMock({ ...newMock, strengths: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Areas for Improvement</label>
                      <textarea
                        rows={2}
                        placeholder="Explaining thoughts out loud, time complexity calculation, dry run before coding..."
                        value={newMock.areas_for_improvement}
                        onChange={(e) => setNewMock({ ...newMock, areas_for_improvement: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMockForm(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Save Mock Session
                    </button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {mockInterviews.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={Users}
                  title="No mock interviews recorded yet"
                  description="Conducting at least 3-5 mock interviews before your actual placement season dramatically reduces interview anxiety and improves communication."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {mockInterviews.map((mock) => (
                <div
                  key={mock.id}
                  className="bg-white border border-gray-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        {mock.interview_type}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">{mock.topic_focus || 'Mock Interview'}</h4>
                      {mock.interviewer && (
                        <span className="text-xs text-gray-400">with {mock.interviewer}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <Award size={14} />
                      {mock.score}/10
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                    {mock.strengths && (
                      <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                        <span className="font-bold text-emerald-800 block mb-0.5">Strengths</span>
                        <p className="text-emerald-900">{mock.strengths}</p>
                      </div>
                    )}
                    {mock.areas_for_improvement && (
                      <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                        <span className="font-bold text-amber-800 block mb-0.5">Improvement Areas</span>
                        <p className="text-amber-900">{mock.areas_for_improvement}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────── TAB 4: TIMED ASSESSMENTS ───────────────── */}
      {!loading && !error && activeTab === 'timed' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                <Timer size={18} className="text-purple-600" />
                Track B: Timed Assessments & Speed Rounds
              </h3>
              <p className="text-xs text-purple-700 mt-1 max-w-2xl">
                Top companies evaluate speed, precision, and accuracy under strict time limits (typically 45–60 minutes for 2 coding questions or 20 MCQs). Log your timed test attempts here.
              </p>
            </div>
            <button
              onClick={() => setShowTimedForm(!showTimedForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs"
            >
              <Plus size={14} />
              {showTimedForm ? 'Cancel' : 'Log Timed Test'}
            </button>
          </div>

          {showTimedForm && (
            <Card>
              <CardHeader title="Log Timed Assessment Simulation" />
              <CardBody>
                <form onSubmit={handleCreateTimed} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Assessment / Contest Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 45-min DSA OA Simulation / OOP & DBMS Blitz"
                        value={newTimed.assessment_title}
                        onChange={(e) => setNewTimed({ ...newTimed, assessment_title: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Topic / Category</label>
                      <input
                        type="text"
                        placeholder="e.g. Dynamic Programming, Trees & Graphs, OS"
                        value={newTimed.topic_name}
                        onChange={(e) => setNewTimed({ ...newTimed, topic_name: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Total Questions</label>
                      <input
                        type="number"
                        min="1"
                        value={newTimed.total_questions}
                        onChange={(e) => setNewTimed({ ...newTimed, total_questions: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Correct Answers</label>
                      <input
                        type="number"
                        min="0"
                        value={newTimed.correct_count}
                        onChange={(e) => setNewTimed({ ...newTimed, correct_count: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Time Limit (mins)</label>
                      <input
                        type="number"
                        min="5"
                        defaultValue={45}
                        onChange={(e) => setNewTimed({ ...newTimed, time_limit_seconds: (parseInt(e.target.value, 10) || 45) * 60 })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Time Spent (mins)</label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={40}
                        onChange={(e) => setNewTimed({ ...newTimed, time_spent_seconds: (parseInt(e.target.value, 10) || 40) * 60 })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTimedForm(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Record Test
                    </button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {timedAssessments.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={Timer}
                  title="No timed assessments recorded yet"
                  description="Use each topic's Knowledge Assessment or timed coding contest simulators to build speed under time constraints."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {timedAssessments.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-gray-200/90 rounded-xl p-4 shadow-2xs hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">{t.assessment_title}</h4>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {t.passed ? '✓ PASSED' : 'NEEDS PRACTICE'}
                    </span>
                  </div>
                  {t.topic_name && <p className="text-xs text-gray-500 mt-1">{t.topic_name}</p>}

                  <div className="mt-3 flex items-center justify-between text-xs border-t border-gray-100 pt-2">
                    <span className="font-bold text-purple-700 text-sm">{t.score_percentage}%</span>
                    <span className="text-gray-500">{t.correct_count} / {t.total_questions} correct</span>
                    <span className="text-gray-400 flex items-center gap-1">
                      <Clock size={11} />
                      {Math.round(t.time_spent_seconds / 60)}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────── TAB 5: WEEKLY REVISION ───────────────── */}
      {!loading && !error && activeTab === 'revision' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <RotateCcw size={18} className="text-amber-600" />
              Spaced Repetition & Weekly Revision
            </h3>
            <p className="text-xs text-amber-700 mt-1">
              Active recall is crucial for placement retention. Review your previously completed topics and retake short assessments to prevent forgetting curve decay.
            </p>
          </div>

          {weeklyRevision && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">
                  {weeklyRevision.total_completed} completed topics available for spaced review
                </span>
              </div>

              {weeklyRevision.total_completed === 0 ? (
                <Card>
                  <CardBody>
                    <EmptyState
                      icon={RotateCcw}
                      title="No completed topics yet"
                      description="Once you complete topics in the curriculum, they will appear here grouped by module for weekly retention review."
                    />
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {weeklyRevision.revision_by_module?.map((mod) => (
                    <Card key={mod.module_id}>
                      <CardHeader
                        title={`Module ${mod.module_seq}: ${mod.module_title}`}
                        subtitle={`${mod.topics.length} completed topics`}
                      />
                      <CardBody className="p-0">
                        <div className="divide-y divide-gray-100">
                          {mod.topics.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => onOpenTopic(t.id)}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-medium text-gray-900 truncate">{t.title}</p>
                                <p className="text-[10px] text-gray-400">
                                  Done {t.completed_at ? new Date(t.completed_at).toLocaleDateString() : '—'}
                                </p>
                              </div>
                              <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1 shrink-0">
                                Review <ChevronRight size={12} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
