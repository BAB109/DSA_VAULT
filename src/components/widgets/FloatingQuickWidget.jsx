import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Pause, RotateCcw,
  PlusCircle, BookOpen, X
} from 'lucide-react';
import { useTimer } from '../../context/TimerContext';

export default function FloatingQuickWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('timer'); // 'timer' | 'shortcuts'

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

  // If on login or register, don't show floating widget
  if (
    location.pathname === '/login' ||
    location.pathname === '/register'
  ) {
    return null;
  }

  const handleLogFromTimer = () => {
    pauseTimer();
    const mins = getElapsedMinutes();
    setIsOpen(false);
    navigate(`/add?timeTaken=${mins}`, { state: { timeTaken: String(mins) } });
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {/* Popover Card */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-88 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                {isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              </span>
              <span className="text-xs font-bold tracking-tight">DSA Focus Timer</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              aria-label="Close widget"
            >
              <X size={15} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 bg-gray-50/60 p-1">
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
              onClick={() => setActiveTab('shortcuts')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'shortcuts'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🚀 Shortcuts
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* TIMER TAB */}
            {activeTab === 'timer' && (
              <div className="space-y-3.5 text-center">
                <div className="py-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80">
                  <span className="font-mono text-3xl font-bold text-gray-900 tracking-tight">
                    {formatTime(seconds)}
                  </span>
                  <p className="text-2xs text-gray-500 capitalize mt-0.5">{mode} mode</p>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {!isRunning ? (
                    <button
                      onClick={startTimer}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                    >
                      <Play size={12} className="fill-white" />
                      <span>Start</span>
                    </button>
                  ) : (
                    <button
                      onClick={pauseTimer}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                    >
                      <Pause size={12} className="fill-white" />
                      <span>Pause</span>
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="p-1.5 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-lg transition-colors"
                    title="Reset Timer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <button
                  onClick={handleLogFromTimer}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                >
                  ⚡ Quick Log Solve ({getElapsedMinutes()}m) →
                </button>
              </div>
            )}

            {/* SHORTCUTS TAB */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-1.5">
                <button
                  onClick={() => { setIsOpen(false); navigate('/add'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left"
                >
                  <PlusCircle size={15} className="text-indigo-600 shrink-0" />
                  <span>Log New Problem</span>
                </button>
                <button
                  onClick={() => { setIsOpen(false); navigate('/revision'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left"
                >
                  <RotateCcw size={15} className="text-amber-600 shrink-0" />
                  <span>Spaced Revision Center</span>
                </button>
                <button
                  onClick={() => { setIsOpen(false); navigate('/library'); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
                >
                  <BookOpen size={15} className="text-blue-600 shrink-0" />
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
        title="Open DSA Timer"
      >
        <span className="flex h-2 w-2 relative">
          {isRunning && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
        </span>
        <span className="font-mono text-xs font-bold">
          {isRunning ? formatTime(seconds) : 'DSA Timer'}
        </span>
      </button>
    </div>
  );
}
