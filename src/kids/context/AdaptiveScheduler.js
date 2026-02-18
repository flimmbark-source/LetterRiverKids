const REVIEW_INTERVALS_MS = [
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

export function getNextReview({ streak = 0, now = Date.now() } = {}) {
  const intervalIndex = Math.min(Math.max(streak, 0), REVIEW_INTERVALS_MS.length - 1);
  return now + REVIEW_INTERVALS_MS[intervalIndex];
}

export function scheduleAfterAttempt(previous = {}, wasCorrect) {
  const nextStreak = wasCorrect ? (previous.streak ?? 0) + 1 : 0;
  return {
    streak: nextStreak,
    dueAt: getNextReview({ streak: nextStreak }),
    lastAttemptAt: Date.now(),
  };
}

export function pickDueLetterIds(progressByLetter = {}) {
  const now = Date.now();
  const due = Object.entries(progressByLetter)
    .filter(([, value]) => !value.dueAt || value.dueAt <= now)
    .sort((a, b) => (a[1].dueAt ?? 0) - (b[1].dueAt ?? 0))
    .map(([id]) => id);

  return due;
}

export function getUpcomingReviews(progressByLetter = {}, limit = 8) {
  return Object.entries(progressByLetter)
    .filter(([, value]) => value.dueAt)
    .sort((a, b) => (a[1].dueAt ?? 0) - (b[1].dueAt ?? 0))
    .slice(0, limit)
    .map(([id, value]) => ({ id, dueAt: value.dueAt, streak: value.streak ?? 0 }));
}
