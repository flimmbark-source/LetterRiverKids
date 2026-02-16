import React from 'react';
import {
  createInitialLetterState,
  getUpcomingReviews,
  updateLetterSchedule
} from './AdaptiveScheduler.js';

const STORAGE_KEY = 'kidsProgressV1';

const KidsProgressContext = React.createContext(null);

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        schedule: {},
        sessionSeconds: 0,
        sessions: 0,
        totalCorrect: 0,
        totalAttempts: 0
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      schedule: {},
      sessionSeconds: 0,
      sessions: 0,
      totalCorrect: 0,
      totalAttempts: 0
    };
  }
}

export function KidsProgressProvider({ children }) {
  const [progress, setProgress] = React.useState(loadProgress);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const recordAttempt = React.useCallback((letterId, wasCorrect, confusedWithId) => {
    setProgress((prev) => {
      const current = prev.schedule[letterId] ?? createInitialLetterState();
      const nextState = updateLetterSchedule(current, wasCorrect, confusedWithId);

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          [letterId]: nextState
        },
        totalAttempts: prev.totalAttempts + 1,
        totalCorrect: prev.totalCorrect + (wasCorrect ? 1 : 0)
      };
    });
  }, []);

  const recordSession = React.useCallback((durationSeconds) => {
    setProgress((prev) => ({
      ...prev,
      sessions: prev.sessions + 1,
      sessionSeconds: prev.sessionSeconds + durationSeconds
    }));
  }, []);

  const exportProgress = React.useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      ...progress,
      upcoming: getUpcomingReviews(progress.schedule, 25)
    };
    return JSON.stringify(payload, null, 2);
  }, [progress]);

  const value = React.useMemo(() => ({
    progress,
    recordAttempt,
    recordSession,
    exportProgress,
    upcomingReviews: getUpcomingReviews(progress.schedule)
  }), [progress, recordAttempt, recordSession, exportProgress]);

  return <KidsProgressContext.Provider value={value}>{children}</KidsProgressContext.Provider>;
}

export function useKidsProgress() {
  const ctx = React.useContext(KidsProgressContext);
  if (!ctx) {
    throw new Error('useKidsProgress must be used within KidsProgressProvider');
  }
  return ctx;
}
