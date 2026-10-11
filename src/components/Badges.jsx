export function DifficultyBadge({ difficulty }) {
  const map = {
    Easy: 'badge-easy',
    Medium: 'badge-medium',
    Hard: 'badge-hard',
  };
  return (
    <span className={map[difficulty] || 'badge-easy'}>
      {difficulty}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    // New status values
    'Solved Independently': 'bg-emerald-100 text-emerald-700',
    'Solved With Hint':     'bg-blue-100 text-blue-700',
    'Solved With Help':     'bg-amber-100 text-amber-700',
    'Unable To Solve':      'bg-gray-100 text-gray-600',
    // Legacy fallbacks (keep for any old data)
    'Solved':               'bg-emerald-100 text-emerald-700',
    'Partially Solved':     'bg-amber-100 text-amber-700',
    'Attempted':            'bg-blue-100 text-blue-700',
    'Unsolved':             'bg-gray-100 text-gray-600',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function ReviewBadge({ reviewed }) {
  return reviewed ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
      <span>✓</span> Reviewed
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Not Reviewed
    </span>
  );
}

export function TopicTag({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
      {label}
    </span>
  );
}

export function ConfidenceDots({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i <= rating ? 'bg-indigo-500' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}
