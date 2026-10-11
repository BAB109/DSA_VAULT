import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { problemService } from '../services/problemService';
import { Table, SearchInput, FilterSelect, Pagination } from '../components/Table';
import { DifficultyBadge, StatusBadge, TopicTag, ReviewBadge } from '../components/Badges';
import { Card } from '../components/Card';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Button } from '../components/FormControls';
import { ConfirmModal } from '../components/Modal';

const PAGE_SIZE = 10;

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const PLATFORMS = ['LeetCode', 'HackerRank', 'CodeForces', 'GFG', 'InterviewBit', 'Other'];
const STATUSES = [
  'Solved Independently',
  'Solved With Hint',
  'Solved With Help',
  'Unable To Solve',
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'difficulty', label: 'Difficulty (Easy → Hard)' },
];

export default function Library() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  // Raw input value vs debounced query used in API requests
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters
  const [filterDiff, setFilterDiff] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('');
  const [filterRevision, setFilterRevision] = useState('');

  // Sorting
  const [sortOption, setSortOption] = useState('newest');

  // Pagination & Data
  const [problems, setProblems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Available topics loaded from GET /api/topics
  const [allTopics, setAllTopics] = useState([]);

  // Deletion modal target
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to page 1 on new search query
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load topics list once on mount
  useEffect(() => {
    problemService.getTopics()
      .then((data) => {
        if (Array.isArray(data)) setAllTopics(data);
      })
      .catch(() => {});
  }, []);

  // Fetch problems with server-side pagination, search, filters & sort
  const fetchProblems = useCallback(() => {
    setLoading(true);
    setError(null);

    const queryParams = {
      search: debouncedSearch,
      difficulty: filterDiff,
      platform: filterPlatform,
      status: filterStatus,
      topic: filterTopic,
      reviewed: filterReviewed,
      revision: filterRevision,
      sort: sortOption,
      page,
      limit: PAGE_SIZE,
    };

    problemService.getAll(queryParams)
      .then((res) => {
        if (res && res.data && res.pagination) {
          // Server returned paginated structure
          setProblems(res.data);
          setTotalCount(res.pagination.total);
        } else if (Array.isArray(res)) {
          // Backward-compatible array response
          setProblems(res);
          setTotalCount(res.length);
        } else {
          setProblems([]);
          setTotalCount(0);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load problems from server.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    debouncedSearch,
    filterDiff,
    filterPlatform,
    filterStatus,
    filterTopic,
    filterReviewed,
    filterRevision,
    sortOption,
    page,
  ]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setFilterDiff('');
    setFilterPlatform('');
    setFilterTopic('');
    setFilterStatus('');
    setFilterReviewed('');
    setFilterRevision('');
    setSortOption('newest');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchInput ||
    filterDiff ||
    filterPlatform ||
    filterTopic ||
    filterStatus ||
    filterReviewed ||
    filterRevision ||
    sortOption !== 'newest'
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await problemService.delete(deleteTarget.id);
      setDeleteTarget(null);
      // Reload current page or step back if last item on page
      if (problems.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchProblems();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete problem.');
    } finally {
      setDeleting(false);
    }
  };

  // Table Columns
  const columns = [
    {
      key: 'title',
      label: 'Problem',
      render: (row) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/problems/${row.id}`);
            }}
            className="font-medium text-gray-900 hover:text-indigo-600 text-left transition-colors cursor-pointer"
          >
            {row.title}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">{row.platform}</p>
        </div>
      ),
    },
    {
      key: 'difficulty',
      label: 'Difficulty',
      width: 100,
      render: (row) => <DifficultyBadge difficulty={row.difficulty} />,
    },
    {
      key: 'topics',
      label: 'Topics',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.topics?.slice(0, 3).map((t) => (
            <TopicTag key={t} label={t} />
          ))}
          {row.topics?.length > 3 && (
            <span className="text-xs text-gray-400 font-medium self-center">
              +{row.topics.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'reviewed',
      label: 'Reviewed Better',
      width: 120,
      render: (row) => (
        <ReviewBadge reviewed={row.improvedSolution?.reviewed} />
      ),
    },
    {
      key: 'solvingDate',
      label: 'Solved On',
      width: 110,
      render: (row) => <span className="text-xs text-gray-500">{row.solvingDate}</span>,
    },
    {
      key: 'nextRevision',
      label: 'Next Revision',
      width: 120,
      render: (row) => {
        const d = row.assessment?.nextRevisionDate;
        if (!d) return <span className="text-xs text-gray-400">—</span>;
        const overdue = d < today;
        return (
          <span className={`text-xs inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            {overdue && <AlertTriangle size={11} />}
            {d}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      width: 110,
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/problems/${row.id}`)}
            className="px-2 py-1 text-xs text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Open details"
          >
            View
          </button>
          <button
            onClick={() => navigate(`/problems/${row.id}/edit`)}
            className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-md font-medium transition-colors"
            title="Edit problem"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md font-medium transition-colors"
            title="Delete problem"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading && problems.length === 0) {
    return <LoadingState message="Loading your problem library..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchProblems} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Problem Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} problem{totalCount !== 1 ? 's' : ''} recorded in your vault
          </p>
        </div>
        <Button onClick={() => navigate('/add')}>
          <Plus size={16} /> Add Problem
        </Button>
      </div>

      {/* Search, Filters & Sorting Bar */}
      <Card>
        <div className="p-4 flex flex-wrap items-center gap-3">
          {/* Debounced Search */}
          <div className="flex-1 min-w-56">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search by title or platform..."
            />
          </div>

          {/* Difficulty Filter */}
          <FilterSelect
            value={filterDiff}
            onChange={(v) => { setFilterDiff(v); setPage(1); }}
            options={DIFFICULTIES}
            placeholder="All Difficulties"
          />

          {/* Platform Filter */}
          <FilterSelect
            value={filterPlatform}
            onChange={(v) => { setFilterPlatform(v); setPage(1); }}
            options={PLATFORMS}
            placeholder="All Platforms"
          />

          {/* Topic Filter */}
          <FilterSelect
            value={filterTopic}
            onChange={(v) => { setFilterTopic(v); setPage(1); }}
            options={allTopics}
            placeholder="All Topics"
          />

          {/* Solving Status Filter */}
          <FilterSelect
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            options={STATUSES}
            placeholder="All Statuses"
          />

          {/* Better Solution Reviewed Filter */}
          <FilterSelect
            value={filterReviewed}
            onChange={(v) => { setFilterReviewed(v); setPage(1); }}
            options={[
              { value: 'true', label: 'Reviewed' },
              { value: 'false', label: 'Not Reviewed' },
            ]}
            placeholder="Better Solution"
          />

          {/* Revision Status Filter */}
          <FilterSelect
            value={filterRevision}
            onChange={(v) => { setFilterRevision(v); setPage(1); }}
            options={[
              { value: 'due', label: 'Due today' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'upcoming', label: 'Upcoming' },
            ]}
            placeholder="Revision Status"
          />

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Sort:</span>
            <FilterSelect
              value={sortOption}
              onChange={(v) => { setSortOption(v); setPage(1); }}
              options={SORT_OPTIONS}
              placeholder="Sort By"
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline px-1 py-1 font-medium whitespace-nowrap cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table & Pagination Card */}
      <Card>
        {problems.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={hasActiveFilters ? "No matching problems" : "Your library is empty"}
            description={
              hasActiveFilters
                ? "Try clearing filters or adjusting your search term."
                : "Start logging your DSA learning journey by adding your first solved problem."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => navigate('/add')}>
                  <Plus size={14} /> Add First Problem
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={problems}
              onRowClick={(row) => navigate(`/problems/${row.id}`)}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} problem{totalCount !== 1 ? 's' : ''}
                </p>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(newPage) => {
                    setPage(newPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Problem"
        message={`Are you sure you want to permanently delete "${deleteTarget?.title}"? All associated revision history will be removed.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        danger
      />
    </div>
  );
}
