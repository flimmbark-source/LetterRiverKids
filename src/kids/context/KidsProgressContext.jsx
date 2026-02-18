import React from 'react';
import { getUpcomingReviews, pickDueLetterIds, scheduleAfterAttempt } from './AdaptiveScheduler.js';

const STORAGE_KEY = 'kidsProgressV1';

const KidsProgressContext = React.createContext(null);

export function KidsProgressProvider({ children }) {
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { letters: {}, sessions: [], totalTimeMs: 0 };
      return JSON.parse(raw);
    } catch {
      return { letters: {}, sessions: [], totalTimeMs: 0 };
    }
  });

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const recordAttempt = React.useCallback((letterId, wasCorrect) => {
    setState((previous) => {
      const current = previous.letters[letterId] ?? { attempts: 0, correct: 0, streak: 0, dueAt: Date.now() };
      const scheduled = scheduleAfterAttempt(current, wasCorrect);

      return {
        ...previous,
        letters: {
          ...previous.letters,
          [letterId]: {
            ...current,
            attempts: current.attempts + 1,
            correct: current.correct + (wasCorrect ? 1 : 0),
            ...scheduled,
          },
        },
      };
    });
  }, []);

  const recordSession = React.useCallback((session) => {
    setState((previous) => ({
      ...previous,
      totalTimeMs: previous.totalTimeMs + (session.durationMs ?? 0),
      sessions: [session, ...(previous.sessions ?? [])].slice(0, 100),
    }));
  }, []);

  const dueLetterIds = React.useMemo(() => pickDueLetterIds(state.letters), [state.letters]);
  const upcomingReviews = React.useMemo(() => getUpcomingReviews(state.letters), [state.letters]);

  const value = React.useMemo(() => ({
    state,
    recordAttempt,
    recordSession,
    dueLetterIds,
    upcomingReviews,
    exportJson: () => JSON.stringify(state, null, 2),
  }), [state, recordAttempt, recordSession, dueLetterIds, upcomingReviews]);

  return <KidsProgressContext.Provider value={value}>{children}</KidsProgressContext.Provider>;
}

export function useKidsProgress() {
  const context = React.useContext(KidsProgressContext);
  if (!context) throw new Error('useKidsProgress must be used within KidsProgressProvider');
  return context;
}
