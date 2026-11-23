import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Clock, FileCode2, Play, Pause, RotateCcw,
  PlusCircle, BookOpen, ChevronDown, Sparkles, X,
  Maximize2, Minimize2, Copy, Check, ListTodo, Plus,
  ExternalLink
} from 'lucide-react';
import { useTimer } from '../../context/TimerContext';

const QUICK_SNIPPETS = [
  {
    name: 'Binary Search',
    code: `let l = 0, r = nums.length - 1;
while (l <= r) {
  const m = l + Math.floor((r - l) / 2);
  if (nums[m] === target) return m;
  else if (nums[m] < target) l = m + 1;
  else r = m - 1;
}`,
  },
  {
    name: 'BFS Level Order',
    code: `const q = [root];
while (q.length) {
  const levelSize = q.length;
  for (let i = 0; i < levelSize; i++) {
    const node = q.shift();
    if (node.left) q.push(node.left);
    if (node.right) q.push(node.right);
  }
}`,
  },
];

const TASKS_STORAGE_KEY = 'dsa_daily_tasks_v1';

export default function FloatingQuickWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'timer' | 'notes' | 'shortcuts'
  const [copiedSnippet, setCopiedSnippet] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [quickTaskText, setQuickTaskText] = useState('');

  const {
    mode,
    seconds,
    isRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
    getElapsedMinutes,
  } = useTimer();

  const navigate = useNavigate();
  const location = useLocation();

  // Load tasks on open
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TASKS_STORAGE_KEY);
      if (saved) {
        setTasks(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
  }, [isOpen]);

  const toggleTask = (id) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  };

  const addQuickTask = (e) => {
    e.preventDefault();
    if (!quickTaskText.trim()) return;
    const newTask = {
      id: `t-${Date.now()}`,
      text: quickTaskText.trim(),
      category: 'Practice',
      priority: 'medium',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
    setQuickTaskText('');
  };

  // If on login, register, or dedicated widget page, don't show floating widget
  if (
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/widget/tasks'
  ) {
    return null;
  }

  const handleLogFromTimer = () => {
    pauseTimer();
    const mins = getElapsedMinutes();
    setIsOpen(false);
    navigate(`/add?timeTaken=${mins}`, { state: { timeTaken: String(mins) } });
  };

  const copySnippet = (code, name) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(name);
    setTimeout(() => setCopiedSnippet(null), 1500);
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {/* Popover Card */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-92 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                {isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              </span>
              <span className="text-xs font-bold tracking-tight">DSA Quick Widget</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/widget/tasks');
                }}
                title="Open Standalone Widget"
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 bg-gray-50/60 p-1">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ✅ Tasks {tasks.length > 0 && `(${completedCount}/${tasks.length})`}
            </button>
            <button
              onClick={() => setActiveTab('timer')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'timer'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⏱️ Timer
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'notes'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📝 Sheet
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'shortcuts'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🚀 Jump
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3.5">
            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <div className="space-y-2.5">
                {/* Quick Add */}
                <form onSubmit={addQuickTask} className="flex gap-1.5">
                  <input
                    type="text"
                    value={quickTaskText}
                    onChange={(e) => setQuickTaskText(e.target.value)}
                    placeholder="New task (e.g. Solve 1 DP prob)..."
                    className="flex-1 text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 text-gray-800"
                  />
                  <button
                    type="submit"
                    disabled={!quickTaskText.trim()}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                  >
                    <Plus size={13} />
                  </button>
                </form>

                {/* Tasks List */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {tasks.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-xs">
                      No tasks yet today. Add one above!
                    </div>
                  ) : (
                    tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => toggleTask(t.id)}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                          t.completed
                            ? 'bg-gray-50 border-gray-100 opacity-60'
                            : 'bg-white border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <button
                          type="button"
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                            t.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {t.completed && <Check size={9} strokeWidth={3} />}
                        </button>
                        <span
                          className={`text-xs flex-1 break-words leading-tight ${
                            t.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'
                          }`}
                        >
                          {t.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between text-2xs text-gray-400 border-t border-gray-100">
                  <span>{completedCount} of {tasks.length} done</span>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/widget/tasks');
                    }}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Open Full Tasks Widget →
                  </button>
                </div>
              </div>
            )}

            {/* TIMER TAB */}
            {activeTab === 'timer' && (
              <div className="space-y-3 text-center">
                <div className="py-2 bg-indigo-50/60 rounded-xl border border-indigo-100/80">
                  <span className="font-mono text-3xl font-bold text-gray-900">
                    {formatTime(seconds)}
                  </span>
                  <p className="text-2xs text-gray-500 capitalize">{mode} mode</p>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {!isRunning ? (
                    <button
                      onClick={startTimer}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                    >
                      <Play size={12} className="fill-white" />
                      <span>Start</span>
                    </button>
                  ) : (
                    <button
                      onClick={pauseTimer}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                    >
                      <Pause size={12} className="fill-white" />
                      <span>Pause</span>
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="p-1.5 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <button
                  onClick={handleLogFromTimer}
                  className="w-full py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors"
                >
                  Log Solve ({getElapsedMinutes()}m) →
                </button>
              </div>
            )}

            {/* CHEAT SHEET TAB */}
            {activeTab === 'notes' && (
              <div className="space-y-2.5 max-h-52 overflow-y-auto">
                <p className="text-2xs text-gray-500">Click to copy quick boilerplate templates:</p>
                {QUICK_SNIPPETS.map((snip) => (
                  <div key={snip.name} className="bg-gray-50 border border-gray-200/80 rounded-lg p-2">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-200/60">
                      <span className="text-2xs font-bold text-gray-800">{snip.name}</span>
                      <button
                        onClick={() => copySnippet(snip.code, snip.name)}
                        className="inline-flex items-center gap-1 text-2xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        {copiedSnippet === snip.name ? (
                          <>
                            <Check size={11} className="text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-3xs font-mono text-gray-600 overflow-x-auto">
                      {snip.code}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* SHORTCUTS TAB */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-1.5">
                <button
                  onClick={() => { setIsOpen(false); navigate('/add'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <PlusCircle size={15} className="text-indigo-600" />
                  <span>Log New Problem</span>
                </button>
                <button
                  onClick={() => { setIsOpen(false); navigate('/revision'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                >
                  <RotateCcw size={15} className="text-amber-600" />
                  <span>Spaced Revision Center</span>
                </button>
                <button
                  onClick={() => { setIsOpen(false); navigate('/library'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <BookOpen size={15} className="text-blue-600" />
                  <span>Problem Library</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg transition-all duration-200 ${
          isRunning
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-200'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
        title="Open Quick Tasks & Widgets"
      >
        <span className="flex h-2 w-2 relative">
          {isRunning && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
        </span>
        <span className="font-mono text-xs font-bold">
          {isRunning ? formatTime(seconds) : 'Tasks & Widgets'}
        </span>
      </button>
    </div>
  );
}
