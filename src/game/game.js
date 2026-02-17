import { emit } from '../lib/eventBus.js';
import { loadLanguage } from '../lib/languageLoader.js';
import { getDictionary, translate as translateWithDictionary, formatTemplate } from '../i18n/index.js';
import { getAssociation } from '../data/soundAssociations.js';

const trackedTimeouts = new Set();
const trackedIntervals = new Set();

function trackTimeout(callback, delay) {
  const handle = setTimeout(() => {
    trackedTimeouts.delete(handle);
    callback();
  }, delay);
  trackedTimeouts.add(handle);
  return handle;
}

function trackInterval(callback, delay) {
  const handle = setInterval(callback, delay);
  trackedIntervals.add(handle);
  return handle;
}

function clearTrackedTimeout(handle) {
  if (handle === undefined || handle === null) return;
  clearTimeout(handle);
  trackedTimeouts.delete(handle);
}

function clearTrackedInterval(handle) {
  if (handle === undefined || handle === null) return;
  clearInterval(handle);
  trackedIntervals.delete(handle);
}

function clearAllTimers() {
  trackedTimeouts.forEach((handle) => clearTimeout(handle));
  trackedTimeouts.clear();
  trackedIntervals.forEach((handle) => clearInterval(handle));
  trackedIntervals.clear();
}

// Store the current practice language ID for Association Mode (module-level variable)
let activeAssociationLanguageId = 'en';

