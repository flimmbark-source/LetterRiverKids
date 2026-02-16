import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import badgesCatalog from '../data/badges.json';
import kidRewards from '../data/kidRewards.json';
import { useProgress, STAR_LEVEL_SIZE } from '../context/ProgressContext.jsx';
import { useGame } from '../context/GameContext.jsx';
import { useTutorial } from '../context/TutorialContext.jsx';
import { useLocalization } from '../context/LocalizationContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useKidMode } from '../hooks/useKidMode.js';
import { formatJerusalemTime, millisUntilNextJerusalemMidnight } from '../lib/time.js';
import { getFormattedLanguageName } from '../lib/languageUtils.js';
import { classNames } from '../lib/classNames.js';
import { getPlayerTitle } from '../utils/playerTitles.js';
import { loadLanguage } from '../lib/languageLoader.js';
import { useCardUpdates } from '../hooks/useCardUpdates.js';

function GlobeIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function XIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function QuestCard({ task, onClaim, claimingTaskId, t }) {
  const percentage = Math.min((task.progress ?? 0) / task.goal, 1) * 100;
  const rewardValue = Number.isFinite(task.rewardStars) ? Math.max(0, task.rewardStars) : 0;
  const canClaimReward = Boolean(task.rewardClaimable) && !task.rewardClaimed;
  const currentProgress = Math.min(task.progress ?? 0, task.goal);

  // Track quest progress for green stroke
  const questUpdate = useCardUpdates(`quest-${task.id}`, task.progress ?? 0);

  return (
    <div className={classNames('quest-card', questUpdate.isUpdated && 'card-updated')}>
      <div className="quest-top-row">
        <div className="quest-left">
          <div className="quest-title">{task.description}</div>
          <div className="quest-progress-meta">
            {currentProgress} / {task.goal}
          </div>
        </div>
        <div className="quest-right">
          {rewardValue > 0 && (
            <div className="quest-reward-inline">
              +{rewardValue} <span className="star-inline">★</span>
            </div>
          )}
          <button
            className={`quest-cta ${canClaimReward ? 'active' : ''}`}
            onClick={() => canClaimReward && onClaim(task.id)}
            disabled={!canClaimReward || claimingTaskId === task.id}
          >
            {task.rewardClaimed ? t('home.quest.claimed') : canClaimReward ? t('home.quest.claim') : t('home.quest.locked')}
          </button>
        </div>
      </div>
      <div className="quest-progress-bar">
        <div className="quest-progress-fill" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

export default function HomeView() {
  const { player, streak, daily, starLevelSize, claimDailyReward } = useProgress();
  const { isKidMode, kidSettings, ageBand, track } = useKidMode();

  const { openGame } = useGame();
  const { startTutorial, currentTutorial, currentStepIndex } = useTutorial();
  const { t } = useLocalization();
  const { languageId, selectLanguage, appLanguageId, selectAppLanguage, languageOptions } = useLanguage();
  const [appLanguageSelectorExpanded, setAppLanguageSelectorExpanded] = useState(false);
  const [hoveredLetter, setHoveredLetter] = useState(null);
  const languageSelectorRef = useRef(null);

  const latestBadge = useMemo(() => {
    if (!player.latestBadge) return null;
    const badge = badgesCatalog.find((item) => item.id === player.latestBadge.id);
    const tierSpec = badge?.tiers?.find((item) => item.tier === player.latestBadge.tier);

    const nameKey = player.latestBadge.nameKey ?? badge?.nameKey;
    const labelKey = player.latestBadge.labelKey ?? tierSpec?.labelKey;
    const summaryKey = player.latestBadge.summaryKey ?? badge?.summaryKey;

    const name = nameKey ? t(nameKey) : player.latestBadge.name ?? badge?.name ?? player.latestBadge.id;
    const label = labelKey ? t(labelKey) : player.latestBadge.label ?? tierSpec?.label ?? '';
    const summary = summaryKey ? t(summaryKey, { gameName: t('app.title'), goal: tierSpec?.goal ?? player.latestBadge.goal }) : player.latestBadge.summary ?? badge?.summary ?? '';

    return {
      ...player.latestBadge,
      name,
      label,
      summary
    };
  }, [player.latestBadge, t]);

  const starsPerLevel = starLevelSize ?? STAR_LEVEL_SIZE;
  const totalStarsEarned = player.totalStarsEarned ?? player.stars ?? 0;
  const level = player.level ?? Math.floor(totalStarsEarned / starsPerLevel) + 1;
  const levelProgress = player.levelProgress ?? (totalStarsEarned % starsPerLevel);
  const starsProgress = starsPerLevel > 0 ? Math.min(levelProgress / starsPerLevel, 1) : 0;
  const formatNumber = useCallback((value) => Math.max(0, Math.floor(value ?? 0)).toLocaleString(), []);
  const [claimingTaskId, setClaimingTaskId] = useState(null);

  // Get recently encountered letters
  const recentLetters = useMemo(() => {
    try {
      const languagePack = loadLanguage(languageId);
      const letters = player.letters || {};
      const itemsById = languagePack.itemsById || {};

      // Get letters with activity, sorted by total interactions
      const activeLetters = Object.entries(letters)
        .filter(([id, stats]) => (stats.correct || 0) + (stats.incorrect || 0) > 0)
        .map(([id, stats]) => ({
          id,
          symbol: itemsById[id]?.symbol || id,
          name: itemsById[id]?.name || id,
          sound: itemsById[id]?.sound || '',
          total: (stats.correct || 0) + (stats.incorrect || 0)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return activeLetters.length > 0 ? activeLetters : [
        { symbol: 'ק', name: 'Qof', sound: 'k' },
        { symbol: 'ר', name: 'Resh', sound: 'r' },
        { symbol: 'ט', name: 'Tet', sound: 't' },
        { symbol: 'ו', name: 'Vav', sound: 'v' },
        { symbol: 'ב', name: 'Bet', sound: 'b' }
      ];
    } catch (e) {
      // Fallback to default letters
      return [
        { symbol: 'ק', name: 'Qof', sound: 'k' },
        { symbol: 'ר', name: 'Resh', sound: 'r' },
        { symbol: 'ט', name: 'Tet', sound: 't' },
        { symbol: 'ו', name: 'Vav', sound: 'v' },
        { symbol: 'ב', name: 'Bet', sound: 'b' }
      ];
    }
  }, [player.letters, languageId]);

  // Track card updates for green stroke
  const heroCardUpdate = useCardUpdates('hero-card', recentLetters.map(l => l.symbol).join(','));
  const streakCardUpdate = useCardUpdates('streak-card', player.streakCount ?? 0);
  const levelCardUpdate = useCardUpdates('level-card', level);
  const badgeCardUpdate = useCardUpdates('badge-card', player.latestBadge?.id ?? '');

  // Check if play button should be disabled during tutorial
  const isPlayDisabled = currentTutorial?.id === 'firstTime' && currentStepIndex < 4;

  // Close language selector when clicking outside
  useEffect(() => {
    if (!appLanguageSelectorExpanded) return;

    const handleClickOutside = (event) => {
      if (languageSelectorRef.current && !languageSelectorRef.current.contains(event.target)) {
        setAppLanguageSelectorExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [appLanguageSelectorExpanded]);

  const handleDailyClaim = useCallback(
    (taskId) => {
      if (!taskId || claimingTaskId) return;
      setClaimingTaskId(taskId);
      Promise.resolve(claimDailyReward(taskId)).finally(() => {
        setClaimingTaskId(null);
      });
    },
    [claimingTaskId, claimDailyReward]
  );

  if (!daily) {
    return (
      <div className="rounded-3xl border-4 border-slate-700 bg-slate-800 p-8 text-center font-semibold text-slate-300 shadow-2xl">
        Loading daily quests…
      </div>
    );
  }

  const nextResetDate = useMemo(() => new Date(Date.now() + millisUntilNextJerusalemMidnight()), [daily?.dateKey]);
  const nextResetTime = formatJerusalemTime(nextResetDate, { timeZoneName: 'short' });
  const totalQuests = daily?.tasks?.length ?? 0;

  return (
    <>
      {/* Player Header */}
      <header className="player-header">
        <div className="player-meta">
          <div className="avatar"></div>
          <div className="player-text">
            <div className="player-name">{t('common.player')}</div>
            <div className="player-level-row">
              <div className="player-level">{t('home.progress.level', { level })}</div>
              <div className="player-level-progress">
                <div className="player-level-progress-fill" style={{ width: `${starsProgress * 100}%` }}></div>
              </div>
              <div className="player-stars-badge">
                <span className="star-icon">⭐</span>
                <span className="star-value">{formatNumber(totalStarsEarned)}</span>
              </div>
            </div>
            <div className="player-rank">{getPlayerTitle(level)}</div>
          </div>
        </div>
        <div className="top-counters">
          <button
            onClick={() => startTutorial('tour')}
            className="tiny-pill"
            aria-label="Show tutorial"
            title="Show tutorial"
          >
            ?
          </button>
          <div ref={languageSelectorRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setAppLanguageSelectorExpanded(!appLanguageSelectorExpanded)}
              className="tiny-pill"
              aria-label={t('app.languagePicker.label')}
            >
              🌎
            </button>

            {/* App Language Selector Popup */}
            {appLanguageSelectorExpanded && (
              <div className="language-selector-popup">
                <button
                  onClick={() => setAppLanguageSelectorExpanded(false)}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-arcade-accent-red text-white shadow-arcade-sm z-10"
                  aria-label={t('common.close')}
                >
                  <XIcon className="h-3 w-3" />
                </button>

                <h3 className="mb-3 text-center font-heading text-sm font-bold text-arcade-text-main">
                  {t('app.languagePicker.label')}
                </h3>

                <select
                  id="home-app-language-select"
                  value={appLanguageId}
                  onChange={(event) => selectAppLanguage(event.target.value)}
                  className="w-full rounded-xl border-2 border-arcade-panel-border bg-arcade-panel-light px-3 py-2 text-xs font-semibold text-arcade-text-main shadow-inner"
                >
                  {languageOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {getFormattedLanguageName(option, t)}
                    </option>
                  ))}
                </select>

                <h3 className="mb-2 mt-4 text-center font-heading text-sm font-bold text-arcade-text-main">
                  {t('home.languagePicker.label')}
                </h3>

                <select
                  id="home-practice-language-select"
                  value={languageId}
                  onChange={(event) => selectLanguage(event.target.value)}
                  className="w-full rounded-xl border-2 border-arcade-panel-border bg-arcade-panel-light px-3 py-2 text-xs font-semibold text-arcade-text-main shadow-inner"
                >
                  {languageOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {getFormattedLanguageName(option, t)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Card */}
      <section className="section" style={{ marginTop: '20px',  }}></section>
      <section className={classNames('hero-card', heroCardUpdate.isUpdated && 'card-updated')} style={{ position: 'relative' }}>
        {isKidMode ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '10px' }}>
                {track === 'explorer' ? '🧒' : '👷'}
              </div>
              <h1 className="hero-title" style={{ fontSize: '32px', marginBottom: '10px' }}>
                Ready to play?
              </h1>
              <p style={{ fontSize: '18px', color: '#6c3b14' }}>
                Let's learn letters together!
              </p>
            </div>
            <button
              className="hero-cta"
              onClick={() => !isPlayDisabled && openGame({ autostart: false })}
              disabled={isPlayDisabled}
              style={{
                fontSize: '28px',
                padding: '20px 40px',
                ...(isPlayDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {})
              }}
            >
              🎮 Start Playing!
            </button>
          </>
        ) : (
          <>
            <h1 className="hero-title">{t('home.recentLetters.title')}</h1>
            <div className="hero-body" style={{ display: 'flex', gap: '12px', fontSize: '24px', flexWrap: 'wrap' }}>
              {recentLetters.map((letter, index) => (
                <span
                  key={index}
                  className="hebrew-text"
                  style={{
                    cursor: 'pointer',
                    position: 'relative',
                    fontFamily: 'Heebo, sans-serif',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={() => setHoveredLetter(index)}
                  onMouseLeave={() => setHoveredLetter(null)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {letter.symbol}
                  {hoveredLetter === index && (
                    <span className="letter-tooltip">
                      {letter.name} ({letter.sound})
                    </span>
                  )}
                </span>
              ))}
            </div>
            <button
              className="hero-cta"
              onClick={() => !isPlayDisabled && openGame({ autostart: false })}
              disabled={isPlayDisabled}
              style={isPlayDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {t('home.cta.play')}
            </button>
          </>
        )}
      </section>

      {/* Progress Section */}
      {!isKidMode && (
        <section className="section">
          <section className="section" style={{ marginTop: '20px',  }}></section>
          <div className="section-header">
            <div className="section-title">
              <div className="wood-header">{t('home.progress.heading')}</div>
            </div>
            <div className="section-link">{t('common.viewDetails')}</div>
          </div>
          <section className="section" style={{ marginTop: '5px',  }}></section>
          <div className="progress-row">
            <div className={classNames('progress-card-small', streakCardUpdate.isUpdated && 'card-updated')}>
              <div className="progress-icon red">🔥</div>
              <div className="progress-label">{t('home.progress.streak')}</div>
              <div className="progress-value">{t('home.progress.days', { count: streak.current })}</div>
              <div className="progress-sub">{t('home.progress.resetsAt', { time: nextResetTime })}</div>
            </div>
            <div className={classNames('progress-card-small', levelCardUpdate.isUpdated && 'card-updated')}>
              <div className="progress-icon gold">★</div>
              <div className="progress-label">{t('home.progress.starLevel')}</div>
              <div className="progress-value">{t('home.progress.level', { level })}</div>
              <div className="progress-bar-shell">
                <div className="progress-bar-fill" style={{ width: `${starsProgress * 100}%` }}></div>
              </div>
              <div className="progress-sub">
                {t('home.progress.toNextLevel', { current: formatNumber(levelProgress), total: formatNumber(starsPerLevel) })}
              </div>
            </div>
            <div className={classNames('progress-card-small', badgeCardUpdate.isUpdated && 'card-updated')}>
              <div className="progress-icon cyan">🏅</div>
              <div className="progress-label">{t('home.progress.latestBadge')}</div>
              <div className="progress-value">{latestBadge?.name || t('common.noneYet')}</div>
              <div className="progress-sub">{latestBadge ? latestBadge.summary : t('home.progress.playToUnlock')}</div>
            </div>
          </div>
        </section>
      )}

      {/* Kid-Friendly Progress Section */}
      {isKidMode && (
        <section className="section">
          <section className="section" style={{ marginTop: '20px',  }}></section>
          <div className="section-header">
            <div className="section-title">
              <div className="wood-header">My Progress</div>
            </div>
          </div>
          <section className="section" style={{ marginTop: '5px',  }}></section>
          <div className="progress-row">
            <div className={classNames('progress-card-small', levelCardUpdate.isUpdated && 'card-updated')} style={{ textAlign: 'center' }}>
              <div className="progress-icon gold" style={{ fontSize: '48px' }}>⭐</div>
              <div className="progress-label" style={{ fontSize: '18px', marginTop: '10px' }}>Stars Collected</div>
              <div className="progress-value" style={{ fontSize: '32px', fontWeight: 'bold' }}>{formatNumber(totalStarsEarned)}</div>
              <div className="progress-sub">Keep playing to earn more!</div>
            </div>
            {latestBadge && (
              <div className={classNames('progress-card-small', badgeCardUpdate.isUpdated && 'card-updated')} style={{ textAlign: 'center' }}>
                <div className="progress-icon cyan" style={{ fontSize: '48px' }}>🏅</div>
                <div className="progress-label" style={{ fontSize: '18px', marginTop: '10px' }}>Latest Badge</div>
                <div className="progress-value" style={{ fontSize: '24px' }}>{latestBadge.name}</div>
                <div className="progress-sub">{latestBadge.label}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Daily Quests Section - Hidden in kid mode */}
      {!isKidMode && (
        <>
          <section className="section" style={{ marginTop: '20px',  }}></section>
          {daily?.tasks && daily.tasks.length > 0 && (
            <section className="section">
              <div className="section-header">
                <div className="section-title">
                  <div className="wood-header">{t('home.dailyQuests.title')}</div>
                </div>
                <div className="section-link">{t('home.dailyQuests.resetsAt', { time: nextResetTime })}</div>
              </div>
              <section className="section" style={{ marginTop: '5px',  }}></section>
              {daily.tasks.map((task) => (
                <QuestCard
                  key={task.id}
                  task={task}
                  onClaim={handleDailyClaim}
                  claimingTaskId={claimingTaskId}
                  t={t}
                />
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
