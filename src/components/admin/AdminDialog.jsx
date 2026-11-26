import { useEffect, useRef } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';

/**
 * Accessible confirmation dialog for Admin actions.
 * Rules:
 * - Traps focus inside the dialog while open.
 * - Restores focus to the triggering element when closed.
 * - Escape key closes.
 * - Backdrop click closes.
 * - Responsive down to 375px.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  loading = false,
  confirmInputText = null, // If provided, user must match this text to enable confirm
  confirmInputPlaceholder = '',
  confirmInputValue = '',
  onConfirmInputChange = null,
}) {
  const dialogRef = useRef(null);
  const triggerElementRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Capture triggering active element on open and restore on close
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement;
    } else if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
      triggerElementRef.current.focus();
    }
  }, [isOpen]);

  // Handle Escape key and Tab focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!loading) onClose();
        return;
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the confirm button or first interactive element after render
    const timeout = setTimeout(() => {
      if (confirmInputText) {
        const input = dialogRef.current?.querySelector('input');
        input?.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(timeout);
    };
  }, [isOpen, loading, onClose, confirmInputText]);

  if (!isOpen) return null;

  const isConfirmDisabled =
    loading ||
    (confirmInputText !== null && confirmInputValue.trim() !== confirmInputText.trim());

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle size={20} className="text-rose-600" />,
          iconBg: 'bg-rose-100',
          btn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
        };
      case 'warning':
        return {
          icon: <AlertCircle size={20} className="text-amber-600" />,
          iconBg: 'bg-amber-100',
          btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
        };
      default:
        return {
          icon: <AlertCircle size={20} className="text-indigo-600" />,
          iconBg: 'bg-indigo-100',
          btn: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="dialog-title" className="text-base font-bold text-gray-900 leading-6">
                {title}
              </h3>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Optional confirmation text input (e.g. Danger Zone delete) */}
          {confirmInputText !== null && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Type <span className="font-mono text-rose-600 bg-rose-50 px-1 py-0.5 rounded">{confirmInputText}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmInputValue}
                onChange={(e) => onConfirmInputChange?.(e.target.value)}
                placeholder={confirmInputPlaceholder || confirmInputText}
                className="w-full text-xs font-mono px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              disabled={isConfirmDisabled}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.btn}`}
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <span>{confirmLabel}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
