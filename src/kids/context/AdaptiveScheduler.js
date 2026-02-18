const REVIEW_INTERVALS_MS = [
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000
];

export function createInitialLetterState() {
  return {
    attempts: 0,
    successes: 0,
    misses: 0,
    streak: 0,
    intervalIndex: 0,
    dueAt: Date.now(),
    lastReviewedAt: null,
    confusion: {}
  };
}

export function updateLetterSchedule(previous = createInitialLetterState(), wasCorrect, confusedWithId) {
  const now = Date.now();
  const next = {
    ...previous,
    attempts: previous.attempts + 1,
    lastReviewedAt: now,
    confusion: { ...(previous.confusion ?? {}) }
  };

  if (wasCorrect) {
    const grownIndex = Math.min((previous.intervalIndex ?? 0) + 1, REVIEW_INTERVALS_MS.length - 1);
    next.successes = (previous.successes ?? 0) + 1;
    next.streak = (previous.streak ?? 0) + 1;
    next.intervalIndex = next.streak >= 2 ? grownIndex : previous.intervalIndex ?? 0;
  } else {
    next.misses = (previous.misses ?? 0) + 1;
    next.streak = 0;
    next.intervalIndex = 0;
    if (confusedWithId) {
      next.confusion[confusedWithId] = (next.confusion[confusedWithId] ?? 0) + 1;
    }
  }

  next.dueAt = now + REVIEW_INTERVALS_MS[next.intervalIndex];
  return next;
}

export function selectDueLetter(letters, scheduleMap) {
  if (!letters.length) return null;
  const now = Date.now();

  const due = letters.filter((letter) => {
    const state = scheduleMap[letter.id];
    return !state || (state.dueAt ?? 0) <= now;
  });

  const activePool = due.length ? due : letters;
  return activePool.sort((a, b) => {
    const aDue = scheduleMap[a.id]?.dueAt ?? 0;
    const bDue = scheduleMap[b.id]?.dueAt ?? 0;
    return aDue - bDue;
  })[0];
}

export function getUpcomingReviews(scheduleMap, limit = 10) {
  return Object.entries(scheduleMap)
    .map(([letterId, state]) => ({
      letterId,
      dueAt: state.dueAt,
      intervalIndex: state.intervalIndex,
      attempts: state.attempts,
      successes: state.successes,
      misses: state.misses
    }))
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit);
}
