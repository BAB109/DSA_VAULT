import { useState, useEffect, useCallback } from 'react';
import {
  Check, Plus, Trash2, Clock, ChevronDown, ChevronUp,
  BookOpen, Code2, Star, X, Calendar, Flame, Target,
  GripVertical, AlarmClock
} from 'lucide-react';
import { csFundamentalsService } from '../../services/csFundamentalsService';

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'dsa_daily_tasks_v2';
const WEEK_HISTORY_KEY = 'dsa_week_history_v2';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getWeekDays() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      date: d.getDate(),
      isToday: d.toISOString().slice(0, 10) === getTodayKey(),
      isFuture: d > today && d.toISOString().slice(0, 10) !== getTodayKey(),
    };
  });
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveTasks(allTasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(WEEK_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveHistory(h) {
  localStorage.setItem(WEEK_HISTORY_KEY, JSON.stringify(h));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt12(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────
function AddTaskModal({ onAdd, onClose }) {
  const [text, setText] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hasTime, setHasTime] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({
      id: `ut-${Date.now()}`,
      text: trimmed,
      completed: false,
      type: 'user',
      startTime: hasTime ? startTime : null,
      endTime: hasTime ? endTime : null,
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Plus size={14} className="text-white" />
            </div>
            Add New Task
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task text */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Task Description</label>
            <input
              autoFocus
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. Read OS chapter on scheduling..."
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* Time toggle */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setHasTime(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${hasTime ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasTime ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <AlarmClock size={12} className="text-indigo-500" />
                Set time window (for future notifications)
              </span>
            </label>
          </div>

          {hasTime && (
            <div className="grid grid-cols-2 gap-3 bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition-colors shadow-sm"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle, onDelete, isCompulsory }) {
  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
        task.completed
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : isCompulsory
            ? 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'
            : 'bg-white border-gray-100 hover:border-violet-200 hover:shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          task.completed
            ? 'bg-emerald-500 border-emerald-500'
            : isCompulsory
              ? 'border-indigo-300 hover:border-indigo-500 bg-white'
              : 'border-violet-300 hover:border-violet-500 bg-white'
        }`}
      >
        {task.completed && <Check size={11} strokeWidth={3} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.text}
        </p>
        {/* Time badge */}
        {(task.startTime || task.endTime) && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-400 font-medium">
            <Clock size={10} />
            {task.startTime && fmt12(task.startTime)}
            {task.startTime && task.endTime && ' – '}
            {task.endTime && fmt12(task.endTime)}
          </span>
        )}
        {/* Subtopic badge for CS */}
        {task.subtopic && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded-md">
            <BookOpen size={9} />
            {task.subtopic}
          </span>
        )}
      </div>

      {/* Delete */}
      {!isCompulsory && (
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 p-1 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 rounded-lg"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Week Strip Day Cell ──────────────────────────────────────────────────────
function DayCell({ day, done, total }) {
  const pct = total > 0 ? done / total : 0;
  const color =
    day.isFuture ? 'bg-gray-100 text-gray-300 border-gray-100'
    : day.isToday ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
    : pct === 1 ? 'bg-emerald-500 text-white border-emerald-500'
    : pct > 0 ? 'bg-amber-400 text-white border-amber-400'
    : 'bg-gray-100 text-gray-500 border-gray-100';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-semibold text-gray-400">{day.label}</span>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${color}`}>
        {day.date}
      </div>
      {!day.isFuture && (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold text-emerald-600">✓{done}</span>
          <span className="text-xs text-gray-300">✗{Math.max(0, total - done)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function DailyTasksWidget() {
  const todayKey = getTodayKey();
  const weekDays = getWeekDays();
  const now = new Date();
  const monthYear = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // All tasks stored by day key
  const [allTasks, setAllTasks] = useState(() => loadTasks());
  const [weekHistory, setWeekHistory] = useState(() => loadHistory());
  const [showAddModal, setShowAddModal] = useState(false);
  const [csCollapsed, setCsCollapsed] = useState(false);
  const [dsaCollapsed, setDsaCollapsed] = useState(false);

  // CS topic from API
  const [activeTopic, setActiveTopic] = useState(null);
  const [csLoading, setCsLoading] = useState(true);

  // Today's tasks (split by type)
  const todayTasks = allTasks[todayKey] || [];
  const dsaTasks   = todayTasks.filter(t => t.type === 'dsa');
  const csTasks    = todayTasks.filter(t => t.type === 'cs');
  const userTasks  = todayTasks.filter(t => t.type === 'user');

  // Persist whenever tasks change
  useEffect(() => {
    saveTasks(allTasks);
    // Update history
    const total = (allTasks[todayKey] || []).length;
    const done  = (allTasks[todayKey] || []).filter(t => t.completed).length;
    const newHist = { ...weekHistory, [todayKey]: { done, total } };
    setWeekHistory(newHist);
    saveHistory(newHist);
  }, [allTasks]);

  // Fetch active CS topic and seed compulsory tasks for today
  useEffect(() => {
    let cancelled = false;
    setCsLoading(true);
    csFundamentalsService.getActiveTopic()
      .then(data => {
        if (cancelled) return;
        setActiveTopic(data);
        seedCompulsoryTasks(data);
      })
      .catch(() => {
        if (!cancelled) {
          setActiveTopic(null);
          seedCompulsoryTasks(null);
        }
      })
      .finally(() => { if (!cancelled) setCsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const seedCompulsoryTasks = useCallback((topicData) => {
    setAllTasks(prev => {
      const existing = prev[todayKey] || [];
      // Only seed once per day
      const hasDsa = existing.some(t => t.type === 'dsa');
      const hasCs  = existing.some(t => t.type === 'cs');
      if (hasDsa && hasCs) return prev;

      const newTasks = [...existing];

      if (!hasDsa) {
        newTasks.push({
          id: `dsa-${todayKey}-1`,
          text: 'Solve 2 DSA problems (any difficulty)',
          type: 'dsa',
          completed: false,
          startTime: null,
          endTime: null,
          createdAt: new Date().toISOString(),
        });
        newTasks.push({
          id: `dsa-${todayKey}-2`,
          text: 'Review spaced-repetition queue & log outcomes',
          type: 'dsa',
          completed: false,
          startTime: null,
          endTime: null,
          createdAt: new Date().toISOString(),
        });
      }

      if (!hasCs) {
        const topicName  = topicData?.topic_title || topicData?.title || 'Current CS Topic';
        const subName    = topicData?.subtopic_title || topicData?.current_subtopic || null;
        newTasks.push({
          id: `cs-${todayKey}-1`,
          text: `Study: ${topicName}`,
          subtopic: subName,
          type: 'cs',
          completed: false,
          startTime: null,
          endTime: null,
          createdAt: new Date().toISOString(),
        });
        newTasks.push({
          id: `cs-${todayKey}-2`,
          text: `Complete checklist for: ${topicName}`,
          subtopic: subName,
          type: 'cs',
          completed: false,
          startTime: null,
          endTime: null,
          createdAt: new Date().toISOString(),
        });
      }

      return { ...prev, [todayKey]: newTasks };
    });
  }, [todayKey]);

  const toggleTask = (id) => {
    setAllTasks(prev => ({
      ...prev,
      [todayKey]: (prev[todayKey] || []).map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    }));
  };

  const deleteTask = (id) => {
    setAllTasks(prev => ({
      ...prev,
      [todayKey]: (prev[todayKey] || []).filter(t => t.id !== id),
    }));
  };

  const addUserTask = (task) => {
    setAllTasks(prev => ({
      ...prev,
      [todayKey]: [...(prev[todayKey] || []), task],
    }));
  };

  // Stats
  const totalToday = todayTasks.length;
  const doneToday  = todayTasks.filter(t => t.completed).length;
  const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const streak = (() => {
    let s = 0;
    const keys = Object.keys(weekHistory).sort().reverse();
    for (const k of keys) {
      if (k === todayKey) { s++; continue; }
      const h = weekHistory[k];
      if (h && h.total > 0 && h.done === h.total) s++;
      else break;
    }
    return s;
  })();

  return (
    <>
      {showAddModal && (
        <AddTaskModal onAdd={addUserTask} onClose={() => setShowAddModal(false)} />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{monthYear}</p>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5">To-Do Today</h2>
            </div>
            <div className="flex items-center gap-3">
              {streak > 1 && (
                <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                  <Flame size={12} />
                  {streak} day streak
                </div>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl shadow-sm shadow-indigo-200 transition-colors"
              >
                <Plus size={13} />
                New task
              </button>
            </div>
          </div>
        </div>

        {/* ── Week Strip ── */}
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/40">
          <div className="flex items-start justify-between">
            {weekDays.map(day => {
              const h = weekHistory[day.key] || { done: 0, total: 0 };
              return (
                <DayCell
                  key={day.key}
                  day={day}
                  done={day.isToday ? doneToday : h.done}
                  total={day.isToday ? totalToday : h.total}
                />
              );
            })}
          </div>
        </div>

        {/* ── Progress Bar ── */}
        <div className="px-6 py-3 border-b border-gray-50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-500">
              {doneToday} of {totalToday} completed
            </span>
            <span className="text-xs font-bold text-indigo-600">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && totalToday > 0 && (
            <p className="text-xs font-bold text-emerald-600 mt-1.5 text-center">
              🎯 All done! Outstanding work today!
            </p>
          )}
        </div>

        {/* ── Task Sections ── */}
        <div className="px-6 py-4 space-y-4 max-h-[52vh] overflow-y-auto">

          {/* DSA Section */}
          <section>
            <button
              onClick={() => setDsaCollapsed(v => !v)}
              className="w-full flex items-center justify-between mb-2.5 group"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Code2 size={13} className="text-indigo-600" />
                </div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">DSA Problems</span>
                <span className="text-xs text-gray-400 font-medium">
                  ({dsaTasks.filter(t => t.completed).length}/{dsaTasks.length})
                </span>
                <span className="text-2xs font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">Required</span>
              </div>
              {dsaCollapsed
                ? <ChevronDown size={14} className="text-gray-400" />
                : <ChevronUp size={14} className="text-gray-400" />}
            </button>

            {!dsaCollapsed && (
              <div className="space-y-2">
                {dsaTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    isCompulsory
                  />
                ))}
              </div>
            )}
          </section>

          {/* CS Fundamentals Section */}
          <section>
            <button
              onClick={() => setCsCollapsed(v => !v)}
              className="w-full flex items-center justify-between mb-2.5"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <BookOpen size={13} className="text-emerald-600" />
                </div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">CS Fundamentals</span>
                <span className="text-xs text-gray-400 font-medium">
                  ({csTasks.filter(t => t.completed).length}/{csTasks.length})
                </span>
                <span className="text-2xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Required</span>
              </div>
              {csCollapsed
                ? <ChevronDown size={14} className="text-gray-400" />
                : <ChevronUp size={14} className="text-gray-400" />}
            </button>

            {!csCollapsed && (
              <div className="space-y-2">
                {csLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                    <span className="text-xs text-gray-400">Fetching current topic…</span>
                  </div>
                ) : (
                  <>
                    {activeTopic && (
                      <div className="flex items-center gap-2 px-4 py-2 mb-1 rounded-xl bg-emerald-50 border border-emerald-100">
                        <Target size={12} className="text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-700 font-semibold">
                          Active: {activeTopic.topic_title || activeTopic.title || 'Current Topic'}
                          {(activeTopic.subtopic_title || activeTopic.current_subtopic) && (
                            <span className="text-emerald-500 font-normal">
                              {' '}→ {activeTopic.subtopic_title || activeTopic.current_subtopic}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {csTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        isCompulsory
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </section>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Your Tasks</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* User Tasks Section */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Star size={13} className="text-violet-600" />
                </div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Custom Tasks</span>
                <span className="text-xs text-gray-400 font-medium">
                  ({userTasks.filter(t => t.completed).length}/{userTasks.length})
                </span>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors"
              >
                <Plus size={11} />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {userTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <Plus size={16} className="text-gray-300" />
                  </div>
                  <p className="text-xs font-semibold text-gray-400 mt-1">No custom tasks yet</p>
                  <p className="text-2xs text-gray-300">Click "New task" to add yours</p>
                </div>
              ) : (
                userTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    isCompulsory={false}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/40 flex items-center justify-between">
          <span className="text-2xs text-gray-400 flex items-center gap-1">
            <Calendar size={10} />
            Tasks reset daily at midnight
          </span>
          <span className="text-2xs font-semibold text-gray-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </>
  );
}
