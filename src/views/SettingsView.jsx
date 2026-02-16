import React, { useState, useEffect } from 'react';
import { useLocalization } from '../context/LocalizationContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useKidMode } from '../hooks/useKidMode.js';
import { getFormattedLanguageName } from '../lib/languageUtils.js';

export default function SettingsView() {
  const { t } = useLocalization();
  const { languageId, selectLanguage, appLanguageId, selectAppLanguage, languageOptions } = useLanguage();
  const { isKidMode, kidSettings, updateKidSettings, ageBand, track, parentMode } = useKidMode();

  // Game accessibility settings - these mirror the game settings
  const [showIntroductions, setShowIntroductions] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [randomLetters, setRandomLetters] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(17);
  const [gameFont, setGameFont] = useState('default');
  const [fontShuffle, setFontShuffle] = useState(false);
  const [slowRiver, setSlowRiver] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [associationMode, setAssociationMode] = useState(false);

  // Info popup state
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [infoPopupContent, setInfoPopupContent] = useState({ title: '', description: '' });
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          setShowIntroductions(settings.showIntroductions ?? true);
          setHighContrast(settings.highContrast ?? false);
          setRandomLetters(settings.randomLetters ?? false);
          setReducedMotion(settings.reducedMotion ?? false);
          setGameSpeed(settings.gameSpeed ?? 17);
          const savedFont = settings.gameFont === 'opendyslexic' ? 'lexend' : (settings.gameFont ?? 'default');
          setGameFont(savedFont);
          setFontShuffle(settings.fontShuffle ?? false);
          setSlowRiver(settings.slowRiver ?? false);
          setClickMode(settings.clickMode ?? false);
          setAssociationMode(settings.associationMode ?? false);
        }
        setHasLoadedSettings(true);
      } catch (e) {
        console.error('Failed to load game settings', e);
      }
    };

    loadSettings();

    // Listen for settings changes from other sources (like game.js)
    window.addEventListener('gameSettingsChanged', loadSettings);

    return () => {
      window.removeEventListener('gameSettingsChanged', loadSettings);
    };
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedSettings) return;

    try {
      const settings = {
        showIntroductions,
        highContrast,
        randomLetters,
        reducedMotion,
        gameSpeed,
        gameFont,
        fontShuffle,
        slowRiver,
        clickMode,
        associationMode
      };
      localStorage.setItem('gameSettings', JSON.stringify(settings));

      // Dispatch event to notify other components (like game.js)
      window.dispatchEvent(new Event('gameSettingsChanged'));

      // Apply high contrast to body
      if (highContrast) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }
    } catch (e) {
      console.error('Failed to save game settings', e);
    }
  }, [hasLoadedSettings, showIntroductions, highContrast, randomLetters, reducedMotion, gameSpeed, gameFont, fontShuffle, slowRiver, clickMode, associationMode]);

  const getSpeedLabel = (speed) => {
    if (speed < 14) return t('game.accessibility.speedSlow');
    if (speed > 20) return t('game.accessibility.speedFast');
    return t('game.accessibility.speedNormal');
  };

  // Setting descriptions for info popup
  const settingInfo = {
    showIntroductions: {
      title: t('game.accessibility.showIntroductions'),
      description: 'Shows an introduction screen for each new letter before it appears in the game, helping you learn the letter before playing.'
    },
    highContrast: {
      title: t('game.accessibility.highContrast'),
      description: 'Increases the contrast between text and background colors to make letters easier to see and distinguish.'
    },
    randomLetters: {
      title: t('game.accessibility.randomLetters'),
      description: 'Letters appear in random order instead of the standard alphabetical sequence, providing varied practice.'
    },
    reducedMotion: {
      title: t('game.accessibility.reducedMotion'),
      description: 'Simplifies animations by removing rotation and complex movement patterns, making letters move in straight lines for easier tracking.'
    },
    gameSpeed: {
      title: t('game.accessibility.speed'),
      description: 'Controls how quickly letters move across the screen. Slower speeds give you more time to recognize and drag letters.'
    },
    gameFont: {
      title: 'Game Font',
      description: 'Choose from different fonts including dyslexia-friendly options. Some fonts are specially designed to make letters easier to distinguish.'
    },
    fontShuffle: {
      title: 'Font Shuffle',
      description: 'Each letter appears in a different random font from the previous one. This helps you recognize letters in various typefaces.'
    },
    slowRiver: {
      title: 'Slow River Mode',
      description: 'Letters move to the center of the screen and stay there instead of flowing off the edge. This gives you unlimited time to identify and place each letter.'
    },
    clickMode: {
      title: 'Click Mode',
      description: 'Click on a letter to select it, then click on a bucket to place it, instead of dragging. This makes the game easier to play if you have difficulty with dragging.'
    },
    associationMode: {
      title: 'Association Mode',
      description: 'Buckets display images, drag to the image which starts with the letter sound.'
    }
  };

