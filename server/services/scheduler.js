/**
 * Spaced-Repetition Scheduling Algorithm for DSA Vault
 *
 * Configurable intervals (default in days): [1, 3, 7, 14, 30]
 * Post-completion periodic interval: 30 days
 *
 * Outcomes:
 * 1. 'Solved Independently':
 *    - Advance to next configured interval stage (e.g. 1 -> 3 -> 7 -> 14 -> 30).
 *    - Beyond the final interval (stage >= 5), schedule periodically by periodic_interval (default 30 days).
 *
 * 2. 'Solved With Hint':
 *    - Step back by 1 interval stage (minimum 1 day) to reinforce understanding without starting completely over.
 *
 * 3. 'Reviewed The Solution':
 *    - Reset to early retry interval (stage 1, e.g. 1 day) to verify independent reproduction within 24-48 hours.
 *
 * 4. 'Unable To Solve':
 *    - Immediate early retry (1 day) and flags need for approach review.
 */

export const DEFAULT_INTERVALS = [1, 3, 7, 14, 30];
export const DEFAULT_PERIODIC_INTERVAL = 30;

export const REVISION_OUTCOMES = [
  'Solved Independently',
  'Solved With Hint',
  'Reviewed The Solution',
  'Unable To Solve',
];

/**
 * Calculates the next revision date and interval stage based on outcome
 *
 * @param {Object} options
 * @param {string} options.outcome - One of the 4 revision outcomes
 * @param {number} [options.currentStage=1] - Current interval stage index (1-based: 1, 2, 3, 4, 5...)
 * @param {number[]} [options.configuredIntervals=DEFAULT_INTERVALS] - Array of interval days
 * @param {number} [options.periodicInterval=DEFAULT_PERIODIC_INTERVAL] - Periodic repeat interval
 * @param {Date|string} [options.baseDate=new Date()] - Reference date for calculation
 * @returns {{ nextDate: string, nextStage: number, intervalDays: number }}
 */
export function calculateNextRevision({
  outcome,
  currentStage = 1,
  configuredIntervals = DEFAULT_INTERVALS,
  periodicInterval = DEFAULT_PERIODIC_INTERVAL,
  baseDate = new Date(),
}) {
  const intervals = Array.isArray(configuredIntervals) && configuredIntervals.length > 0
    ? configuredIntervals
    : DEFAULT_INTERVALS;

  const maxStage = intervals.length;
  let nextStage = currentStage;
  let intervalDays = intervals[0];

  switch (outcome) {
    case 'Solved Independently':
      if (currentStage >= maxStage) {
        // Beyond final stage, apply periodic revision policy
        nextStage = maxStage;
        intervalDays = periodicInterval || intervals[maxStage - 1];
      } else {
        nextStage = currentStage + 1;
        intervalDays = intervals[nextStage - 1];
      }
      break;

    case 'Solved With Hint':
      // Fallback by 1 stage, minimum stage 1
      nextStage = Math.max(1, currentStage - 1);
      intervalDays = intervals[nextStage - 1];
      break;

    case 'Reviewed The Solution':
    case 'Unable To Solve':
    default:
      // Reset to stage 1 for immediate consolidation
      nextStage = 1;
      intervalDays = intervals[0];
      break;
  }

  // Calculate target date consistently
  const d = new Date(baseDate);
  d.setDate(d.getDate() + intervalDays);
  const nextDate = d.toISOString().split('T')[0];

  return {
    nextDate,
    nextStage,
    intervalDays,
  };
}
