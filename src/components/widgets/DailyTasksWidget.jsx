import { useState, useEffect } from 'react';
import {
  CheckCircle2, Circle, Plus, Trash2, Check,
  Sparkles, Calendar, Filter, ListTodo, AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';

const STORAGE_KEY = 'dsa_daily_tasks_v1';

const DEFAULT_TASKS = [
  {
    id: 't-1',
    text: 'Solve 2 Medium problems (Two Pointers / Sliding Window)',
    category: 'Practice',
    priority: 'high',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't-2',
    text: 'Complete overdue spaced-repetition revisions',
    category: 'Revision',
    priority: 'high',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't-3',
    text: 'Review Monotonic Stack template & edge cases',
    category: 'Theory',
    priority: 'medium',
    completed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't-4',
    text: '45-minute timed mock interview session',
    category: 'Mock',
    priority: 'normal',
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

const CATEGORIES = ['Practice', 'Revision', 'Theory', 'Mock'];

const PRIORITY_STYLES = {
  high: { label: 'High', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  normal: { label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function DailyTasksWidget() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return DEFAULT_TASKS;
  });

  const [inputVal, setInputVal] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Practice');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (e) => {
    e?.preventDefault();
    const text = inputVal.trim();
    if (!text) return;

    const newTask = {
      id: `t-${Date.now()}`,
      text,
      category: selectedCategory,
      priority: selectedPriority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setInputVal('');
  };

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const loadSmartPlan = () => {
    const smartTasks = [
      {
        id: `t-${Date.now()}-1`,
        text: 'Solve 2 LeetCode Mediums on current focus topic',
        category: 'Practice',
        priority: 'high',
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: `t-${Date.now()}-2`,
        text: 'Review spaced repetition queue & log outcomes',
        category: 'Revision',
        priority: 'high',
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: `t-${Date.now()}-3`,
        text: 'Study time & space complexity constraints for 1 problem',
        category: 'Theory',
        priority: 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];
    setTasks((prev) => [...smartTasks, ...prev]);
  };

  // Calculations
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <Card className="min-w-0 border-indigo-100/80 shadow-xs hover:border-indigo-200 transition-all">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
              <ListTodo size={14} />
            </div>
            <span>Today's Tasks & Checklist</span>
          </div>
        }
        subtitle="Daily study agenda, problem solving tasks, and revision goals"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={loadSmartPlan}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
              title="Add recommended daily study tasks"
            >
              <Sparkles size={12} />
              <span>Smart Plan</span>
            </button>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                title="Remove completed items"
              >
                Clear Done
              </button>
            )}
          </div>
        }
      />

      <CardBody className="space-y-4">
        {/* Progress bar and counter */}
        <div className="bg-gradient-to-r from-indigo-50/70 to-emerald-50/50 border border-indigo-100/70 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border border-indigo-200 flex items-center justify-center font-bold text-xs text-indigo-700 shrink-0 shadow-2xs">
              {progressPercent}%
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">
                {completedCount} of {totalCount} Tasks Completed
              </p>
              <p className="text-2xs text-gray-500">
                {completedCount === totalCount && totalCount > 0
                  ? '🎯 Outstanding! All daily tasks checked off!'
                  : `${totalCount - completedCount} tasks remaining for today`}
              </p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center bg-white/80 p-0.5 rounded-lg border border-gray-200 text-xs self-start sm:self-center">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'active' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              To-Do ({totalCount - completedCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                filter === 'completed' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Done ({completedCount})
            </button>
          </div>
        </div>

        {/* Quick Add Task Input */}
        <form onSubmit={addTask} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Add a new task (e.g. Solve 2 Graph problems, Revise LRU Cache)..."
                className="w-full pl-3.5 pr-10 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="inline-flex items-center gap-1 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors shrink-0"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-2xs text-gray-500 flex-wrap gap-2 pt-0.5">
            {/* Category selection */}
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-400">Category:</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-100 text-indigo-700 font-bold'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Priority selection */}
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-400">Priority:</span>
              {['high', 'medium', 'normal'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPriority(p)}
                  className={`px-2 py-0.5 rounded-md capitalize transition-colors ${
                    selectedPriority === p
                      ? 'bg-gray-800 text-white font-bold'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Task List */}
        <div className="space-y-2 pt-1 max-h-72 overflow-y-auto pr-1">
          {filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-gray-400 space-y-1">
              <CheckCircle2 size={24} className="mx-auto text-emerald-400 opacity-60" />
              <p className="text-xs font-semibold text-gray-600">No tasks in this list</p>
              <p className="text-2xs text-gray-400">
                {filter === 'completed'
                  ? 'Check off tasks to see them here!'
                  : 'Add a new task above or click "Smart Plan" to populate tasks.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const priorityInfo = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal;
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                    task.completed
                      ? 'bg-gray-50/70 border-gray-200/60 opacity-60'
                      : 'bg-white border-gray-200/90 hover:border-indigo-200 hover:shadow-2xs'
                  }`}
                >
                  {/* Checkbox & text */}
                  <div
                    onClick={() => toggleTask(task.id)}
                    className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer select-none"
                  >
                    <button
                      type="button"
                      className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-300 hover:border-indigo-600 bg-white'
                      }`}
                    >
                      {task.completed && <Check size={11} strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium leading-relaxed break-words ${
                          task.completed ? 'line-through text-gray-400' : 'text-gray-800'
                        }`}
                      >
                        {task.text}
                      </p>
                    </div>
                  </div>

                  {/* Badges & delete button */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-2xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                      {task.category}
                    </span>
                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-md border ${priorityInfo.color}`}>
                      {priorityInfo.label}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1 text-gray-300 hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardBody>
    </Card>
  );
}
