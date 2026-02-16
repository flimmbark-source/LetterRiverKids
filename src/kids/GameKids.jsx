import React from 'react';
import SpeakButton from '../components/SpeakButton.jsx';
import ttsService from '../lib/ttsService.js';
import { loadLanguage } from '../lib/languageLoader.js';
import { getKidLetterChoices, getLettersForLanguage } from '../lib/letters.js';
import { selectDueLetter } from './context/AdaptiveScheduler.js';
import { useKidsProgress } from './context/KidsProgressContext.jsx';
import { useKidsSettings } from './context/KidsSettingsContext.jsx';
import { useStickerReward } from './context/StickerRewardContext.jsx';

function pickNextRound(letters, schedule, optionCount) {
  const target = selectDueLetter(letters, schedule) ?? letters[0];
  const choices = getKidLetterChoices(letters, target, optionCount);
  return { target, choices };
}

export default function GameKids() {
  const { settings } = useKidsSettings();
  const { progress, recordAttempt, recordSession } = useKidsProgress();
  const { unlockSticker } = useStickerReward();
  const [sessionStart] = React.useState(Date.now());
  const [streak, setStreak] = React.useState(0);
  const [feedback, setFeedback] = React.useState('Tap the sound button to begin.');

  const letters = React.useMemo(() => {
    const languagePack = loadLanguage();
    return getLettersForLanguage(languagePack, settings.preferredLanguage).slice(0, 12);
  }, [settings.preferredLanguage]);

  const [round, setRound] = React.useState(() => pickNextRound(letters, progress.schedule, settings.track === 'builder' ? 4 : 3));

  React.useEffect(() => {
    if (round?.target) {
      ttsService.speakSmart({
        nativeText: `Find ${round.target.phonetic}`,
        nativeLocale: settings.preferredLanguage,
        transliteration: round.target.transliteration,
        mode: 'word'
      });
    }
  }, [round?.target?.id]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsedMinutes = (Date.now() - sessionStart) / (1000 * 60);
      if (elapsedMinutes >= settings.sessionLimitMinutes) {
        setFeedback('Time for a break! Ask a parent to continue.');
      }
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [sessionStart, settings.sessionLimitMinutes]);

  React.useEffect(() => {
    return () => {
      const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
      recordSession(durationSeconds);
    };
  }, [recordSession, sessionStart]);

  const handleChoice = (choice) => {
    const correct = choice.id === round.target.id;
    recordAttempt(round.target.id, correct, correct ? null : choice.id);

    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setFeedback('Great job! 🌟');
      ttsService.speakSmart({
        nativeText: 'Awesome!',
        nativeLocale: settings.preferredLanguage,
        transliteration: 'awesome',
        mode: 'word'
      });

      if (nextStreak % 3 === 0) {
        unlockSticker(round.target.id);
      }
    } else {
      setStreak(0);
      setFeedback('Try again! Listen to the sound.');
    }

    setRound(pickNextRound(letters, progress.schedule, settings.track === 'builder' ? 4 : 3));
  };

  if (!round?.target) {
    return <p>Loading letters…</p>;
  }

  return (
    <section className="rounded-3xl border-4 border-rose-200 bg-rose-50 p-4">
      <h3 className="text-2xl font-black text-rose-900">Hear it • See it • Do it</h3>
      <p className="text-sm font-semibold text-rose-700">{feedback}</p>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4">
        <div>
          <p className="text-xs font-bold uppercase text-rose-600">Target</p>
          <p className="text-5xl font-black text-rose-900">{round.target.symbol}</p>
          <p className="text-sm text-rose-700">{round.target.association ? `${round.target.association.emoji} ${round.target.association.word}` : 'Sound match'}</p>
        </div>
        <SpeakButton
          nativeText={`Find ${round.target.phonetic}`}
          nativeLocale={settings.preferredLanguage}
          transliteration={round.target.transliteration}
          variant="iconWithLabel"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {round.choices.map((choice) => (
          <button
            type="button"
            key={choice.id}
            onClick={() => handleChoice(choice)}
            className="min-h-24 rounded-2xl border-4 border-rose-200 bg-white text-center text-4xl font-black text-rose-900 transition hover:bg-rose-100"
            style={{ minWidth: 40, minHeight: 40 }}
          >
            <div>{choice.association?.emoji ?? '🧩'}</div>
            <div className="text-2xl">{choice.symbol}</div>
            {settings.track === 'builder' ? <div className="text-xs font-bold">{choice.name}</div> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
