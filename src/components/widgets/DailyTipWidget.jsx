import { useState } from 'react';
import { Lightbulb, Shuffle, Zap } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';

const TIPS = [
  {
    category: 'Pattern Recognition',
    title: 'Monotonic Stack for Next Greater Element',
    desc: 'When you need the next/previous greater or smaller element in linear time O(N), keep a stack that is monotonically decreasing or increasing.',
    heuristic: 'If the problem has nested O(N²) loops finding the nearest larger element, think Monotonic Stack.',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    category: 'Complexity Heuristic',
    title: 'Input Size vs Target Time Complexity',
    desc: 'N ≤ 10 → O(N!) or O(2^N * N). N ≤ 20 → O(2^N). N ≤ 1000 → O(N²). N ≤ 10^5 → O(N log N) or O(N). N ≥ 10^9 → O(log N) or O(1).',
    heuristic: 'Always check problem constraints first to immediately eliminate impossible time complexities.',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    category: 'Edge-Case Trap',
    title: 'Integer Overflow in Binary Search & Math',
    desc: 'Avoid (low + high) / 2 in languages with fixed-width integers. Instead use low + (high - low) / 2 or safe arithmetic.',
    heuristic: 'Look out for N = 0, N = 1, all duplicate elements, negative numbers, and empty strings.',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    category: 'Pattern Recognition',
    title: 'Fast & Slow Pointers (Floyd’s Cycle)',
    desc: 'Move fast pointer 2 steps, slow pointer 1 step. If they meet, a cycle exists. To find entry, move one pointer to head and advance both by 1 step.',
    heuristic: 'Useful for Linked List cycles, finding middle node in single pass, and duplicate number in array.',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    category: 'Pattern Recognition',
    title: 'Sliding Window Invariant',
    desc: 'Expand right pointer to satisfy condition; once window becomes invalid or condition is met, shrink left pointer until valid again.',
    heuristic: 'Ideal for contiguous subarrays or substrings with sum, unique characters, or target frequencies.',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    category: 'Interview Communication',
    title: 'Talk Out Loud Before Writing Code',
    desc: 'State the brute force first (e.g. O(N²)), discuss its bottleneck, then explain how you will optimize it before writing a single line of code.',
    heuristic: 'Interviewers evaluate your thought process, edge-case anticipation, and clarity as much as clean code.',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

export default function DailyTipWidget() {
  const [index, setIndex] = useState(0);

  const nextTip = () => {
    setIndex((prev) => (prev + 1) % TIPS.length);
  };

  const tip = TIPS[index];

  return (
    <Card className="min-w-0 flex flex-col justify-between border-amber-100/70 shadow-xs hover:border-amber-200 transition-all">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            <span>Algorithmic Insight</span>
          </div>
        }
        subtitle="High-yield pattern reminders & interview heuristics"
        action={
          <button
            onClick={nextTip}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
          >
            <Shuffle size={12} />
            <span>Next Tip ({index + 1}/{TIPS.length})</span>
          </button>
        }
      />

      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tip.badgeColor}`}>
            {tip.category}
          </span>
        </div>

        <div>
          <h4 className="text-xs sm:text-sm font-bold text-gray-900">{tip.title}</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{tip.desc}</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-100/90 rounded-lg p-2.5 flex items-start gap-2">
          <Zap size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 font-medium leading-snug">
            <span className="font-bold">Rule of Thumb: </span>
            {tip.heuristic}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
