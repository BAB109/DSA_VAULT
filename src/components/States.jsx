import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'md' }) {
  const sizeMap = { sm: 16, md: 24, lg: 32 };
  return (
    <Loader2
      size={sizeMap[size]}
      className="text-indigo-500 animate-spin"
    />
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
      {Icon && (
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Icon size={24} className="text-gray-400" />
        </div>
      )}
      <div>
        <p className="font-semibold text-gray-700">{title}</p>
        {description && <p className="text-sm text-gray-500 mt-1 max-w-xs">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div>
        <p className="font-semibold text-red-700">Error</p>
        <p className="text-sm text-gray-500 mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function SuccessToast({ message }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}
