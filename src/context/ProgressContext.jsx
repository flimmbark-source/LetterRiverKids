import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import badgesCatalog from '../data/badges.json';
import dailyTemplates from '../data/dailyTemplates.json';
import { emit, on } from '../lib/eventBus.js';
import { celebrate } from '../lib/celebration.js';
import { loadState, saveState, removeState } from '../lib/storage.js';
import { differenceInJerusalemDays, getJerusalemDateKey, millisUntilNextJerusalemMidnight } from '../lib/time.js';
import { useToast } from './ToastContext.jsx';
import { useLocalization } from './LocalizationContext.jsx';

export const STAR_LEVEL_SIZE = 50;
export const DAILY_REWARD_STARS = 30;

function distributeRewardStars(total, count) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(count) || count <= 0) {
    return new Array(Math.max(0, count)).fill(0);
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

const ProgressContext = createContext(null);

function toLetterInfo(item) {
  if (!item) return null;
  return {
    id: item.id,
    hebrew: item.symbol ?? item.id,
    name: item.name ?? item.id,
    sound: item.sound ?? ''
  };
}

const badgeSpecById = badgesCatalog.reduce((acc, badge) => {
  acc[badge.id] = badge;
  return acc;
}, {});

function calculateLevelInfo(totalStars) {
  const total = Math.max(0, Math.floor(Number.isFinite(totalStars) ? totalStars : 0));
  const level = Math.floor(total / STAR_LEVEL_SIZE) + 1;
  const levelProgress = total % STAR_LEVEL_SIZE;
  return { level, levelProgress, total };
}

const defaultPlayer = {
  name: 'River Explorer',
  stars: 0,
  level: 1,
  levelProgress: 0,
  totalStarsEarned: 0,
  totals: {
    sessions: 0,
    perfectCatches: 0
  },
  letters: {},
  latestBadge: null,
  modesPlayed: [],
  kidMode: true, // Default to kid mode for this app
  kidSettings: {
    ageBand: '4-6', // '4-6' or '7-9'
    track: 'explorer', // 'explorer' or 'builder'
    parentMode: false, // false = kid UI, true = advanced settings accessible
    onboardingComplete: false
  }
};

const defaultBadges = badgesCatalog.reduce((acc, badge) => {
  acc[badge.id] = { tier: 0, progress: 0, unclaimed: [] };
  return acc;
}, {});

const MAX_ACTIVE_BADGES = 6;

function selectRandomBadges(excludeIds = []) {
  const available = badgesCatalog.filter(badge => !excludeIds.includes(badge.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, MAX_ACTIVE_BADGES).map(b => b.id);
}

const defaultActiveBadges = selectRandomBadges();

const defaultStreak = {
  current: 0,
  best: 0,
  lastPlayedDateKey: null
};

function createLanguageAssets(languagePack, localization = {}) {
  const { t: translateFn } = localization ?? {};
  const translate = typeof translateFn === 'function' ? translateFn : null;

  function translateKey(key, fallback, replacements = {}) {
    if (!key) return fallback ?? '';
    if (translate) {
      const result = translate(key, replacements);
      if (result && result !== key) {
        return result;
      }
    }
    return fallback ?? (typeof key === 'string' ? key : '');
  }
  const baseLanguageItems = languagePack.items ?? [];
  const allLanguageItems = languagePack.allItems ?? baseLanguageItems;
  const itemsById = languagePack.itemsById ?? {};
  const itemsBySymbol = languagePack.itemsBySymbol ?? {};
  const fallbackLetterInfo =
    toLetterInfo(baseLanguageItems[0] ?? allLanguageItems[0]) ?? { id: null, hebrew: '', name: '', sound: '' };

  function getWeakestLetter(letterStats) {
    const entries = Object.entries(letterStats ?? {});
    if (entries.length === 0) {
      return fallbackLetterInfo;
    }
    let weakest = entries[0][0];
    let weakestScore = Infinity;
    entries.forEach(([itemId, stats]) => {
      const total = (stats.correct ?? 0) + (stats.incorrect ?? 0);
      if (total === 0) return;
      const accuracy = (stats.correct ?? 0) / total;
      const penalty = total < 3 ? accuracy + 0.15 : accuracy;
      if (penalty < weakestScore) {
        weakestScore = penalty;
        weakest = itemId;
      }
    });
    const info = toLetterInfo(itemsById[weakest] ?? itemsBySymbol[weakest]) ?? fallbackLetterInfo;
    return info;
  }

  function normalizeLetterStats(rawStats) {
    const normalized = {};
    Object.entries(rawStats ?? {}).forEach(([key, value]) => {
      if (!value) return;
      const target = { correct: value.correct ?? 0, incorrect: value.incorrect ?? 0 };
      if (itemsById[key]) {
        normalized[key] = target;
        return;
      }
      const symbolMatch = itemsBySymbol[key];
      if (symbolMatch?.id) {
        const existing = normalized[symbolMatch.id] ?? { correct: 0, incorrect: 0 };
        normalized[symbolMatch.id] = {
          correct: existing.correct + target.correct,
          incorrect: existing.incorrect + target.incorrect
        };
      }
    });
    return normalized;
  }

  function getConstraintLabel(constraintId) {
    const constraint = spiceConstraints.find((item) => item.id === constraintId);
    if (!constraint) return constraintId;
    return translateKey(constraint.labelKey, constraint.fallbackLabel);
  }

  function normalizeDailyData(daily) {
    if (!daily?.tasks) return daily;
    const totalReward = Number.isFinite(daily.rewardStars) ? daily.rewardStars : DAILY_REWARD_STARS;
    const rewardDistribution = distributeRewardStars(totalReward, daily.tasks.length);
    const tasks = daily.tasks.map((task, index) => {
      let nextTask = task;
      if (task.id === 'focus' && task.meta?.letter) {
        const original = task.meta.letter;
        const itemId = itemsById[original] ? original : itemsBySymbol[original]?.id ?? original;
        if (itemId !== original) {
          nextTask = { ...task, meta: { ...task.meta, letter: itemId } };
        }
      }

      const template = dailyTemplates.find((entry) => entry.id === task.id) ?? {};
      const translation = nextTask.translation ?? {};
      const titleKey = translation.titleKey ?? template.titleKey ?? null;
      const descriptionKey = translation.descriptionKey ?? template.descriptionKey ?? null;
      let replacements = { ...(translation.replacements ?? {}) };

      if (nextTask.id === 'focus') {
        const letterId = nextTask.meta?.letter;
        let info = null;
        if (letterId) {
          const fallbackInfo =
            typeof letterId === 'string'
              ? { id: letterId, symbol: letterId, name: letterId, sound: '' }
              : null;
          info =
            toLetterInfo(itemsById[letterId] ?? itemsBySymbol[letterId] ?? fallbackInfo) ??
            (fallbackInfo ? toLetterInfo(fallbackInfo) : null);
        }
        const finalInfo = info ?? fallbackLetterInfo;
        const labelParts = [finalInfo.hebrew, finalInfo.name].filter(
          (part, index, arr) => part && arr.indexOf(part) === index
        );
        const label = labelParts.length > 0 ? labelParts.join(' · ') : finalInfo.id ?? '';
        if (label) {
          replacements = { ...replacements, letter: label };
        }
      }

      if (nextTask.id === 'spice') {
        const constraintId = nextTask.meta?.constraintId;
        if (constraintId) {
          replacements = { ...replacements, constraint: getConstraintLabel(constraintId) };
        }
      }

      const title = titleKey ? translateKey(titleKey, nextTask.title, replacements) : nextTask.title;
      const description = descriptionKey
        ? translateKey(descriptionKey, nextTask.description, replacements)
        : nextTask.description;

      const rewardStars = Number.isFinite(nextTask.rewardStars)
        ? Math.max(0, Math.floor(nextTask.rewardStars))
        : Math.max(0, rewardDistribution[index] ?? 0);
      const rewardClaimed = Boolean(nextTask.rewardClaimed);
      const rewardClaimable =
        nextTask.rewardClaimable ?? (Boolean(nextTask.completed) && !rewardClaimed);
      const claimedAt = nextTask.claimedAt ?? null;

      return {
        ...nextTask,
        title,
        description,
        rewardStars,
        rewardClaimed,
        rewardClaimable: rewardClaimed ? false : rewardClaimable,
        claimedAt,
        translation: {
          titleKey,
          descriptionKey,
          replacements
        }
      };
    });
    const rewardStars = tasks.reduce((sum, task) => sum + (Number.isFinite(task.rewardStars) ? task.rewardStars : 0), 0);
    const rewardClaimed = tasks.length > 0 ? tasks.every((task) => task.rewardClaimed) : Boolean(daily.rewardClaimed);
    const rewardClaimable = tasks.some((task) => task.rewardClaimable && !task.rewardClaimed);
    return {
      ...daily,
      tasks,
      rewardStars,
      rewardClaimed,
      rewardClaimable,
      claimedAt: daily.claimedAt ?? null
    };
  }

  function generateDaily(dateKey, focusLetterInfo, constraint) {
    const focusLetter = focusLetterInfo ?? fallbackLetterInfo;
    const selectedConstraint = constraint ?? pickConstraint();

    const shuffled = [...dailyTemplates].sort(() => Math.random() - 0.5);
    const selectedTemplates = shuffled.slice(0, 3);

    const rewardDistribution = distributeRewardStars(DAILY_REWARD_STARS, selectedTemplates.length);
    const tasks = selectedTemplates.map((template, index) => {
      const baseTranslation = {
        titleKey: template.titleKey ?? null,
        descriptionKey: template.descriptionKey ?? null
      };
      let replacements = {};
      let meta = template.meta ?? {};

      if (template.id === 'focus') {
        const label = `${focusLetter.hebrew} · ${focusLetter.name}`;
        replacements = { letter: label };
        meta = { ...meta, letter: focusLetter.id ?? focusLetter.hebrew };
      }
      if (template.id === 'spice') {
        replacements = { constraint: getConstraintLabel(selectedConstraint.id) };
        meta = { ...meta, constraintId: selectedConstraint.id };
      }
      const title = baseTranslation.titleKey
        ? translateKey(baseTranslation.titleKey, null, replacements)
        : template.title;
      const description = baseTranslation.descriptionKey
        ? translateKey(baseTranslation.descriptionKey, null, replacements)
        : template.description;
      return {
        ...template,
        title,
        description,
        progress: 0,
        meta,
        completed: false,
        rewardStars: rewardDistribution[index] ?? 0,
        rewardClaimable: false,
        rewardClaimed: false,
        claimedAt: null,
        translation: {
          ...baseTranslation,
          replacements
        }
      };
    });
    return {
      dateKey,
      tasks,
      completed: false,
      completedAt: null,
      rewardStars: DAILY_REWARD_STARS,
      rewardClaimable: false,
      rewardClaimed: false,
      claimedAt: null
    };
  }

  return {
    baseLanguageItems,
    allLanguageItems,
    itemsById,
    itemsBySymbol,
    fallbackLetterInfo,
    getWeakestLetter,
    normalizeLetterStats,
    normalizeDailyData,
    generateDaily
  };
}

const spiceConstraints = [
  {
    id: 'fast-flow',
    labelKey: 'daily.constraints.fast-flow',
    fallbackLabel: 'Fast Flow speed active',
    predicate: (session) => (session?.settings?.speed ?? 0) >= 18
  },
  {
    id: 'no-intros',
    labelKey: 'daily.constraints.no-intros',
    fallbackLabel: 'No Introductions enabled',
    predicate: (session) => session?.settings?.introductions === false
  },
  {
    id: 'click-mode',
    labelKey: 'daily.constraints.click-mode',
    fallbackLabel: 'Click Mode active',
    predicate: (session) => session?.settings?.clickMode === true
  },
  {
    id: 'slow-river',
    labelKey: 'daily.constraints.slow-river',
    fallbackLabel: 'Slow River mode active',
    predicate: (session) => session?.settings?.slowRiver === true
  },
  {
    id: 'random-letters',
    labelKey: 'daily.constraints.random-letters',
    fallbackLabel: 'Random Letters enabled',
    predicate: (session) => session?.settings?.randomLetters === true
  },
  {
    id: 'font-shuffle',
    labelKey: 'daily.constraints.font-shuffle',
    fallbackLabel: 'Font Shuffle active',
    predicate: (session) => session?.settings?.fontShuffle === true
  }
];

function pickConstraint() {
  return spiceConstraints[Math.floor(Math.random() * spiceConstraints.length)];
}

export function ProgressProvider({ children }) {
  const { addToast } = useToast();
  const { languagePack, dictionary, t } = useLocalization();

  const assets = useMemo(() => createLanguageAssets(languagePack, { dictionary, t }), [languagePack, dictionary, t]);
  const storagePrefix = useMemo(() => `progress.${languagePack.id}`, [languagePack.id]);
  const initialPlayerRef = useRef(null);
  const hydratedPrefixRef = useRef(storagePrefix);
  const isInitialHydrationRef = useRef(true);
  const [isHydrationComplete, setIsHydrationComplete] = useState(false);

  const hydratePlayer = useCallback(() => {
    const stored = loadState(`${storagePrefix}.player`, null);
    let source = stored;
    if (!source) {
      const legacy = loadState('player', null);
      if (legacy) {
        source = legacy;
        removeState('player');
      }
    }
    if (!source) return { ...defaultPlayer };
    const storedTotal = Number.isFinite(source?.totalStarsEarned) ? source.totalStarsEarned : source?.stars ?? 0;
    const { level, levelProgress, total } = calculateLevelInfo(storedTotal);
    const hydrated = {
      ...defaultPlayer,
      ...source,
      stars: Number.isFinite(source?.stars) ? source.stars : total,
      totalStarsEarned: total,
      level,
      levelProgress,
      totals: { ...defaultPlayer.totals, ...(source.totals ?? {}) },
      letters: assets.normalizeLetterStats(source.letters ?? {}),
      modesPlayed: Array.isArray(source.modesPlayed) ? source.modesPlayed : [],
      latestBadge: (() => {
        if (!source.latestBadge) return null;
        const badge = badgeSpecById[source.latestBadge.id];
        if (!badge) return source.latestBadge;
        const tierSpec = badge.tiers.find((item) => item.tier === source.latestBadge.tier);
        return {
          ...source.latestBadge,
          nameKey: source.latestBadge.nameKey ?? badge.nameKey,
          labelKey: source.latestBadge.labelKey ?? tierSpec?.labelKey,
          summaryKey: source.latestBadge.summaryKey ?? badge.summaryKey
        };
      })(),
      kidMode: source.kidMode ?? defaultPlayer.kidMode,
      kidSettings: { ...defaultPlayer.kidSettings, ...(source.kidSettings ?? {}) }
    };
    if (!stored) {
      saveState(`${storagePrefix}.player`, hydrated);
    }
    return hydrated;
  }, [storagePrefix, assets]);

  const hydrateBadges = useCallback(() => {
    const stored = loadState(`${storagePrefix}.badges`, null);
    let source = stored;
    if (!source) {
      const legacy = loadState('badges', null);
      if (legacy) {
        source = legacy;
        removeState('badges');
      }
    }
    if (!source) return { ...defaultBadges };
    const hydrated = { ...defaultBadges };
    Object.keys(source).forEach((key) => {
      const entry = source[key] ?? {};
      const unclaimed = Array.isArray(entry.unclaimed)
        ? entry.unclaimed.map((item) => ({
            tier: Number.isFinite(item?.tier) ? item.tier : 0,
            stars: Number.isFinite(item?.stars) ? item.stars : 0,
            goal: Number.isFinite(item?.goal) ? item.goal : 0,
            earnedAt: item?.earnedAt ?? null
          }))
        : [];
      hydrated[key] = {
        tier: Number.isFinite(entry.tier) ? entry.tier : 0,
        progress: Number.isFinite(entry.progress) ? entry.progress : 0,
        unclaimed
      };
    });
    if (!stored) {
      saveState(`${storagePrefix}.badges`, hydrated);
    }
    return hydrated;
  }, [storagePrefix]);

  const hydrateStreak = useCallback(() => {
    const stored = loadState(`${storagePrefix}.streak`, null);
    let source = stored;
    if (!source) {
      const legacy = loadState('streak', null);
      if (legacy) {
        source = legacy;
        removeState('streak');
      }
    }
    if (!source) return { ...defaultStreak };
    const hydrated = { ...defaultStreak, ...source };
    if (!stored) {
      saveState(`${storagePrefix}.streak`, hydrated);
    }
    return hydrated;
  }, [storagePrefix]);

  const hydrateDaily = useCallback(
    (currentPlayer) => {
      const todayKey = getJerusalemDateKey();
      const stored = loadState(`${storagePrefix}.daily`, null);
      let source = stored;
      if (!source) {
        const legacy = loadState('daily', null);
        if (legacy) {
          source = legacy;
          removeState('daily');
        }
      }
      if (source && source.dateKey === todayKey) {
        const normalized = assets.normalizeDailyData(source);
        if (!stored) {
          saveState(`${storagePrefix}.daily`, normalized);
        }
        return normalized;
      }
      const weakest = assets.getWeakestLetter(currentPlayer?.letters);
      return assets.generateDaily(todayKey, weakest, pickConstraint());
    },
    [storagePrefix, assets]
  );

  const hydrateActiveBadges = useCallback(() => {
    const stored = loadState(`${storagePrefix}.activeBadges`, null);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
    return [...defaultActiveBadges];
  }, [storagePrefix]);

  const [player, setPlayer] = useState(() => {
    const loaded = hydratePlayer();
    initialPlayerRef.current = loaded;
    return loaded;
  });
  const [badges, setBadges] = useState(() => hydrateBadges());
  const [streak, setStreak] = useState(() => hydrateStreak());
  const [daily, setDaily] = useState(() => hydrateDaily(initialPlayerRef.current));
  const [activeBadges, setActiveBadges] = useState(() => hydrateActiveBadges());
  const [lastSession, setLastSession] = useState(null);
  const sessionStatsRef = useRef({ uniqueLetters: new Set(), totalCatches: 0, mistakes: 0, modesPlayed: new Set() });
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    hydratedPrefixRef.current = storagePrefix;
    setIsHydrationComplete(false);
  }, [storagePrefix]);

  useEffect(() => {
    if (isInitialHydrationRef.current) {
      isInitialHydrationRef.current = false;
      setIsHydrationComplete(true);
      return;
    }
    const nextPlayer = hydratePlayer();
    const nextBadges = hydrateBadges();
    const nextStreak = hydrateStreak();
    const nextDaily = hydrateDaily(nextPlayer);
    const nextActiveBadges = hydrateActiveBadges();
    initialPlayerRef.current = nextPlayer;
    setPlayer(nextPlayer);
    setBadges(nextBadges);
    setStreak(nextStreak);
    setDaily(nextDaily);
    setActiveBadges(nextActiveBadges);
    setLastSession(null);
    if (hydratedPrefixRef.current === storagePrefix) {
      setIsHydrationComplete(true);
    }
  }, [hydratePlayer, hydrateBadges, hydrateStreak, hydrateDaily, hydrateActiveBadges, storagePrefix]);

  useEffect(() => {
    if (!isHydrationComplete) return;
    saveState(`${storagePrefix}.player`, player);
  }, [player, storagePrefix, isHydrationComplete]);

  useEffect(() => {
    if (!isHydrationComplete) return;
    saveState(`${storagePrefix}.badges`, badges);
  }, [badges, storagePrefix, isHydrationComplete]);

  useEffect(() => {
    if (!isHydrationComplete) return;
    saveState(`${storagePrefix}.streak`, streak);
  }, [streak, storagePrefix, isHydrationComplete]);

  useEffect(() => {
    if (!isHydrationComplete) return;
    saveState(`${storagePrefix}.daily`, daily);
  }, [daily, storagePrefix, isHydrationComplete]);

  useEffect(() => {
    if (!isHydrationComplete) return;
    saveState(`${storagePrefix}.activeBadges`, activeBadges);
  }, [activeBadges, storagePrefix, isHydrationComplete]);

  useEffect(() => {
    const key = getJerusalemDateKey();
    if (daily.dateKey !== key) {
      const weakest = assets.getWeakestLetter(player.letters);
      setDaily(assets.generateDaily(key, weakest, pickConstraint()));
    }
    const timeout = setTimeout(() => {
      const weakest = assets.getWeakestLetter(player.letters);
      setDaily(assets.generateDaily(getJerusalemDateKey(), weakest, pickConstraint()));
    }, millisUntilNextJerusalemMidnight());
    return () => clearTimeout(timeout);
  }, [daily.dateKey, player.letters, assets]);

  const applyStarsToPlayer = useCallback(
    (stars, options = {}) => {
      if (!Number.isFinite(stars) || stars <= 0) {
        console.warn('applyStarsToPlayer: Invalid stars value', { stars, options });
        return { success: false, levelUp: false };
      }
      const { latestBadge = null, source = null, metadata = null } = options ?? {};
      let levelUp = false;
      let levelValue = null;
      let totalStarsEarnedValue = null;
      setPlayer((prev) => {
        const baseTotal = Number.isFinite(prev.totalStarsEarned) ? prev.totalStarsEarned : prev.stars ?? 0;
        const totalStarsEarned = baseTotal + stars;
        const { level, levelProgress } = calculateLevelInfo(totalStarsEarned);
        levelValue = level;
        levelUp = level > (prev.level ?? 1);
        totalStarsEarnedValue = totalStarsEarned;
        const nextPlayer = {
          ...prev,
          stars: (prev.stars ?? 0) + stars,
          totalStarsEarned,
          level,
          levelProgress
        };
        if (latestBadge) {
          nextPlayer.latestBadge = latestBadge;
        }
        console.log('applyStarsToPlayer: Stars awarded', {
          starsAwarded: stars,
          previousTotal: prev.stars,
          newTotal: nextPlayer.stars,
          totalStarsEarned: nextPlayer.totalStarsEarned,
          level: nextPlayer.level,
          source,
          metadata
        });
        return nextPlayer;
      });
      if (levelUp) {
        addToast({
          tone: 'success',
          title: 'Level up!',
          description: `You reached level ${levelValue}!`,
          icon: '🌟'
        });
      }
      emit('progress:stars-awarded', {
        stars,
        totalStarsEarned: totalStarsEarnedValue,
        level: levelValue,
        levelUp,
        source,
        metadata
      });
      return { success: true, levelUp, level: levelValue };
    },
    [addToast]
  );

  function updateStreakForSession(dateKey, playerSessionsCount) {
    let shouldAdvanceBadge = false;
    setStreak((prev) => {
      if (prev.lastPlayedDateKey === dateKey) return prev;
      const diff = prev.lastPlayedDateKey ? differenceInJerusalemDays(prev.lastPlayedDateKey, dateKey) : null;
      let current = 1;
      if (diff === 1) {
        current = prev.current + 1;
        shouldAdvanceBadge = true;
      } else {
        current = 1;
        shouldAdvanceBadge = prev.lastPlayedDateKey === null;

        // Comeback-kid: player had sessions before, had played before, missed days (diff > 1), streak resets to 1
        if (playerSessionsCount > 0 && prev.lastPlayedDateKey !== null && diff !== null && diff > 1) {
          trackBadgeProgress('comeback-kid', 1);
        }
      }
      const best = Math.max(prev.best, current);
      return {
        current,
        best,
        lastPlayedDateKey: dateKey
      };
    });
    if (shouldAdvanceBadge) trackBadgeProgress('steady-streak', 1);
  }

  const replaceCompletedBadge = useCallback((completedBadgeId) => {
    setActiveBadges((prev) => {
      const available = badgesCatalog
        .map(b => b.id)
        .filter(id => !prev.includes(id));

      if (available.length === 0) {
        return prev;
      }

      const randomIndex = Math.floor(Math.random() * available.length);
      const newBadgeId = available[randomIndex];

      return prev.map(id => id === completedBadgeId ? newBadgeId : id);
    });
  }, []);

  function trackBadgeProgress(badgeId, delta = 1) {
    const badgeSpec = badgeSpecById[badgeId];
    if (!badgeSpec) return;
    const earnedTiers = [];
    let completedAllTiers = false;
    setBadges((prev) => {
      const current = prev[badgeId] ?? { tier: 0, progress: 0, unclaimed: [] };
      let tier = Number.isFinite(current.tier) ? current.tier : 0;
      let progress = (current.progress ?? 0) + delta;
      const unclaimed = Array.isArray(current.unclaimed) ? [...current.unclaimed] : [];
      const result = { ...prev };
      while (tier < badgeSpec.tiers.length) {
        const target = badgeSpec.tiers[tier].goal;
        if (progress >= target) {
          progress -= target;
          tier += 1;
          const tierSpec = badgeSpec.tiers[tier - 1];
          const reward = {
            tier: tierSpec.tier,
            stars: tierSpec.stars ?? 0,
            goal: tierSpec.goal ?? target,
            earnedAt: new Date().toISOString()
          };
          unclaimed.push(reward);
          earnedTiers.push(reward);

          if (tier === badgeSpec.tiers.length) {
            completedAllTiers = true;
          }
        } else {
          break;
        }
      }
      if (tier >= badgeSpec.tiers.length) {
        progress = badgeSpec.tiers[badgeSpec.tiers.length - 1].goal;
      }
      result[badgeId] = { tier, progress, unclaimed };
      return result;
    });
    if (earnedTiers.length > 0) {
      const latestReward = earnedTiers[earnedTiers.length - 1];
      const tierSpec = badgeSpec.tiers.find((item) => item.tier === latestReward.tier) ?? latestReward;
      const badgeName = badgeSpec.nameKey ? t(badgeSpec.nameKey) : badgeSpec.name ?? badgeId;
      const tierLabel = tierSpec.labelKey ? t(tierSpec.labelKey) : tierSpec.label ?? `Tier ${latestReward.tier}`;
      addToast({
        tone: 'info',
        title: `${badgeName} · ${tierLabel}`,
        description: completedAllTiers
          ? `All tiers complete! +${latestReward.stars} ⭐ A new achievement is now available.`
          : `Tier ${latestReward.tier} ready to claim! +${latestReward.stars} ⭐`,
        icon: completedAllTiers ? '🏆' : '⭐'
      });
    }
  }

  function markDailyProgress(predicate) {
    const newlyClaimable = [];
    setDaily((prev) => {
      if (!prev) return prev;
      const tasks = prev.tasks.map((task) => {
        if (task.completed) return task;
        if (!predicate(task)) return task;
        const nextProgress = Math.min(task.goal, (task.progress ?? 0) + 1);
        const completed = nextProgress >= task.goal;
        const becameClaimable = completed && !task.rewardClaimed && !task.rewardClaimable;
        if (becameClaimable) {
          newlyClaimable.push({
            id: task.id,
            title: task.title,
            rewardStars: Number.isFinite(task.rewardStars) ? task.rewardStars : 0
          });
        }
        return {
          ...task,
          progress: nextProgress,
          completed,
          rewardClaimable: completed && !task.rewardClaimed
        };
      });
      const completed = tasks.every((task) => task.completed);
      const completedAt = completed && !prev.completed ? new Date().toISOString() : prev.completedAt;
      const rewardStars = tasks.reduce(
        (sum, task) => sum + (Number.isFinite(task.rewardStars) ? task.rewardStars : 0),
        0
      );
      const rewardClaimed = tasks.every((task) => task.rewardClaimed);
      const rewardClaimable = tasks.some((task) => task.rewardClaimable && !task.rewardClaimed);
      const nextDaily = {
        ...prev,
        tasks,
        completed,
        completedAt: completed ? completedAt : prev.completedAt,
        rewardStars,
        rewardClaimed,
        rewardClaimable
      };
      return nextDaily;
    });
    newlyClaimable.forEach((task) => {
      const rewardValue = Math.max(0, Math.floor(task.rewardStars ?? 0));
      addToast({
        tone: 'info',
        title: `${task.title} complete`,
        description:
          rewardValue > 0
            ? `Claim +${rewardValue} ⭐ from this quest!`
            : 'Quest complete! Claim your reward.',
        icon: '⭐'
      });
    });
  }

  const claimBadgeReward = useCallback(
    (badgeId, tier) => {
      const badgeSpec = badgeSpecById[badgeId];
      if (!badgeSpec) {
        console.warn('claimBadgeReward: Badge spec not found', { badgeId });
        return { success: false };
      }

      // First, validate the reward exists and has valid stars BEFORE updating state
      let reward = null;
      let starsToAward = 0;

      setBadges((prev) => {
        const state = prev[badgeId];
        if (!state) {
          console.warn('claimBadgeReward: Badge state not found', { badgeId });
          return prev;
        }
        const unclaimed = Array.isArray(state.unclaimed) ? [...state.unclaimed] : [];
        const index =
          typeof tier === 'number'
            ? unclaimed.findIndex((entry) => entry.tier === tier)
            : 0;
        if (index < 0 || index >= unclaimed.length) {
          console.warn('claimBadgeReward: No unclaimed reward found', { badgeId, tier, unclaimed });
          return prev;
        }

        // Extract reward to validate
        const candidateReward = unclaimed[index];
        const tierSpec = badgeSpec.tiers.find((item) => item.tier === candidateReward.tier);

        // Calculate stars BEFORE removing from unclaimed
        const candidateStars = Number.isFinite(candidateReward.stars) && candidateReward.stars > 0
          ? candidateReward.stars
          : (Number.isFinite(tierSpec?.stars) && tierSpec.stars > 0 ? tierSpec.stars : 0);

        // Validate stars value
        if (!Number.isFinite(candidateStars) || candidateStars <= 0) {
          console.error('claimBadgeReward: Invalid stars value, aborting claim', {
            badgeId,
            tier: candidateReward.tier,
            rewardStars: candidateReward.stars,
            tierSpecStars: tierSpec?.stars,
            candidateStars
          });
          return prev;
        }

        // Stars are valid, proceed with removal
        reward = unclaimed.splice(index, 1)[0];
        starsToAward = candidateStars;

        return {
          ...prev,
          [badgeId]: {
            ...state,
            unclaimed
          }
        };
      });

      if (!reward || starsToAward <= 0) {
        console.warn('claimBadgeReward: Failed to extract reward or invalid stars', { reward, starsToAward });
        return { success: false };
      }

      const isMaxTier = reward.tier === badgeSpec.tiers.length;
      if (isMaxTier) {
        replaceCompletedBadge(badgeId);
      }

      const tierSpec = badgeSpec.tiers.find((item) => item.tier === reward.tier) ?? reward;
      const badgeName = badgeSpec.nameKey ? t(badgeSpec.nameKey) : badgeSpec.name ?? badgeId;
      const tierLabel = tierSpec.labelKey ? t(tierSpec.labelKey) : tierSpec.label ?? `Tier ${reward.tier}`;
      const summary = badgeSpec.summaryKey ? t(badgeSpec.summaryKey) : badgeSpec.summary ?? '';

      console.log('claimBadgeReward: Awarding stars', {
        badgeId,
        tier: reward.tier,
        starsToAward
      });

      const applyResult = applyStarsToPlayer(starsToAward, {
        latestBadge: {
          id: badgeId,
          tier: reward.tier,
          earnedAt: reward.earnedAt ?? new Date().toISOString(),
          nameKey: badgeSpec.nameKey,
          labelKey: tierSpec.labelKey,
          summaryKey: badgeSpec.summaryKey,
          name: badgeName,
          label: tierLabel,
          summary
        },
        source: 'badge',
        metadata: { badgeId, tier: reward.tier }
      });

      // Verify stars were actually applied
      if (!applyResult || !applyResult.success) {
        console.error('claimBadgeReward: Failed to apply stars to player', {
          badgeId,
          tier: reward.tier,
          starsToAward,
          applyResult
        });
        addToast({
          tone: 'error',
          title: 'Error claiming reward',
          description: 'Stars could not be added to your profile. Please try again.',
          icon: '⚠️'
        });
        return { success: false };
      }

      addToast({
        tone: 'success',
        title: `${badgeName} · ${tierLabel}`,
        description: isMaxTier
          ? `Mastered! +${starsToAward} ⭐ New achievement unlocked!`
          : `Claimed +${starsToAward} ⭐`,
        icon: isMaxTier ? '🏆' : '🏅'
      });
      celebrate({ particleCount: 140, spread: 75, originY: 0.55 });
      return { success: true, reward, starsAwarded: starsToAward };
    },
    [addToast, applyStarsToPlayer, t, replaceCompletedBadge]
  );

  const claimDailyReward = useCallback(
    (taskId = null) => {
      // First, validate eligible tasks and calculate stars BEFORE updating state
      let starsToAward = 0;
      let eligibleTaskIds = [];

      setDaily((prev) => {
        if (!prev?.tasks?.length) {
          console.warn('claimDailyReward: No tasks found');
          return prev;
        }

        // First pass: identify eligible tasks and validate stars
        const eligibleTasks = prev.tasks.filter((task) => {
          const eligible =
            task.completed &&
            !task.rewardClaimed &&
            task.rewardClaimable &&
            (taskId === null || task.id === taskId);
          if (eligible) {
            const rewardValue = Number.isFinite(task.rewardStars) ? Math.max(0, task.rewardStars) : 0;
            if (rewardValue > 0) {
              eligibleTaskIds.push(task.id);
              starsToAward += rewardValue;
            }
          }
          return eligible;
        });

        if (eligibleTaskIds.length === 0 || starsToAward <= 0) {
          console.warn('claimDailyReward: No eligible tasks with valid stars', {
            eligibleTasks: eligibleTasks.length,
            starsToAward
          });
          return prev;
        }

        // Stars are valid, proceed with claiming
        const claimedAt = new Date().toISOString();
        const tasks = prev.tasks.map((task) => {
          if (eligibleTaskIds.includes(task.id)) {
            return {
              ...task,
              rewardClaimable: false,
              rewardClaimed: true,
              claimedAt
            };
          }
          return task;
        });

        const completed = tasks.every((task) => task.completed);
        const rewardClaimed = tasks.every((task) => task.rewardClaimed);
        const rewardClaimable = tasks.some((task) => task.rewardClaimable && !task.rewardClaimed);
        const rewardStars = tasks.reduce(
          (sum, task) => sum + (Number.isFinite(task.rewardStars) ? task.rewardStars : 0),
          0
        );

        return {
          ...prev,
          tasks,
          completed,
          rewardStars,
          rewardClaimed,
          rewardClaimable,
          claimedAt: rewardClaimed ? claimedAt : prev.claimedAt
        };
      });

      if (eligibleTaskIds.length === 0 || starsToAward <= 0) {
        console.warn('claimDailyReward: No tasks claimed or invalid stars', {
          eligibleTaskIds,
          starsToAward
        });
        return { success: false };
      }

      console.log('claimDailyReward: Awarding stars', {
        tasks: eligibleTaskIds,
        starsToAward
      });

      const applyResult = applyStarsToPlayer(starsToAward, {
        source: 'daily',
        metadata: { tasks: eligibleTaskIds }
      });

      // Verify stars were actually applied
      if (!applyResult || !applyResult.success) {
        console.error('claimDailyReward: Failed to apply stars to player', {
          tasks: eligibleTaskIds,
          starsToAward,
          applyResult
        });
        addToast({
          tone: 'error',
          title: 'Error claiming reward',
          description: 'Stars could not be added to your profile. Please try again.',
          icon: '⚠️'
        });
        return { success: false };
      }

      addToast({
        tone: 'success',
        title: eligibleTaskIds.length > 1 ? 'Daily rewards claimed' : 'Daily reward claimed',
        description: `+${starsToAward} ⭐ added to your profile`,
        icon: '🎉'
      });
      celebrate({ particleCount: 120, spread: 80, originY: 0.6 });
      return { success: true, stars: starsToAward, tasks: eligibleTaskIds };
    },
    [applyStarsToPlayer, addToast]
  );

  const updateKidSettings = useCallback((updates) => {
    setPlayer((prev) => ({
      ...prev,
      kidSettings: {
        ...prev.kidSettings,
        ...updates
      }
    }));
  }, []);

  const toggleKidMode = useCallback((enabled) => {
    setPlayer((prev) => ({
      ...prev,
      kidMode: enabled
    }));
  }, []);

  const completeKidOnboarding = useCallback(() => {
    setPlayer((prev) => ({
      ...prev,
      kidSettings: {
        ...prev.kidSettings,
        onboardingComplete: true
      }
    }));
  }, []);

  useEffect(() => {
    const offSessionStart = on('game:session-start', (payload) => {
      setLastSession({ start: new Date().toISOString(), settings: payload?.settings ?? {}, mode: payload?.mode });
      sessionStatsRef.current = {
        uniqueLetters: new Set(),
        totalCatches: 0,
        mistakes: 0,
        modesPlayed: new Set(),
        initialLetters: new Set(Object.keys(playerRef.current.letters ?? {}))
      };
      if (payload?.mode) {
        sessionStatsRef.current.modesPlayed.add(payload.mode);
      }
    });
    const offSessionComplete = on('game:session-complete', (payload) => {
      const dateKey = getJerusalemDateKey();
      const stats = payload?.stats ?? {};
      const correct = Object.values(stats).reduce((sum, item) => sum + (item.correct ?? 0), 0);
      const incorrect = Object.values(stats).reduce((sum, item) => sum + (item.incorrect ?? 0), 0);
      const total = correct + incorrect;
      const accuracy = total > 0 ? correct / total : 0;
      const speed = payload?.settings?.speed ?? 0;
      const isFastFlow = speed >= 18;
      const isPerfect = incorrect === 0 && total > 0;
      const isMarathon = sessionStatsRef.current.totalCatches >= 30;
      const uniqueLetterCount = sessionStatsRef.current.uniqueLetters.size;

      const now = new Date();
      const hour = now.getHours();
      const isEarlyBird = hour >= 5 && hour < 11;
      const isNightOwl = hour >= 20 || hour < 2;
      const dayOfWeek = now.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      setPlayer((prev) => {
        // Update streak with current sessions count (before incrementing)
        updateStreakForSession(dateKey, prev.totals.sessions);

        return {
          ...prev,
          totals: {
            ...prev.totals,
            sessions: prev.totals.sessions + 1
          }
        };
      });

      trackBadgeProgress('first-flow', 1);
      trackBadgeProgress('dedicated-scholar', sessionStatsRef.current.totalCatches);

      if (accuracy >= 0.9) {
        trackBadgeProgress('accuracy-ace', 1);
        markDailyProgress((task) => task.type === 'highAccuracy');
      }

      if (isFastFlow) {
        trackBadgeProgress('speed-demon', 1);
        markDailyProgress((task) => task.type === 'fastMode');
      }

      if (isPerfect) {
        trackBadgeProgress('perfectionist', 1);
        markDailyProgress((task) => task.type === 'flawlessSession');
      }

      if (isMarathon) {
        trackBadgeProgress('marathon-runner', 1);
      }

      if (isEarlyBird) {
        trackBadgeProgress('early-bird', 1);
      }

      if (isNightOwl) {
        trackBadgeProgress('night-owl', 1);
      }

      if (isWeekend) {
        trackBadgeProgress('weekend-warrior', 1);
      }

      if (sessionStatsRef.current.modesPlayed.size > 0) {
        setPlayer((prev) => {
          const prevModes = new Set(prev.modesPlayed ?? []);
          sessionStatsRef.current.modesPlayed.forEach(mode => prevModes.add(mode));
          const newModesCount = prevModes.size;
          const oldModesCount = (prev.modesPlayed ?? []).length;

          if (newModesCount > oldModesCount) {
            trackBadgeProgress('explorer', newModesCount - oldModesCount);
          }

          return {
            ...prev,
            modesPlayed: Array.from(prevModes)
          };
        });
      }

      if (uniqueLetterCount > 0 && sessionStatsRef.current.initialLetters) {
        const newLetters = Array.from(sessionStatsRef.current.uniqueLetters).filter(
          letterId => !sessionStatsRef.current.initialLetters.has(letterId)
        );

        if (newLetters.length > 0) {
          trackBadgeProgress('variety-seeker', newLetters.length);
        }
      }

      markDailyProgress((task) => task.id === 'warmup' || task.id === 'triple-threat');

      markDailyProgress((task) => {
        if (task.id !== 'spice') return false;
        const constraint = spiceConstraints.find((c) => c.id === task.meta?.constraintId);
        return constraint?.predicate(payload);
      });

      markDailyProgress((task) => {
        if (task.type === 'uniqueLetters') {
          return sessionStatsRef.current.uniqueLetters.size >= task.goal;
        }
        return false;
      });

      markDailyProgress((task) => {
        if (task.type === 'totalCatches') {
          return sessionStatsRef.current.totalCatches >= task.goal;
        }
        return false;
      });
    });

    const offLetter = on('game:letter-result', (payload) => {
      const itemId = payload?.itemId;
      if (!itemId) return;

      sessionStatsRef.current.totalCatches += 1;
      sessionStatsRef.current.uniqueLetters.add(itemId);

      if (!payload.correct) {
        sessionStatsRef.current.mistakes += 1;
      }

      setPlayer((prev) => {
        const current = prev.letters[itemId] ?? { correct: 0, incorrect: 0 };
        const newStats = {
          correct: current.correct + (payload.correct ? 1 : 0),
          incorrect: current.incorrect + (!payload.correct ? 1 : 0)
        };

        const oldTotal = current.correct + current.incorrect;
        const oldAccuracy = oldTotal > 0 ? current.correct / oldTotal : 0;
        const newTotal = newStats.correct + newStats.incorrect;
        const newAccuracy = newTotal > 0 ? newStats.correct / newTotal : 0;

        if (oldAccuracy < 0.5 && newAccuracy >= 0.5 && newTotal >= 5) {
          trackBadgeProgress('rapid-learner', 1);
        }

        return {
          ...prev,
          letters: {
            ...prev.letters,
            [itemId]: newStats
          },
          totals: {
            ...prev.totals,
            perfectCatches: prev.totals.perfectCatches + (payload.correct ? 1 : 0)
          }
        };
      });

      if (payload.correct) {
        trackBadgeProgress('letter-master', 1);
        markDailyProgress((task) => {
          if (task.id !== 'focus') return false;
          const target = task.meta?.letter;
          if (!target) return false;
          if (target === itemId) return true;
          const symbolMatch = assets.itemsBySymbol[target]?.id;
          return symbolMatch ? symbolMatch === itemId : false;
        });
      }
    });

    return () => {
      offSessionStart();
      offSessionComplete();
      offLetter();
    };
  }, [assets]);

  const value = useMemo(
    () => ({
      player,
      badges,
      activeBadges,
      streak,
      daily,
      setDaily,
      starLevelSize: STAR_LEVEL_SIZE,
      getWeakestLetter: () => assets.getWeakestLetter(player.letters),
      lastSession,
      claimBadgeReward,
      claimDailyReward,
      updateKidSettings,
      toggleKidMode,
      completeKidOnboarding
    }),
    [assets, player, badges, activeBadges, streak, daily, lastSession, claimBadgeReward, claimDailyReward, updateKidSettings, toggleKidMode, completeKidOnboarding]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
