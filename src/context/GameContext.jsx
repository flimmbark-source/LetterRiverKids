import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { setupGame } from '../game/game.js';
import { useLocalization } from './LocalizationContext.jsx';
import { useTutorial } from './TutorialContext.jsx';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import { on } from '../lib/eventBus.js';
import PostGameReview from '../components/PostGameReview.jsx';

const GameContext = createContext({ openGame: () => {}, closeGame: () => {} });

export function GameProvider({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [options, setOptions] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [showPostGameReview, setShowPostGameReview] = useState(false);
  const containerRef = useRef(null);
  const gameApiRef = useRef(null);
  const [hasMounted, setHasMounted] = useState(false);
  const shouldAutostartRef = useRef(false);
  const { languagePack, interfaceLanguagePack, t, dictionary } = useLocalization();
  const { pendingTutorial, startPendingTutorial, currentTutorial } = useTutorial();
  const fontClass = languagePack.metadata?.fontClass ?? 'language-font-hebrew';
  const direction = interfaceLanguagePack.metadata?.textDirection ?? 'ltr';

  // Load settings from localStorage to display correct initial state
  const loadedSettings = useMemo(() => {
    try {
      const saved = localStorage.getItem('gameSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gameFont === 'opendyslexic') {
          parsed.gameFont = 'lexend';
        }
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load game settings:', error);
    }
    // Return kid-first defaults — optimized for young children learning letters
    return {
      showIntroductions: true,    // Always show letter introductions for new learners
      highContrast: false,
      randomLetters: false,       // Alphabetical order helps young kids
      reducedMotion: false,
      gameSpeed: 10,              // Slowest comfortable speed for small children
      gameFont: 'default',
      fontShuffle: false,         // Consistent fonts reduce confusion for beginners
      slowRiver: true,            // Letters pause in center — no time pressure
      clickMode: true,            // Click-to-place is easier than drag for small hands
      associationMode: true,      // Picture-based buckets aid pre-readers
    };
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Disable body scroll when play area is open
  useEffect(() => {
    if (isVisible) {
      // Save current scroll position
      const scrollY = window.scrollY;

      // Prevent scrolling on body (position: fixed is required for iOS)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      // Also add class for additional CSS support
      document.body.classList.add('no-scroll');

      // Return cleanup function that restores scroll
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.classList.remove('no-scroll');

        // Restore scroll position
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    if (!gameApiRef.current) return;
    const api = gameApiRef.current;
    api.setAppLanguageId?.(interfaceLanguagePack.id);
    api.resetToSetupScreen?.();
    gameApiRef.current = null;
  }, [languagePack.id, interfaceLanguagePack.id]);

  // Clear game API when vocab data is present to force fresh setup with vocab mode
  useEffect(() => {
    if (options?.vocabData && gameApiRef.current) {
      gameApiRef.current = null;
    }
  }, [options?.vocabData]);

  useEffect(() => {
    if (!isVisible) return;
    if (!containerRef.current) return;
    if (!gameApiRef.current) {
      gameApiRef.current = setupGame({
        onReturnToMenu: () => {
          // If we have session data, show post-game review instead of closing immediately
          if (sessionData) {
            setShowPostGameReview(true);
            setIsGameRunning(false);
          } else {
            setIsVisible(false);
            setIsGameRunning(false);
          }
        },
        onGameStart: () => {
          setIsGameRunning(true);
        },
        onGameReset: () => {
          setIsGameRunning(false);
        },
        languagePack,
        translate: t,
        dictionary,
        appLanguageId: interfaceLanguagePack.id,
        vocabData: options?.vocabData || null,
      });
    }
    const api = gameApiRef.current;
    api.resetToSetupScreen();
    if (options?.mode) api.setGameMode(options.mode);
    if (options?.forceLetter) api.forceStartByHebrew(options.forceLetter);
    // Only autostart if the flag is set (prevents multiple starts on dependency changes)
    if (shouldAutostartRef.current) {
      shouldAutostartRef.current = false; // Clear flag after using it
      requestAnimationFrame(() => api.startGame());
    }
  }, [isVisible, options, languagePack, t, dictionary, interfaceLanguagePack.id, sessionData]);

  // Start pending tutorial when game becomes visible
  useEffect(() => {
    if (isVisible && pendingTutorial === 'gameSetup') {
      // Small delay to let the modal render first
      const timer = setTimeout(() => {
        startPendingTutorial();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, pendingTutorial, startPendingTutorial]);

  // Listen for game session complete to show post-game review
  useEffect(() => {
    const offSessionComplete = on('game:session-complete', (payload) => {
      // Store session data for post-game review
      setSessionData(payload);
    });

    return () => {
      offSessionComplete();
    };
  }, []);

  // Restore game modal if gameSetup tutorial is active (e.g., after page refresh)
  useEffect(() => {
    if (currentTutorial?.id === 'gameSetup' && !isVisible && hasMounted) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentTutorial, isVisible, hasMounted]);

  const openGame = useCallback((openOptions = {}) => {
    // If game is already visible, close it (acts as a toggle)
    if (isVisible) {
      if (gameApiRef.current) {
        gameApiRef.current.resetToSetupScreen();
      }
      setIsVisible(false);
      setIsGameRunning(false);
      return;
    }
    setOptions(openOptions);
    // Set autostart flag if requested
    if (openOptions.autostart) {
      shouldAutostartRef.current = true;
    }
    setIsVisible(true);
  }, [isVisible]);

  const closeGame = useCallback(() => {
    if (gameApiRef.current) {
      gameApiRef.current.resetToSetupScreen();
    }
    shouldAutostartRef.current = false;
    setIsVisible(false);
    setIsGameRunning(false);
    setShowPostGameReview(false);
    setSessionData(null);
    setOptions(null); // Clear options to prevent stale vocab data
    gameApiRef.current = null; // Clear game API to force fresh setup next time
  }, []);

  const contextValue = useMemo(
    () => ({ openGame, closeGame, isVisible, isGameRunning }),
    [openGame, closeGame, isVisible, isGameRunning],
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
      {hasMounted
        ? createPortal(
            <div
              className={`fixed inset-0 z-50 transition-opacity duration-200 ${
                isVisible
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <div
                className="absolute inset-0 backdrop-blur"
                style={{ background: 'rgba(74, 34, 8, 0.85)' }}
                onClick={closeGame}
              />
              <div
                className="absolute inset-0 overflow-hidden"
                onClick={closeGame}
              >
                <div className="flex min-h-full items-center justify-center p-4 sm:p-6" onClick={closeGame}>
                  <div
                    ref={containerRef}
                    className={`relative h-full w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl transition-transform sm:rounded-3xl ${
                      isVisible ? 'scale-100' : 'scale-95'
                    }`}
                    style={{
                      background:
                        'linear-gradient(180deg, #fffaf0 0%, #ffe9c9 45%, #ffe2b8 100%)',
                      border: '2px solid #e49b5a',
                      maxHeight: 'calc(100vh - 2rem)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir={direction}
                  >
                  <ErrorBoundary>
                    <GameCanvas
                       key={languagePack.id}
                        fontClass={fontClass}
                       loadedSettings={loadedSettings}
                    />
                  </ErrorBoundary>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {hasMounted && showPostGameReview && sessionData
        ? createPortal(
            <PostGameReview
              sessionData={sessionData}
              onPlayAgain={() => {
                // Reset states and restart game
                setShowPostGameReview(false);
                setSessionData(null);
                if (gameApiRef.current) {
                  gameApiRef.current.resetToSetupScreen();
                  gameApiRef.current.startGame();
                  setIsGameRunning(true);
                }
              }}
              onHome={() => {
                // Close everything and go home
                setShowPostGameReview(false);
                setSessionData(null);
                setIsVisible(false);
                setIsGameRunning(false);
                if (gameApiRef.current) {
                  gameApiRef.current.resetToSetupScreen();
                }
              }}
            />,
            document.body,
          )
        : null}
    </GameContext.Provider>
  );
}

function GameCanvas({ fontClass, loadedSettings }) {
  const { t } = useLocalization();
  const { closeGame } = useContext(GameContext);

  // Info popup state (mirrors SettingsView behaviour)
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [infoPopupContent, setInfoPopupContent] = useState({
    title: '',
    description: '',
  });
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  const settingInfo = {
    showIntroductions: {
      title: t('game.accessibility.showIntroductions'),
      description:
        'Shows an introduction screen for each new letter before it appears in the game, helping you learn the letter before playing.',
    },
    highContrast: {
      title: t('game.accessibility.highContrast'),
      description:
        'Increases the contrast between text and background colors to make letters easier to see and distinguish.',
    },
    randomLetters: {
      title: t('game.accessibility.randomLetters'),
      description:
        'Letters appear in random order instead of the standard alphabetical sequence, providing varied practice.',
    },
    reducedMotion: {
      title: t('game.accessibility.reducedMotion'),
      description:
        'Simplifies animations by removing rotation and complex movement patterns, making letters move in straight lines for easier tracking.',
    },
    gameSpeed: {
      title: t('game.accessibility.speed'),
      description:
        'Controls how quickly letters move across the screen. Slower speeds give you more time to recognize and drag letters.',
    },
    gameFont: {
      title: 'Game Font',
      description:
        'Choose from different fonts including dyslexia-friendly options. Some fonts are specially designed to make letters easier to distinguish.',
    },
    slowRiver: {
      title: 'Slow River Mode',
      description:
        'Letters move to the center of the screen and stay there instead of flowing off the edge. This gives you unlimited time to identify and place each letter.',
    },
    clickMode: {
      title: 'Click Mode',
      description:
        'Click on a letter to select it, then click on a bucket to place it, instead of dragging. This makes the game easier to play if you have difficulty with dragging.',
    },
    associationMode: {
      title: 'Association Mode',
      description:
        'Buckets display images, drag to the image which starts with the letter sound.',
    },
  };

  const showInfo = (settingKey, event) => {
    if (settingInfo[settingKey]) {
      setInfoPopupContent(settingInfo[settingKey]);
      setShowInfoPopup(true);

      if (event) {
        const clientX = event.clientX || event.touches?.[0]?.clientX || 0;
        const clientY = event.clientY || event.touches?.[0]?.clientY || 0;

        const viewportWidth =
          window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight || 0;

        const horizontalPadding = 16; // px
        const verticalOffset = 15; // px below the cursor when possible
        const bottomBuffer = 24; // px from bottom of screen
        const estimatedPopupHeight = 200; // conservative max height in px
        const maxPopupWidth = 320; // matches maxWidth style

        // Position X with a right-edge clamp
        const rawX = clientX + 15;
        const x = Math.min(
          Math.max(rawX, horizontalPadding),
          viewportWidth - maxPopupWidth - horizontalPadding,
        );

        // Position Y with a bottom buffer; if not enough room below, clamp up
        const rawY = clientY + verticalOffset;
        const maxY = viewportHeight - estimatedPopupHeight - bottomBuffer;
        const y = Math.min(rawY, maxY);

        setPopupPosition({ x, y });
      }
    }
  };

  return (
    <div id="game-view" className="flex h-full w-full flex-col overflow-hidden">
      <div
        id="game-container"
        className="relative flex h-full min-h-[calc(100vh-4rem)] flex-col sm:min-h-[600px]"
        style={{
          background: 'linear-gradient(180deg, #fff9eb 0%, #ffe5bd 100%)',
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        <div className="relative flex flex-col">
          <div
            id="top-bar"
            className="relative text-sm shadow-lg sm:text-base"
            style={{ background: 'rgba(255, 229, 201, 0.9)' }}
          >
            <button
              id="pause-button"
              className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md px-2 py-1 text-xl font-bold transition hover:opacity-80"
              style={{
                color: '#b07737',
                minWidth: 'auto',
                minHeight: 'auto',
                background: 'rgba(235, 179, 105, 0.1)',
                border: '2px solid rgba(235, 179, 105, 0.4)'
              }}
              aria-label="Pause game"
            >
              ⏸️
            </button>
            <div className="top-bar-content flex w-full flex-wrap items-center justify-center gap-3 sm:gap-6">
              <div className="inline-flex items-center gap-2 text-center">
                <span className="font-semibold" style={{ color: '#6c3b14' }}>
                  {t('game.labels.level')}
                </span>
                <span
                  id="level"
                  className="text-2xl font-bold"
                  style={{ color: '#ff9247' }}
                >
                  1
                </span>
              </div>
              <div className="score-lives-group flex items-center gap-3 text-center">
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: '#6c3b14' }}>
                    {t('game.labels.score')}
                  </span>
                  <span
                    id="score"
                    className="text-2xl font-bold"
                    style={{ color: '#ffce4a' }}
                  >
                    0
                  </span>
                </div>
                <div
                  id="lives-container"
                  className="flex items-center gap-2"
                />
              </div>
              <div
                className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
                id="river-stat-container"
              >
                <div className="stat-badge" id="wave-stat" aria-live="polite">
                  <span className="sr-only">
                    {t('game.labels.bestWave', 'Best wave')}
                  </span>
                  <span className="stat-badge__icon" aria-hidden="true">
                    🌊
                  </span>
                  <span className="stat-badge__value" id="wave-stat-value">
                    0
                  </span>
                  <span
                    className="stat-badge__ghost"
                    id="wave-stat-ghost"
                    aria-hidden="true"
                  />
                </div>
                <div className="stat-badge" id="streak-stat" aria-live="polite">
                  <span className="sr-only">
                    {t('game.labels.bestStreak', 'Best streak')}
                  </span>
                  <span className="stat-badge__icon" aria-hidden="true">
                    🔥
                  </span>
                  <span className="stat-badge__value" id="streak-stat-value">
                    0
                  </span>
                  <span
                    className="stat-badge__ghost"
                    id="streak-stat-ghost"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          id="play-area"
          className="relative flex-1 overflow-hidden"
          style={{
            touchAction: 'none',  // 👈 blocks scroll/pinch on this area
            background:
              'linear-gradient(180deg, rgba(255, 218, 168, 0.3), rgba(255, 229, 201, 0.5))',
            maxHeight: 'calc(100vh - 12rem)',
          }}
        >
          <div
            id="learn-overlay"
            className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-4 rounded-2xl px-6 py-3 shadow-lg"
            style={{
              border: '2px solid rgba(235, 179, 105, 0.95)',
              background:
                'linear-gradient(180deg, #fff5dd 0%, #ffe5c2 100%)',
              boxShadow:
                '0 4px 0 rgba(214, 140, 64, 1), 0 8px 12px rgba(214, 140, 64, 0.6)',
            }}
          >
            <div
              id="learn-letter"
              className={`text-6xl font-bold ${fontClass}`}
              style={{ color: '#ff9247' }}
            />
            <div className="flex flex-col text-center">
              <div
                id="learn-name"
                className="text-2xl font-semibold"
                style={{ color: '#4a2208' }}
              />
              <div
                id="learn-sound"
                className="text-lg"
                style={{ color: '#6c3b14' }}
              />
            </div>
          </div>

          {/* Bucket Info Overlay */}
          <div
            id="bucket-info-overlay"
            className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl px-8 py-6 shadow-2xl"
            style={{
              border: '3px solid rgba(235, 179, 105, 0.95)',
              background:
                'linear-gradient(180deg, #fff5dd 0%, #ffe5c2 100%)',
              boxShadow:
                '0 4px 0 rgba(214, 140, 64, 1), 0 8px 20px rgba(214, 140, 64, 0.7)',
              minWidth: '300px',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                id="bucket-info-symbol"
                className={`text-7xl font-bold ${fontClass}`}
                style={{ color: '#ff9247' }}
              />
              <div className="flex flex-col text-left">
                <div
                  id="bucket-info-name"
                  className="text-2xl font-semibold"
                  style={{ color: '#4a2208' }}
                />
                <div
                  id="bucket-info-sound"
                  className="text-lg"
                  style={{ color: '#6c3b14' }}
                />
              </div>
            </div>
            <button
              id="bucket-info-close"
              className="mt-2 rounded-lg bg-gradient-to-b from-orange-400 to-orange-500 px-6 py-2 font-semibold text-white shadow-md transition-all hover:from-orange-500 hover:to-orange-600"
              style={{
                boxShadow: '0 2px 0 rgba(214, 140, 64, 1)',
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div
          id="choices-container"
          className="grid w-full flex-shrink-0 grid-cols-2 gap-3 px-4 pb-6 pt-4 sm:grid-cols-3 sm:px-6 md:grid-cols-4 lg:grid-cols-5"
          style={{ background: 'linear-gradient(180deg, #fff9eb 0%, #ffe5bd 100%)' }}
        />

        <div
  id="modal"
  className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto pt-10 p-4 sm:p-6"
  style={{ background: 'rgba(6, 78, 59, 0.85)' }}
  onClick={(e) => {
    // Only trigger when clicking the dark overlay, not the inner content
    if (e.target === e.currentTarget) {
      closeGame?.(); // closes the game overlay (and thus the modal)
    }
  }}
>
  <div
    id="modal-content"
    className="relative w-full max-w-lg shadow-2xl"
    style={{
      border: '1px solid #E5E7EB',
      background: 'linear-gradient(180deg, #fffce3ff 0%, #fae5d1ff 50%, #fdf4e0ff 100%)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    }}
    onClick={(e) => e.stopPropagation()}
  >

            <button
              id="accessibility-btn"
              className="absolute left-2 top-1 text-2xl transition p-2 rounded-lg hover:bg-emerald-100/50 active:bg-emerald-200/50"
              aria-label={t('game.accessibility.gear')}
              style={{ color: '#059669', minWidth: '44px', minHeight: '44px', zIndex: 10 }}            >
              ⚙️
            </button>
            <div id="setup-view" className="flex flex-col h-full">
              <div
                className="relative flex items-center justify-center px-3 py-2 border-b-2"
                style={{ borderColor: '#D1FAE5' }}
              >
                <div className="flex flex-col items-center flex-1 text-center gap-1">
                  <h1
                    className={`modal-title text-xl sm:text-2xl font-bold ${fontClass}`}
                    style={{ color: '#059669' }}
                  >
                    {t('game.setup.title')}
                  </h1>
                  <p
                    id="modal-subtitle"
                    className="text-xs font-semibold sm:text-sm"
                    style={{ color: '#065F46' }}
                  >
                    {t('game.setup.subtitleFallback')}
                  </p>
                </div>
              </div>
              <div className="setup-body px-4">
                <aside className="goal-column goal-selector" aria-label="Goal settings">
                  <div
                    className="goal-column__label text-xs font-bold uppercase tracking-wider"
                    style={{ color: '#065F46' }}
                  >
                    {t('game.setup.goal', 'Goal')}
                  </div>

                  <div className="goal-badge" aria-live="polite">
                    <button
                      className="goal-badge__info-icon"
                      id="goalInfoIcon"
                      aria-label="Goal information"
                      aria-controls="goalTooltip"
                      aria-expanded="false"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="goal-badge__info-glyph"
                      >
                        i
                      </span>
                    </button>
                    <div className="goal-badge__value">
                      <span id="goalValue">0</span>
                      <span
                        className="goal-badge__icon"
                        aria-hidden="true"
                      >
                        🎯
                      </span>
                    </div>
                    <div
                      className="goal-badge__tooltip hidden"
                      id="goalTooltip"
                    >
                      {t(
                        'game.setup.goalTooltip',
                        'The Goal number represents the level you need to reach to win the game. Collect letters and earn points to level up!',
                      )}
                    </div>
                  </div>

                  <div className="goal-column__controls" aria-label="Adjust goal">
                    <button
                      className="goal-icon-button"
                      type="button"
                      id="goalIncrease"
                      aria-label="Increase goal"
                    >
                      +
                    </button>

                    <div
                      className="goal-progress-bar"
                      aria-label="Goal progress"
                    >
                      <div className="goal-progress-bar__inner">
                        <div
                          className="goal-progress-bar__fill"
                          id="goalProgressFill"
                        ></div>
                        <div className="goal-progress-bar__ticks">
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                          <span className="goal-progress-bar__tick"></span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="goal-icon-button"
                      type="button"
                      id="goalDecrease"
                      aria-label="Decrease goal"
                    >
                      –
                    </button>
                  </div>
                </aside>

                <section className="mode-column">
                  <h2
                    className="mode-column__headline text-xs font-bold uppercase tracking-wider"
                    style={{ color: '#065F46' }}
                  >
                    {t('game.setup.prompt')}
                  </h2>

                  <div className="mode-panel">
                    <div
                      id="mode-options"
                      className="mode-buttons-container practice-modes"
                    />

                    <div className="mode-panel__footer">
                      <button
                        id="start-button"
                        className="primary-cta start-game"
                        type="button"
                        style={{
                          border: '2px solid #5aa838',
                          background:
                            'linear-gradient(135deg, #e8ffd8 0%, #7bd74f 100%)',
                          color: '#ffffff',
                          boxShadow:
                            '0 6px 0 #5aa838, 0 8px 20px rgba(90, 168, 56, 0.3)',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        {t('game.controls.start')}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div
              id="game-over-view"
              className="relative hidden pt-12 text-center"
            >
              <h2
                id="game-over-heading"
                className={`mb-4 text-4xl font-bold ${fontClass}`}
                style={{ color: '#064E3B' }}
              >
                {t('game.summary.gameOver')}
              </h2>
              <p
                id="final-score"
                className="mb-6 text-2xl"
                style={{ color: '#374151' }}
              >
                {t('game.summary.finalScore', { score: 0 })}
              </p>
              <div className="learning-summary-container my-6" />
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center mt-8">
                  <button
                    id="game-over-exit-button"
                    className="w-full rounded-full px-8 py-3 text-base font-semibold transition sm:w-auto"
                    style={{
                      border: '2px solid #10B981',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 4px 0 rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {t('game.controls.backToMenu')}
                  </button>
                </div>
              </div>
            </div>

            <div
              id="win-view"
              className="relative hidden pt-8 text-center px-4"
            >
              <div className="space-y-6">
                <div className="text-6xl">🎉</div>
                <h2
                  className={`text-5xl font-bold ${fontClass}`}
                  style={{ color: '#10B981' }}
                >
                  {t('game.win.title', 'You Win!')}
                </h2>
                <p
                  className="text-xl font-semibold"
                  style={{ color: '#374151' }}
                >
                  {t('game.win.message', 'You reached your goal!')}
                </p>
                <div className="space-y-2">
                  <p className="text-lg" style={{ color: '#6B7280' }}>
                    {t('game.win.sessionCorrectPrefix', 'You caught')}{' '}
                    <span
                      className="font-bold"
                      id="session-correct-display"
                      style={{ color: '#1F2937' }}
                    >
                      0
                    </span>{' '}
                    {t(
                      'game.win.sessionCorrectSuffix',
                      'letters in a row this game!',
                    )}
                  </p>
                  <p className="text-base" style={{ color: '#6B7280' }}>
                    {t('game.win.totalWins', 'Total wins')}:{' '}
                    <span
                      className="font-bold"
                      id="total-wins-display"
                      style={{ color: '#1F2937' }}
                    >
                      0
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center mt-8">
                  <button
                    id="continue-playing-button"
                    className="w-full rounded-full px-8 py-3 text-base font-semibold transition sm:w-auto"
                    style={{
                      border: '2px solid #10B981',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 4px 0 rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {t('game.win.continue', 'Continue Playing')}
                  </button>
                  <button
                    id="win-exit-button"
                    className="w-full rounded-full px-8 py-3 text-base font-semibold transition sm:w-auto"
                    style={{
                      border: '2px solid #E5E7EB',
                      background: '#FFFFFF',
                      color: '#374151',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {t('game.controls.backToMenu')}
                  </button>
                </div>
              </div>
            </div>

            <div
              id="setup-footer"
              className="mt-2 flex flex-shrink-0 flex-col items-center gap-3 pb-4 sm:flex-row sm:justify-center"
            >
              <button
                id="install-btn"
                className="hidden rounded-full px-5 py-3 text-sm font-semibold transition"
                style={{
                  border: 0,
                  background:
                    'radial-gradient(circle at 20% 0, #fff7cf 0, #ffd96d 45%, #e79b26 100%)',
                  color: '#4a1a06',
                  boxShadow:
                    '0 3px 0 rgba(176, 104, 38, 1), 0 6px 10px rgba(176, 104, 38, 0.7)',
                }}
              >
                {t('game.controls.install')}
              </button>
            </div>
          </div>
        </div>

        {/* Accessibility panel */}
        <div
          id="accessibility-view"
          className="hidden absolute right-6 top-28 z-40 w-72 rounded-2xl p-4 text-left shadow-xl overflow-y-auto max-h-[80vh]"
          style={{
            border: '2px solid rgba(235, 179, 105, 0.95)',
            background: 'linear-gradient(180deg, #fff5dd 0%, #ffe5c2 100%)',
            boxShadow: '0 4px 0 rgba(214, 140, 64, 1), 0 8px 12px rgba(214, 140, 64, 0.6)',
          }}
        >
          <button
            id="close-accessibility-btn"
            className="absolute right-3 top-3 text-2xl transition"
            style={{ color: '#b07737' }}
          >
            ×
          </button>
          <h3
            className="mb-4 text-center text-lg font-semibold"
            style={{ color: '#ff9247' }}
          >
            {t('game.controls.accessibility')}
          </h3>
          <div
            className="space-y-4 text-sm"
            style={{ color: '#4a2208' }}
          >
            <div
              className="border-b pb-3"
              style={{ borderColor: '#e49b5a' }}
            >
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="game-font-select"
                  className="text-sm"
                  style={{ color: '#4a2208' }}
                >
                  <span
                    className="cursor-pointer hover:text-amber-700"
                    onClick={(e) => showInfo('gameFont', e)}
                    onMouseEnter={(e) => showInfo('gameFont', e)}
                    onMouseLeave={() => setShowInfoPopup(false)}
                  >
                    Game Font
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: '#4a2208' }}>
                  <span>Shuffle</span>
                  <input
                    id="font-shuffle-toggle"
                    type="checkbox"
                    defaultChecked={loadedSettings.fontShuffle}
                    className="h-4 w-4 rounded border-2 text-orange-600 focus:ring-orange-500"
                    style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
                  />
                </label>
              </div>
              <select
                id="game-font-select"
                defaultValue={loadedSettings.gameFont}
                className="w-full rounded-lg border px-2 py-1 text-xs"
                style={{
                  borderColor: '#e49b5a',
                  background: '#fff5dd',
                  color: '#4a2208',
                }}
              >
                <option value="default">Default</option>
                <option value="lexend">Lexend / Noto Sans (dyslexia-friendly)</option>
                <option value="comic-sans">Comic Sans</option>
                <option value="arial">Arial</option>
                <option value="verdana">Verdana</option>
              </select>
            </div>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('showIntroductions', e)}
                onMouseEnter={(e) => showInfo('showIntroductions', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.showIntroductions')}
              </span>
              <input
                id="toggle-introductions"
                type="checkbox"
                defaultChecked={loadedSettings.showIntroductions}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('highContrast', e)}
                onMouseEnter={(e) => showInfo('highContrast', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.highContrast')}
              </span>
              <input
                id="high-contrast-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.highContrast}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('randomLetters', e)}
                onMouseEnter={(e) => showInfo('randomLetters', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.randomLetters')}
              </span>
              <input
                id="random-letters-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.randomLetters}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('reducedMotion', e)}
                onMouseEnter={(e) => showInfo('reducedMotion', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.reducedMotion')}
              </span>
              <input
                id="reduced-motion-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.reducedMotion}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('slowRiver', e)}
                onMouseEnter={(e) => showInfo('slowRiver', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Slow River Mode
              </span>
              <input
                id="slow-river-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.slowRiver}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('clickMode', e)}
                onMouseEnter={(e) => showInfo('clickMode', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Click Mode
              </span>
              <input
                id="click-mode-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.clickMode}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="cursor-pointer hover:text-amber-700"
                onClick={(e) => showInfo('associationMode', e)}
                onMouseEnter={(e) => showInfo('associationMode', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Association Mode
              </span>
              <input
                id="association-mode-toggle"
                type="checkbox"
                defaultChecked={loadedSettings.associationMode ?? true}
                className="h-5 w-5 rounded border-2 text-orange-600 focus:ring-orange-500"
                style={{ borderColor: '#e49b5a', accentColor: '#ff9247' }}
              />
            </label>

            <div>
              <label
                htmlFor="game-speed-slider"
                className="text-sm"
                style={{ color: '#4a2208' }}
              >
                <span
                  className="cursor-pointer hover:text-amber-700"
                  onClick={(e) => showInfo('gameSpeed', e)}
                  onMouseEnter={(e) => showInfo('gameSpeed', e)}
                  onMouseLeave={() => setShowInfoPopup(false)}
                >
                  {t('game.accessibility.speed')}{' '}
                  <span id="speed-label">
                    {t('game.accessibility.speedNormal')}
                  </span>
                </span>
              </label>
              <input
                id="game-speed-slider"
                type="range"
                min="10"
                max="24"
                defaultValue={loadedSettings.gameSpeed}
                className="mt-2 w-full"
                style={{ accentColor: '#ff9247' }}
              />
            </div>
          </div>
        </div>

        {/* Shared info popup tooltip (same behaviour as in SettingsView) */}
        {showInfoPopup && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`,
              maxWidth: '320px',
            }}
          >
            <div
              className="progress-card-small p-4 shadow-lg pointer-events-auto"
              style={{
                border: '2px solid rgba(235, 179, 105, 0.95)',
                boxShadow:
                  '0 4px 0 rgba(214, 140, 64, 1), 0 8px 12px rgba(214, 140, 64, 0.6)',
                background: 'linear-gradient(180deg, #fff5dd 0%, #ffe5c2 100%)',
                color: '#4a2208',
              }}
              onMouseEnter={() => setShowInfoPopup(true)}
              onMouseLeave={() => setShowInfoPopup(false)}
            >
              <h3 className="font-heading text-sm font-bold mb-2">
                {infoPopupContent.title}
              </h3>
              <p className="text-xs">{infoPopupContent.description}</p>
            </div>
          </div>
        )}

        {/* Existing summary tooltip / ghosts */}
        <div
          id="summary-tooltip"
          className="pointer-events-none absolute z-50 hidden rounded-xl px-3 py-2 text-center text-sm shadow-lg"
          style={{
            border: '2px solid rgba(235, 179, 105, 0.95)',
            background: 'linear-gradient(180deg, #fff5dd 0%, #ffe5c2 100%)',
            color: '#4a2208',
            boxShadow:
              '0 4px 0 rgba(214, 140, 64, 1), 0 8px 12px rgba(214, 140, 64, 0.6)',
          }}
        />
        <div
          id="correct-answer-ghost"
          className="pointer-events-none absolute text-4xl font-bold opacity-0"
          style={{ color: '#5acb5a' }}
        />

        {/* Pause Modal - Separate from main modal, no click-outside-to-close */}
        <div
          id="pause-modal"
          className="fixed inset-0 z-40 hidden flex items-center justify-center p-4"
          style={{ background: 'rgba(6, 78, 59, 0.95)' }}
        >
          <div
            className="relative w-full max-w-md rounded-3xl shadow-2xl"
            style={{
              border: '1px solid #E5E7EB',
              background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="relative pt-8 pb-8 text-center px-6">
              <div className="space-y-6">
                <div className="text-6xl">⏸️</div>
                <h2
                  className={`text-4xl font-bold ${fontClass}`}
                  style={{ color: '#059669' }}
                >
                  {t('game.pause.title', 'Paused')}
                </h2>
                <p
                  className="text-lg font-semibold"
                  style={{ color: '#065F46' }}
                >
                  {t('game.pause.message', '')}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center mt-8">
                  <button
                    id="resume-button"
                    className="w-full rounded-full px-8 py-3 text-base font-semibold transition sm:w-auto"
                    style={{
                      border: '2px solid #5aa838',
                      background:
                        'linear-gradient(135deg, #e8ffd8 0%, #7bd74f 100%)',
                      color: '#ffffff',
                      boxShadow:
                        '0 6px 0 #5aa838, 0 8px 20px rgba(90, 168, 56, 0.3)',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    {t('game.pause.resume', 'Resume')}
                  </button>
                  <button
                    id="pause-exit-button"
                    className="w-full rounded-full px-8 py-3 text-base font-semibold transition sm:w-auto"
                    style={{
                      border: '2px solid #d97706',
                      background:
                        'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
                      color: '#ffffff',
                      boxShadow:
                        '0 6px 0 #d97706, 0 8px 20px rgba(217, 119, 6, 0.3)',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    {t('game.pause.mainMenu', 'Main Menu')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