export function setupGame({ onReturnToMenu, onGameStart, onGameReset, languagePack, translate, dictionary, appLanguageId = 'en', vocabData = null } = {}) {
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesContainer = document.getElementById('lives-container');
  const choicesContainer = document.getElementById('choices-container');
  const modal = document.getElementById('modal');
  const startButton = document.getElementById('start-button');
  const playArea = document.getElementById('play-area');
  const learnOverlay = document.getElementById('learn-overlay');
  const learnLetterEl = document.getElementById('learn-letter');
  const learnName = document.getElementById('learn-name');
  const learnSound = document.getElementById('learn-sound');
  const bucketInfoOverlay = document.getElementById('bucket-info-overlay');
  const bucketInfoSymbol = document.getElementById('bucket-info-symbol');
  const bucketInfoName = document.getElementById('bucket-info-name');
  const bucketInfoSound = document.getElementById('bucket-info-sound');
  const bucketInfoClose = document.getElementById('bucket-info-close');
  const ghostEl = document.getElementById('correct-answer-ghost');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const setupView = document.getElementById('setup-view');
  const gameOverView = document.getElementById('game-over-view');
  const gameContainer = document.getElementById('game-container');
  const summaryTooltip = document.getElementById('summary-tooltip');
  const accessibilityBtn = document.getElementById('accessibility-btn');
  const accessibilityView = document.getElementById('accessibility-view');
  const closeAccessibilityBtn = document.getElementById('close-accessibility-btn');
  const highContrastToggle = document.getElementById('high-contrast-toggle');
  const randomLettersToggle = document.getElementById('random-letters-toggle');
  const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
  const gameSpeedSlider = document.getElementById('game-speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const gameFontSelect = document.getElementById('game-font-select');
  const fontShuffleToggle = document.getElementById('font-shuffle-toggle');
  const slowRiverToggle = document.getElementById('slow-river-toggle');
  const clickModeToggle = document.getElementById('click-mode-toggle');
  const associationModeToggle = document.getElementById('association-mode-toggle');
  const installBtn = document.getElementById('install-btn');
  const pauseButton = document.getElementById('pause-button');
  const pauseModal = document.getElementById('pause-modal');
  const resumeButton = document.getElementById('resume-button');
  const pauseExitButton = document.getElementById('pause-exit-button');
  const setupExitButton = document.getElementById('setup-exit-button');
  const gameOverExitButton = document.getElementById('game-over-exit-button');
  const modeOptionsContainer = document.getElementById('mode-options');
  const goalValueEl = document.getElementById('goalValue');
  const goalIncreaseBtn = document.getElementById('goalIncrease');
  const goalDecreaseBtn = document.getElementById('goalDecrease');
  const goalProgressFillEl = document.getElementById('goalProgressFill');
  const goalInfoIcon = document.getElementById('goalInfoIcon');
  const goalTooltip = document.getElementById('goalTooltip');
  const winView = document.getElementById('win-view');
  const continuePlayingButton = document.getElementById('continue-playing-button');
  const winExitButton = document.getElementById('win-exit-button');
  const winGoalDisplay = document.getElementById('win-goal-display');
  const totalWinsDisplay = document.getElementById('total-wins-display');
  const sessionCorrectDisplay = document.getElementById('session-correct-display');
  const waveStatValue = document.getElementById('wave-stat-value');
  const streakStatValue = document.getElementById('streak-stat-value');
  const waveStatGhost = document.getElementById('wave-stat-ghost');
  const streakStatGhost = document.getElementById('streak-stat-ghost');

  if (!scoreEl || !levelEl) {
    throw new Error('Game elements failed to initialize.');
  }

  const activeLanguage = languagePack ?? loadLanguage();
  const activeDictionary = dictionary ?? getDictionary(activeLanguage.id);
  const t = translate
    ? (key, replacements) => translate(key, replacements)
    : (key, replacements) => translateWithDictionary(activeDictionary, key, replacements);

  // Association mode should follow the practice language sounds, not the UI language.
  activeAssociationLanguageId = activeLanguage.id || appLanguageId || 'en';

  const translateWithFallback = (key, fallback, replacements = {}) => {
    const result = t(key, replacements);
    if (!result || result === key) return fallback;
    return result;
  };

  // Vocab mode tracking variables (must be declared before vocabData check)
  let isVocabMode = false;
  let vocabCaughtInRound = new Set();
  let hadPerfectRound = false;
  let totalVocabCount = 0;

  let practiceModes = (activeLanguage.practiceModes ?? []).map((mode) => ({ ...mode }));
  const modeItems = { ...(activeLanguage.modeItems ?? {}) };
  const baseItems = activeLanguage.items ?? [];
  const allLanguageItems = activeLanguage.allItems ?? [];
  const itemsById = activeLanguage.itemsById ?? {};
  const itemsBySymbol = activeLanguage.itemsBySymbol ?? {};
  const introductionsConfig = activeLanguage.introductions ?? {};
  const defaultSubtitle = translateWithFallback(
    'game.setup.subtitleFallback',
    introductionsConfig.subtitleTemplate ?? 'Drag the letters to the correct boxes!'
  );
  const subtitleTemplate = translateWithFallback(
    `game.introductions.${activeLanguage.id}.subtitle`,
    defaultSubtitle
  );
  const defaultNoun = translateWithFallback(
    'game.setup.defaultNoun',
    introductionsConfig.nounFallback ?? 'item'
  );
  const nounFallback = translateWithFallback(
    `game.introductions.${activeLanguage.id}.nounFallback`,
    introductionsConfig.nounFallback ?? defaultNoun
  );
  const metadata = activeLanguage.metadata ?? {};
  const fontClass = metadata.fontClass ?? 'language-font-hebrew';
  const accessibilityHints = metadata.accessibility ?? {};
  const letterDescriptionTemplate = accessibilityHints.letterDescriptionTemplate ?? null;

  const defaultModeLabel = translateWithFallback(
    'game.setup.defaultModeLabel',
    'Core Practice'
  );
  const defaultModeDescription = translateWithFallback(
    'game.setup.defaultModeDescription',
    'Practice the main set of characters.'
  );

  if (!practiceModes.length) {
    practiceModes = [
      {
        id: 'letters',
        label: defaultModeLabel,
        description: defaultModeDescription,
        type: 'consonants',
        noun: nounFallback
      }
    ];
  }

  practiceModes = practiceModes.map((mode) => {
    const label = translateWithFallback(
      `game.modes.${mode.id}.label`,
      mode.label ?? defaultModeLabel
    );
    const description = translateWithFallback(
      `game.modes.${mode.id}.description`,
      mode.description ?? defaultModeDescription
    );
    const noun = translateWithFallback(
      `game.modes.${mode.id}.noun`,
      mode.noun ?? nounFallback
    );
    return { ...mode, label, description, noun };
  });

  if (!modeItems.letters && baseItems.length) {
    modeItems.letters = baseItems.map((item) => ({ ...item }));
  }

  // Track selected mode IDs (multi-select) - declare early so vocab mode can use it
  let selectedModeIds = new Set();

  // Add vocab mode if vocab data is provided
  if (vocabData) {
    const vocabMode = {
      id: 'vocab',
      label: vocabData.title || 'Vocabulary Practice',
      description: vocabData.subtitle || 'Match words with their emojis',
      type: 'vocab',
      noun: 'word'
    };
    practiceModes.push(vocabMode);

    // Create vocab items from the vocab data
    const vocabItems = vocabData.words.map((word) => ({
      id: word.id,
      symbol: word.text,
      sound: vocabData.emojis[word.id] || word.text, // Use emoji as sound for association mode, fallback to Hebrew text
      name: word.gloss || word.id,
      transliteration: word.transliteration,
      emoji: vocabData.emojis[word.id],
      sourceMode: 'vocab'
    }));
    modeItems.vocab = vocabItems;

    // Set vocab mode tracking
    isVocabMode = true;
    totalVocabCount = vocabItems.length;

    // IMPORTANT: Auto-select vocab mode
    selectedModeIds.clear();
    selectedModeIds.add('vocab');
  }

  const modeNounMap = practiceModes.reduce((acc, mode) => {
    acc[mode.id] = mode.noun ?? nounFallback;
    return acc;
  }, {});

  function renderPracticeModes() {
    if (!modeOptionsContainer) return;
    modeOptionsContainer.innerHTML = '';

    // Default select the first mode if none selected
    if (selectedModeIds.size === 0 && practiceModes.length > 0) {
      selectedModeIds.add(practiceModes[0].id);
    }

    practiceModes.forEach((mode) => {
      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'mode-button-wrapper';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mode-button';
      button.dataset.mode = mode.id;
      button.textContent = mode.label;
      button.setAttribute('role', 'checkbox');
      button.setAttribute('aria-checked', selectedModeIds.has(mode.id) ? 'true' : 'false');

      if (selectedModeIds.has(mode.id)) {
        button.classList.add('selected');
      }

      // Create info popup (initially hidden)
      const infoPopup = document.createElement('div');
      infoPopup.className = 'mode-info-popup';
      infoPopup.textContent = mode.description || '';
      infoPopup.style.display = 'none';

      button.addEventListener('click', () => {
        // Toggle selection - allow deselecting all buttons
        if (selectedModeIds.has(mode.id)) {
          selectedModeIds.delete(mode.id);
          button.classList.remove('selected');
          button.setAttribute('aria-checked', 'false');
        } else {
          selectedModeIds.add(mode.id);
          button.classList.add('selected');
          button.setAttribute('aria-checked', 'true');
        }
        updateModalSubtitle();
      });

      // Show popup on hover (desktop)
      button.addEventListener('mouseenter', () => {
        infoPopup.style.display = 'block';
      });

      button.addEventListener('mouseleave', () => {
        infoPopup.style.display = 'none';
      });

      // Show popup on touch/press (mobile)
      let touchTimeout;
      button.addEventListener('touchstart', (e) => {
        touchTimeout = setTimeout(() => {
          infoPopup.style.display = 'block';
        }, 300);
      });

      button.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
        setTimeout(() => {
          infoPopup.style.display = 'none';
        }, 2000);
      });

      buttonWrapper.appendChild(button);
      modeOptionsContainer.appendChild(buttonWrapper);

      // Append popup to mode-panel (higher level) to prevent clipping
      const modePanel = modeOptionsContainer.closest('.mode-panel');
      if (modePanel) {
        modePanel.appendChild(infoPopup);
      } else {
        buttonWrapper.appendChild(infoPopup);
      }
    });

    updateModalSubtitle();
  }

  function updateGoalDisplay() {
    if (goalValueEl) {
      goalValueEl.textContent = goalValue;
      goalValueEl.style.color = '#4a2208';
    }
    updateGoalSettingBar();
  }

  function updateGoalSettingBar() {
    if (goalProgressFillEl) {
      // Bar represents the goal setting itself
      // Minimum (5) = 20% filled (2 segments)
      // Maximum (25) = 100% filled (10 segments)
      const range = GOAL_MAX - GOAL_MIN;
      const currentOffset = goalValue - GOAL_MIN;
      const percent = 20 + (currentOffset / range) * 80;
      goalProgressFillEl.style.height = `${Math.min(100, Math.max(20, percent))}%`;
    }
  }

  function increaseGoal() {
    goalValue = Math.min(GOAL_MAX, goalValue + GOAL_STEP);
    updateGoalDisplay();
  }

  function decreaseGoal() {
    goalValue = Math.max(GOAL_MIN, goalValue - GOAL_STEP);
    updateGoalDisplay();
  }

  function showWinScreen() {
    gameActive = false;

    emit('game:session-complete', {
      mode: gameMode,
      score,
      stats: sessionStats,
      settings: {
        mode: gameMode,
        speed: baseSpeedSetting,
        introductions: introductionsEnabled,
        randomLetters: isRandomLettersModeActive(),
        clickMode: clickModeEnabled,
        slowRiver: slowRiverEnabled,
        fontShuffle: fontShuffleEnabled
      },
      languageId: activeLanguage.id
    });

    modal.classList.remove('hidden');
    setupView.classList.add('hidden');
    gameOverView.classList.add('hidden');
    winView.classList.remove('hidden');
    accessibilityBtn?.classList.add('hidden');

    if (winGoalDisplay) winGoalDisplay.textContent = goalValue;
    if (totalWinsDisplay) totalWinsDisplay.textContent = totalWins;
    if (sessionCorrectDisplay) sessionCorrectDisplay.textContent = totalCatchStreak;
  }

  function continueAfterWin() {
    waveCorrectCount = 0;
    winView.classList.add('hidden');
    modal.classList.add('hidden');
    gameActive = true;
    // Clear current round and start a new wave
    if (currentRound && currentRound.timers) {
      currentRound.timers.forEach((timer) => clearTrackedTimeout(timer.handle || timer));
    }
    activeItems.forEach((item) => item.element.remove());
    activeItems.clear();
    spawnNextRound();
  }

  function exitFromWin() {
    // For vocab mode, skip setup screen and go directly back to module card
    if (isVocabMode) {
      onReturnToMenu?.();
    } else {
      resetToSetupScreen();
      onReturnToMenu?.();
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // ignore registration failures during development
      });
    });
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBtn.disabled = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
    installBtn.disabled = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installBtn?.classList.add('hidden');
  });

  let dropZones = [];
  let activeBucketCount = 0;
  let maxBucketCount = 4; // Track maximum buckets reached in current session
  const BUCKET_MIN_WIDTH_FALLBACK = 80;
  const LAYOUT_GAP_FALLBACK = 8;
  const BUCKET_BASE_HEIGHT = 50; // Base height when containers are full size
  const BUCKET_MIN_HEIGHT = 44; // Minimum height for touch accessibility
  let pendingBucketLayoutHandle = null;
  let pendingBucketLayoutIsAnimationFrame = false;
  let isApplyingBucketLayout = false;
  let rerunBucketLayout = false;
  let bucketResizeObserver = null;
  let bucketResizeHandler = null;
  let playAreaResizeObserver = null;
  let playAreaResizeHandler = null;
  let bucketMeasurementElement = null;
  let cachedBucketMinWidth = null;
  let activeDrag = null;
  let dragGhost = null;
  let hoverZone = null;
  let gameMode = practiceModes[0]?.id ?? 'letters';
  let isRestartMode = false;
  let visualViewportResizeHandler = null;

  function ensureDragGhost() {
    if (dragGhost) return dragGhost;
    dragGhost = document.createElement('div');
    dragGhost.id = 'drag-ghost';
    document.body.appendChild(dragGhost);
    return dragGhost;
  }

  function ensureBucketMeasurementElement() {
    if (bucketMeasurementElement && bucketMeasurementElement.isConnected) {
      return bucketMeasurementElement;
    }
    if (typeof document === 'undefined' || !document.body) return null;
    bucketMeasurementElement = document.createElement('div');
    bucketMeasurementElement.style.position = 'absolute';
    bucketMeasurementElement.style.visibility = 'hidden';
    bucketMeasurementElement.style.pointerEvents = 'none';
    bucketMeasurementElement.style.left = '-9999px';
    bucketMeasurementElement.style.top = '0';
    bucketMeasurementElement.style.boxSizing = 'border-box';
    document.body.appendChild(bucketMeasurementElement);
    return bucketMeasurementElement;
  }

  function updateRiverWidth() {
    if (!playArea) return;
    const width = playArea.offsetWidth;
    if (!Number.isFinite(width)) return;
    playArea.style.setProperty('--river-width', `${width}px`);
  }

  function measureBucketMinWidth() {
    if (!choicesContainer || typeof window === 'undefined') {
      return BUCKET_MIN_WIDTH_FALLBACK;
    }
    const buckets = choicesContainer.querySelectorAll('.catcher-box');
    if (!buckets.length) return BUCKET_MIN_WIDTH_FALLBACK;
    const measurementElement = ensureBucketMeasurementElement();
    if (!measurementElement) return BUCKET_MIN_WIDTH_FALLBACK;
    const containerWidth = choicesContainer.clientWidth;
    if (Number.isFinite(containerWidth) && containerWidth > 0) {
      measurementElement.style.width = `${containerWidth}px`;
      measurementElement.style.maxWidth = `${containerWidth}px`;
    } else {
      measurementElement.style.width = '';
      measurementElement.style.maxWidth = '';
    }
    measurementElement.style.whiteSpace = 'normal';
    let maxWidth = 0;
    buckets.forEach((bucket) => {
      measurementElement.className = bucket.className;
      const bucketStyle = window.getComputedStyle?.(bucket);
      measurementElement.style.padding = bucketStyle?.padding ?? '';
      measurementElement.style.border = bucketStyle?.border ?? '';
      measurementElement.style.boxSizing = bucketStyle?.boxSizing ?? 'border-box';
      measurementElement.innerHTML = bucket.innerHTML;
      const ariaLabel = bucket.getAttribute('aria-label');
      if (ariaLabel) measurementElement.setAttribute('aria-label', ariaLabel);
      else measurementElement.removeAttribute('aria-label');
      const rect = measurementElement.getBoundingClientRect();
      if (rect.width > maxWidth) maxWidth = rect.width;
    });
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
      return BUCKET_MIN_WIDTH_FALLBACK;
    }
    return Math.ceil(maxWidth);
  }

  function getBucketMinWidth() {
    if (cachedBucketMinWidth !== null) {
      return cachedBucketMinWidth;
    }
    cachedBucketMinWidth = measureBucketMinWidth();
    return cachedBucketMinWidth;
  }

  function invalidateBucketMinWidth() {
    cachedBucketMinWidth = null;
  }

  function refreshDropZones() {
    dropZones = Array.from(document.querySelectorAll('.catcher-box'));
    if (clickModeEnabled) {
      setupClickModeBuckets();
    }
  }

  function measureBucketTextWidth() {
    if (!choicesContainer || typeof window === 'undefined') {
      return 0;
    }
    const buckets = choicesContainer.querySelectorAll('.catcher-box');
    if (!buckets.length) return 0;
    const measurementElement = ensureBucketMeasurementElement();
    if (!measurementElement) return 0;

    measurementElement.style.width = 'max-content';
    measurementElement.style.maxWidth = '';
    measurementElement.style.whiteSpace = 'nowrap';
    let maxWidth = 0;
    buckets.forEach((bucket) => {
      measurementElement.className = bucket.className;
      measurementElement.textContent = bucket.textContent ?? '';
      measurementElement.style.padding = '0';
      measurementElement.style.border = '0';
      const rect = measurementElement.getBoundingClientRect();
      measurementElement.style.padding = '';
      measurementElement.style.border = '';
      if (rect.width > maxWidth) maxWidth = rect.width;
    });

    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
      return 0;
    }

    return Math.ceil(maxWidth);
  }

  function clearPendingBucketLayout() {
    if (pendingBucketLayoutHandle === null) return;
    if (pendingBucketLayoutIsAnimationFrame) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(pendingBucketLayoutHandle);
      }
    } else if (typeof window !== 'undefined') {
      window.clearTimeout?.(pendingBucketLayoutHandle);
    }
    pendingBucketLayoutHandle = null;
  }

  function scheduleBucketLayoutUpdate() {
    if (!choicesContainer) return;
    if (isApplyingBucketLayout) {
      rerunBucketLayout = true;
      return;
    }
    clearPendingBucketLayout();
    const runUpdate = () => {
      pendingBucketLayoutHandle = null;
      isApplyingBucketLayout = true;
      try {
        invalidateBucketMinWidth();
        applyBucketLayout();
        if (activeBucketCount > 0) {
          refreshDropZones();
        }
      } finally {
        isApplyingBucketLayout = false;
        if (rerunBucketLayout) {
          rerunBucketLayout = false;
          scheduleBucketLayoutUpdate();
        }
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      pendingBucketLayoutIsAnimationFrame = true;
      pendingBucketLayoutHandle = window.requestAnimationFrame(runUpdate);
    } else if (typeof window !== 'undefined') {
      pendingBucketLayoutIsAnimationFrame = false;
      pendingBucketLayoutHandle = window.setTimeout(runUpdate, 50);
    }
  }

  function applyBucketLayout(count = activeBucketCount) {
    if (!choicesContainer) return;
    if (!count) {
      choicesContainer.style.removeProperty('grid-template-columns');
      return;
    }
    
  function markFirstRowBuckets() {
    if (!choicesContainer) return;
    const buckets = choicesContainer.querySelectorAll('.catcher-box');
    if (!buckets.length) return;
    const firstTop = buckets[0].offsetTop;
    buckets.forEach(bucket => {
      bucket.classList.toggle('first-row', bucket.offsetTop === firstTop);
    });
  }

    if (typeof window === 'undefined') return;
    const buckets = choicesContainer.querySelectorAll('.catcher-box');
    if (!buckets.length) return;
    const containerWidth = choicesContainer.clientWidth;
    if (containerWidth <= 0) return;
    const minBucketWidth = getBucketMinWidth();
    const minBucketTextWidth = measureBucketTextWidth();
    const bucketStyle = window.getComputedStyle?.(buckets[0]);
    const horizontalPadding =
      (parseFloat(bucketStyle?.paddingLeft) || 0) + (parseFloat(bucketStyle?.paddingRight) || 0);
    const measuredReadableWidth = minBucketTextWidth + horizontalPadding;
    const minReadableWidth = measuredReadableWidth > 0
      ? Math.ceil(measuredReadableWidth)
      : BUCKET_MIN_WIDTH_FALLBACK;
    const computed = window.getComputedStyle?.(choicesContainer);
    const gapValueRaw = computed?.columnGap || computed?.gap || `${LAYOUT_GAP_FALLBACK}px`;
    const gapValue = parseFloat(gapValueRaw) || LAYOUT_GAP_FALLBACK;
    const totalGap = gapValue * Math.max(count - 1, 0);
    const paddingLeft = parseFloat(computed?.paddingLeft) || 0;
    const paddingRight = parseFloat(computed?.paddingRight) || 0;
    const contentWidth = containerWidth - paddingLeft - paddingRight;
    const availableWidth = contentWidth - totalGap;
    const targetWidth = availableWidth / count;

    const applyDynamicHeight = (currentWidth) => {
      const measuredWidth = buckets[0]?.getBoundingClientRect?.().width;
      const widthToUse = Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : currentWidth;
      buckets.forEach(bucket => {
        bucket.style.height = `${widthToUse}px`;
      });
    };
    
    // For 4 or fewer buckets, force single row by using 1fr columns (no minmax = no wrapping)
    // For 5+ buckets, use minmax to allow wrapping
    if (count <= 4) {
      if (availableWidth / count >= minBucketWidth) {
        choicesContainer.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
        applyDynamicHeight(targetWidth);
        return;
      }
      // If they don't fit comfortably, still force single row but let them shrink
      const minWidth = Math.max(50, Math.floor(availableWidth / count));
      choicesContainer.style.gridTemplateColumns = `repeat(${count}, ${minWidth}px)`;
      applyDynamicHeight(minWidth);
      return;
    }

    // For 5+ buckets, use original logic with minmax to allow wrapping
    if (availableWidth / count >= minBucketWidth) {
      choicesContainer.style.gridTemplateColumns = `repeat(auto-fit, minmax(${minBucketWidth}px, 1fr))`;
      applyDynamicHeight(minBucketWidth);
      return;
    }
    if (targetWidth >= minReadableWidth) {
      const minWidth = Math.max(minReadableWidth, targetWidth);
      choicesContainer.style.gridTemplateColumns = `repeat(${count}, minmax(${minWidth}px, 1fr))`;
      applyDynamicHeight(minWidth);
      return;
    }
    const numerator = containerWidth + gapValue;
    const maxReadableColumns = Math.max(
      1,
      Math.min(count, Math.floor(numerator / (minReadableWidth + gapValue)))
    );
    const maxCompactColumns = Math.max(
      1,
      Math.min(count, Math.floor(numerator / (minBucketWidth + gapValue)))
    );

    if (count >= 4 && maxCompactColumns >= 4 && maxReadableColumns < 4) {
      const compactColumns = Math.min(count, Math.max(4, maxCompactColumns));
      const compactWidth = Math.max(
        minBucketWidth,
        Math.min(minReadableWidth, Math.floor(availableWidth / compactColumns))
      );
      choicesContainer.style.gridTemplateColumns = `repeat(${compactColumns}, minmax(${compactWidth}px, 1fr))`;
      applyDynamicHeight(compactWidth);
      return;
    }

    choicesContainer.style.gridTemplateColumns = `repeat(${maxReadableColumns}, minmax(${minReadableWidth}px, 1fr))`;
    applyDynamicHeight(minReadableWidth);
  }

  if (playArea) {
    updateRiverWidth();

    if (typeof ResizeObserver !== 'undefined') {
      playAreaResizeObserver?.disconnect();
      playAreaResizeObserver = new ResizeObserver(() => updateRiverWidth());
      playAreaResizeObserver.observe(playArea);
    }

    if (typeof window !== 'undefined') {
      if (playAreaResizeHandler) {
        window.removeEventListener('resize', playAreaResizeHandler);
      }
      playAreaResizeHandler = () => updateRiverWidth();
      window.addEventListener('resize', playAreaResizeHandler);
    }
  }

  if (choicesContainer) {
    if (typeof ResizeObserver !== 'undefined') {
      bucketResizeObserver?.disconnect();
      bucketResizeObserver = new ResizeObserver(() => scheduleBucketLayoutUpdate());
      bucketResizeObserver.observe(choicesContainer);
    }
    if (typeof window !== 'undefined') {
      if (bucketResizeHandler) {
        window.removeEventListener('resize', bucketResizeHandler);
      }
      bucketResizeHandler = () => scheduleBucketLayoutUpdate();
      window.addEventListener('resize', bucketResizeHandler);

      const viewport = window.visualViewport;
      if (viewport) {
        if (visualViewportResizeHandler) {
          viewport.removeEventListener('resize', visualViewportResizeHandler);
        }
        visualViewportResizeHandler = () => scheduleBucketLayoutUpdate();
        viewport.addEventListener('resize', visualViewportResizeHandler);
      }
    }
  }

  function getDisplaySymbol(item = {}) {
    return item.symbol ?? item.transliteration ?? item.name ?? item.sound ?? '';
  }

  function getDisplayLabel(item = {}) {
    return item.sound ?? item.pronunciation ?? item.name ?? item.transliteration ?? '';
  }

  function getDisplayPronunciation(item = {}) {
    return item.pronunciation ?? item.sound ?? '';
  }

  function getCharacterAriaLabel(item = {}) {
    const symbol = getDisplaySymbol(item);
    if (!symbol) return '';
    const pronunciation = getDisplayPronunciation(item);
    if (pronunciation) {
      return t('game.summary.characterLabelWithPronunciation', {
        symbol,
        pronunciation
      });
    }
    return t('game.summary.characterLabel', { symbol });
  }

  function zoneAt(x, y) {
    for (let i = 0; i < dropZones.length; i++) {
      const el = dropZones[i];
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el;
    }
    return null;
  }

function startClickMode(itemEl, payload) {
  const glyphEl = itemEl.querySelector('.letter-symbol') || itemEl;

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // If this letter is already selected, deselect it
    if (selectedLetter && selectedLetter.element === glyphEl) {
      selectedLetter.element.classList.remove('click-selected');
      selectedLetter.element.style.animationPlayState = 'running';
      selectedLetter = null;
      return;
    }

    // Deselect previous letter if any
    if (selectedLetter) {
      selectedLetter.element.classList.remove('click-selected');
      selectedLetter.element.style.animationPlayState = 'running';
    }

    // Select this letter (glyph only)
    selectedLetter = { element: glyphEl, payload };
    glyphEl.classList.add('click-selected');
    itemEl.style.animationPlayState = 'paused';
  }

  itemEl.addEventListener('click', onClick);
}

  function setupClickModeBuckets() {
    const buckets = dropZones.filter((el) => el && el.classList && el.classList.contains('catcher-box'));
    buckets.forEach((bucket) => {
      // Remove existing click handlers
      const oldHandler = bucket._clickHandler;
      if (oldHandler) {
        bucket.removeEventListener('click', oldHandler);
      }

      // Add new click handler
      const clickHandler = (e) => {
        // If no letter is selected, show bucket info instead
        if (!selectedLetter) {
          if (bucket._choiceData) {
            e.preventDefault();
            e.stopPropagation();
            showBucketInfo(bucket._choiceData);
          }
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Drop the selected letter into this bucket
        programmaticDrop(bucket, selectedLetter.payload);

        // Deselect the letter
        selectedLetter.element.classList.remove('click-selected');
        selectedLetter = null;
      };

      bucket._clickHandler = clickHandler;
      bucket.addEventListener('click', clickHandler);
    });
  }

  function startPointerDrag(itemEl, payload) {
    function onDown(e) {
      if (clickModeEnabled) {
        return;
      }

      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      itemEl.setPointerCapture?.(e.pointerId);

      itemEl.style.animationPlayState = 'paused';
      itemEl.classList.add('dragging');

      activeDrag = { el: itemEl, data: payload };

      const ghost = ensureDragGhost();
      ghost.textContent = itemEl.textContent;
      // Extract the actual font class from the dragged element to preserve font shuffle
      const fontStyleClass = Array.from(itemEl.classList).find(cls => cls.startsWith('game-font-')) || '';
      ghost.className = itemEl.classList.contains('falling-gem') ? 'text-5xl' : `${fontClass} ${fontStyleClass} text-6xl`;
      ghost.style.opacity = '0.95';

      itemEl.style.visibility = 'hidden';
      onMove(e);
    }

    function onMove(e) {
      if (!activeDrag) return;
      const x = e.clientX;
      const y = e.clientY;
      const ghost = ensureDragGhost();
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';

      const z = zoneAt(x, y);
      if (z !== hoverZone) {
        hoverZone?.classList.remove('drag-over');
        z?.classList.add('drag-over');
        hoverZone = z;
      }
    }

    function onUp(e) {
      if (!activeDrag) return;
      itemEl.releasePointerCapture?.(e.pointerId);

      const x = e.clientX;
      const y = e.clientY;
      const target = zoneAt(x, y);
      hoverZone?.classList.remove('drag-over');
      hoverZone = null;

      itemEl.classList.remove('dragging');
      itemEl.style.visibility = '';
      itemEl.style.animationPlayState = 'running';
      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }

      if (target) programmaticDrop(target, activeDrag.data);
      activeDrag = null;
    }

    itemEl.addEventListener('pointerdown', onDown);
    itemEl.addEventListener('pointermove', onMove);
    itemEl.addEventListener('pointerup', onUp);
    itemEl.addEventListener('pointercancel', onUp);
    itemEl.addEventListener('lostpointercapture', onUp);
  }

  function programmaticDrop(targetBox, payload) {
    handleProgrammaticDrop({ preventDefault: () => {}, currentTarget: targetBox }, payload);
  }

  function handleProgrammaticDrop(e, payload) {
    const targetBox = e.currentTarget;
    targetBox.classList.remove('drag-over');

    const { id: droppedId, roundId, itemId: droppedItemId, symbol: droppedSymbol, sound: droppedSound } = payload;
    if (!gameActive || !activeItems.has(droppedId)) return;

    const targetSound = targetBox.dataset.sound;
    const item = activeItems.get(droppedId);

    item.element.isDropped = true;
    if (droppedItemId && !sessionStats[droppedItemId]) {
      sessionStats[droppedItemId] = { correct: 0, incorrect: 0 };
    }

    // Match by sound - allows multiple letters with same sound to share a bucket
    const isCorrect = targetSound === droppedSound;

    if (isCorrect) {
      updateScore(10);
      targetBox.classList.add('feedback-correct');
      if (droppedItemId) {
        sessionStats[droppedItemId].correct++;
        waveCorrectCount++;
        currentCatchStreak++;
        if (waveCorrectCount > bestWaveCatch) {
          bestWaveCatch = waveCorrectCount;
          updateWaveStat(true);
        }
        const improvedStreak = currentCatchStreak > totalCatchStreak;
        totalCatchStreak = Math.max(totalCatchStreak, currentCatchStreak);
        if (improvedStreak) {
          updateStreakStat(true);
        }
        // Track vocab item catches for perfect round detection
        if (isVocabMode && droppedItemId) {
          vocabCaughtInRound.add(droppedItemId);
        }
      }
      // Hide the letter immediately after correct drop
      item.element.style.display = 'none';
    } else {
      lives--;
      updateLives(true);
      targetBox.classList.add('feedback-incorrect');
      if (droppedItemId) {
        sessionStats[droppedItemId].incorrect++;
        waveCorrectCount = 0;
        currentCatchStreak = 0;
      }

      // Find the correct bucket to show its sound/label
      const correctBucket = choicesContainer.querySelector(`[data-sound="${droppedSound}"]`);
      const correctLabel = correctBucket ? correctBucket.textContent : (droppedSound || getDisplayLabel(item.data) || getDisplaySymbol(item.data));
      const boxRect = targetBox.getBoundingClientRect();
      const gameRect = gameContainer.getBoundingClientRect();
      ghostEl.textContent = correctLabel;

      ghostEl.style.display = 'block';
      const ghostWidth = ghostEl.offsetWidth;
      ghostEl.style.display = '';
      ghostEl.style.left = `${boxRect.left - gameRect.left + boxRect.width / 2 - ghostWidth / 2}px`;
      ghostEl.style.top = `${boxRect.top - gameRect.top}px`;
      ghostEl.classList.add('ghost-rise');
      trackTimeout(() => ghostEl.classList.remove('ghost-rise'), 2000);
      // Hide the letter immediately after incorrect drop too
      item.element.style.display = 'none';
    }

    emit('game:letter-result', {
      itemId: droppedItemId,
      symbol: droppedSymbol,
      sound: item.data.sound,
      correct: isCorrect,
      mode: gameMode,
      roundId,
      languageId: activeLanguage.id
    });

    item.element.removeEventListener('animationend', item.missHandler);
    trackTimeout(() => {
      targetBox.classList.remove('feedback-correct', 'feedback-incorrect');
      onItemHandled(droppedId, roundId, false);
    }, 400);
  }

  let score;
  let lives;
  let level;
  let scoreForNextLevel;
  let gameActive;
  let fallDuration;
  let baseSpeedSetting;
  let introductionsEnabled;
  let activeItems = new Map();
  let seenItems;
  let learningOrder = [];
  let lastItemSound;
  let currentRound;
  let sessionStats;
  let forcedStartItem = null;
  let hasIntroducedForItemInLevel;
  let randomLettersEnabled = randomLettersToggle?.checked ?? false;
  let slowRiverEnabled = false;
  let clickModeEnabled = false;
  let associationModeEnabled = false;
  let selectedFont = 'default';
  let fontShuffleEnabled = false;
  let lastUsedFont = null; // Track last used font to prevent consecutive repeats
  let recentSpawnPositions = []; // Track recent spawn positions to prevent clumping
  let selectedLetter = null; // For click mode
  let goalValue = 10;
  let hasReachedGoal = false; // Track if goal level was reached
  let waveCorrectCount = 0;
  let totalCatchStreak = 0;
  let currentCatchStreak = 0;
  let bestWaveCatch = 0;
  let totalWins = 0;
  const initialLives = 3;
  const learnPhaseDuration = 2500;
  const levelUpThreshold = 50;
  const GOAL_MIN = 5;
  const GOAL_MAX = 25;
  const GOAL_STEP = 1;

  function clonePool(items = []) {
    return items.map((item) => ({ ...item }));
  }

  function getModePool(modeId) {
    if (modeItems[modeId]?.length) return clonePool(modeItems[modeId]);
    if (modeItems.letters?.length) return clonePool(modeItems.letters);
    return clonePool(baseItems);
  }

  function getCombinedModePool(modeIds) {
    const combined = [];
    const seen = new Set();

    modeIds.forEach((modeId) => {
      const pool = getModePool(modeId);
      pool.forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          const itemCopy = { ...item };
          // Track which mode this item belongs to for even distribution
          itemCopy.sourceMode = modeId;
          combined.push(itemCopy);
        }
      });
    });

    return combined;
  }

  // Get items with even distribution across selected modes
  function getEvenlyDistributedItems(itemPool, count, seenItems) {
    if (selectedModeIds.size === 0) return [];

    // Group items by source mode
    const itemsByMode = {};
    selectedModeIds.forEach((modeId) => {
      itemsByMode[modeId] = itemPool.filter((item) => item.sourceMode === modeId);
    });

    const result = [];
    const modesArray = Array.from(selectedModeIds);
    let modeIndex = 0;
    let attempts = 0;
    const maxAttempts = count * modesArray.length * 3; // Prevent infinite loop

    while (result.length < count && attempts < maxAttempts) {
      attempts++;
      const currentMode = modesArray[modeIndex];
      const modePool = itemsByMode[currentMode];

      if (modePool && modePool.length > 0) {
        // Try to find an item from this mode that hasn't been used yet
        const availableItems = modePool.filter((item) =>
          !result.some((r) => r.id === item.id)
        );

        if (availableItems.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableItems.length);
          result.push(availableItems[randomIndex]);
        }
      }

      // Move to next mode
      modeIndex = (modeIndex + 1) % modesArray.length;
    }

    return result;
  }

  function resolveItemById(itemId) {
    return itemsById[itemId] ?? null;
  }

  function resolveItemBySymbol(symbol) {
    return itemsBySymbol[symbol] ?? null;
  }

  function resetToSetupScreen() {
    gameActive = false;
    if (currentRound && currentRound.timers) {
      currentRound.timers.forEach((timer) => clearTrackedTimeout(timer.handle || timer));
    }
    currentRound = null;
    clearAllTimers();

    activeItems.forEach((item) => item.element.remove());
    activeItems.clear();
    choicesContainer.innerHTML = '';
    activeBucketCount = 0;
    maxBucketCount = 4; // Reset to default on game reset
    applyBucketLayout(0);
    invalidateBucketMinWidth();
    refreshDropZones();
    clearPendingBucketLayout();
    learnOverlay.classList.remove('visible');
    hideBucketInfo();
    ghostEl.classList.remove('ghost-rise');
    summaryTooltip.classList.add('hidden');
    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
    }
    hoverZone?.classList.remove('drag-over');
    hoverZone = null;
    activeDrag = null;

    score = 0;
    lives = initialLives;
    level = 1;
    scoreForNextLevel = levelUpThreshold;
    baseSpeedSetting = parseInt(gameSpeedSlider.value, 10);
    fallDuration = baseSpeedSetting;
    seenItems = new Set();
    learningOrder = [];
    lastItemSound = null;
    recentSpawnPositions = []; // Clear spawn position tracking
    sessionStats = {};
    hasIntroducedForItemInLevel = false;
    randomLettersEnabled = randomLettersToggle?.checked ?? false;
    hasReachedGoal = false;
    waveCorrectCount = 0;
    totalCatchStreak = 0;
    currentCatchStreak = 0;
    bestWaveCatch = 0;

    updateScore(0, true);
    updateLives();
    updateLevelDisplay();
    updateGoalDisplay();
    updateWaveStat();
    updateStreakStat();

    startButton.textContent = t('game.controls.start');
    isRestartMode = false;
    renderPracticeModes();
    setupView.classList.remove('hidden');
    gameOverView.classList.add('hidden');
    winView?.classList.add('hidden');
    accessibilityView.classList.add('hidden');
    setupExitButton?.classList.remove('hidden');
    accessibilityBtn?.classList.remove('hidden');
    modal.classList.remove('hidden');

    // Hide modal internal backdrop so mode select appears directly over current page
    modal.style.background = 'transparent';

    // Hide game container background and children so only the mode select modal is visible
    gameContainer.style.background = 'transparent';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = 'none';
    if (playArea) playArea.style.display = 'none';
    if (choicesContainer) choicesContainer.style.display = 'none';

    // Hide the GameContext wrapper's background (the beige container)
    const gameView = document.getElementById('game-view');
    if (gameView?.parentElement) {
      gameView.parentElement.style.background = 'transparent';
      gameView.parentElement.style.border = 'none';
      gameView.parentElement.style.boxShadow = 'none';

      // Keep the backdrop visible but make it more subtle - allows clicking outside to close
      const scrollContainer = gameView.parentElement.parentElement?.parentElement;
      const backdrop = scrollContainer?.previousElementSibling;
      if (backdrop?.classList.contains('backdrop-blur')) {
        backdrop.style.background = 'rgba(74, 34, 8, 0.5)';
        backdrop.style.backdropFilter = 'blur(2px)';
      }
    }

    refreshDropZones();

    if (onGameReset) onGameReset();
  }

  function startGame() {
    // Clear any pending timers from previous game instances
    clearAllTimers();

    score = 0;
    lives = initialLives;
    level = 1;
    waveCorrectCount = 0;
    totalCatchStreak = 0;
    currentCatchStreak = 0;
    bestWaveCatch = 0;
    scoreForNextLevel = levelUpThreshold;
    baseSpeedSetting = parseInt(document.getElementById('game-speed-slider').value, 10);
    fallDuration = baseSpeedSetting;
    gameActive = true;
    seenItems = new Set();
    lastItemSound = null;
    currentRound = null;
    sessionStats = {};
    hasIntroducedForItemInLevel = false;
    randomLettersEnabled = randomLettersToggle?.checked ?? false;
    hasReachedGoal = false;
    slowRiverEnabled = slowRiverToggle?.checked ?? false;
    clickModeEnabled = clickModeToggle?.checked ?? false;
    selectedFont = gameFontSelect?.value ?? 'default';
    fontShuffleEnabled = fontShuffleToggle?.checked ?? false;
    lastUsedFont = null; // Reset last used font for new game
    selectedLetter = null;
    waveCorrectCount = 0;
    forcedStartItem = null; // Clear any forced start item
    recentSpawnPositions = []; // Clear spawn position tracking

    // Reset vocab mode tracking
    vocabCaughtInRound.clear();
    hadPerfectRound = false;

    // Clear any active items from previous sessions
    activeItems.forEach((item) => item.element.remove());
    activeItems.clear();

    // Get combined pool from all selected modes
    introductionsEnabled = document.getElementById('toggle-introductions').checked;

    const gameItemPool = getCombinedModePool(selectedModeIds);
    // Store first selected mode as gameMode for compatibility
    gameMode = Array.from(selectedModeIds)[0] ?? practiceModes[0]?.id ?? 'letters';

    learningOrder = gameItemPool.filter((item) => !seenItems.has(item.id));
    for (let i = learningOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [learningOrder[i], learningOrder[j]] = [learningOrder[j], learningOrder[i]];
    }

    updateScore(0, true);
    updateLives();
    updateLevelDisplay();
    updateWaveStat();
    updateStreakStat();

    // Show game container and play area elements now that the game is starting
    gameContainer.style.background = 'linear-gradient(180deg, #fff9eb 0%, #ffe5bd 100%)';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = '';
    if (playArea) playArea.style.display = '';
    if (choicesContainer) choicesContainer.style.display = '';

    // Restore modal internal backdrop for game-over/win screens
    modal.style.background = 'rgba(74, 34, 8, 0.8)';

    // Restore the GameContext wrapper's background (the beige container)
    const gameView = document.getElementById('game-view');
    if (gameView?.parentElement) {
      gameView.parentElement.style.background = 'linear-gradient(180deg, #fffaf0 0%, #ffe9c9 45%, #ffe2b8 100%)';
      gameView.parentElement.style.border = '2px solid #e49b5a';
      gameView.parentElement.style.boxShadow = '';

      // Restore the dark backdrop overlay
      const scrollContainer = gameView.parentElement.parentElement?.parentElement;
      const backdrop = scrollContainer?.previousElementSibling;
      if (backdrop?.classList.contains('backdrop-blur')) {
        backdrop.style.display = '';
        backdrop.style.background = '';
        backdrop.style.backdropFilter = '';
      }
    }

    setupExitButton?.classList.add('hidden');
    modal.classList.add('hidden');
    accessibilityView?.classList.add('hidden');
    learnOverlay.classList.remove('visible');
    hideBucketInfo();

    activeItems.forEach((item) => item.element.remove());
    activeItems.clear();

    if (onGameStart) onGameStart();

    spawnNextRound();

    // Extra layout update after initial game start to ensure proper bucket alignment
    // The container was just made visible, so dimensions may need extra time to stabilize
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        scheduleBucketLayoutUpdate();
      }, 200);
    }

    emit('game:session-start', {
      mode: gameMode,
      settings: {
        mode: gameMode,
        speed: baseSpeedSetting,
        introductions: introductionsEnabled,
        randomLetters: isRandomLettersModeActive(),
        clickMode: clickModeEnabled,
        slowRiver: slowRiverEnabled,
        fontShuffle: fontShuffleEnabled
      },
      languageId: activeLanguage.id
    });
  }

  function endGame() {
    gameActive = false;
    if (currentRound && currentRound.timers) currentRound.timers.forEach((timer) => clearTrackedTimeout(timer.handle || timer));
    currentRound = null;
    activeItems.forEach((item) => item.element.remove());
    activeItems.clear();
    clearAllTimers();

    emit('game:session-complete', {
      mode: gameMode,
      score,
      stats: sessionStats,
      settings: {
        mode: gameMode,
        speed: baseSpeedSetting,
        introductions: introductionsEnabled,
        randomLetters: isRandomLettersModeActive(),
        clickMode: clickModeEnabled,
        slowRiver: slowRiverEnabled,
        fontShuffle: fontShuffleEnabled
      },
      languageId: activeLanguage.id
    });

    displayLearningSummary();
    setupView.classList.add('hidden');
    gameOverView.classList.remove('hidden');
    startButton.textContent = t('game.controls.playAgain');
    isRestartMode = true;
    setupExitButton?.classList.add('hidden');
    accessibilityBtn?.classList.add('hidden');
    modal.classList.remove('hidden');
  }

  function displayLearningSummary() {
    const headingEl = document.getElementById('game-over-heading');
    if (headingEl) {
      headingEl.textContent = t('game.summary.gameOver');
    }

    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) {
      finalScoreEl.textContent = t('game.summary.finalScore', { score });
    }

    const summaryContainer = gameOverView.querySelector('.learning-summary-container');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = '';

    const seenInSession = Object.keys(sessionStats);
    if (seenInSession.length === 0) {
      summaryContainer.innerHTML = `<p class="text-arcade-text-soft">${t('game.summary.empty')}</p>`;
      return;
    }

    const encounteredContainer = document.createElement('div');
    encounteredContainer.className = 'flex flex-wrap gap-2 justify-center mb-6';

    seenInSession.forEach((key) => {
      const itemData = resolveItemById(key);
      if (!itemData) return;
      const span = document.createElement('span');
      span.className = `${fontClass} text-3xl p-2 bg-gradient-to-b from-arcade-panel-light to-arcade-panel-medium border-2 border-arcade-panel-border rounded-md cursor-pointer shadow-arcade-sm`;
      span.textContent = itemData.symbol ?? '';

      span.addEventListener('mouseenter', (event) => {
        const transliteration = itemData.transliteration ?? itemData.name ?? '';
        const pronunciation = itemData.pronunciation ?? itemData.sound ?? '';
        summaryTooltip.innerHTML = `
          <div class="font-bold">${transliteration}</div>
          <div>${t('game.summary.soundLabel', { sound: pronunciation })}</div>
        `;
        const targetRect = event.target.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        summaryTooltip.style.left = `${targetRect.left - containerRect.left + targetRect.width / 2 - summaryTooltip.offsetWidth / 2}px`;
        summaryTooltip.style.top = `${targetRect.top - containerRect.top - summaryTooltip.offsetHeight - 8}px`;
        summaryTooltip.classList.remove('hidden');
      });
      span.addEventListener('mouseleave', () => summaryTooltip.classList.add('hidden'));
      encounteredContainer.appendChild(span);
    });

    const encounteredTitle = document.createElement('h3');
    encounteredTitle.className = 'text-xl font-bold text-arcade-accent-orange mb-2';
    encounteredTitle.textContent = t('game.summary.heading');
    summaryContainer.appendChild(encounteredTitle);
    summaryContainer.appendChild(encounteredContainer);

    let weakestLink = null;
    let maxIncorrect = 0;
    for (const key in sessionStats) {
      if (sessionStats[key].incorrect > maxIncorrect) {
        maxIncorrect = sessionStats[key].incorrect;
        weakestLink = key;
      }
    }

    if (weakestLink && maxIncorrect > 0) {
      const weakestLinkItem = resolveItemById(weakestLink);
      if (weakestLinkItem) {
        const weakestLinkContainer = document.createElement('div');
        weakestLinkContainer.innerHTML = `
            <h3 class="text-xl font-bold text-arcade-accent-orange mb-2">${t('game.summary.weakestLink')}</h3>
            <p class="mb-3 text-sm text-arcade-text-soft">${t('game.summary.weakestLinkDescription')}</p>
            <div class="flex items-center justify-center gap-4">
              <span class="${fontClass} text-5xl">${weakestLinkItem.symbol ?? ''}</span>
              <button id="practice-weakest-btn" class="bg-gradient-to-b from-arcade-accent-gold to-arcade-accent-orange hover:shadow-arcade-md text-arcade-text-main font-bold py-2 px-4 rounded-lg shadow-arcade-sm border-2 border-arcade-accent-orange">${t('game.summary.practice')}</button>
            </div>`;
        summaryContainer.appendChild(weakestLinkContainer);
        document.getElementById('practice-weakest-btn').addEventListener('click', () => {
          forcedStartItem = { ...weakestLinkItem };
          startGame();
        });
      }
    }
  }

  function updateScore(points = 0, reset = false) {
    if (reset) score = 0;
    else score += points;
    scoreEl.textContent = score;
    if (points > 0) {
      scoreEl.classList.add('score-pop');
      trackTimeout(() => scoreEl.classList.remove('score-pop'), 300);
    }
    if (score >= scoreForNextLevel) levelUp();
  }

  function levelUp() {
    level++;
    hasIntroducedForItemInLevel = false;
    scoreForNextLevel += levelUpThreshold;
    if (fallDuration > 7) fallDuration -= 1;

    // Check if player has reached the goal level
    const winThreshold = goalValue + 1;

    // For vocab mode: win after completing a level following a perfect round
    if (isVocabMode && hadPerfectRound) {
      totalWins++;
      hasReachedGoal = true;
      // Don't show win screen yet - wait for all items to be cleared
    } else if (!isVocabMode && level >= winThreshold) {
      totalWins++;
      hasReachedGoal = true;
      // Don't show win screen yet - wait for all letters to be cleared
      // Win screen will be triggered in onItemHandled when activeItems.size === 0
    }

    // Check for perfect round in vocab mode
    if (isVocabMode && vocabCaughtInRound.size === totalVocabCount) {
      hadPerfectRound = true;
    }
    // Reset vocab tracking for next round
    if (isVocabMode) {
      vocabCaughtInRound.clear();
    }

    const levelUpText = t('game.status.levelUp');

    const levelLabel = levelEl.previousElementSibling;
    levelLabel.classList.add('hidden');
    levelEl.textContent = levelUpText;
    levelEl.classList.add('flash-level-up', 'text-3xl');
    levelEl.classList.remove('text-2xl');
    trackTimeout(() => {
      levelLabel.classList.remove('hidden');
      levelEl.classList.remove('flash-level-up', 'text-3xl');
      levelEl.classList.add('text-2xl');
      updateLevelDisplay();
    }, 1800);
    emit('game:level-up', { level, mode: gameMode });
  }

  function updateLevelDisplay() {
    levelEl.textContent = level;
  }

  function updateLives(isLost = false) {
    livesContainer.innerHTML = '';
    for (let i = 0; i < initialLives; i++) {
      const heart = document.createElement('span');
      heart.textContent = '❤️';
      heart.className = `transition-opacity duration-300 ${i < lives ? 'opacity-100' : 'opacity-20'}`;
      livesContainer.appendChild(heart);
    }
    if (isLost) {
      gameContainer.classList.add('life-lost-shake');
      trackTimeout(() => gameContainer.classList.remove('life-lost-shake'), 500);
    }
  }

  function triggerStatGhost(ghostEl, icon) {
    if (!ghostEl) return;
    ghostEl.textContent = `+1 ${icon}`;
    ghostEl.classList.remove('stat-badge__ghost--visible');
    // Force reflow so the animation restarts
    void ghostEl.offsetWidth;
    ghostEl.classList.add('stat-badge__ghost--visible');
    trackTimeout(() => ghostEl.classList.remove('stat-badge__ghost--visible'), 900);
  }

  function updateWaveStat(triggerGhost = false) {
    if (!waveStatValue) return;
    waveStatValue.textContent = bestWaveCatch;
    if (triggerGhost) {
      triggerStatGhost(waveStatGhost, '🌊');
    }
  }

  function updateStreakStat(triggerGhost = false) {
    if (!streakStatValue) return;
    streakStatValue.textContent = totalCatchStreak;
    if (triggerGhost) {
      triggerStatGhost(streakStatGhost, '🔥');
    }
  }

  function spawnNextRound() {
    if (!gameActive || isPaused) return;
    // Don't spawn new rounds if goal has been reached
    if (hasReachedGoal) return;
    // Prevent concurrent spawn attempts
    if (currentRound && currentRound.handledCount < currentRound.items.length) {
      return; // Still processing current round
    }
    // Reset wave counter at the start of each new wave/round
    waveCorrectCount = 0;

    let roundItems = [];
    const itemPool = getModePool(gameMode);
    const isFirstWaveOfLevel = !hasIntroducedForItemInLevel;

    if (isRandomLettersModeActive()) {
      // First wave of level: introduce new letters
      if (isFirstWaveOfLevel) {
        if (forcedStartItem && level === 1) {
          roundItems.push(forcedStartItem);
          forcedStartItem = null;
        } else {
          // At level 1: introduce 2 letters, at higher levels: introduce 1 letter
          const lettersToIntroduce = level === 1 ? 2 : 1;
          const unseenItems = itemPool.filter((item) => !seenItems.has(item.id));

          if (selectedModeIds.size > 1 && unseenItems.length > 0) {
            // Use even distribution for introducing new items across modes
            const distributedItems = getEvenlyDistributedItems(unseenItems, lettersToIntroduce, new Set());
            roundItems.push(...distributedItems);
          } else {
            // Single mode: randomly select new items
            const shuffled = [...unseenItems].sort(() => Math.random() - 0.5);
            for (let i = 0; i < lettersToIntroduce && i < shuffled.length; i++) {
              roundItems.push(shuffled[i]);
            }
          }
        }
        hasIntroducedForItemInLevel = true;
      } else if (seenItems.size === 0) {
        // Safety check: if no items have been seen yet, introduce new letters
        const lettersToIntroduce = level === 1 ? 2 : 1;
        const unseenItems = itemPool.filter((item) => !seenItems.has(item.id));
        const shuffled = [...unseenItems].sort(() => Math.random() - 0.5);
        for (let i = 0; i < lettersToIntroduce && i < shuffled.length; i++) {
          roundItems.push(shuffled[i]);
        }
        hasIntroducedForItemInLevel = true;
      } else {
        // Subsequent waves: send ALL letters that have been introduced so far
        const availableItems = itemPool.filter((item) => seenItems.has(item.id));

        if (selectedModeIds.size > 1 && availableItems.length > 0) {
          // Send ALL available items with even distribution across modes
          roundItems = getEvenlyDistributedItems(availableItems, availableItems.length, new Set());
        } else {
          // Send ALL available items in shuffled order
          roundItems = [...availableItems].sort(() => Math.random() - 0.5);
        }
      }

      // Filter out any invalid items to prevent spawning without buckets
      roundItems = roundItems.filter((item) => item && item.id);

      // Clear spawn position tracking for new round
      recentSpawnPositions = [];

      currentRound = { id: Date.now(), items: roundItems, handledCount: 0, timers: [], isFirstWave: isFirstWaveOfLevel };
      generateChoices(roundItems, itemPool);
      processItemsForRound(roundItems, currentRound.id, isFirstWaveOfLevel);
      return;
    }

    let seenSoFar = itemPool.filter((item) => seenItems.has(item.id));
    const totalItemsInRound = level;

    // First wave of level: send ONLY new letters
    if (isFirstWaveOfLevel && learningOrder.length > 0) {
      if (forcedStartItem && level === 1) {
        roundItems.push(forcedStartItem);
        forcedStartItem = null;
      } else {
        // Introduce new letters for the first wave
        // At level 1: introduce 2 letters, at higher levels: introduce 1 letter
        const lettersToIntroduce = level === 1 ? 2 : 1;
        for (let i = 0; i < lettersToIntroduce && learningOrder.length > 0; i++) {
          roundItems.push(learningOrder.shift());
        }
      }
      hasIntroducedForItemInLevel = true;
    } else if (seenItems.size === 0 && learningOrder.length > 0) {
      // Safety check: if no items have been seen yet, introduce new letters instead of spawning empty wave
      // This handles edge cases where first wave might be skipped
      const lettersToIntroduce = level === 1 ? 2 : 1;
      for (let i = 0; i < lettersToIntroduce && learningOrder.length > 0; i++) {
        roundItems.push(learningOrder.shift());
      }
      hasIntroducedForItemInLevel = true;
    } else {
      // Subsequent waves: send ALL letters that have been introduced so far
      const availableItems = itemPool.filter((item) => seenItems.has(item.id));

      if (selectedModeIds.size > 1 && availableItems.length > 0) {
        // Send ALL available items with even distribution across modes
        roundItems = getEvenlyDistributedItems(availableItems, availableItems.length, new Set());
      } else {
        // Send ALL available items in shuffled order
        roundItems = [...availableItems].sort(() => Math.random() - 0.5);
      }
    }

    // Fallback if no items
    if (roundItems.length === 0 && seenSoFar.length > 0) {
      roundItems.push(seenSoFar[Math.floor(Math.random() * seenSoFar.length)]);
    } else if (roundItems.length === 0 && learningOrder.length > 0) {
      roundItems.push(learningOrder.shift());
      hasIntroducedForItemInLevel = true;
    }

    // Filter out any invalid items to prevent spawning without buckets
    roundItems = roundItems.filter((item) => item && item.id);

    // Clear spawn position tracking for new round
    recentSpawnPositions = [];

    currentRound = { id: Date.now(), items: roundItems, handledCount: 0, timers: [], isFirstWave: isFirstWaveOfLevel };
    generateChoices(roundItems, itemPool);
    processItemsForRound(roundItems, currentRound.id, isFirstWaveOfLevel);
  }

  function isRandomLettersModeActive() {
    return randomLettersEnabled && gameMode === 'letters';
  }

  function processItemsForRound(items, roundId, isFirstWave) {
    // First wave of level: spawn items one at a time with delays (for introductions)
    // Subsequent waves: spawn ALL items at once (no delays)
    if (isFirstWave) {
      // First wave: spawn one at a time with delays
      let totalDelay = 0;
      items.forEach((itemData) => {
        if (!itemData || !itemData.id) return;
        if (currentRound.id !== roundId) return;
        const isNewItem = !seenItems.has(itemData.id);
        let delayForNext = 500;

        if (isNewItem && introductionsEnabled) {
          const showTime = totalDelay;
          const callback1 = () => {
            if (!gameActive || isPaused || currentRound.id !== roundId) return;
            const transliteration = itemData.transliteration ?? itemData.id ?? '';
            const pronunciation = getDisplayLabel(itemData);
            const association = associationModeEnabled && pronunciation
              ? getAssociation(pronunciation, activeAssociationLanguageId)
              : null;

            if (association) {
              learnLetterEl.textContent = `${itemData.symbol} ${association.emoji}`;
              learnName.textContent = '';
              learnSound.textContent = '';
            } else {
              learnLetterEl.textContent = itemData.symbol;

              // For vocab items, show English translation in name and transliteration in sound
              // For regular items, show transliteration in name and "Sound: [pronunciation]" in sound
              if (itemData.sourceMode === 'vocab') {
                learnName.textContent = itemData.name; // English translation
                learnSound.textContent = transliteration; // transliteration
              } else {
                learnName.textContent = transliteration;
                learnSound.textContent = pronunciation ? t('game.summary.soundLabel', { sound: pronunciation }) : '';
              }
            }
            learnOverlay.classList.add('visible');
            startItemDrop(itemData, roundId);
          };
          const t1 = trackTimeout(callback1, showTime);
          currentRound.timers.push({
            handle: t1,
            startTime: Date.now(),
            delay: showTime,
            callback: callback1
          });

          const callback2 = () => {
            learnOverlay.classList.remove('visible');
          };
          const t2 = trackTimeout(callback2, showTime + learnPhaseDuration);
          currentRound.timers.push({
            handle: t2,
            startTime: Date.now(),
            delay: showTime + learnPhaseDuration,
            callback: callback2
          });
          delayForNext = learnPhaseDuration + 500;
        } else {
          const callback3 = () => {
            if (gameActive && !isPaused && currentRound.id === roundId) startItemDrop(itemData, roundId);
          };
          const t3 = trackTimeout(callback3, totalDelay);
          currentRound.timers.push({
            handle: t3,
            startTime: Date.now(),
            delay: totalDelay,
            callback: callback3
          });
        }
        totalDelay += delayForNext;
      });
    } else {
      // Subsequent waves: spawn all items at once with no delays
    const STAGGER_MS = 500;

    items.forEach((itemData, index) => {
    if (!itemData || !itemData.id) return;
    if (currentRound.id !== roundId) return;

    const delay = index * STAGGER_MS;

    const cb = () => {
      if (!gameActive || isPaused || currentRound.id !== roundId) return;
      startItemDrop(itemData, roundId);
    };

    const h = trackTimeout(cb, delay);
    currentRound.timers.push({
      handle: h,
      startTime: Date.now(),
      delay,
      callback: cb,
      });
     });
    }
  } 

  /**
   * Generate a well-distributed vertical spawn position with buffers and anti-clumping
   * @param {boolean} isSlowRiver - Whether slow river mode is enabled
   * @returns {number} - A position value between minBuffer and maxBuffer (percentage)
   */
  function getDistributedSpawnPosition(isSlowRiver) {
    // Define buffers: 10% from top, 20% from bottom
    const TOP_BUFFER = 10;
    const BOTTOM_BUFFER = 20;
    const MIN_SEPARATION = 8; // Minimum 8% separation between letters
    const MAX_ATTEMPTS = 10; // Try up to 10 times to find a good position

    // Different ranges for slow river vs normal mode
    const minPos = isSlowRiver ? 30 : TOP_BUFFER;
    const maxPos = isSlowRiver ? 70 : (100 - BOTTOM_BUFFER);
    const range = maxPos - minPos;

    let position;
    let attempts = 0;
    let isTooClose = true;

    while (isTooClose && attempts < MAX_ATTEMPTS) {
      position = minPos + Math.random() * range;

      // Check if position is far enough from recent spawns
      isTooClose = recentSpawnPositions.some(
        (recentPos) => Math.abs(position - recentPos) < MIN_SEPARATION
      );

      attempts++;
    }

    // Add to recent positions and keep only last 5
    recentSpawnPositions.push(position);
    if (recentSpawnPositions.length > 5) {
      recentSpawnPositions.shift();
    }

    return position;
  }

  function startItemDrop(itemData, roundId) {
    if (!gameActive || isPaused) return;
    const elementId = `item-${Date.now()}-${Math.random()}`;
    const itemEl = document.createElement('div');
    itemEl.id = elementId;
    itemEl.isDropped = false;
    itemEl.textContent = itemData.symbol;

    // Determine animation based on settings
    let animationName;
    if (slowRiverEnabled) {
      animationName = 'slow-river-flow';
    } else {
      const reducedMotion = reducedMotionToggle.checked;
      animationName = reducedMotion ? 'simple-flow' : ['river-flow-1', 'river-flow-2'][Math.floor(Math.random() * 2)];
    }

    // Apply font class based on selected font or random if font shuffle enabled
    let fontStyleClass = selectedFont !== 'default' ? `game-font-${selectedFont}` : '';
    if (fontShuffleEnabled) {
      // Randomly choose a font for this letter, ensuring it's different from the last one
      const availableFonts = ['frank-ruhl', 'noto-serif', 'taamey-frank', 'ezra-sil', 'keter-yg'];
      let randomFont;

      // If we have a last used font, filter it out to ensure variety
      if (lastUsedFont) {
        const filteredFonts = availableFonts.filter((f) => f !== lastUsedFont);
        randomFont = filteredFonts[Math.floor(Math.random() * filteredFonts.length)];
      } else {
        randomFont = availableFonts[Math.floor(Math.random() * availableFonts.length)];
      }

      lastUsedFont = randomFont;
      fontStyleClass = `game-font-${randomFont}`;
    }
    const interactionClass = clickModeEnabled ? 'click-mode-item' : 'drag-mode-item';
    itemEl.className = `falling-letter font-bold ${fontClass} ${fontStyleClass} text-arcade-text-main ${animationName} ${interactionClass}`;

    // Use distributed positioning with buffers to prevent clumping
    const topPosition = getDistributedSpawnPosition(slowRiverEnabled);
    itemEl.style.top = `${topPosition}%`;

    // In Slow River mode, randomize horizontal placement
    if (slowRiverEnabled) {
      itemEl.style.top = `${30 + Math.random() * 40}%`; // 30-70% range centered
      itemEl.style.left = `${10 + Math.random() * 80}%`; // 10-90% range with edge buffer
    } else {
      itemEl.style.left = '0'; // Explicit left positioning to prevent RTL dir from affecting spawn position
    }

    // Invert slider value: 34 - value (so left=slow, right=fast)
    // In Slow River mode, letters move to center and stay, so use slower animation
    const sliderValue = parseInt(gameSpeedSlider.value, 10);
    const invertedSpeed = slowRiverEnabled ? Math.max(10, 34 - sliderValue) : 34 - sliderValue;
    itemEl.style.animationDuration = `${invertedSpeed}s`;
    itemEl.draggable = true;
    const pronunciation = itemData.pronunciation ?? itemData.sound ?? '';
    const transliteration = itemData.transliteration ?? itemData.name ?? '';
    const ariaLabel = letterDescriptionTemplate
      ? formatTemplate(letterDescriptionTemplate, {
          symbol: itemData.symbol ?? '',
          name: itemData.name ?? '',
          transliteration,
          pronunciation
        })
      : `${transliteration} ${pronunciation}`.trim();
    if (ariaLabel) itemEl.setAttribute('aria-label', ariaLabel);
    itemEl.addEventListener('dragstart', (e) => {
      const dragData = JSON.stringify({
        sound: itemData.sound,
        id: elementId,
        roundId,
        itemId: itemData.id,
        symbol: itemData.symbol
      });
      e.dataTransfer.setData('application/json', dragData);
      itemEl.style.animationPlayState = 'paused';
      itemEl.classList.add('dragging');
      trackTimeout(() => {
        itemEl.style.visibility = 'hidden';
      }, 0);
    });
    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
      if (!itemEl.isDropped) {
        itemEl.style.visibility = 'visible';
        itemEl.style.animationPlayState = 'running';
      }
    });

    // In Slow River mode, letters don't trigger miss on animationend since they stay on screen
    const missHandler = slowRiverEnabled ? null : () => onItemHandled(elementId, roundId, true);
    if (missHandler) {
      itemEl.addEventListener('animationend', missHandler);
    }

    activeItems.set(elementId, { data: itemData, element: itemEl, missHandler });
    playArea.appendChild(itemEl);

    const payload = {
      sound: itemData.sound,
      id: elementId,
      roundId,
      itemId: itemData.id,
      symbol: itemData.symbol
    };

    // Use click mode or drag mode based on settings
    if (clickModeEnabled) {
      startClickMode(itemEl, payload);
    } else {
      startPointerDrag(itemEl, payload);
    }
  }

  function onItemHandled(itemId, roundId, isMiss) {
    if (!activeItems.has(itemId)) return;
    if (!currentRound || currentRound.id !== roundId) return;

    const item = activeItems.get(itemId);
    const itemData = item?.data ?? {};
    const key = itemData.id;
    if (key && !sessionStats[key]) sessionStats[key] = { correct: 0, incorrect: 0 };
    if (key && isMiss) sessionStats[key].incorrect++;
    if (key) seenItems.add(key);

    item.element.remove();
    activeItems.delete(itemId);
    currentRound.handledCount++;

    // Check if we should show win screen (goal reached and all letters cleared)
    if (hasReachedGoal && activeItems.size === 0) {
      trackTimeout(() => {
        showWinScreen();
      }, 500);
      return;
    }

    if (isMiss && key) {
      waveCorrectCount = 0;
      currentCatchStreak = 0;
      lives--;
      updateLives(true);
      emit('game:letter-result', {
        itemId: key,
        symbol: itemData.symbol,
        sound: itemData.sound,
        correct: false,
        mode: gameMode,
        roundId,
        reason: 'timeout',
        languageId: activeLanguage.id
      });
    }
    if (lives <= 0) {
      endGame();
      return;
    }
    // Only spawn next round if ALL items in current round are handled AND all letters cleared from screen
    if (currentRound.handledCount === currentRound.items.length && activeItems.size === 0) {
      spawnNextRound();
    }
  }

  function generateChoices(correctItems, itemPool) {
    choicesContainer.innerHTML = '';
    activeBucketCount = 0;
    applyBucketLayout(0);
    clearPendingBucketLayout();
    invalidateBucketMinWidth();
    refreshDropZones();
    if (correctItems.length === 0) return;

    // Group items by sound - multiple letters with same sound share one bucket
    const uniqueBySound = new Map();
    correctItems.forEach((item) => {
      if (!item) return;
      const sound = getDisplayLabel(item);
      if (!sound) return; // Skip items without sound
      if (!uniqueBySound.has(sound)) {
        uniqueBySound.set(sound, item);
      }
    });
    const correctChoices = Array.from(uniqueBySound.values());
    const correctSounds = new Set(correctChoices.map((i) => getDisplayLabel(i)));
    let finalChoices = [...correctChoices];

    // Filter distractors: exclude items with same sound as correct items
    let distractorPool = itemPool.filter((i) => {
      const sound = getDisplayLabel(i);
      return sound && !correctSounds.has(sound);
    });
    distractorPool.sort(() => 0.5 - Math.random());

    // Track sounds already in finalChoices to prevent duplicates
    const usedSounds = new Set(finalChoices.map((i) => getDisplayLabel(i)));
    let i = 0;
    // Use maxBucketCount to maintain consistent bucket count throughout session
    const targetBucketCount = Math.max(maxBucketCount, finalChoices.length);
    while (finalChoices.length < targetBucketCount && i < distractorPool.length) {
      const distractorSound = getDisplayLabel(distractorPool[i]);
      // Only add if this sound hasn't been used yet
      if (distractorSound && !usedSounds.has(distractorSound)) {
        finalChoices.push(distractorPool[i]);
        usedSounds.add(distractorSound);
      }
      i++;
    }

    finalChoices.sort(() => 0.5 - Math.random());

    finalChoices.forEach((choice) => {
      const box = document.createElement('div');
      const displaySymbol = getDisplaySymbol(choice);
      const displayLabel = getDisplayLabel(choice);
      // Add brackets around final forms
      const isFinalForm = choice.isFinalForm || choice.id.startsWith('final-');
      // For vowel items, use the romanized sound (e.g., "Ba", "Bo", "Be", "Bi")
      const isVowel = choice.type === 'vowel';
      const labelText = isFinalForm
        ? `[${displayLabel || displaySymbol}]`
        : isVowel
          ? displayLabel
          : (displayLabel || displaySymbol);

      box.dataset.labelText = labelText;

      // Check if this is a vocab item with an emoji
      if (choice.emoji) {
        // Display emoji for vocab mode
        box.innerHTML = `<div class="flex flex-col items-center justify-center gap-1">
          <span class="text-4xl" role="img" aria-label="${choice.name || labelText}">${choice.emoji}</span>
        </div>`;
      } else if (associationModeEnabled && displayLabel) {
        // Check if association mode is enabled and we have an emoji for this sound
        const association = getAssociation(displayLabel, activeAssociationLanguageId);
        if (association) {
          // Display emoji with optional word label <span class="text-xs text-arcade-text-muted">${association.word}</span>
          box.innerHTML = `<div class="flex flex-col items-center justify-center gap-1">
            <span class="text-4xl" role="img" aria-label="${association.alt}">${association.emoji}</span>
          </div>`;
        } else {
          // Fallback to text if no association found
          box.textContent = labelText;
        }
      } else {
        box.textContent = labelText;
      }
      box.dataset.itemId = choice.id;
      // Store the sound for matching - for vocab items, use emoji to allow multiple words with same emoji
      box.dataset.sound = choice.emoji || displayLabel;
      box.className = 'catcher-box bg-gradient-to-b from-arcade-panel-light to-arcade-panel-medium text-arcade-text-main font-bold py-5 sm:py-6 px-2 rounded-lg text-2xl transition-all border-2 border-arcade-panel-border shadow-arcade-sm';
      const ariaLabel = getCharacterAriaLabel(choice);
      if (ariaLabel) box.setAttribute('aria-label', ariaLabel);
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        box.classList.add('drag-over');
      });
      box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
      box.addEventListener('drop', handleDrop);

      // Add bucket info handler - right-click to show info
      box.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBucketInfo(choice);
      });

      // Add left-click handler for desktop (only if not in click mode or no drag)
      // This will be overridden by setupClickModeBuckets if click mode is enabled
      let clickStartTime = 0;
      let didDrag = false;

      box.addEventListener('mousedown', () => {
        clickStartTime = Date.now();
        didDrag = false;
      });

      box.addEventListener('mousemove', () => {
        if (clickStartTime > 0) {
          didDrag = true;
        }
      });

      box.addEventListener('click', (e) => {
        // Only show info if this wasn't a drag operation and click mode isn't handling it
        const clickDuration = Date.now() - clickStartTime;
        if (!didDrag && clickDuration < 300 && !clickModeEnabled) {
          e.preventDefault();
          e.stopPropagation();
          showBucketInfo(choice);
        }
        clickStartTime = 0;
        didDrag = false;
      });

      // Add long-press handler for mobile devices
      let longPressTimer = null;
      let longPressTriggered = false;

      box.addEventListener('touchstart', (e) => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          showBucketInfo(choice);
          // Provide haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }, 500); // 500ms long press
      }, { passive: true });

      box.addEventListener('touchend', (e) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        // If long press was triggered, prevent the default click behavior
        if (longPressTriggered) {
          e.preventDefault();
          longPressTriggered = false;
        }
      });

      box.addEventListener('touchmove', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        longPressTriggered = false;
      });

      // Store choice data on the box element for later reference
      box._choiceData = choice;

      choicesContainer.appendChild(box);
    });
    activeBucketCount = finalChoices.length;
    // Update max bucket count if we've exceeded it
    maxBucketCount = Math.max(maxBucketCount, activeBucketCount);
    invalidateBucketMinWidth();

    // Schedule layout update instead of applying immediately
    // This allows DOM to render first, preventing misalignment
    scheduleBucketLayoutUpdate();

    // Schedule a second layout update after a longer delay to catch any late-rendering issues
    // This ensures proper alignment on initial game start
    if (typeof window !== 'undefined') {
      window.setTimeout(() => scheduleBucketLayoutUpdate(), 150);
    }
  }

  // Show bucket info overlay when bucket is clicked
  function showBucketInfo(choice) {
    if (!bucketInfoOverlay) return;

    const displaySymbol = getDisplaySymbol(choice);
    const displayLabel = getDisplayLabel(choice);

    // Check if this is a vocab item with an emoji
    if (choice.emoji) {
      // Display emoji for vocab mode
      bucketInfoSymbol.innerHTML = `<span class="text-7xl" role="img" aria-label="${choice.name || displayLabel}">${choice.emoji}</span>`;
      bucketInfoSymbol.style.color = '';
      bucketInfoName.textContent = choice.name || displayLabel; // English translation
      bucketInfoSound.textContent = choice.transliteration || choice.symbol; // Transliteration or Hebrew word
    } else if (associationModeEnabled && displayLabel) {
      // Check if association mode is enabled and we have an emoji for this sound
      const association = getAssociation(displayLabel, activeAssociationLanguageId);
      if (association) {
        // Display emoji with word
        bucketInfoSymbol.innerHTML = `<span class="text-7xl" role="img" aria-label="${association.alt}">${association.emoji}</span>`;
        bucketInfoSymbol.style.color = '';
        bucketInfoName.textContent = association.word;
        bucketInfoSound.textContent = t('game.summary.soundLabel', { sound: displayLabel });
      } else {
        // Fallback to text if no association found
        bucketInfoSymbol.textContent = displaySymbol || displayLabel;
        bucketInfoSymbol.style.color = '#ff9247';
        bucketInfoName.textContent = choice.transliteration || displayLabel;
        bucketInfoSound.textContent = displayLabel ? t('game.summary.soundLabel', { sound: displayLabel }) : '';
      }
    } else {
      // Regular mode - display letter/symbol
      bucketInfoSymbol.textContent = displaySymbol || displayLabel;
      bucketInfoSymbol.style.color = '#ff9247';
      const isFinalForm = choice.isFinalForm || choice.id.startsWith('final-');
      const isVowel = choice.type === 'vowel';
      const labelText = isFinalForm
        ? `[${displayLabel || displaySymbol}]`
        : isVowel
          ? displayLabel
          : (displayLabel || displaySymbol);
      bucketInfoName.textContent = choice.transliteration || labelText;
      bucketInfoSound.textContent = displayLabel ? t('game.summary.soundLabel', { sound: displayLabel }) : '';
    }

    bucketInfoOverlay.classList.add('visible');
  }

  // Hide bucket info overlay
  function hideBucketInfo() {
    if (!bucketInfoOverlay) return;
    bucketInfoOverlay.classList.remove('visible');
  }

  // Setup bucket info close button
  if (bucketInfoClose) {
    bucketInfoClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBucketInfo();
    });
  }

  // Close bucket info when clicking outside
  if (bucketInfoOverlay) {
    bucketInfoOverlay.addEventListener('click', (e) => {
      if (e.target === bucketInfoOverlay) {
        hideBucketInfo();
      }
    });
  }

  // Helper to sync settings to localStorage
  function syncSettingsToLocalStorage() {
    try {
      const settings = {
        showIntroductions: document.getElementById('toggle-introductions')?.checked ?? true,
        highContrast: highContrastToggle?.checked ?? false,
        randomLetters: randomLettersToggle?.checked ?? false,
        reducedMotion: reducedMotionToggle?.checked ?? false,
        gameSpeed: parseInt(gameSpeedSlider?.value ?? 17, 10),
        gameFont: gameFontSelect?.value ?? 'default',
        fontShuffle: fontShuffleToggle?.checked ?? false,
        slowRiver: slowRiverToggle?.checked ?? false,
        clickMode: clickModeToggle?.checked ?? false,
        associationMode: associationModeToggle?.checked ?? false
      };
      localStorage.setItem('gameSettings', JSON.stringify(settings));
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('gameSettingsChanged'));
    } catch (e) {
      console.error('Failed to save game settings', e);
    }
  }

  // Load settings from localStorage on game init
  function loadSettingsFromLocalStorage() {
    try {
      const saved = localStorage.getItem('gameSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        const normalizedFont = settings.gameFont === 'opendyslexic'
          ? 'lexend'
          : (settings.gameFont ?? 'default');
        const introductionsToggle = document.getElementById('toggle-introductions');
        if (introductionsToggle) introductionsToggle.checked = settings.showIntroductions ?? true;
        if (highContrastToggle) highContrastToggle.checked = settings.highContrast ?? false;
        if (randomLettersToggle) randomLettersToggle.checked = settings.randomLetters ?? false;
        if (reducedMotionToggle) reducedMotionToggle.checked = settings.reducedMotion ?? false;
        if (gameSpeedSlider) gameSpeedSlider.value = settings.gameSpeed ?? 17;
        if (gameFontSelect) gameFontSelect.value = normalizedFont;
        if (fontShuffleToggle) fontShuffleToggle.checked = settings.fontShuffle ?? false;
        if (slowRiverToggle) slowRiverToggle.checked = settings.slowRiver ?? false;
        if (clickModeToggle) clickModeToggle.checked = settings.clickMode ?? false;
        if (associationModeToggle) associationModeToggle.checked = settings.associationMode ?? false;

        // Update internal variables
        randomLettersEnabled = settings.randomLetters ?? false;
        slowRiverEnabled = settings.slowRiver ?? false;
        fontShuffleEnabled = settings.fontShuffle ?? false;
        clickModeEnabled = settings.clickMode ?? false;
        associationModeEnabled = settings.associationMode ?? false;
        selectedFont = normalizedFont;

        // Apply high contrast
        if (settings.highContrast) {
          document.body.classList.add('high-contrast');
        } else {
          document.body.classList.remove('high-contrast');
        }

        // Refresh drop zones to update click mode handlers
        if (dropZones && dropZones.length > 0) {
          refreshDropZones();
        }
      }
    } catch (e) {
      console.error('Failed to load game settings', e);
    }
  }

  loadSettingsFromLocalStorage();

  function setAppLanguageId() {
    // Kept for API compatibility. Association mode now follows practice language.
  }

  // Listen for changes to settings from other sources (like SettingsView)
  window.addEventListener('storage', (e) => {
    if (e.key === 'gameSettings' && e.newValue) {
      loadSettingsFromLocalStorage();
    }
  });

  // Also listen for custom event (for same-window updates)
  window.addEventListener('gameSettingsChanged', () => {
    loadSettingsFromLocalStorage();
  });

