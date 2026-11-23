import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, RotateCcw, Volume2, VolumeX,
  Clock, Plus, ArrowRight, Award, Flame
} from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { Card, CardHeader, CardBody } from '../Card';

const PRESETS = [
  { label: '15m Sprint', mins: 15 },
  { label: '25m Pomodoro', mins: 25 },
  { label: '45m Interview', mins: 45 },
  { label: '60m Hard', mins: 60 },
];

export default function FocusTimerWidget({ onDismiss }) {
  const {
    mode,
    seconds,
    targetDuration,
    isRunning,
    hasFinished,
    soundEnabled,
    setSoundEnabled,
    startTimer,
    pauseTimer,
    resetTimer,
    setCountdownMinutes,
    switchToStopwatch,
    addMinutes,
    formatTime,
    getElapsedMinutes,
  } = useTimer();

  const [customInput, setCustomInput] = useState('');
  const navigate = useNavigate();

  // Calculate progress percentage for countdown
  const progressPercent = mode === 'countdown' && targetDuration > 0
    ? Math.max(0, Math.min(100, Math.round(((targetDuration - seconds) / targetDuration) * 100)))
    : 0;

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customInput, 10);
    if (val && val > 0 && val <= 300) {
      setCountdownMinutes(val);
      setCustomInput('');
    }
  };

  const handleLogProblem = () => {
    pauseTimer();
    const mins = getElapsedMinutes();
    navigate(`/add?timeTaken=${mins}`, { state: { timeTaken: String(mins) } });
  };

  return (
    <Card className="min-w-0 flex flex-col justify-between border-indigo-100 shadow-xs hover:border-indigo-200 transition-all">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              {isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-indigo-600' : 'bg-gray-300'}`} />
            </span>
            <span>Focus & Interview Timer</span>
          </div>
        }
        subtitle="Simulate real mock interview pressure and track solving speed"
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-gray-300" />}
            </button>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setCountdownMinutes(25)}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  mode === 'countdown' ? 'bg-white text-indigo-600 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Timer
              </button>
              <button
                onClick={switchToStopwatch}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  mode === 'stopwatch' ? 'bg-white text-indigo-600 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Stopwatch
              </button>
            </div>
          </div>
        }
      />

      <CardBody className="space-y-4">
        {/* Preset buttons (for countdown mode) */}
        {mode === 'countdown' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map((p) => {
              const active = targetDuration === p.mins * 60;
              return (
                <button
                  key={p.mins}
                  onClick={() => setCountdownMinutes(p.mins)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Big Time Display */}
        <div className="flex flex-col items-center justify-center py-2 bg-gradient-to-b from-indigo-50/40 to-transparent rounded-xl border border-indigo-50/70">
          <div className="font-mono text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-1">
            <span>{formatTime(seconds)}</span>
            <span className="text-xs font-sans font-semibold text-gray-400">
              {mode === 'countdown' ? 'remaining' : 'elapsed'}
            </span>
          </div>

          {/* Progress bar in countdown mode */}
          {mode === 'countdown' && (
            <div className="w-48 sm:w-64 bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  progressPercent > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Time's up banner */}
          {hasFinished && (
            <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5 animate-bounce">
              <Award size={14} className="text-amber-600" />
              <span>Time is up! Great practice run.</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={startTimer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <Play size={14} className="fill-white" />
                <span>Start</span>
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <Pause size={14} className="fill-white" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={resetTimer}
              title="Reset Timer"
              className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            {mode === 'countdown' && (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => addMinutes(1)}
                  className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium rounded-md transition-colors"
                >
                  +1m
                </button>
                <button
                  onClick={() => addMinutes(5)}
                  className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium rounded-md transition-colors"
                >
                  +5m
                </button>
              </div>
            )}
          </div>

          {/* Quick Log Problem Button */}
          <button
            onClick={handleLogProblem}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg transition-colors ml-auto"
            title="Log Problem with this elapsed time"
          >
            <span>Log with {getElapsedMinutes()}m</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
