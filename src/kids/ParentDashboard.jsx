import React from 'react';
import ttsService from '../lib/ttsService.js';
import { useKidsProgress } from './context/KidsProgressContext.jsx';
import { useKidsSettings } from './context/KidsSettingsContext.jsx';

function formatDueAt(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export default function ParentDashboard() {
  const { progress, upcomingReviews, exportProgress } = useKidsProgress();
  const { settings } = useKidsSettings();
  const [gateOpen, setGateOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState('');

  const gateQuestion = React.useMemo(() => ({ a: 3, b: 4 }), []);

  const onUnlock = () => {
    if (Number(answer) === gateQuestion.a + gateQuestion.b) {
      setGateOpen(true);
    }
  };

  if (!gateOpen) {
    return (
      <section className="rounded-3xl border-4 border-violet-200 bg-violet-50 p-4">
        <h3 className="text-lg font-black text-violet-900">Parent gate</h3>
        <p className="text-sm text-violet-800">Solve: {gateQuestion.a} + {gateQuestion.b}</p>
        <div className="mt-2 flex gap-2">
          <input className="rounded-lg border-2 border-violet-300 px-3 py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button type="button" onClick={onUnlock} className="rounded-lg bg-violet-500 px-3 py-2 font-bold text-white">Unlock</button>
        </div>
      </section>
    );
  }

  const avgAccuracy = progress.totalAttempts > 0 ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100) : 0;

  const speakSummary = () => {
    ttsService.speakSmart({
      nativeText: `This week accuracy is ${avgAccuracy} percent. Upcoming letter reviews: ${upcomingReviews.length}.`,
      nativeLocale: settings.preferredLanguage,
      transliteration: '',
      mode: 'sentence'
    });
  };

  return (
    <section className="rounded-3xl border-4 border-violet-200 bg-violet-50 p-4">
      <h3 className="text-xl font-black text-violet-900">Parent dashboard</h3>
      <p className="text-sm text-violet-800">Sessions: {progress.sessions} • Accuracy: {avgAccuracy}% • Time: {Math.round(progress.sessionSeconds / 60)} min</p>
      <button type="button" onClick={speakSummary} className="mt-2 rounded-full bg-violet-500 px-4 py-2 font-bold text-white">🔈 Speak summary</button>
      <details className="mt-3">
        <summary className="cursor-pointer font-bold">Upcoming reviews</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {upcomingReviews.map((review) => (
            <li key={review.letterId}>{review.letterId} — {formatDueAt(review.dueAt)}</li>
          ))}
        </ul>
      </details>
      <a
        href={`data:application/json;charset=utf-8,${encodeURIComponent(exportProgress())}`}
        download="letter-river-kids-progress.json"
        className="mt-3 inline-block rounded-full border-2 border-violet-400 px-4 py-2 text-sm font-bold text-violet-900"
      >
        Export JSON report
      </a>
    </section>
  );
}