accessibilityBtn?.addEventListener('click', () => {
  const isOpening = accessibilityView.classList.contains('hidden');

  // Toggle visibility first
  accessibilityView.classList.toggle('hidden');

  // If we just closed it, nothing else to do
  if (!isOpening) return;

  const btnRect = accessibilityBtn.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  const BUFFER = 8; // how far from edges you want it

  // --- 1. Initial position under the button (in container coords)
  let top = btnRect.bottom - containerRect.top + 5;
  let left = btnRect.left - containerRect.left;

  accessibilityView.style.position = 'absolute';
  accessibilityView.style.top = `${top}px`;
  accessibilityView.style.left = `${left}px`;

  // Make sure it's visible so we can measure it (hidden class is already removed)
  const popupRect = accessibilityView.getBoundingClientRect();
  const popupWidth = popupRect.width;
  const popupHeight = popupRect.height;

  // --- 2. Clamp inside container
  const maxLeft = containerRect.width - popupWidth - BUFFER;
  const maxTop = containerRect.height - popupHeight - BUFFER;

  // keep it within [BUFFER, maxLeft] horizontally
  left = Math.min(Math.max(left, BUFFER), Math.max(maxLeft, BUFFER));
  // keep it within [BUFFER, maxTop] vertically
  top = Math.min(Math.max(top, BUFFER), Math.max(maxTop, BUFFER));

  accessibilityView.style.left = `${left}px`;
  accessibilityView.style.top = `${top}px`;

  // Reload settings when opening the menu to ensure checkboxes reflect current state
  loadSettingsFromLocalStorage();
});

  closeAccessibilityBtn?.addEventListener('click', () => accessibilityView.classList.add('hidden'));
  highContrastToggle?.addEventListener('change', (e) => {
    document.body.classList.toggle('high-contrast', e.target.checked);
    syncSettingsToLocalStorage();
  });
  randomLettersToggle?.addEventListener('change', (e) => {
    randomLettersEnabled = e.target.checked;
    syncSettingsToLocalStorage();
  });
  slowRiverToggle?.addEventListener('change', (e) => {
    slowRiverEnabled = e.target.checked;
    syncSettingsToLocalStorage();
  });
  clickModeToggle?.addEventListener('change', (e) => {
    clickModeEnabled = e.target.checked;
    // Refresh drop zones to update click handlers
    refreshDropZones();
    syncSettingsToLocalStorage();
  });
  associationModeToggle?.addEventListener('change', (e) => {
    associationModeEnabled = e.target.checked;
    // Regenerate choices to update bucket display
    if (currentRound && currentRound.correctItems) {
      generateChoices(currentRound.correctItems, itemPool);
    }
    syncSettingsToLocalStorage();
  });
  gameFontSelect?.addEventListener('change', (e) => {
    selectedFont = e.target.value;
    syncSettingsToLocalStorage();
  });
  fontShuffleToggle?.addEventListener('change', (e) => {
    fontShuffleEnabled = e.target.checked;
    lastUsedFont = null; // Reset last used font when toggling
    syncSettingsToLocalStorage();
  });
  reducedMotionToggle?.addEventListener('change', () => {
    syncSettingsToLocalStorage();
  });

  const speedSlowLabel = t('game.accessibility.speedSlow');
  const speedFastLabel = t('game.accessibility.speedFast');
  const speedNormalLabel = t('game.accessibility.speedNormal');

  gameSpeedSlider?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    // Invert: left=slow (10→24s), right=fast (24→10s)
    if (v < 14) speedLabel.textContent = speedSlowLabel;
    else if (v > 20) speedLabel.textContent = speedFastLabel;
    else speedLabel.textContent = speedNormalLabel;
    syncSettingsToLocalStorage();
  });

  // Also sync the introductions toggle
  const introductionsToggle = document.getElementById('toggle-introductions');
  introductionsToggle?.addEventListener('change', () => {
    syncSettingsToLocalStorage();
  });

  function updateModalSubtitle() {
    const selectedInput = document.querySelector('input[name="gameMode"]:checked');
    const selectedMode = selectedInput?.value ?? 'letters';
    const noun = modeNounMap[selectedMode] ?? nounFallback;
    const text = formatTemplate(subtitleTemplate, { noun });
    if (modalSubtitle) modalSubtitle.textContent = text;
  }

  renderPracticeModes();

  // Create validation popup for start button
  let validationPopup = null;
  if (startButton) {
    validationPopup = document.createElement('div');
    validationPopup.className = 'start-validation-popup';
    validationPopup.textContent = t('game.setup.selectAtLeastOne') || 'Please select at least 1 option before starting the game.';
    validationPopup.style.display = 'none';
    startButton.parentElement.style.position = 'relative';
    startButton.parentElement.appendChild(validationPopup);
  }

  function showValidationPopup() {
    if (validationPopup) {
      validationPopup.style.display = 'block';
      setTimeout(() => {
        validationPopup.style.display = 'none';
      }, 3000);
    }
  }

  startButton?.addEventListener('click', () => {
    if (isRestartMode) {
      // In vocab mode, restart the game directly without showing setup screen
      if (isVocabMode) {
        gameOverView.classList.add('hidden');
        modal.classList.add('hidden');
        isRestartMode = false;
        startGame();
      } else {
        // For regular mode, show setup screen to allow mode selection
        gameOverView.classList.add('hidden');
        setupView.classList.remove('hidden');
        accessibilityView.classList.add('hidden');
        startButton.textContent = t('game.controls.start');
        isRestartMode = false;
        setupExitButton?.classList.remove('hidden');
        updateModalSubtitle();
      }
    } else {
      // Validate that at least one mode is selected
      if (selectedModeIds.size === 0) {
        showValidationPopup();
        return;
      }
      startGame();
    }
  });

  function handleDrop(e) {
    e.preventDefault();
    const targetBox = e.currentTarget;
    targetBox.classList.remove('drag-over');
    const { id: droppedId, roundId, itemId: droppedItemId, symbol: droppedSymbol, sound: droppedSound } = JSON.parse(
      e.dataTransfer.getData('application/json')
    );
    if (!gameActive || !activeItems.has(droppedId)) return;

    const targetSound = targetBox.dataset.sound;
    const item = activeItems.get(droppedId);

    item.element.isDropped = true;
    if (droppedItemId && !sessionStats[droppedItemId]) {
      sessionStats[droppedItemId] = { correct: 0, incorrect: 0 };
    }

    // Match by sound - allows multiple letters with same sound to share a bucket
    const isCorrect = targetSound === droppedSound;

    if (isCorrect) {
      updateScore(10);
      targetBox.classList.add('feedback-correct');
      if (droppedItemId) {
        sessionStats[droppedItemId].correct++;
        waveCorrectCount++;
        currentCatchStreak++;
        if (waveCorrectCount > bestWaveCatch) {
          bestWaveCatch = waveCorrectCount;
          updateWaveStat(true);
        }
        const improvedStreak = currentCatchStreak > totalCatchStreak;
        totalCatchStreak = Math.max(totalCatchStreak, currentCatchStreak);
        if (improvedStreak) {
          updateStreakStat(true);
        }
        // Track vocab item catches for perfect round detection
        if (isVocabMode && droppedItemId) {
          vocabCaughtInRound.add(droppedItemId);
        }
      }
      // Hide the letter immediately after correct drop
      item.element.style.display = 'none';
    } else {
      lives--;
      updateLives(true);
      targetBox.classList.add('feedback-incorrect');
      if (droppedItemId) {
        sessionStats[droppedItemId].incorrect++;
        waveCorrectCount = 0;
        currentCatchStreak = 0;
      }

      // Find the correct bucket to show its sound/label
      const correctBucket = choicesContainer.querySelector(`[data-sound="${droppedSound}"]`);
      const correctLabel = correctBucket ? correctBucket.textContent : (droppedSound || getDisplayLabel(item.data) || getDisplaySymbol(item.data));
      const boxRect = targetBox.getBoundingClientRect();
      const gameRect = gameContainer.getBoundingClientRect();
      ghostEl.textContent = correctLabel;
      ghostEl.style.display = 'block';
      const ghostWidth = ghostEl.offsetWidth;
      ghostEl.style.display = '';
      ghostEl.style.left = `${boxRect.left - gameRect.left + boxRect.width / 2 - ghostWidth / 2}px`;
      ghostEl.style.top = `${boxRect.top - gameRect.top}px`;
      ghostEl.classList.add('ghost-rise');
      trackTimeout(() => {
        ghostEl.classList.remove('ghost-rise');
      }, 2000);
      // Hide the letter immediately after incorrect drop too
      item.element.style.display = 'none';
    }

    emit('game:letter-result', {
      itemId: droppedItemId,
      symbol: droppedSymbol,
      sound: item.data.sound,
      correct: isCorrect,
      mode: gameMode,
      roundId,
      languageId: activeLanguage.id
    });

    item.element.removeEventListener('animationend', item.missHandler);
    trackTimeout(() => {
      targetBox.classList.remove('feedback-correct', 'feedback-incorrect');
      onItemHandled(droppedId, roundId, false);
    }, 400);
  }

  document.addEventListener('dragstart', () => {
    // ensure drop zones refresh when dragging begins (for responsive layouts)
    refreshDropZones();
  });

  updateLives();
  updateModalSubtitle();
  refreshDropZones();

  const handleReturnToMenu = () => {
    // For vocab mode, skip setup screen and go directly back to module card
    if (isVocabMode) {
      onReturnToMenu?.();
    } else {
      resetToSetupScreen();
      onReturnToMenu?.();
    }
  };

  let isPaused = false;
  let pauseTime = 0; // When the game was paused

  const pauseGame = () => {
    if (!gameActive || isPaused) return;
    isPaused = true;
    pauseTime = Date.now();

    // Pause all active item animations
    activeItems.forEach((item) => {
      if (item.element && item.element.style) {
        item.element.style.animationPlayState = 'paused';
      }
    });

    // Pause timers by calculating remaining time for each
    if (currentRound && currentRound.timers) {
      currentRound.pausedTimers = currentRound.timers.map((timer) => {
        const elapsed = pauseTime - timer.startTime;
        const remaining = Math.max(0, timer.delay - elapsed);
        clearTrackedTimeout(timer.handle);
        return {
          callback: timer.callback,
          remaining: remaining
        };
      });
      currentRound.timers = [];
    }

    // Show pause modal
    pauseModal.classList.remove('hidden');
  };

  const resumeGame = () => {
    if (!isPaused) return;
    isPaused = false;

    // Resume all active item animations
    activeItems.forEach((item) => {
      if (item.element && item.element.style) {
        item.element.style.animationPlayState = 'running';
      }
    });

    // Resume timers with their remaining time, but only if they have meaningful time left
    // Filter out timers that were about to fire (< 100ms), preventing letters from spawning immediately on resume
    if (currentRound && currentRound.pausedTimers) {
      currentRound.pausedTimers.forEach((pausedTimer) => {
        // Only restore timers with at least 100ms remaining
        // This prevents letters from spawning immediately when resuming
        if (pausedTimer.remaining >= 100) {
          const handle = trackTimeout(pausedTimer.callback, pausedTimer.remaining);
          currentRound.timers.push({
            handle: handle,
            startTime: Date.now(),
            delay: pausedTimer.remaining,
            callback: pausedTimer.callback
          });
        }
      });
      currentRound.pausedTimers = [];
    }

    // Hide pause modal
    pauseModal.classList.add('hidden');
  };

  const exitFromPause = () => {
    isPaused = false;
    // Hide pause modal first
    pauseModal.classList.add('hidden');
    // End the game, which will show the game over screen with final score
    exitFromWin();
  };

  pauseButton?.addEventListener('click', pauseGame);
  resumeButton?.addEventListener('click', resumeGame);
  pauseExitButton?.addEventListener('click', exitFromPause);
  setupExitButton?.addEventListener('click', handleReturnToMenu);
  gameOverExitButton?.addEventListener('click', handleReturnToMenu);
  goalIncreaseBtn?.addEventListener('click', increaseGoal);
  goalDecreaseBtn?.addEventListener('click', decreaseGoal);
  continuePlayingButton?.addEventListener('click', continueAfterWin);
  winExitButton?.addEventListener('click', exitFromWin);

  const setGoalTooltipVisibility = (isVisible) => {
    goalTooltip?.classList.toggle('hidden', !isVisible);
    goalInfoIcon?.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
  };

  // Goal info icon tooltip handlers
  goalInfoIcon?.addEventListener('mouseenter', () => {
    setGoalTooltipVisibility(true);
  });
  goalInfoIcon?.addEventListener('mouseleave', () => {
        setGoalTooltipVisibility(false);
  });
  goalInfoIcon?.addEventListener('focus', () => {
    setGoalTooltipVisibility(true);
  });
  goalInfoIcon?.addEventListener('blur', () => {
    setGoalTooltipVisibility(false);
  });
  goalInfoIcon?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = goalTooltip ? goalTooltip.classList.contains('hidden') === false : false;
    setGoalTooltipVisibility(!isVisible);
  });
  // Close tooltip when clicking outside
  document.addEventListener('click', (e) => {
    if (goalTooltip && !goalTooltip.classList.contains('hidden') &&
        !goalInfoIcon?.contains(e.target) && !goalTooltip?.contains(e.target)) {
      setGoalTooltipVisibility(false);
    }
  });

  function setGameMode(value) {
    const button = document.querySelector(`.mode-button[data-mode="${value}"]`);
    if (button) {
      // Remove selected class from all buttons
      document.querySelectorAll('.mode-button').forEach((btn) => {
        btn.classList.remove('selected');
        btn.setAttribute('aria-checked', 'false');
      });

      // Add selected class to target button
      button.classList.add('selected');
      button.setAttribute('aria-checked', 'true');
      gameMode = value;
      updateModalSubtitle();
    }
  }

  function forceStartByHebrew(symbol) {
    const match = resolveItemBySymbol(symbol) ?? allLanguageItems.find((entry) => entry.symbol === symbol);
    if (match) forcedStartItem = { ...match };
  }

  return { resetToSetupScreen, startGame, setGameMode, forceStartByHebrew, setAppLanguageId };
}
