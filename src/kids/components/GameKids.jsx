import React from 'react';
import { getAssociation } from '../../data/soundAssociations.js';
import { getLetterPool, pickUniqueOptions } from '../../lib/letters.js';
import ttsService from '../../lib/ttsService.js';
import { useKidsProgress } from '../context/KidsProgressContext.jsx';
import { useStickerRewards } from '../context/StickerRewardContext.jsx';

function speakPrompt(letter, languageId) {
  const prompt = `Find the ${letter.sound} sound`;
  ttsService.speakSmart({
    nativeText: prompt,
    nativeLocale: languageId,
    transliteration: prompt,
    mode: 'word',
  });
}

export default function GameKids({ profile, settings, languageId, appLanguageId }) {
  const pool = React.useMemo(() => getLetterPool(languageId, appLanguageId), [languageId, appLanguageId]);
  const { dueLetterIds, recordAttempt, recordSession, state } = useKidsProgress();
  const { unlockSticker } = useStickerRewards();
  const [round, setRound] = React.useState(null);
  const [feedback, setFeedback] = React.useState('Tap the matching picture.');
  const [streak, setStreak] = React.useState(0);
  const [sessionStartAt] = React.useState(Date.now());

  const nextRound = React.useCallback(() => {
    const dueSet = new Set(dueLetterIds);
    const dueItems = pool.filter((item) => dueSet.has(item.id));
    const source = dueItems.length ? dueItems : pool;
    const target = source[Math.floor(Math.random() * source.length)];
    const optionSize = profile.track === 'builder' ? 4 : 3;
    const options = pickUniqueOptions(target, pool, optionSize).map((item) => ({
      ...item,
      association: getAssociation(item.sound, appLanguageId),
    }));
    setRound({ target, options, attempts: 0 });
    setFeedback('Listen and choose.');
    speakPrompt(target, languageId);
  }, [appLanguageId, dueLetterIds, languageId, pool, profile.track]);

  React.useEffect(() => {
    if (!pool.length) return;
    nextRound();
    return () => {
      recordSession({
        startedAt: sessionStartAt,
        endedAt: Date.now(),
        durationMs: Date.now() - sessionStartAt,
      });
    };
  }, [nextRound, pool.length, recordSession, sessionStartAt]);

  if (!round) return null;

  const handleChoice = (choice) => {
    const correct = choice.id === round.target.id;
    recordAttempt(round.target.id, correct);

    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setFeedback('Great job!');
      if (nextStreak > 0 && nextStreak % 3 === 0) {
        unlockSticker();
      }
      setTimeout(nextRound, settings.slowRiver ? 1400 : 700);
    } else {
      setStreak(0);
      const attempts = round.attempts + 1;
      const hint = attempts > 1
        ? `Hint: Listen for ${round.target.sound}`
        : 'Try again. You can do it!';
      setFeedback(hint);
      setRound((previous) => ({ ...previous, attempts }));
    }
  };

  const targetStats = state.letters[round.target.id] ?? {};

  return (
    <section className={`kids-card kids-game ${settings.highContrast ? 'kids-high-contrast' : ''}`}>
      <h3>🛶 Letter River Kids</h3>
      <p>{feedback}</p>
      <div className="kids-target" aria-live="polite">
        <span className="kids-target-letter">{round.target.symbol}</span>
        {profile.track === 'builder' && <span>{round.target.name}</span>}
      </div>
      <button type="button" className="kids-audio-btn" onClick={() => speakPrompt(round.target, languageId)}>
        🔈 Hear it again
      </button>
      <div className="kids-options">
        {round.options.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="kids-option"
            onClick={() => handleChoice(choice)}
            style={{ minWidth: 56, minHeight: 56 }}
          >
            <span className="kids-option-emoji">{choice.association?.emoji ?? '🧩'}</span>
            {profile.track === 'builder' ? <span>{choice.name}</span> : null}
          </button>
        ))}
      </div>
      <p>Current letter streak: {targetStats.streak ?? 0}</p>
    </section>
  );
}
