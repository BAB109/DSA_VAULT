import { useState } from 'react';
import { Modal } from '../Modal';
import { trackerService } from '../../services/trackerService';

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SubmitModal({ isOpen, onClose, assignment, trackerId, onSuccess }) {
  const [solutionUrl, setSolutionUrl] = useState('');
  const [timeTaken, setTimeTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = solutionUrl.trim();
    if (!trimmedUrl) {
      setError('Solution URL is required.');
      return;
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      setError('Solution URL must start with http:// or https://');
      return;
    }

    setIsSubmitting(true);
    try {
      await trackerService.submitSolution(trackerId, assignment.assignmentId, {
        solutionUrl: trimmedUrl,
        timeTaken: timeTaken ? parseInt(timeTaken, 10) : undefined,
        notes: notes.trim() || undefined,
      });

      setSolutionUrl('');
      setTimeTaken('');
      setNotes('');
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err.status === 409 || err.data?.error === 'ALREADY_SUBMITTED') {
        setError('You have already submitted for this assignment.');
        onSuccess?.(); // Refresh assignment status in background
        setTimeout(() => {
          onClose();
        }, 1500);
      } else if (err.status === 400 && err.data?.message) {
        setError(err.data.message);
      } else {
        setError(err.message || 'Failed to submit solution. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Solution: #${assignment.lcNumber} ${assignment.title}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Solution / Code URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://leetcode.com/problems/.../solutions/... or GitHub URL"
            value={solutionUrl}
            onChange={(e) => {
              setSolutionUrl(e.target.value);
              setError(null);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <p className="text-xs text-gray-400 mt-1">
            Must begin with http:// or https:// (LeetCode submission or GitHub link)
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Time Taken (Minutes) <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input
            type="number"
            min="1"
            max="1440"
            placeholder="e.g. 25"
            value={timeTaken}
            onChange={(e) => setTimeTaken(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Personal Notes <span className="text-gray-400 font-normal">(Saved to your private vault)</span>
          </label>
          <textarea
            rows="3"
            placeholder="Any personal key takeaways, edge cases, or complexity notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <p className="text-xs text-gray-400 mt-1">
            Note: Your vault notes are private and never exposed to the tracker group.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Solution'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default SubmitModal;
