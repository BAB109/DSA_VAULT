import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock, CheckCircle2, Circle, AlertCircle, AlertTriangle,
  ExternalLink, Send, ArrowLeft, Flame, LogOut,
  Shield, FileSpreadsheet, Sparkles, BookOpen, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trackerService } from '../services/trackerService';
import { hasValidAdminToken } from '../services/adminApi';
import { Card } from '../components/Card';
import { ConfirmModal } from '../components/Modal';
import { DifficultyBadge } from '../components/Badges';
import { LoadingState } from '../components/States';
import SubmitModal from '../components/trackers/SubmitModal';
import { TrackerMembers } from '../components/trackers/TrackerMembers';

function formatOverdue(assignDateStr, todayStr) {
  if (!assignDateStr) return 'Overdue';
  let diffDays = 1;
  if (todayStr) {
    const [y1, m1, d1] = assignDateStr.split('-').map(Number);
    const [y2, m2, d2] = todayStr.split('-').map(Number);
    const dt1 = Date.UTC(y1, m1 - 1, d1);
    const dt2 = Date.UTC(y2, m2 - 1, d2);
    diffDays = Math.max(1, Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24)));
  } else {
    const [y, m, d] = assignDateStr.split('-').map(Number);
    const dt = Date.UTC(y, m - 1, d);
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    diffDays = Math.max(1, Math.round((todayUtc - dt) / (1000 * 60 * 60 * 24)));
  }
  return diffDays === 1 ? '1 day late' : `${diffDays} days late`;
}

