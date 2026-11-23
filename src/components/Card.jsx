// Reusable card wrapper
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200/90 rounded-xl min-w-0 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-gray-100/80">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`p-4 sm:p-5 min-w-0 ${className}`}>
      {children}
    </div>
  );
}

// Stat card for dashboard metrics
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg = 'bg-indigo-50',
  iconColor = 'text-indigo-600',
  children,
  className = '',
}) {
  return (
    <Card className={`min-w-0 flex flex-col justify-between transition-all duration-150 hover:shadow-xs ${className}`}>
      <div className="p-4 sm:p-5 flex items-start gap-3.5 min-w-0 flex-1">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 tracking-wide leading-tight">
            {label}
          </p>
          {children ? (
            children
          ) : (
            <p className="text-2xl font-bold text-gray-900 tracking-tight mt-1 leading-none truncate" title={String(value)}>
              {value}
            </p>
          )}
          {sub && (
            <div className="mt-1.5 min-w-0">
              {typeof sub === 'string' ? (
                <p className="text-xs text-gray-400 leading-snug break-words" title={sub}>
                  {sub}
                </p>
              ) : (
                sub
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
