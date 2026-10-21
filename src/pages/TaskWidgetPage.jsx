import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowLeft, LayoutDashboard } from 'lucide-react';
import DailyTasksWidget from '../components/widgets/DailyTasksWidget';

export default function TaskWidgetPage() {
  const navigate = useNavigate();

  const openPopout = () => {
    window.open(
      '/widget/tasks',
      'DSATasksWidget',
      'width=420,height=680,resizable=yes,scrollbars=yes,status=no,toolbar=no'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-3 sm:p-6">
      <div className="w-full max-w-lg space-y-3">
        {/* Widget Top Bar */}
        <div className="flex items-center justify-between text-xs px-1 text-gray-500">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={openPopout}
              className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-800 transition-colors"
              title="Open as a small floating window next to your code editor"
            >
              <ExternalLink size={12} />
              <span>Popout Window</span>
            </button>
          </div>
        </div>

        {/* The Tasks Widget Card */}
        <DailyTasksWidget />
      </div>
    </div>
  );
}