export default function TrackerDetail() {
  const { id: trackerId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => hasValidAdminToken());

  useEffect(() => {
    const handleTokenChange = () => {
      setIsAdminAuthed(hasValidAdminToken());
    };
    window.addEventListener('admin-token-changed', handleTokenChange);
    return () => window.removeEventListener('admin-token-changed', handleTokenChange);
  }, []);

  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'pending' | 'members'
  const [loading, setLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState(null);

  // Core Tracker Data
  const [tracker, setTracker] = useState(null);
  const [todayData, setTodayData] = useState({ sheetEmpty: false, sheetComplete: false, assignments: [] });
  const [pendingData, setPendingData] = useState({ pending: [], count: 0 });
  const [roomData, setRoomData] = useState(null);
  const [membersData, setMembersData] = useState([]);

  // Modals
  const [submitAssignment, setSubmitAssignment] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchTrackerData = useCallback(async () => {
    try {
      setError(null);
      setIsNotFound(false);
      const [trackerRes, todayRes, pendingRes, boardRes] = await Promise.all([
        trackerService.getTracker(trackerId),
        trackerService.getToday(trackerId).catch((err) => {
          if (err.status === 404) return null;
          throw err;
        }),
        trackerService.getPending(trackerId).catch(() => ({ pending: [], count: 0 })),
        trackerService.getBoard(trackerId).catch(() => null),
      ]);

      if (!trackerRes) {
        setIsNotFound(true);
        return;
      }

      setTracker(trackerRes);
      setTodayData(todayRes || { sheetEmpty: false, sheetComplete: false, assignments: [] });
      setPendingData(pendingRes || { pending: [], count: 0 });

      if (boardRes) {
        setRoomData(boardRes.room || null);
        const membersList = Array.isArray(boardRes)
          ? boardRes
          : boardRes.members || boardRes.board || [];
        setMembersData(membersList);
      }
    } catch (err) {
      if (err.status === 404) {
        setIsNotFound(true);
      } else {
        setError(err.message || 'Failed to load tracker details.');
      }
    } finally {
      setLoading(false);
    }
  }, [trackerId]);

  useEffect(() => {
    fetchTrackerData();
  }, [fetchTrackerData]);

  // Leave Tracker
  const handleLeaveTracker = async () => {
    setIsLeaving(true);
    try {
      await trackerService.leaveTracker(trackerId);
      navigate('/trackers', { replace: true });
    } catch (err) {
      alert(err.message || 'Failed to leave tracker.');
      setIsLeaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading tracker details..." />;
  }

  // Standard 404 Not Found Page
  if (isNotFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-5xl font-bold text-gray-200">404</p>
        <p className="text-gray-500">Page not found</p>
        <Link to="/trackers" className="text-indigo-600 text-sm hover:underline mt-2">
          ← Back to Trackers
        </Link>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Tracker Unavailable</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'An unexpected error occurred.'}</p>
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
  const currentUserStats = membersData.find((m) => m.userId === session?.userId) || null;

  return (
    <div className="space-y-6">
      {/* ── Tracker Top Header Bar ── */}
      <div className="space-y-4 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{tracker.name}</h1>
              <span className="text-xs font-mono font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                {tracker.perDay}/day
              </span>
              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md flex items-center gap-1">
                <Clock size={11} />
                <span>{tracker.timezone}</span>
              </span>
              {tracker.status === 'archived' && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-medium">
                  Archived
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
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

        {/* Room Sheet Progress Bar: "Day D, N problems left" */}
        {roomData && roomData.sheetTotal > 0 && (
          <div className="p-3.5 bg-gray-50/80 border border-gray-200/70 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-1.5 text-gray-800 font-semibold">
                <FileSpreadsheet size={14} className="text-indigo-600" />
                <span>Day {roomData.dayNumber}, {roomData.sheetRemaining} problems left</span>
              </div>
              <span className="text-gray-500 font-mono text-[11px]">
                {roomData.sheetTotal - roomData.sheetRemaining} / {roomData.sheetTotal} ({Math.round(((roomData.sheetTotal - roomData.sheetRemaining) / roomData.sheetTotal) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round(((roomData.sheetTotal - roomData.sheetRemaining) / roomData.sheetTotal) * 100))}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* 4 Summary Cards for the Current User: Released, Submitted, Pending, Streak */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Card 1: Released */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-1">
              <span className="text-xs font-medium">Released</span>
              <BookOpen size={15} className="text-gray-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {currentUserStats?.released ?? 0}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Problems available to you</p>
          </div>

          {/* Card 2: Submitted */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-1">
              <span className="text-xs font-medium">Submitted</span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {currentUserStats?.submitted ?? 0}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              <span>{currentUserStats?.onTime ?? 0} on-time</span>
              {(currentUserStats?.late ?? 0) > 0 && (
                <span className="text-amber-600 font-medium">, {currentUserStats.late} late</span>
              )}
            </p>
          </div>

          {/* Card 3: Pending */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-1">
              <span className="text-xs font-medium">Pending</span>
              <AlertTriangle
                size={15}
                className={(currentUserStats?.pending ?? pendingCount) > 0 ? 'text-amber-500' : 'text-gray-400'}
              />
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                (currentUserStats?.pending ?? pendingCount) > 0 ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {currentUserStats?.pending ?? pendingCount}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {(currentUserStats?.pending ?? pendingCount) > 0 ? 'Overdue from past days' : 'All caught up'}
            </p>
          </div>

          {/* Card 4: Streak */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-1">
              <span className="text-xs font-medium">Streak</span>
              <Flame
                size={15}
                className={(currentUserStats?.streak ?? 0) > 0 ? 'text-orange-500 fill-orange-500' : 'text-gray-400'}
              />
            </div>
            <div className="text-2xl font-bold font-mono text-gray-900 flex items-center gap-1">
              <span>{currentUserStats?.streak ?? 0}</span>
              <span className="text-sm font-normal text-gray-400">days</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">On-time daily streak</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center border-b border-gray-200 gap-1 overflow-x-auto">
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
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={14} />
          <span>Members</span>
        </button>

        {/* Link to Admin Control Center */}
        {isAdminAuthed && (
          <Link
            to={`/admin/trackers/${trackerId}`}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 my-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
          >
            <Shield size={13} />
            <span>Manage in Admin</span>
          </Link>
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
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs">
                  <Sparkles size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Sheet Completed!</span> You have finished all problems in this tracker's sheet. Fantastic job!
                  </div>
                </div>
              )}

              {todayData.assignments?.length === 0 ? (
                <Card className="text-center py-8 text-xs text-gray-400">
                  No assignments scheduled for today.
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {todayData.assignments?.map((assignment) => {
                    const lcUrl = `https://leetcode.com/problems/${assignment.slug}/`;
                    const hasMySubmission = Boolean(assignment.submission);

                    return (
                      <Card key={assignment.assignmentId} className="p-5 hover:border-indigo-100 transition">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-gray-400">
                                #{assignment.lcNumber}
                              </span>
                              <h3 className="text-base font-bold text-gray-900 hover:text-indigo-600 transition">
                                <a
                                  href={lcUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1"
                                >
                                  <span>{assignment.title}</span>
                                  <ExternalLink size={13} className="text-gray-400" />
                                </a>
                              </h3>
                              <DifficultyBadge difficulty={assignment.difficulty} />
                            </div>

                            {/* Member completion status chips (done / not yet chip per member) */}
                            {assignment.membersStatus && assignment.membersStatus.length > 0 && (
                              <div className="pt-1">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                  Group Progress:
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {assignment.membersStatus.map((m) => (
                                    <div
                                      key={m.userId}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                        m.done
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-gray-50 text-gray-500 border-gray-200'
                                      }`}
                                    >
                                      {m.done ? (
                                        <CheckCircle2 size={12} className="text-emerald-600" />
                                      ) : (
                                        <Circle size={12} className="text-gray-400" />
                                      )}
                                      <span>{m.username}</span>
                                      {m.done ? (
                                        <span className="text-[10px] text-emerald-600/80 font-normal">done</span>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 font-normal">not yet</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 self-end lg:self-center">
                            {hasMySubmission ? (
                              <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                <CheckCircle2 size={15} />
                                <span>Solved</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSubmitAssignment(assignment)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition"
                              >
                                <Send size={13} />
                                <span>Submit</span>
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

      {/* ── Tab 2: Pending Overdue ── */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Overdue problems from past days since you joined that you haven't marked as solved yet (oldest first).
          </p>

          {pendingData.pending?.length === 0 ? (
            <Card className="text-center py-12 px-4">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-gray-800">You're All Caught Up!</h3>
              <p className="text-xs text-gray-400 mt-1">No overdue pending problems.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingData.pending?.map((item) => {
                const lcUrl = `https://leetcode.com/problems/${item.slug}/`;
                const overdueDuration = formatOverdue(item.assignDate, todayData.today);

                return (
                  <Card key={item.assignmentId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-400">
                          #{item.lcNumber}
                        </span>
                        <a
                          href={lcUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-gray-900 hover:text-indigo-600 inline-flex items-center gap-1"
                        >
                          <span>{item.title}</span>
                          <ExternalLink size={12} className="text-gray-400" />
                        </a>
                        <DifficultyBadge difficulty={item.difficulty} />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500">
                          Assigned {item.assignDate}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          {overdueDuration}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSubmitAssignment(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition self-end sm:self-center"
                    >
                      <Send size={12} />
                      <span>Submit</span>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Members (replaces Board) ── */}
      {activeTab === 'members' && (
        <TrackerMembers
          trackerId={trackerId}
          service={trackerService}
          isAdmin={false}
          currentUserId={session?.userId}
        />
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
