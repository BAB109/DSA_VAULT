import { X, ArrowUp, ArrowDown, RotateCcw, Check, Eye, EyeOff, Sliders } from 'lucide-react';

export default function WidgetCustomizerModal({
  isOpen,
  onClose,
  widgets,
  onToggleWidget,
  onMoveWidget,
  onResetDefaults,
}) {
  if (!isOpen) return null;

  const enabledCount = widgets.filter((w) => w.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-2xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Customize Dashboard Widgets</h3>
              <p className="text-xs text-gray-500">
                {enabledCount} of {widgets.length} widgets enabled
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          <p className="text-xs text-gray-500 mb-2">
            Toggle widgets on or off and use the arrow buttons to rearrange their layout order.
          </p>

          {widgets.map((widget, index) => {
            const Icon = widget.icon;
            return (
              <div
                key={widget.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  widget.enabled
                    ? 'bg-white border-gray-200 shadow-2xs hover:border-indigo-200'
                    : 'bg-gray-50/80 border-gray-200 opacity-60'
                }`}
              >
                {/* Info & Icon */}
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      widget.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {Icon ? <Icon size={16} /> : <Check size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{widget.label}</p>
                    <p className="text-2xs text-gray-500 truncate">{widget.description}</p>
                  </div>
                </div>

                {/* Actions: Reorder + Toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={index === 0}
                    onClick={() => onMoveWidget(index, index - 1)}
                    title="Move up"
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 rounded transition-colors"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    disabled={index === widgets.length - 1}
                    onClick={() => onMoveWidget(index, index + 1)}
                    title="Move down"
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 rounded transition-colors"
                  >
                    <ArrowDown size={15} />
                  </button>

                  <div className="h-4 w-px bg-gray-200 mx-1" />

                  <button
                    onClick={() => onToggleWidget(widget.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      widget.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {widget.enabled ? (
                      <>
                        <Eye size={13} />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={13} />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/70">
          <button
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-semibold"
          >
            <RotateCcw size={13} />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
