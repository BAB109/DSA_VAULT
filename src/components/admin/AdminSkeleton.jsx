/**
 * Skeletons for Admin UI components (tables, cards, detail pages)
 */

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-pulse">
      <div className="h-11 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3.5 bg-gray-200 rounded-md w-1/6" />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-14 flex items-center px-4 gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3 bg-gray-100 rounded-md"
                style={{ width: `${Math.max(30, (c * 17 + r * 13) % 70 + 20)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-16 h-3 bg-gray-200 rounded" />
            <div className="w-6 h-6 bg-gray-100 rounded-lg" />
          </div>
          <div className="w-24 h-6 bg-gray-300 rounded" />
          <div className="w-32 h-2.5 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="space-y-2">
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-48 h-7 bg-gray-300 rounded" />
        </div>
        <div className="w-32 h-8 bg-gray-200 rounded-xl" />
      </div>
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-20 h-7 bg-gray-100 rounded-lg" />
        ))}
      </div>
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
