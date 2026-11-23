import { forwardRef } from 'react';

// Base input
export const Input = forwardRef(function Input({ label, error, hint, required, className = '', ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors
          placeholder-gray-400 text-gray-900
          ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}
          ${className}
        `}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

// Textarea
export const Textarea = forwardRef(function Textarea({ label, error, hint, required, rows = 3, className = '', ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors resize-none
          placeholder-gray-400 text-gray-900
          ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}
          ${className}
        `}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

// Select dropdown
export const Select = forwardRef(function Select({ label, error, hint, required, children, className = '', ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors appearance-none
          text-gray-900 cursor-pointer
          ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

// Form section wrapper
export function FormSection({ title, description, children }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

// Grid span helpers
export function FullWidth({ children }) {
  return <div className="md:col-span-2">{children}</div>;
}

// Checkbox
export function Checkbox({ label, hint, ...props }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
        {...props}
      />
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

// Star / dot rating
export function RatingInput({ label, value, onChange, max = 5 }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`w-8 h-8 rounded-lg text-sm font-semibold border transition-colors
              ${i <= value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-300'
              }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

// Tag input
export function TagInput({ label, tags, setTags, placeholder = 'Add tag and press Enter', suggestions = [] }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        e.target.value = '';
      }
    }
    if (e.key === 'Backspace' && !e.target.value && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
      <div className="min-h-[38px] flex flex-wrap gap-1.5 px-3 py-2 border border-gray-300 rounded-lg focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 bg-white">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-medium">
            {tag}
            <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] outline-none text-sm placeholder-gray-400 text-gray-900 bg-transparent"
          placeholder={tags.length === 0 ? placeholder : ''}
          onKeyDown={handleKeyDown}
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      <p className="text-xs text-gray-400">Press Enter or comma to add</p>
    </div>
  );
}

// Primary button
export function Button({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