const showInfo = (settingKey, event) => {
  if (settingInfo[settingKey]) {
    setInfoPopupContent(settingInfo[settingKey]);
    setShowInfoPopup(true);

    if (event) {
      const clientX = event.clientX || event.touches?.[0]?.clientX || 0;
      const clientY = event.clientY || event.touches?.[0]?.clientY || 0;

      const viewportWidth  = window.innerWidth  || document.documentElement.clientWidth  || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

      const horizontalPadding    = 16;   // px from left/right
      const verticalOffset       = 15;   // px below cursor when possible
      const bottomBuffer         = 24;   // px from bottom of screen
      const estimatedPopupHeight = 200;  // rough max popup height
      const maxPopupWidth        = 320;  // matches your maxWidth style

      // X: sit a bit to the right of the cursor, but not off the screen
      const rawX = clientX + 15;
      const x = Math.min(
        Math.max(rawX, horizontalPadding),
        viewportWidth - maxPopupWidth - horizontalPadding
      );

      // Y: prefer below the cursor, but clamp so there's a bottom buffer
      const rawY = clientY + verticalOffset;
      const maxY = viewportHeight - estimatedPopupHeight - bottomBuffer;
      const y = Math.min(rawY, maxY);

      setPopupPosition({ x, y });
    }
  }
};


  const fontOptions = [
    { value: 'default', label: 'Default' },
    { value: 'lexend', label: 'Lexend / Noto Sans (dyslexia-friendly)' },
    { value: 'comic-sans', label: 'Comic Sans' },
    { value: 'arial', label: 'Arial' },
    { value: 'verdana', label: 'Verdana' }
  ];

  return (
    <>
      {/* Language Settings */}
      <section className="section">
        <div className="section-header">
          <div className="section-title">
            <div className="wood-header">{t('settings.languageSettings')}</div>
          </div>
        </div>

        <div className="progress-card-small p-4">
          <h3 className="mb-3 font-heading text-sm font-bold text-arcade-text-main">
            {t('app.languagePicker.label')}
          </h3>
          <select
            id="settings-app-language-select"
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
          <p className="mt-2 text-xs text-arcade-text-muted">
            {t('app.languagePicker.helper')}
          </p>
        </div>

        <div className="progress-card-small p-4 mt-3">
          <h3 className="mb-3 font-heading text-sm font-bold text-arcade-text-main">
            {t('home.languagePicker.label')}
          </h3>
          <select
            id="settings-practice-language-select"
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
          <p className="mt-2 text-xs text-arcade-text-muted">
            {t('home.languagePicker.helper')}
          </p>
        </div>
      </section>

      {/* Kid Settings - Only show if in kid mode */}
      {isKidMode && (
        <section className="section" style={{ marginTop: '20px' }}>
          <div className="section-header">
            <div className="section-title">
              <div className="wood-header">Kid Settings</div>
            </div>
          </div>

          <div className="progress-card-small p-4">
            <h3 className="mb-3 font-heading text-sm font-bold text-arcade-text-main">
              Age Range
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => updateKidSettings({ ageBand: '4-6' })}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  ageBand === '4-6'
                    ? 'bg-arcade-accent-blue text-white'
                    : 'bg-arcade-panel-light text-arcade-text-main border-2 border-arcade-panel-border'
                }`}
              >
                <div className="text-2xl mb-1">👶</div>
                Ages 4-6
              </button>
              <button
                onClick={() => updateKidSettings({ ageBand: '7-9' })}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  ageBand === '7-9'
                    ? 'bg-arcade-accent-blue text-white'
                    : 'bg-arcade-panel-light text-arcade-text-main border-2 border-arcade-panel-border'
                }`}
              >
                <div className="text-2xl mb-1">🧒</div>
                Ages 7-9
              </button>
            </div>
          </div>

          <div className="progress-card-small p-4 mt-3">
            <h3 className="mb-3 font-heading text-sm font-bold text-arcade-text-main">
              Learning Buddy
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => updateKidSettings({ track: 'explorer' })}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  track === 'explorer'
                    ? 'bg-arcade-accent-orange text-white'
                    : 'bg-arcade-panel-light text-arcade-text-main border-2 border-arcade-panel-border'
                }`}
              >
                <div className="text-2xl mb-1">🧒</div>
                Explorer
                <div className="text-xs mt-1 opacity-75">Learn by discovering</div>
              </button>
              <button
                onClick={() => updateKidSettings({ track: 'builder' })}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  track === 'builder'
                    ? 'bg-arcade-accent-orange text-white'
                    : 'bg-arcade-panel-light text-arcade-text-main border-2 border-arcade-panel-border'
                }`}
              >
                <div className="text-2xl mb-1">👷</div>
                Builder
                <div className="text-xs mt-1 opacity-75">Learn by creating</div>
              </button>
            </div>
          </div>

          <div className="progress-card-small p-4 mt-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-arcade-text-main">
                Parent Mode
              </span>
              <input
                type="checkbox"
                checked={parentMode}
                onChange={(e) => updateKidSettings({ parentMode: e.target.checked })}
                className="h-5 w-5 rounded border-2 text-arcade-accent-blue focus:ring-arcade-accent-blue"
              />
            </label>
            <p className="mt-2 text-xs text-arcade-text-muted">
              Enable to access advanced settings
            </p>
          </div>
        </section>
      )}

      {/* Game Accessibility Settings */}
      <section className="section" style={{ marginTop: '20px' }}>
        <div className="section-header">
          <div className="section-title">
            <div className="wood-header">{t('settings.gameSettings')}</div>
          </div>
        </div>

        <div className="progress-card-small p-4 relative">
          {/* Info icon */}
          <div className="absolute right-3 top-3 text-arcade-text-muted text-xl">
            ⓘ
          </div>

          <div className="space-y-4 mt-2">
            {/* Font Dropdown */}
            <div className="border-b border-arcade-panel-border pb-4">
              <label htmlFor="settings-font-select" className="block text-sm text-arcade-text-main mb-2">
                <span
                  className="cursor-pointer hover:text-arcade-accent-orange"
                  onClick={(e) => showInfo('gameFont', e)}
                  onMouseEnter={(e) => showInfo('gameFont', e)}
                  onMouseLeave={() => setShowInfoPopup(false)}
                >
                  Game Font
                </span>
              </label>
              <select
                id="settings-font-select"
                value={gameFont}
                onChange={(e) => setGameFont(e.target.value)}
                className="w-full rounded-xl border-2 border-arcade-panel-border bg-arcade-panel-light px-3 py-2 text-xs font-semibold text-arcade-text-main shadow-inner"
              >
                {fontOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between border-b border-arcade-panel-border pb-4">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('fontShuffle', e)}
                onMouseEnter={(e) => showInfo('fontShuffle', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Font Shuffle
              </span>
              <input
                id="settings-font-shuffle-toggle"
                type="checkbox"
                checked={fontShuffle}
                onChange={(e) => setFontShuffle(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('showIntroductions', e)}
                onMouseEnter={(e) => showInfo('showIntroductions', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.showIntroductions')}
              </span>
              <input
                id="settings-toggle-introductions"
                type="checkbox"
                checked={showIntroductions}
                onChange={(e) => setShowIntroductions(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('highContrast', e)}
                onMouseEnter={(e) => showInfo('highContrast', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.highContrast')}
              </span>
              <input
                id="settings-high-contrast-toggle"
                type="checkbox"
                checked={highContrast}
                onChange={(e) => setHighContrast(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('randomLetters', e)}
                onMouseEnter={(e) => showInfo('randomLetters', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.randomLetters')}
              </span>
              <input
                id="settings-random-letters-toggle"
                type="checkbox"
                checked={randomLetters}
                onChange={(e) => setRandomLetters(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('reducedMotion', e)}
                onMouseEnter={(e) => showInfo('reducedMotion', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                {t('game.accessibility.reducedMotion')}
              </span>
              <input
                id="settings-reduced-motion-toggle"
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('slowRiver', e)}
                onMouseEnter={(e) => showInfo('slowRiver', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Slow River Mode
              </span>
              <input
                id="settings-slow-river-toggle"
                type="checkbox"
                checked={slowRiver}
                onChange={(e) => setSlowRiver(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('clickMode', e)}
                onMouseEnter={(e) => showInfo('clickMode', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Click Mode
              </span>
              <input
                id="settings-click-mode-toggle"
                type="checkbox"
                checked={clickMode}
                onChange={(e) => setClickMode(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <label className="flex items-center justify-between">
              <span
                className="text-sm text-arcade-text-main cursor-pointer hover:text-arcade-accent-orange"
                onClick={(e) => showInfo('associationMode', e)}
                onMouseEnter={(e) => showInfo('associationMode', e)}
                onMouseLeave={() => setShowInfoPopup(false)}
              >
                Association Mode
              </span>
              <input
                id="settings-association-mode-toggle"
                type="checkbox"
                checked={associationMode}
                onChange={(e) => setAssociationMode(e.target.checked)}
                className="h-5 w-5 rounded border-arcade-panel-border bg-arcade-panel-light text-arcade-accent-orange focus:ring-arcade-accent-orange"
              />
            </label>

            <div>
              <label htmlFor="settings-game-speed-slider" className="block text-sm text-arcade-text-main mb-2">
                <span
                  className="cursor-pointer hover:text-arcade-accent-orange"
                  onClick={(e) => showInfo('gameSpeed', e)}
                  onMouseEnter={(e) => showInfo('gameSpeed', e)}
                  onMouseLeave={() => setShowInfoPopup(false)}
                >
                  {t('game.accessibility.speed')} (<span id="settings-speed-label">{getSpeedLabel(gameSpeed)}</span>)
                </span>
              </label>
              <input
                id="settings-game-speed-slider"
                type="range"
                min="10"
                max="24"
                value={gameSpeed}
                onChange={(e) => setGameSpeed(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Info Popup Tooltip */}
      {showInfoPopup && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${popupPosition.x + 15}px`,
            top: `${popupPosition.y + 15}px`,
            maxWidth: '320px'
          }}
        >
          <div
            className="progress-card-small p-4 shadow-lg pointer-events-auto"
            style={{
              border: '2px solid rgba(235, 179, 105, 0.95)',
              boxShadow: '0 4px 0 rgba(214, 140, 64, 1), 0 8px 12px rgba(214, 140, 64, 0.6)'
            }}
            onMouseEnter={() => setShowInfoPopup(true)}
            onMouseLeave={() => setShowInfoPopup(false)}
          >
            <h3 className="font-heading text-sm font-bold text-arcade-text-main mb-2">
              {infoPopupContent.title}
            </h3>
            <p className="text-xs text-arcade-text-main">
              {infoPopupContent.description}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
