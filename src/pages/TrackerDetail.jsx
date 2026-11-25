import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock, CheckCircle2, Circle, AlertCircle,
  ExternalLink, Send, ArrowLeft, Flame, LogOut,
  Shield, Copy, Check, Download, Trash2,
  FileSpreadsheet, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trackerService } from '../services/trackerService';
import { Card, CardHeader, CardBody } from '../components/Card';
import { ConfirmModal } from '../components/Modal';
import { DifficultyBadge } from '../components/Badges';
import { LoadingState } from '../components/States';
import SubmitModal from '../components/trackers/SubmitModal';

export default function TrackerDetail() {
  const { id: trackerId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isAdmin = Boolean(session?.isAdmin);

  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'pending' | 'board' | 'admin'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Tracker Data
  const [tracker, setTracker] = useState(null);
  const [todayData, setTodayData] = useState({ sheetEmpty: false, sheetComplete: false, assignments: [] });
  const [pendingData, setPendingData] = useState({ pending: [], count: 0 });
  const [boardData, setBoardData] = useState([]);
  const [members, setMembers] = useState([]);

  // Modals
  const [submitAssignment, setSubmitAssignment] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Admin Tab States
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminInvites, setAdminInvites] = useState([]);
  const [newInviteLink, setNewInviteLink] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [publicCodeCopied, setPublicCodeCopied] = useState(false);
  const [inviteForm, setInviteForm] = useState({ expiresInDays: 7, maxUses: 10 });
  const [inviteCreating, setInviteCreating] = useState(false);

  // Admin Sheet States
  const [sheetCsvText, setSheetCsvText] = useState('');
  const [sheetPreview, setSheetPreview] = useState(null);
  const [sheetPreviewLoading, setSheetPreviewLoading] = useState(false);
  const [sheetConfirmLoading, setSheetConfirmLoading] = useState(false);
  const [sheetFeedback, setSheetFeedback] = useState(null);

  // Admin Settings States
  const [settingsForm, setSettingsForm] = useState({ per_day: 2, timezone: 'Asia/Kolkata' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);

  // Removing member state
  const [removingUserId, setRemovingUserId] = useState(null);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchTrackerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch base tracker info, today's assignments, pending, and board in parallel
      const [trackerRes, todayRes, pendingRes, boardRes, membersRes] = await Promise.all([
        trackerService.getTracker(trackerId),
        trackerService.getToday(trackerId).catch((err) => ({ error: err })),
        trackerService.getPending(trackerId).catch(() => ({ pending: [], count: 0 })),
        trackerService.getBoard(trackerId).catch(() => ({ board: [] })),
        trackerService.getMembers(trackerId).catch(() => []),
      ]);

      setTracker(trackerRes);
      setSettingsForm({
        per_day: trackerRes.perDay || 2,
        timezone: trackerRes.timezone || 'Asia/Kolkata',
      });

      if (!todayRes.error) {
        setTodayData(todayRes);
      }
      setPendingData(pendingRes);
      setBoardData(boardRes.board || []);
      setMembers(membersRes || []);

      // If admin, also pre-fetch requests & invites
      if (isAdmin) {
        Promise.all([
          trackerService.getJoinRequests(trackerId).catch(() => []),
          trackerService.getInvites(trackerId).catch(() => []),
        ]).then(([reqs, invs]) => {
          setAdminRequests(reqs);
          setAdminInvites(invs);
        });
      }
    } catch (err) {
      if (err.status === 404) {
        setError('Tracker not found or you are not a member of this tracker.');
      } else {
        setError(err.message || 'Failed to load tracker details.');
      }
    } finally {
      setLoading(false);
    }
  }, [trackerId, isAdmin]);

  useEffect(() => {
    fetchTrackerData();
  }, [fetchTrackerData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  // Leave Tracker
  const handleLeaveTracker = async () => {
    setIsLeaving(true);
    try {
      await trackerService.leaveTracker(trackerId);
      navigate('/trackers', { replace: true });
    } catch (err) {
      alert(err.message || 'Failed to leave tracker.');
      setIsLeaving(false);
      setIsLeaveModalOpen(false);
    }
  };

  // Copy Public Code
  const handleCopyCode = () => {
    if (tracker?.publicCode) {
      navigator.clipboard.writeText(tracker.publicCode);
      setPublicCodeCopied(true);
      setTimeout(() => setPublicCodeCopied(false), 2000);
    }
  };

  // Admin: Decide Join Request
  const handleDecideRequest = async (reqId, decision) => {
    try {
      await trackerService.decideJoinRequest(trackerId, reqId, decision);
      setAdminRequests((prev) => prev.filter((r) => r.id !== reqId));
      fetchTrackerData();
    } catch (err) {
      alert(err.message || `Failed to ${decision} request.`);
    }
  };

  // Admin: Create Invite
  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setInviteCreating(true);
    try {
      const res = await trackerService.createInvite(trackerId, inviteForm);
      const rawToken = res.invite?.token;
      if (rawToken) {
        const fullLink = `${window.location.origin}/trackers/join#t=${rawToken}`;
        setNewInviteLink(fullLink);
      }
      // Refresh invites list
      const updatedInvites = await trackerService.getInvites(trackerId);
      setAdminInvites(updatedInvites);
    } catch (err) {
      alert(err.message || 'Failed to create invite.');
    } finally {
      setInviteCreating(false);
    }
  };

  // Admin: Revoke Invite
  const handleRevokeInvite = async (inviteId) => {
    try {
      await trackerService.revokeInvite(trackerId, inviteId);
      setAdminInvites((prev) =>
        prev.map((inv) => (inv.id === inviteId ? { ...inv, revoked: true } : inv))
      );
    } catch (err) {
      alert(err.message || 'Failed to revoke invite.');
    }
  };

  // Admin: Remove Member
  const handleRemoveMember = async (userId) => {
    if (userId === session?.userId) return;
    if (!window.confirm('Are you sure you want to remove this member from the tracker?')) return;

    setRemovingUserId(userId);
    try {
      await trackerService.removeMember(trackerId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setBoardData((prev) => prev.filter((b) => b.userId !== userId));
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setRemovingUserId(null);
    }
  };

  // Admin: Download Example CSV
  const handleDownloadExampleCsv = () => {
    const csvContent = 'lc_number,position\n1,1\n2,2\n3,3\n15,4\n20,5';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'example_tracker_sheet.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Admin: Handle CSV File Upload
  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSheetCsvText(event.target?.result || '');
      setSheetPreview(null);
      setSheetFeedback(null);
    };
    reader.readAsText(file);
  };

  // Admin: Preview Sheet
  const handlePreviewSheet = async () => {
    if (!sheetCsvText.trim()) return;
    setSheetPreviewLoading(true);
    setSheetFeedback(null);
    try {
      const res = await trackerService.previewSheet(trackerId, sheetCsvText);
      setSheetPreview(res);
    } catch (err) {
      setSheetFeedback({
        type: 'error',
        message: err.data?.message || err.message || 'Failed to preview sheet.',
      });
    } finally {
      setSheetPreviewLoading(false);
    }
  };

  // Admin: Confirm Sheet
  const handleConfirmSheet = async () => {
    if (!sheetCsvText.trim()) return;
    setSheetConfirmLoading(true);
    setSheetFeedback(null);
    try {
      const res = await trackerService.confirmSheet(trackerId, sheetCsvText);
      setSheetFeedback({
        type: 'success',
        message: `Successfully updated sheet with ${res.count} problems!`,
      });
      setSheetPreview(null);
      setSheetCsvText('');
      fetchTrackerData();
    } catch (err) {
      setSheetFeedback({
        type: 'error',
        message: err.data?.message || err.message || 'Failed to confirm sheet.',
      });
    } finally {
      setSheetConfirmLoading(false);
    }
  };

  // Admin: Update Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsFeedback(null);
    try {
      const updated = await trackerService.updateSettings(trackerId, {
        per_day: parseInt(settingsForm.per_day, 10),
        timezone: settingsForm.timezone,
      });
      setTracker((prev) => ({
        ...prev,
        perDay: updated.per_day,
        timezone: updated.timezone,
      }));
      setSettingsFeedback({
        type: 'success',
        message: 'Settings updated successfully for future days.',
      });
    } catch (err) {
      setSettingsFeedback({
        type: 'error',
        message: err.data?.message || err.message || 'Failed to update settings.',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading tracker details..." />;
  }

  if (error || !tracker) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Tracker Unavailable</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'Tracker not found.'}</p>
        <Link
          to="/trackers"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Trackers</span>
        </Link>
      </div>
    );
  }

  const pendingCount = pendingData.count ?? pendingData.pending?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Tracker Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              to="/trackers"
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium transition"
            >
              <ArrowLeft size={13} />
              <span>All Trackers</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{tracker.name}</h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
              {tracker.perDay}/day
            </span>
            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md flex items-center gap-1">
              <Clock size={11} />
              <span>{tracker.timezone}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin Public Code Display */}
          {isAdmin && tracker.publicCode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono">
              <span className="text-gray-400">Code:</span>
              <span className="font-bold text-gray-800">{tracker.publicCode}</span>
              <button
                onClick={handleCopyCode}
                className="p-1 text-gray-400 hover:text-indigo-600 transition"
                title="Copy public code"
              >
                {publicCodeCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {/* Leave Tracker Button */}
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-xl transition"
            title="Leave this tracker"
          >
            <LogOut size={13} />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'today'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Today
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Pending</span>
          {pendingCount > 0 && (
            <span className="text-xs px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'board'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Board
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield size={14} />
            <span>Admin</span>
            {adminRequests.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                {adminRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Tab 1: Today ── */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {todayData.sheetEmpty ? (
            <Card className="text-center py-12 px-4 border-dashed">
              <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet size={22} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">No sheet uploaded yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                The tracker administrator has not uploaded a problem sheet yet. Once uploaded, daily assignments will appear here automatically.
              </p>
            </Card>
          ) : (
            <>
              {todayData.sheetComplete && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-3">
                  <Sparkles size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Sheet Complete!</span> All problems from the tracker sheet have been assigned. Great job!
                  </div>
                </div>
              )}

              {todayData.assignments?.length === 0 ? (
                <Card className="text-center py-10 px-4">
                  <p className="text-sm text-gray-500">No assignments for today.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {todayData.assignments.map((assignment) => {
                    const isSubmitted = Boolean(assignment.submission);
                    const memberStatuses = assignment.memberStatuses || [];

                    return (
                      <Card key={assignment.assignmentId} className="p-5 transition hover:border-gray-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2 min-w-0 flex-1">
                            {/* Problem Title & LeetCode link */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-gray-400">
                                #{assignment.lcNumber}
                              </span>
                              <a
                                href={assignment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-gray-900 hover:text-indigo-600 transition flex items-center gap-1.5"
                              >
                                <span>{assignment.title}</span>
                                <ExternalLink size={13} className="text-gray-400" />
                              </a>
                              <DifficultyBadge difficulty={assignment.difficulty} />
                            </div>

                            {/* Members completion status */}
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              <span className="text-xs text-gray-400 font-medium mr-1">Group:</span>
                              {memberStatuses.map((m) => (
                                <div
                                  key={m.userId}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    m.done
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                  title={`${m.username}: ${m.done ? 'Solved' : 'Not yet solved'}`}
                                >
                                  {m.done ? (
                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                  ) : (
                                    <Circle size={10} className="text-gray-400" />
                                  )}
                                  <span>{m.username}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Submit Action */}
                          <div className="shrink-0 flex items-center gap-3">
                            {isSubmitted ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">
                                  <CheckCircle2 size={14} />
                                  <span>Submitted</span>
                                </span>
                                {assignment.submission?.solutionUrl && (
                                  <a
                                    href={assignment.submission.solutionUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition rounded-lg hover:bg-gray-100"
                                    title="View your submitted solution"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => setSubmitAssignment(assignment)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl transition shadow-xs"
                              >
                                <Send size={13} />
                                <span>Submit Solution</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab 2: Pending (Overdue) ── */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingData.pending?.length === 0 ? (
            <Card className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">All caught up!</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                You have zero overdue assignments. Keep up the consistent streak!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Overdue assignments from previous days (oldest first). Submitting them clears your pending debt!
              </p>
              {pendingData.pending.map((assignment) => (
                <Card key={assignment.assignmentId} className="p-5 border-amber-200/80 bg-amber-50/10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-400">
                          #{assignment.lcNumber}
                        </span>
                        <a
                          href={assignment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-gray-900 hover:text-indigo-600 transition flex items-center gap-1.5"
                        >
                          <span>{assignment.title}</span>
                          <ExternalLink size={13} className="text-gray-400" />
                        </a>
                        <DifficultyBadge difficulty={assignment.difficulty} />
                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-mono">
                          Assigned {assignment.assignDate}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSubmitAssignment(assignment)}
                      className="shrink-0 self-start md:self-center inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl transition shadow-xs"
                    >
                      <Send size={13} />
                      <span>Submit Solution</span>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Board (Leaderboard) ── */}
      {activeTab === 'board' && (
        <Card>
          <CardHeader
            title="Member Leaderboard"
            subtitle="Track progress, on-time streak, and pending assignments across your group."
          />
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Member</th>
                  <th className="py-3 px-4 font-semibold text-center">Done Today</th>
                  <th className="py-3 px-4 font-semibold text-center">Pending Overdue</th>
                  <th className="py-3 px-4 font-semibold text-center">On-Time Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {boardData.map((member) => (
                  <tr key={member.userId || member.user_id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-medium text-gray-900 flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-indigo-100 text-indigo-700 font-bold rounded-lg flex items-center justify-center text-xs">
                        {member.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span>{member.username}</span>
                      {(member.userId || member.user_id) === session?.userId && (
                        <span className="text-xs px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded-md font-mono">
                          You
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-gray-800">
                        {member.doneToday ?? member.done_today ?? 0}
                      </span>
                      <span className="text-xs text-gray-400"> / {tracker.perDay}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-semibold ${
                          (member.pendingCount ?? member.pending_count ?? 0) > 0
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {member.pendingCount ?? member.pending_count ?? 0}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full text-xs">
                        <Flame size={13} className="text-orange-500 fill-orange-500" />
                        <span>{member.streak ?? member.on_time_streak ?? 0} days</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* ── Tab 4: Admin Panel (Admin Only) ── */}
      {isAdmin && activeTab === 'admin' && (
        <div className="space-y-6">
          {/* Section: Pending Join Requests */}
          <Card>
            <CardHeader
              title="Join Requests"
              subtitle="Review and decide on join requests submitted with your public tracker code."
            />
            <CardBody className="p-5">
              {adminRequests.length === 0 ? (
                <p className="text-xs text-gray-400">No pending join requests.</p>
              ) : (
                <div className="space-y-3">
                  {adminRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{req.username}</span>
                          <span className="text-xs text-gray-400">
                            Requested {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {req.message && (
                          <p className="text-xs text-gray-600 mt-0.5 italic">"{req.message}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleDecideRequest(req.id, 'approve')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecideRequest(req.id, 'reject')}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition"
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

          {/* Section: Invite Links */}
          <Card>
            <CardHeader
              title="Invite Links"
              subtitle="Generate direct invite links for members to join immediately."
            />
            <CardBody className="p-5 space-y-5">
              {/* Generate Form */}
              <form onSubmit={handleCreateInvite} className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={inviteForm.expiresInDays}
                    onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: e.target.value })}
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
                    value={inviteForm.maxUses}
                    onChange={(e) => setInviteForm({ ...inviteForm, maxUses: e.target.value })}
                    className="w-28 px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inviteCreating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                >
                  {inviteCreating ? 'Generating...' : 'Generate Invite Link'}
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
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition"
                    >
                      {inviteCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{inviteCopied ? 'Copied!' : 'Copy Link'}</span>
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
                {adminInvites.length === 0 ? (
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
                        {adminInvites.map((inv) => {
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
                                    onClick={() => handleRevokeInvite(inv.id)}
                                    className="text-red-600 hover:text-red-700 font-medium"
                                  >
                                    Revoke
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

          {/* Section: Problem Sheet Upload & Preview */}
          <Card>
            <CardHeader
              title="Problem Sheet Upload"
              subtitle="Upload a CSV with LeetCode problem numbers for sequential daily assignments."
            />
            <CardBody className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Required column: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">lc_number</code>. Optional: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">position</code>.
                </span>
                <button
                  type="button"
                  onClick={handleDownloadExampleCsv}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Download size={13} />
                  <span>Download Example CSV</span>
                </button>
              </div>

              {sheetFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs ${
                    sheetFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {sheetFeedback.message}
                </div>
              )}

              <div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Or Paste CSV Content
                </label>
                <textarea
                  rows="4"
                  placeholder="lc_number,position&#10;1,1&#10;2,2&#10;3,3"
                  value={sheetCsvText}
                  onChange={(e) => {
                    setSheetCsvText(e.target.value);
                    setSheetPreview(null);
                  }}
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePreviewSheet}
                  disabled={sheetPreviewLoading || !sheetCsvText.trim()}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                >
                  {sheetPreviewLoading ? 'Previewing...' : 'Preview Sheet'}
                </button>

                {sheetPreview && (
                  <button
                    type="button"
                    onClick={handleConfirmSheet}
                    disabled={sheetConfirmLoading || sheetPreview.unknown?.length > 0 || sheetPreview.valid === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {sheetConfirmLoading ? 'Confirming...' : 'Confirm & Apply Sheet'}
                  </button>
                )}
              </div>

              {/* Preview Results */}
              {sheetPreview && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 bg-white rounded-lg border border-gray-100">
                      <p className="text-gray-400">Valid Problems</p>
                      <p className="text-base font-bold text-emerald-600">{sheetPreview.valid}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-gray-100">
                      <p className="text-gray-400">Duplicates Ignored</p>
                      <p className="text-base font-bold text-amber-600">
                        {sheetPreview.duplicates?.length || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-gray-100">
                      <p className="text-gray-400">Unknown Problems</p>
                      <p className="text-base font-bold text-red-600">
                        {sheetPreview.unknown?.length || 0}
                      </p>
                    </div>
                  </div>

                  {sheetPreview.unknown?.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      ⚠️ Sheet contains unknown LeetCode numbers: {sheetPreview.unknown.join(', ')}.
                      You must import these problems into the catalog or remove them before confirming.
                    </div>
                  )}

                  {sheetPreview.firstTen?.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-700 mb-1.5">First 10 Problems Preview:</p>
                      <ul className="space-y-1 list-disc list-inside text-gray-600">
                        {sheetPreview.firstTen.map((p, idx) => (
                          <li key={idx}>
                            #{p.lc_number} - {p.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Section: Tracker Settings */}
          <Card>
            <CardHeader
              title="Tracker Settings"
              subtitle="Update problems per day and timezone. Changes apply to future assignment days only."
            />
            <CardBody className="p-5">
              {settingsFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs mb-4 ${
                    settingsFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {settingsFeedback.message}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Problems Per Day (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settingsForm.per_day}
                    onChange={(e) => setSettingsForm({ ...settingsForm, per_day: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Timezone
                  </label>
                  <select
                    value={settingsForm.timezone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                >
                  {settingsSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </form>
            </CardBody>
          </Card>

          {/* Section: Members Management */}
          <Card>
            <CardHeader
              title="Members Management"
              subtitle="View all members and manage group membership."
            />
            <CardBody className="p-5">
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-xs text-gray-800">{m.username}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        Joined {new Date(m.joinedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {m.userId !== session?.userId && (
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={removingUserId === m.userId}
                        className="p-1 text-gray-400 hover:text-red-600 transition"
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Submit Modal ── */}
      {submitAssignment && (
        <SubmitModal
          isOpen={Boolean(submitAssignment)}
          onClose={() => setSubmitAssignment(null)}
          assignment={submitAssignment}
          trackerId={trackerId}
          onSuccess={() => {
            fetchTrackerData();
          }}
        />
      )}

      {/* ── Confirm Leave Modal ── */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={handleLeaveTracker}
        title="Leave Tracker"
        message="Are you sure you want to leave this tracker? Your previous submissions will remain in your private vault, but you will lose access to this group's board and daily tracker assignments."
        confirmLabel={isLeaving ? 'Leaving...' : 'Leave Tracker'}
        danger
      />
    </div>
  );
}
