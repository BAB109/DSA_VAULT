import { useState, useRef, useEffect } from 'react';
import { Calendar, Flame, CheckCircle, RotateCcw } from 'lucide-react';

const LEVEL_CLASSES = {
  0: 'bg-gray-100 border-gray-200/70 text-gray-400',
  1: 'bg-emerald-200 border-emerald-300 text-emerald-800',
  2: 'bg-emerald-400 border-emerald-500 text-emerald-950',
  3: 'bg-emerald-600 border-emerald-700 text-white',
  4: 'bg-emerald-800 border-emerald-900 text-white',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ActivityCalendar({ calendar }) {
  const [activeCell, setActiveCell] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  if (!calendar || !calendar.weeks || calendar.weeks.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        Activity calendar loading or unavailable.
      </div>
    );
  }

  const { weeks, months, totalActivitiesYear, activeDaysCount, longestStreak } = calendar;

  const handleCellHover = (cell, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current
      ? containerRef.current.getBoundingClientRect()
      : { left: 0, top: 0 };

    setHoverPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    });
    setActiveCell(cell);
  };

  const handleKeyDown = (e, weekIndex, dayIndex) => {
    let nextWeek = weekIndex;
    let nextDay = dayIndex;

    if (e.key === 'ArrowRight') {
      nextWeek = Math.min(weeks.length - 1, weekIndex + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      nextWeek = Math.max(0, weekIndex - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      nextDay = Math.min(6, dayIndex + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      nextDay = Math.max(0, dayIndex - 1);
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      setActiveCell(weeks[weekIndex][dayIndex]);
      e.preventDefault();
      return;
    } else {
      return;
    }

    const targetCell = weeks[nextWeek]?.[nextDay];
    if (targetCell) {
      setActiveCell(targetCell);
      const cellId = `cell-${targetCell.date}`;
      const elem = document.getElementById(cellId);
      if (elem) elem.focus();
    }
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Calendar Top Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-indigo-600" />
          <span className="font-bold text-gray-900">
            {totalActivitiesYear} activities in the past year
          </span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          <span className="flex items-center gap-1">
            <CheckCircle size={14} className="text-emerald-500" />
            <strong>{activeDaysCount}</strong> active days
          </span>
          <span className="flex items-center gap-1">
            <Flame size={14} className="text-orange-500" />
            Longest streak: <strong>{longestStreak}d</strong>
          </span>
        </div>
      </div>

      {/* Heatmap Grid & Tooltip Area */}
      <div className="relative overflow-x-auto pb-2 focus:outline-none">
        {/* Floating Tooltip */}
        {activeCell && (
          <div
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap transition-all"
            style={{
              left: `${hoverPosition.x}px`,
              top: `${hoverPosition.y}px`,
            }}
          >
            <p className="font-bold text-white">
              {activeCell.count === 0
                ? 'No activity'
                : `${activeCell.count} ${activeCell.count === 1 ? 'activity' : 'activities'}`}
            </p>
            <p className="text-2xs text-gray-300 mt-0.5">{activeCell.formattedDate}</p>
            {activeCell.count > 0 && (
              <p className="text-2xs text-emerald-300 mt-0.5">
                {activeCell.problemsCount} solved · {activeCell.revisionsCount} revised
              </p>
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}

        <div className="inline-block min-w-full">
          {/* Month labels header */}
          <div className="flex text-2xs font-semibold text-gray-400 pl-8 mb-1.5 select-none h-4 relative">
            {months.map((m, idx) => (
              <span
                key={`${m.label}-${idx}`}
                className="absolute"
                style={{ left: `${m.weekIndex * 15 + 32}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Main Day Grid */}
          <div
            className="flex gap-1"
            role="grid"
            aria-label="Daily DSA Activity Heatmap for the past year"
          >
            {/* Weekday Labels (Mon, Wed, Fri) */}
            <div className="flex flex-col gap-1 pr-1.5 text-2xs text-gray-400 select-none justify-between h-[104px]">
              <span className="h-3 leading-3 opacity-0">Sun</span>
              <span className="h-3 leading-3">Mon</span>
              <span className="h-3 leading-3 opacity-0">Tue</span>
              <span className="h-3 leading-3">Wed</span>
              <span className="h-3 leading-3 opacity-0">Thu</span>
              <span className="h-3 leading-3">Fri</span>
              <span className="h-3 leading-3 opacity-0">Sat</span>
            </div>

            {/* Weeks columns */}
            {weeks.map((week, wIdx) => (
              <div key={`week-${wIdx}`} className="flex flex-col gap-1" role="row">
                {week.map((cell, dIdx) => {
                  const isFuture = cell.isFuture;
                  const label = `${cell.count} activities on ${cell.formattedDate}`;

                  return (
                    <button
                      key={cell.date}
                      id={`cell-${cell.date}`}
                      type="button"
                      role="gridcell"
                      aria-label={label}
                      tabIndex={isFuture ? -1 : 0}
                      disabled={isFuture}
                      onMouseEnter={(e) => !isFuture && handleCellHover(cell, e)}
                      onMouseLeave={() => setActiveCell(null)}
                      onFocus={(e) => !isFuture && handleCellHover(cell, e)}
                      onBlur={() => setActiveCell(null)}
                      onKeyDown={(e) => handleKeyDown(e, wIdx, dIdx)}
                      className={`w-3 h-3 rounded-2xs border transition-transform duration-100 ${
                        isFuture
                          ? 'bg-transparent border-transparent cursor-default'
                          : `${LEVEL_CLASSES[cell.level]} hover:scale-125 focus:scale-125 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer`
                      } ${cell.isToday ? 'ring-1 ring-indigo-500' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Legend & Keyboard Instruction */}
      <div className="flex flex-wrap items-center justify-between text-2xs text-gray-500 pt-2 border-t border-gray-100 gap-2">
        <span className="text-gray-400">
          Tip: Use <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-2xs font-mono">Arrow keys</kbd> to explore days
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 mr-0.5">Less</span>
          <span className="w-2.5 h-2.5 rounded-2xs border bg-gray-100 border-gray-200/70" title="0 activities" />
          <span className="w-2.5 h-2.5 rounded-2xs border bg-emerald-200 border-emerald-300" title="1-2 activities" />
          <span className="w-2.5 h-2.5 rounded-2xs border bg-emerald-400 border-emerald-500" title="3-4 activities" />
          <span className="w-2.5 h-2.5 rounded-2xs border bg-emerald-600 border-emerald-700" title="5-6 activities" />
          <span className="w-2.5 h-2.5 rounded-2xs border bg-emerald-800 border-emerald-900" title="7+ activities" />
          <span className="text-gray-400 ml-0.5">More</span>
        </div>
      </div>
    </div>
  );
}
