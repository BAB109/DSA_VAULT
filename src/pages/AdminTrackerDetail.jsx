import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Users,
  FileSpreadsheet,
  Settings,
  UserPlus,
  Key,
  Activity,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  AlertTriangle,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Lock,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { adminService } from '../services/adminService';
import { useToast } from '../components/admin/AdminToast';
import { ConfirmDialog } from '../components/admin/AdminDialog';
import { DetailSkeleton, TableSkeleton } from '../components/admin/AdminSkeleton';
import { DifficultyBadge } from '../components/Badges';
import { Card, CardHeader, CardBody } from '../components/Card';
import { TrackerRequests } from '../components/trackers/TrackerRequests';
import { TrackerInvites } from '../components/trackers/TrackerInvites';
import { TrackerMembers } from '../components/trackers/TrackerMembers';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function AdminTrackerDetail() {
  const { id: trackerId } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'settings' | 'requests' | 'invites' | 'members' | 'activity'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracker Metadata
  const [tracker, setTracker] = useState(null);

  // Sheet Tab States
  const [sheetItems, setSheetItems] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  // Add Single Problem via Catalog Search
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [addingProblem, setAddingProblem] = useState(false);
  const searchSeqRef = useRef(0);

  // CSV Upload States
  const [csvMode, setCsvMode] = useState('replace'); // 'replace' | 'append'
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvPreviewLoading, setCsvPreviewLoading] = useState(false);
  const [csvConfirmLoading, setCsvConfirmLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  // Reordering / Deleting Items
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Confirmation Dialog States
  const [confirmClearUpcomingOpen, setConfirmClearUpcomingOpen] = useState(false);
  const [clearingUpcoming, setClearingUpcoming] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deletingTracker, setDeletingTracker] = useState(false);

  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archivingLoading, setArchivingLoading] = useState(false);

  // Settings Tab States
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    per_day: 2,
    applyToday: false,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Activity / Audit Log Tab State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditError, setAuditError] = useState(null);

  // ── Fetch Tracker & Sheet ──────────────────────────────────────────────────
  const fetchTracker = useCallback(async () => {
    try {
      setError(null);
      const t = await adminService.getTracker(trackerId);
      setTracker(t);
      setSettingsForm({
        name: t.name || '',
        timezone: t.timezone || 'Asia/Kolkata',
        per_day: t.perDay || t.per_day || 2,
        applyToday: false,
      });
    } catch (err) {
      setError(err.message || 'Failed to load tracker.');
    } finally {
      setLoading(false);
    }
  }, [trackerId]);

  const fetchSheet = useCallback(async () => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const items = await adminService.getSheet(trackerId);
      setSheetItems(items || []);
    } catch (err) {
      setSheetError(err.message || 'Failed to load sheet.');
    } finally {
      setSheetLoading(false);
    }
  }, [trackerId]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const logs = await adminService.getAudit(trackerId, auditLimit);
      setAuditLogs(logs || []);
    } catch (err) {
      setAuditError(err.message || 'Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  }, [trackerId, auditLimit]);

  useEffect(() => {
    fetchTracker();
    fetchSheet();
  }, [fetchTracker, fetchSheet]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchAudit();
    }
  }, [activeTab, fetchAudit]);

  // ── Debounced Catalog Search with Out-of-Order Guards ───────────────────────
  useEffect(() => {
    if (!catalogQuery.trim()) {
      setCatalogResults([]);
      setCatalogSearching(false);
      return;
    }

    const currentSeq = ++searchSeqRef.current;
    setCatalogSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await adminService.searchCatalog(catalogQuery.trim());
        // Ignore response if a newer search was initiated
        if (searchSeqRef.current === currentSeq) {
          setCatalogResults(results || []);
        }
      } catch {
        if (searchSeqRef.current === currentSeq) {
          setCatalogResults([]);
        }
      } finally {
        if (searchSeqRef.current === currentSeq) {
          setCatalogSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [catalogQuery]);

  // ── Add Single Catalog Item ────────────────────────────────────────────────
  const handleAddProblem = async () => {
    if (!selectedCatalogItem) return;
    setAddingProblem(true);
    try {
      await adminService.addSheetItem(trackerId, {
        lc_number: selectedCatalogItem.lc_number,
      });
      success(`Added #${selectedCatalogItem.lc_number} ${selectedCatalogItem.title} to sheet.`);
      setSelectedCatalogItem(null);
      setCatalogQuery('');
      setCatalogResults([]);
      fetchSheet();
      fetchTracker();
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to add problem.');
    } finally {
      setAddingProblem(false);
    }
  };

  // ── Delete Single Item ─────────────────────────────────────────────────────
  const handleDeleteItem = async (catalogId) => {
    setActionLoadingId(catalogId);
    try {
      await adminService.deleteSheetItem(trackerId, catalogId);
      success('Problem removed from upcoming sheet.');
      fetchSheet();
      fetchTracker();
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to remove problem.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Reorder Upcoming Items ─────────────────────────────────────────────────
  const handleMove = async (index, direction) => {
    const upcomingItems = sheetItems.filter((i) => i.state === 'upcoming');
    const targetItem = sheetItems[index];
    const targetCatalogId = targetItem.catalogId || targetItem.catalog_id;
    const upcomingIndex = upcomingItems.findIndex(
      (i) => (i.catalogId || i.catalog_id) === targetCatalogId
    );
    if (upcomingIndex === -1) return;

    const newUpcomingIndex = upcomingIndex + direction;
    if (newUpcomingIndex < 0 || newUpcomingIndex >= upcomingItems.length) return;

    // Swap elements in upcoming slice
    const newUpcoming = [...upcomingItems];
    const temp = newUpcoming[upcomingIndex];
    newUpcoming[upcomingIndex] = newUpcoming[newUpcomingIndex];
    newUpcoming[newUpcomingIndex] = temp;

    const orderedIds = newUpcoming.map((i) => i.catalogId || i.catalog_id);
    setActionLoadingId(targetCatalogId);

    try {
      await adminService.reorderSheet(trackerId, orderedIds);
      fetchSheet();
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to reorder items.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Clear Upcoming Items ───────────────────────────────────────────────────
  const handleClearUpcomingConfirm = async () => {
    setClearingUpcoming(true);
    try {
      const res = await adminService.clearUpcoming(trackerId);
      success(`Cleared ${res.removedCount ?? 0} upcoming problems from the sheet.`);
      setConfirmClearUpcomingOpen(false);
      fetchSheet();
      fetchTracker();
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to clear upcoming problems.');
    } finally {
      setClearingUpcoming(false);
    }
  };

  // ── CSV Sheet Preview & Confirm ───────────────────────────────────────────
  const handlePreviewCsv = async () => {
    if (!csvText.trim()) return;
    setCsvPreviewLoading(true);
    setCsvError(null);
    setCsvPreview(null);

    try {
      const res = await adminService.previewSheet(trackerId, {
        csv: csvText,
        mode: csvMode,
      });
      setCsvPreview(res);
    } catch (err) {
      setCsvError(err.data?.message || err.message || 'Failed to preview CSV.');
      if (err.data?.unknown) {
        setCsvPreview({ unknown: err.data.unknown, valid: 0, duplicates: 0 });
      }
    } finally {
      setCsvPreviewLoading(false);
    }
  };

  const handleConfirmCsv = async () => {
    if (!csvText.trim()) return;
    setCsvConfirmLoading(true);
    setCsvError(null);

    try {
      const res = await adminService.confirmSheet(trackerId, {
        csv: csvText,
        mode: csvMode,
      });
      success(`Successfully applied sheet (${res.addedCount} added, ${res.skippedCount} skipped).`);
      setCsvPreview(null);
      setCsvText('');
      fetchSheet();
      fetchTracker();
    } catch (err) {
      setCsvError(err.data?.message || err.message || 'Failed to confirm sheet.');
    } finally {
      setCsvConfirmLoading(false);
    }
  };

  const handleDownloadExampleCsv = () => {
    const exampleContent = `1,Two Sum,Easy\n2,Add Two Numbers,Medium\n3,Longest Substring Without Repeating Characters,Medium\n15,3Sum,Medium\n20,Valid Parentheses,Easy\n42,Trapping Rain Water,Hard`;
    const blob = new Blob([exampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'leetcode_sheet_example.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Save Settings ──────────────────────────────────────────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const updated = await adminService.updateTracker(trackerId, {
        name: settingsForm.name.trim(),
        timezone: settingsForm.timezone,
        per_day: parseInt(settingsForm.per_day, 10),
        applyToday: settingsForm.applyToday,
      });
      setTracker(updated);
      success('Tracker settings updated successfully.');
      fetchSheet();
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Archive / Unarchive Tracker ───────────────────────────────────────────
  const handleToggleArchiveConfirm = async () => {
    if (!tracker) return;
    const isArchived = tracker.status === 'archived';
    const nextStatus = isArchived ? 'active' : 'archived';
    setArchivingLoading(true);

    try {
      const updated = await adminService.updateTracker(trackerId, { status: nextStatus });
      setTracker(updated);
      success(`Tracker has been ${isArchived ? 'unarchived' : 'archived'}.`);
      setConfirmArchiveOpen(false);
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to update status.');
    } finally {
      setArchivingLoading(false);
    }
  };

  // ── Danger Zone: Hard Delete Tracker ───────────────────────────────────────
  const handleDeleteTrackerConfirm = async () => {
    if (!tracker || deleteInputText.trim() !== tracker.name.trim()) return;
    setDeletingTracker(true);

    try {
      await adminService.deleteTracker(trackerId, deleteInputText.trim());
      success(`Tracker "${tracker.name}" deleted permanently.`);
      setConfirmDeleteOpen(false);
      navigate('/admin', { replace: true });
    } catch (err) {
      toastError(err.data?.message || err.message || 'Failed to delete tracker.');
      setDeletingTracker(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !tracker) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">Tracker Not Found</h2>
        <p className="text-xs text-gray-500 mb-6">{error || 'This tracker room does not exist.'}</p>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Admin Overview</span>
        </Link>
      </div>
    );
  }

  const assignedCount = sheetItems.filter((i) => i.state === 'assigned').length;
  const upcomingCount = sheetItems.filter((i) => i.state === 'upcoming').length;
  const perDay = tracker.perDay || tracker.per_day || 2;
  const estimatedDaysLeft = perDay > 0 ? Math.ceil(upcomingCount / perDay) : 0;
  const isArchived = tracker.status === 'archived';

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              to="/admin"
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold transition"
            >
              <ArrowLeft size={13} />
              <span>All Tracker Rooms</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{tracker.name}</h1>
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                isArchived
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isArchived ? 'Archived' : 'Active'}
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
              {perDay}/day
            </span>
            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md flex items-center gap-1">
              <Clock size={11} />
              <span>{tracker.timezone}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={`/trackers/${trackerId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-indigo-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition shadow-xs"
          >
            <ExternalLink size={13} />
            <span>Open Member Room</span>
          </Link>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-4 min-w-max">
          {[
            { id: 'sheet', label: 'Sequential Sheet', icon: FileSpreadsheet, badge: sheetItems.length },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'requests', label: 'Join Requests', icon: UserPlus },
            { id: 'invites', label: 'Invite Links', icon: Key },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'activity', label: 'Activity & Audit', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SHEET                                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sheet' && (
        <div className="space-y-6">
          {/* Summary Metric Banner */}
          {sheetError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{sheetError}</span>
            </div>
          )}

          <div className="bg-gradient-to-r from-indigo-50/80 via-white to-gray-50 p-4 border border-indigo-100 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">
                  {upcomingCount} left, about {estimatedDaysLeft} days at {perDay} per day
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {assignedCount} problems already assigned & locked · {upcomingCount} upcoming sequential problems
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmClearUpcomingOpen(true)}
                disabled={upcomingCount === 0 || clearingUpcoming}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear Upcoming ({upcomingCount})
              </button>
            </div>
          </div>

          {/* Add Single Problem via Catalog Search */}
          <Card>
            <CardHeader
              title="Add Single Problem to Sheet"
              subtitle="Search LeetCode problems from the local 3,500+ question catalog by number or title."
            />
            <CardBody className="p-5">
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by LeetCode number (e.g. 1) or title (e.g. Two Sum)..."
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {catalogSearching && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Selected Item Chip */}
                {selectedCatalogItem && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-700">
                        #{selectedCatalogItem.lc_number}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">
                        {selectedCatalogItem.title}
                      </span>
                      <DifficultyBadge difficulty={selectedCatalogItem.difficulty} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddProblem}
                        disabled={addingProblem}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {addingProblem ? 'Adding...' : 'Add to End of Sheet'}
                      </button>
                      <button
                        onClick={() => setSelectedCatalogItem(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                        aria-label="Deselect problem"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Search Results Dropdown */}
                {catalogResults.length > 0 && !selectedCatalogItem && (
                  <div className="border border-gray-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-gray-100 shadow-xs bg-white">
                    {catalogResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedCatalogItem(item);
                          setCatalogQuery('');
                          setCatalogResults([]);
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-50/60 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 font-medium w-12">
                            #{item.lc_number}
                          </span>
                          <span className="font-medium text-gray-900">{item.title}</span>
                        </div>
                        <DifficultyBadge difficulty={item.difficulty} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Bulk CSV Sheet Upload & Preview */}
          <Card>
            <CardHeader
              title="Bulk CSV Sheet Upload"
              subtitle="Upload or paste LeetCode numbers to set up your tracker sheet sequentially."
            />
            <CardBody className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Mode Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Upload Mode:</span>
                  <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setCsvMode('replace')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        csvMode === 'replace'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Replace Upcoming
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvMode('append')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        csvMode === 'append'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Append to End
                    </button>
                  </div>
                </div>

                {/* Example CSV download */}
                <button
                  type="button"
                  onClick={handleDownloadExampleCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-indigo-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition"
                >
                  <Download size={13} />
                  <span>Download Example CSV</span>
                </button>
              </div>

              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV rows (e.g. 1, Two Sum, Easy or simply list numbers: 1&#10;2&#10;15&#10;42)"
                className="w-full font-mono text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              />

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handlePreviewCsv}
                  disabled={!csvText.trim() || csvPreviewLoading}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {csvPreviewLoading ? 'Analyzing CSV...' : 'Preview CSV Sheet'}
                </button>

                {csvText && (
                  <button
                    type="button"
                    onClick={() => {
                      setCsvText('');
                      setCsvPreview(null);
                      setCsvError(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear Input
                  </button>
                )}
              </div>

              {/* CSV Error Banner */}
              {csvError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* CSV Preview Results Panel */}
              {csvPreview && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                    <span className="text-xs font-bold text-gray-900">CSV Sheet Analysis:</span>
                    <span className="text-[11px] font-mono text-gray-500">Mode: {csvMode}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <div className="text-gray-500 text-[10px] uppercase font-semibold">Valid Problems</div>
                      <div className="text-sm font-bold text-emerald-600">{csvPreview.valid}</div>
                    </div>
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <div className="text-gray-500 text-[10px] uppercase font-semibold">Unknown Numbers</div>
                      <div className={`text-sm font-bold ${csvPreview.unknown?.length ? 'text-rose-600' : 'text-gray-700'}`}>
                        {csvPreview.unknown?.length || 0}
                      </div>
                    </div>
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <div className="text-gray-500 text-[10px] uppercase font-semibold">Duplicates</div>
                      <div className="text-sm font-bold text-amber-600">
                        {csvPreview.duplicates ? (Array.isArray(csvPreview.duplicates) ? csvPreview.duplicates.length : csvPreview.duplicates) : 0}
                      </div>
                    </div>
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <div className="text-gray-500 text-[10px] uppercase font-semibold">Already in Sheet</div>
                      <div className="text-sm font-bold text-gray-700">
                        {csvPreview.alreadyInSheet?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Unknown Numbers Warning */}
                  {csvPreview.unknown && csvPreview.unknown.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-rose-600" />
                        <span>Unknown LeetCode question numbers detected:</span>
                      </div>
                      <div className="font-mono text-[11px] bg-white p-2 rounded border border-rose-200 break-words">
                        {csvPreview.unknown.join(', ')}
                      </div>
                      <p className="text-[11px] text-rose-600">
                        Confirming is disabled while unknown numbers exist in the CSV. Please remove or correct them.
                      </p>
                    </div>
                  )}

                  {/* First Ten Resolved Titles */}
                  {csvPreview.firstTen && csvPreview.firstTen.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-gray-600">
                        First Resolved Problems Sample:
                      </span>
                      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-40 overflow-y-auto">
                        {csvPreview.firstTen.map((item, idx) => (
                          <div key={idx} className="p-2 flex items-center gap-2 text-xs">
                            <span className="font-mono text-gray-400 text-[11px]">#{item.lc_number}</span>
                            <span className="font-medium text-gray-800">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmCsv}
                      disabled={csvConfirmLoading || (csvPreview.unknown && csvPreview.unknown.length > 0)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {csvConfirmLoading ? 'Applying Sheet...' : `Confirm & Apply ${csvMode === 'replace' ? 'Replace' : 'Append'}`}
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Sequential Sheet Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Sequential Sheet Items ({sheetItems.length})</h3>
              <button
                onClick={fetchSheet}
                className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg transition"
                title="Refresh sheet"
              >
                <RefreshCw size={13} className={sheetLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {sheetLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : sheetItems.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-xs text-gray-500">
                Sheet is currently empty. Add problems above or upload a CSV.
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto min-w-full">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 w-12 text-center">Pos</th>
                        <th className="py-3 px-4 w-20">#LC</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4 w-24">Difficulty</th>
                        <th className="py-3 px-4 w-28">State</th>
                        <th className="py-3 px-4 w-32">Assigned Date</th>
                        <th className="py-3 px-4 w-28 text-right">Reorder / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sheetItems.map((item, index) => {
                        const isAssigned = item.state === 'assigned';
                        const catalogId = item.catalogId || item.catalog_id;
                        const upcomingItems = sheetItems.filter((i) => i.state === 'upcoming');
                        const upcomingIdx = upcomingItems.findIndex(
                          (i) => (i.catalogId || i.catalog_id) === catalogId
                        );

                        return (
                          <tr
                            key={catalogId || index}
                            className={`hover:bg-gray-50/60 transition-colors ${
                              isAssigned ? 'bg-gray-50/30' : ''
                            }`}
                          >
                            {/* Position */}
                            <td className="py-3 px-4 text-center font-mono text-gray-400 text-xs">
                              {item.position || index + 1}
                            </td>

                            {/* LC Number */}
                            <td className="py-3 px-4 font-mono font-semibold text-gray-800">
                              #{item.lc_number}
                            </td>

                            {/* Title */}
                            <td className="py-3 px-4 font-medium text-gray-900">
                              <span className="truncate max-w-xs block">{item.title}</span>
                            </td>

                            {/* Difficulty */}
                            <td className="py-3 px-4">
                              <DifficultyBadge difficulty={item.difficulty} />
                            </td>

                            {/* State Badge */}
                            <td className="py-3 px-4">
                              {isAssigned ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                  <Lock size={10} className="text-gray-500" />
                                  <span>Assigned</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Upcoming
                                </span>
                              )}
                            </td>

                            {/* Assigned Date */}
                            <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                              {item.assign_date || item.assignDate || (
                                <span className="text-gray-300 font-sans italic">Not yet</span>
                              )}
                            </td>

                            {/* Actions / Reorder */}
                            <td className="py-3 px-4 text-right">
                              {isAssigned ? (
                                <span className="text-[11px] text-gray-400 italic" title="Assigned items are immutable">
                                  Locked
                                </span>
                              ) : (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <button
                                    onClick={() => handleMove(index, -1)}
                                    disabled={upcomingIdx === 0 || actionLoadingId === catalogId}
                                    title="Move problem earlier"
                                    className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-20"
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleMove(index, 1)}
                                    disabled={
                                      upcomingIdx === upcomingItems.length - 1 ||
                                      actionLoadingId === catalogId
                                    }
                                    title="Move problem later"
                                    className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-20"
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(catalogId)}
                                    disabled={actionLoadingId === catalogId}
                                    title="Remove upcoming problem"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition disabled:opacity-30"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: SETTINGS & DANGER ZONE                                         */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Tracker Configuration"
              subtitle="Update room pacing, timezone, and assignment generation behavior."
            />
            <CardBody className="p-6">
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Room Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.name}
                      onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Timezone *
                    </label>
                    <select
                      value={settingsForm.timezone}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, timezone: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Pacing (Problems/Day) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={settingsForm.per_day}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, per_day: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Applies from tomorrow.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2.5">
                  <input
                    id="apply-today"
                    type="checkbox"
                    checked={settingsForm.applyToday}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, applyToday: e.target.checked })
                    }
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="apply-today" className="text-xs text-gray-800 cursor-pointer">
                    <span className="font-semibold">Also add more problems today</span> (can only increase today&apos;s assignments count, will not decrease past or today&apos;s assignments).
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmArchiveOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition"
                  >
                    {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    <span>{isArchived ? 'Unarchive Room' : 'Archive Room'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
                  >
                    {settingsSaving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Danger Zone: Hard Delete Tracker */}
          <Card className="border-rose-200">
            <CardHeader
              title="Danger Zone: Delete Tracker"
              subtitle="Permanently remove this tracker room and its schedule. Members' vault problem notes remain safe."
            />
            <CardBody className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Once deleted, this tracker room cannot be recovered. To delete, click below to open the confirmation dialog where you must verify the exact tracker name.
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteInputText('');
                    setConfirmDeleteOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
                >
                  Delete This Tracker Room
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: REQUESTS                                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <TrackerRequests trackerId={trackerId} service={adminService} />
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: INVITES                                                        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'invites' && (
        <TrackerInvites trackerId={trackerId} service={adminService} />
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: MEMBERS                                                        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <TrackerMembers trackerId={trackerId} service={adminService} isAdmin={true} />
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: ACTIVITY & AUDIT                                               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader
            title="Room Activity & Audit Trail"
            subtitle="Record of administrative actions and member mutations specific to this tracker room."
            action={
              <div className="flex items-center gap-2">
                <select
                  value={auditLimit}
                  onChange={(e) => setAuditLimit(parseInt(e.target.value, 10))}
                  className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={25}>25 entries</option>
                  <option value={50}>50 entries</option>
                  <option value={100}>100 entries</option>
                </select>
                <button
                  onClick={fetchAudit}
                  disabled={auditLoading}
                  className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg transition"
                  title="Refresh activity"
                >
                  <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            }
          />
          <CardBody className="p-0">
            {auditError && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{auditError}</span>
              </div>
            )}

            {auditLoading ? (
              <div className="p-5">
                <TableSkeleton rows={5} cols={4} />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-gray-400">
                No activity records found for this tracker.
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Admin</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/70">
                        <td className="py-2.5 px-4 text-gray-500 font-sans text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-sans whitespace-nowrap">
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-sans text-gray-800 whitespace-nowrap">
                          {log.admin_username || 'Admin'}
                        </td>
                        <td className="py-2.5 px-4 max-w-sm truncate text-gray-600">
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Dialogs: Clear Upcoming ── */}
      <ConfirmDialog
        isOpen={confirmClearUpcomingOpen}
        onClose={() => setConfirmClearUpcomingOpen(false)}
        onConfirm={handleClearUpcomingConfirm}
        title="Clear Upcoming Sheet Problems"
        message="Are you sure you want to remove ALL upcoming unassigned problems from the sheet? Already assigned problems will remain safe and unaffected."
        confirmLabel="Clear Upcoming Problems"
        variant="warning"
        loading={clearingUpcoming}
      />

      {/* ── Dialogs: Archive / Unarchive ── */}
      <ConfirmDialog
        isOpen={confirmArchiveOpen}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleToggleArchiveConfirm}
        title={isArchived ? 'Unarchive Tracker Room' : 'Archive Tracker Room'}
        message={
          isArchived
            ? `Unarchiving will resume daily sequential assignments for "${tracker.name}" starting tomorrow.`
            : `Archiving will immediately suspend daily assignment generation for "${tracker.name}". Members can still view existing assignments.`
        }
        confirmLabel={isArchived ? 'Unarchive Room' : 'Archive Room'}
        variant={isArchived ? 'primary' : 'warning'}
        loading={archivingLoading}
      />

      {/* ── Dialogs: Delete Tracker (Danger Zone with required name confirmation) ── */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteTrackerConfirm}
        title={`Delete Tracker "${tracker.name}"`}
        message="This action CANNOT be undone. This will permanently remove the tracker room, all its assignments, invites, and join requests. Members' private vault problem records will remain safe."
        confirmLabel="Permanently Delete Tracker"
        variant="danger"
        confirmInputText={tracker.name}
        confirmInputPlaceholder="Enter tracker name exactly"
        confirmInputValue={deleteInputText}
        onConfirmInputChange={setDeleteInputText}
        loading={deletingTracker}
      />
    </div>
  );
}
