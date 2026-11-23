import { useState, useEffect } from 'react';
import { FileCode2, Copy, Check, Trash2, BookOpen, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';

const CHEAT_SHEETS = [
  {
    title: 'Binary Search (Lower Bound)',
    code: `// First index where arr[mid] >= target
let left = 0, right = arr.length;
while (left < right) {
  const mid = left + Math.floor((right - left) / 2);
  if (arr[mid] >= target) right = mid;
  else left = mid + 1;
}
return left;`,
  },
  {
    title: 'Sliding Window (Dynamic)',
    code: `let left = 0, maxLen = 0;
const map = new Map();
for (let right = 0; right < s.length; right++) {
  // add s[right] to window state
  while (/* window is invalid */) {
    // shrink window from left
    left++;
  }
  maxLen = Math.max(maxLen, right - left + 1);
}`,
  },
  {
    title: 'Monotonic Stack (Next Greater Element)',
    code: `const stack = []; // stores indices
const res = new Array(n).fill(-1);
for (let i = 0; i < n; i++) {
  while (stack.length && arr[i] > arr[stack[stack.length - 1]]) {
    res[stack.pop()] = arr[i];
  }
  stack.push(i);
}`,
  },
  {
    title: 'Bitwise Quick Tricks',
    code: `n & (n - 1)       // Clears the lowest set bit (power of 2 check)
n & (-n)          // Isolates the lowest set bit
x ^ x === 0       // Self XOR cancellation
x ^ 0 === x       // Identity element
(n >> k) & 1      // Check if k-th bit is set`,
  },
];

export default function QuickScratchpadWidget() {
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'cheatsheet'
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('dsa_scratchpad_notes') || '';
  });
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedNotes, setCopiedNotes] = useState(false);

  useEffect(() => {
    localStorage.setItem('dsa_scratchpad_notes', notes);
  }, [notes]);

  const copyToClipboard = (text, index = null) => {
    navigator.clipboard.writeText(text);
    if (index !== null) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } else {
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 1500);
    }
  };

  const clearNotes = () => {
    if (window.confirm('Clear all scratchpad notes?')) {
      setNotes('');
    }
  };

  return (
    <Card className="min-w-0 flex flex-col justify-between border-gray-200/90 shadow-xs hover:border-gray-300 transition-all">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <FileCode2 size={16} className="text-indigo-600" />
            <span>DSA Scratchpad & Templates</span>
          </div>
        }
        subtitle="Quick notes, pseudocode, and algorithm boilerplate"
        action={
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'notes' ? 'bg-white text-indigo-600 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Scratchpad
            </button>
            <button
              onClick={() => setActiveTab('cheatsheet')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'cheatsheet' ? 'bg-white text-indigo-600 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Templates
            </button>
          </div>
        }
      />

      <CardBody className="space-y-3">
        {activeTab === 'notes' ? (
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type temporary notes, test cases, formulas, or tricky edge cases... (Saved automatically)"
                rows={5}
                className="w-full text-xs font-mono p-3 bg-gray-50/80 rounded-lg border border-gray-200 outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all resize-none text-gray-800 placeholder-gray-400"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>{notes.length} characters</span>
              <div className="flex items-center gap-2">
                {notes.length > 0 && (
                  <>
                    <button
                      onClick={() => copyToClipboard(notes)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {copiedNotes ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedNotes ? 'Copied!' : 'Copy Notes'}</span>
                    </button>
                    <button
                      onClick={clearNotes}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-medium transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {CHEAT_SHEETS.map((cs, idx) => (
              <div key={cs.title} className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/60">
                  <span className="text-xs font-bold text-gray-700">{cs.title}</span>
                  <button
                    onClick={() => copyToClipboard(cs.code, idx)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-2xs font-mono text-gray-700 overflow-x-auto pt-1.5 leading-relaxed">
                  {cs.code}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
