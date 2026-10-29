import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import DailyTasksWidget from '../components/widgets/DailyTasksWidget';

export default function TaskWidgetPage() {
  const navigate = useNavigate();

  const openPopout = () => {
    window.open(
      '/widget/tasks',
      'DSATasksWidget',
      'width=480,height=780,resizable=yes,scrollbars=yes,status=no,toolbar=no'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/70">
      {/* Top Nav Bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft size={15} />
          Dashboard
        </button>
        <button
          onClick={openPopout}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
          title="Open as floating window"
        >
          <ExternalLink size={12} />
          Popout
        </button>
      </div>

      {/* Centered content — comfortable desktop width */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <DailyTasksWidget />
      </div>
    </div>
  );
}
