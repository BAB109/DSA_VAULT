import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, AlertTriangle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';
import { DifficultyBadge } from '../Badges';
import { problemService } from '../../services/problemService';

export default function QuickRevisionWidget({ metrics }) {
  const [dueProblems, setDueProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    problemService.getDueRevisions?.()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setDueProblems(list.slice(0, 3));
      })
      .catch(() => {
        // Fallback gracefully if endpoint differs
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const overdueCount = metrics?.overdueCount || 0;
  const dueTodayCount = metrics?.dueTodayCount || 0;
  const totalDue = overdueCount + dueTodayCount;

  return (
    <Card className="min-w-0 flex flex-col justify-between border-amber-100/90 shadow-xs hover:border-amber-200 transition-all">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-600" />
            <span>Spaced Repetition Queue</span>
          </div>
        }
        subtitle="Problems primed for optimal memory retention"
        action={
          <button
            onClick={() => navigate('/revision')}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors flex items-center gap-1"
          >
            <span>Revision Center</span>
            <ArrowRight size={13} />
          </button>
        }
      />

      <CardBody className="space-y-3">
        {loading ? (
          <div className="py-6 text-center text-xs text-gray-400 animate-pulse">
            Checking spaced repetition queue...
          </div>
        ) : totalDue > 0 ? (
          <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  {overdueCount > 0 ? `${overdueCount} Overdue` : ''} {dueTodayCount > 0 ? `${dueTodayCount} Due Today` : ''}
                </p>
                <p className="text-xs text-amber-700">Revising on schedule prevents the forgetting curve!</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/revision')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors shrink-0"
            >
              Start Review
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">All Revisions Cleared!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                No problems overdue today. Solid retention streak!
              </p>
            </div>
          </div>
        )}

        {/* Due problem items preview */}
        {dueProblems.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Top Priority</p>
            {dueProblems.map((prob) => (
              <div
                key={prob.id}
                onClick={() => navigate(`/problems/${prob.id}`)}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-indigo-50/60 border border-gray-100 hover:border-indigo-100 cursor-pointer transition-colors group"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-semibold text-gray-800 group-hover:text-indigo-600 truncate">
                    {prob.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {prob.platform} {prob.topics?.[0] ? `· ${prob.topics[0]}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DifficultyBadge difficulty={prob.difficulty} />
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pt-2 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Solve a new problem to add it to your spaced repetition cycle</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
