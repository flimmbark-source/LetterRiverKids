import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import HomeView from './views/HomeView.jsx';
import AchievementsView from './views/AchievementsView.jsx';
import LearnView from './views/LearnView.jsx';
import SettingsView from './views/SettingsView.jsx';
import DailyView from './views/DailyView.jsx';
import KidsApp from './kids/KidsApp.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProgressProvider } from './context/ProgressContext.jsx';
import { SRSProvider } from './context/SRSContext.jsx';
import { GameProvider, useGame } from './context/GameContext.jsx';
import { LocalizationProvider, useLocalization } from './context/LocalizationContext.jsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';
import { TutorialProvider, useTutorial } from './context/TutorialContext.jsx';
import { getFormattedLanguageName } from './lib/languageUtils.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import OfflineIndicator from './components/OfflineIndicator.jsx';
import MigrationInitializer from './components/MigrationInitializer.jsx';
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx';

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M4.5 10.5 12 4l7.5 6.5v8a1 1 0 0 1-1 1h-4.5v-5.5h-4V19.5H5.5a1 1 0 0 1-1-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M8 5.14v13.72L19 12z" fill="currentColor" />
    </svg>
  );
}

function TrophyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M18 4h2a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9V13a2 2 0 0 1-2 2h-1v2.18A3 3 0 0 1 16 20v1H8v-1a3 3 0 0 1 2-2.82V15H9a2 2 0 0 1-2-2v-1.1A5 5 0 0 1 3 7V5a1 1 0 0 1 1-1h2V3h12zm0 2V5H6v1a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V5z"
        fill="currentColor"
      />
    </svg>
  );
}

function BookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M5 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H5zM19 4h-4a1 1 0 0 0-1 1v17a3 3 0 0 1 3-3h2a1 1 0 0 0 1-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function LanguageSelect({ selectId, value, onChange, label, helperText, selectClassName = '', options = [] }) {
  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={selectId} className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border-4 border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-inner focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/40 sm:text-base ${selectClassName}`}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {helperText ? <p className="text-xs font-semibold text-slate-400">{helperText}</p> : null}
    </div>
  );
}

function LanguageOnboardingModal() {
  const {
    hasSelectedLanguage,
    languageId,
    setLanguageId,
    appLanguageId,
    setAppLanguageId,
    markLanguageSelected,
    languageOptions
  } = useLanguage();
  const { t: translateOnboarding } = useLocalization();
  const { currentTutorial, currentStepIndex } = useTutorial();
  const [pendingPracticeId, setPendingPracticeId] = React.useState(languageId);
  const [pendingAppId, setPendingAppId] = React.useState(appLanguageId);

  React.useEffect(() => {
    setPendingPracticeId(languageId);
  }, [languageId]);

  React.useEffect(() => {
    setPendingAppId(appLanguageId);
  }, [appLanguageId]);

  if (hasSelectedLanguage) return null;

  // Disable continue button during tutorial until step 4 (confirmLanguages)
  const isContinueDisabled = currentTutorial?.id === 'firstTime' && currentStepIndex < 3;

  const handleChange = (nextId) => {
    setPendingPracticeId(nextId);
    setLanguageId(nextId);
  };

  const handleAppLanguageChange = (nextId) => {
    setPendingAppId(nextId);
    setAppLanguageId(nextId);
  };

  const handleContinue = () => {
    if (!isContinueDisabled) {
      markLanguageSelected();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 language-onboarding-overlay" style={{
      background: 'linear-gradient(135deg, #E8FFE3 0%, #E0FBFD 100%)'
    }}>
      <div className="w-full max-w-lg rounded-3xl p-6 text-center shadow-2xl sm:p-8 language-onboarding-card" style={{
        background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
        border: '3px solid #A7F3D0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 className="text-2xl font-bold sm:text-3xl" style={{
          fontFamily: '"Baloo 2", system-ui, sans-serif',
          color: '#4a2208'
        }}>
          {translateOnboarding('app.languagePicker.onboardingTitle')}
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: '#6c3b14' }}>
          {translateOnboarding('app.languagePicker.onboardingSubtitle')}
        </p>
        <div className="mt-6 space-y-5 text-left">
          <div className="flex flex-col gap-2 onboarding-app-language-section">
            <label htmlFor="onboarding-app-language" className="text-xs font-bold uppercase tracking-wider" style={{ color: '#b07737' }}>
              {translateOnboarding('app.languagePicker.label')}
            </label>
            <select
              id="onboarding-app-language"
              value={pendingAppId}
              onChange={(event) => handleAppLanguageChange(event.target.value)}
              className="w-full rounded-xl border-2 px-3 py-2 text-sm font-semibold shadow-inner sm:text-base onboarding-app-language-select"
              style={{
                borderColor: 'rgba(235, 179, 105, 0.95)',
                background: '#fff5dd',
                color: '#4a2208'
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {getFormattedLanguageName(option, translateOnboarding)}
                </option>
              ))}
            </select>
            <p className="text-xs font-semibold" style={{ color: '#b07737' }}>
              {translateOnboarding('app.languagePicker.helper')}
            </p>
          </div>
          <div className="flex flex-col gap-2 onboarding-practice-language-section">
            <label htmlFor="onboarding-language" className="text-xs font-bold uppercase tracking-wider" style={{ color: '#b07737' }}>
              {translateOnboarding('app.practicePicker.label')}
            </label>
            <select
              id="onboarding-language"
              value={pendingPracticeId}
              onChange={(event) => handleChange(event.target.value)}
              className="w-full rounded-xl border-2 px-3 py-2 text-sm font-semibold shadow-inner sm:text-base onboarding-practice-language-select"
              style={{
                borderColor: 'rgba(235, 179, 105, 0.95)',
                background: '#fff5dd',
                color: '#4a2208'
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {getFormattedLanguageName(option, translateOnboarding)}
                </option>
              ))}
            </select>
            <p className="text-xs font-semibold" style={{ color: '#b07737' }}>
              {translateOnboarding('app.practicePicker.helper')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className="mt-6 w-full rounded-full px-5 py-3 text-base font-bold shadow-lg transition-all active:translate-y-1 sm:w-auto sm:px-8 onboarding-continue-button"
          style={{
            border: 0,
            fontFamily: '"Nunito", system-ui, sans-serif',
            color: '#4a1a06',
            background: 'radial-gradient(circle at 20% 0, #ffe6c7 0, #ffb45f 40%, #ff7a3b 100%)',
            boxShadow: '0 4px 0 #c85a24, 0 7px 12px rgba(200, 90, 36, 0.7)',
            opacity: isContinueDisabled ? 0.5 : 1,
            cursor: isContinueDisabled ? 'not-allowed' : 'pointer'
          }}
          onMouseDown={(e) => {
            if (!isContinueDisabled) {
              e.currentTarget.style.transform = 'translateY(2px)';
              e.currentTarget.style.boxShadow = '0 2px 0 #c85a24, 0 5px 12px rgba(200, 90, 36, 0.7)';
            }
          }}
          onMouseUp={(e) => {
            if (!isContinueDisabled) {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 4px 0 #c85a24, 0 7px 12px rgba(200, 90, 36, 0.7)';
            }
          }}
        >
          {translateOnboarding('app.languagePicker.confirm')}
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { openGame, closeGame, isVisible: isGameVisible, isGameRunning } = useGame();
  const { t, interfaceLanguagePack } = useLocalization();
  const { currentTutorial, currentStepIndex } = useTutorial();
  const fontClass = interfaceLanguagePack.metadata?.fontClass ?? 'language-font-hebrew';
  const direction = interfaceLanguagePack.metadata?.textDirection ?? 'ltr';
  const [inConversationPractice, setInConversationPractice] = React.useState(false);

  // Check if we're in conversation practice mode
  React.useEffect(() => {
    const checkConversationMode = () => {
      setInConversationPractice(document.body.classList.contains('in-conversation-practice'));
    };

    // Check initially
    checkConversationMode();

    // Set up observer to watch for class changes
    const observer = new MutationObserver(checkConversationMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Check if play button should be disabled during tutorial
  const isPlayDisabled = currentTutorial?.id === 'firstTime' && currentStepIndex < 4;

  const handlePlay = React.useCallback(
    (event) => {
      event.preventDefault();
      if (!isPlayDisabled) {
        openGame({ autostart: false });
      }
    },
    [openGame, isPlayDisabled]
  );

  const handleNavClick = React.useCallback(() => {
    // Close the game modal if it's open
    if (isGameVisible) {
      closeGame?.();
    }
  }, [isGameVisible, closeGame]);

  return (
    <div className="app-shell">
      <LanguageOnboardingModal />
      <OfflineIndicator />
      <PWAInstallPrompt />
      <main className="flex-1 main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeView />} />
          <Route path="/achievements" element={<AchievementsView />} />
          <Route path="/read" element={<LearnView />} />
          <Route path="/daily" element={<DailyView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/kids" element={<KidsApp />} />
          <Route path="/play" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      {!(isGameVisible && isGameRunning) && !inConversationPractice && (
        <nav className="bottom-nav">
          <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <div className="nav-icon-shell">
              <span>🏠</span>
            </div>
            <span className="label">{t('app.nav.home')}</span>
          </NavLink>
          <NavLink to="/read" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <div className="nav-icon-shell">
              <span>📚</span>
            </div>
            <span className="label">{t('app.nav.read')}</span>
          </NavLink>
          <button
            type="button"
            onClick={handlePlay}
            className="nav-item nav-item-fab"
            disabled={isPlayDisabled}
            style={isPlayDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <div className="play-fab">
              <span>▶</span>
            </div>
          </button>
          <NavLink to="/achievements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <div className="nav-icon-shell">
              <span>🏆</span>
            </div>
            <span className="label">{t('app.nav.achievements')}</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <div className="nav-icon-shell">
              <span>⚙️</span>
            </div>
            <span className="label">{t('app.nav.settings')}</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MigrationInitializer>
        <LanguageProvider>
          <LocalizationProvider>
            <ToastProvider>
              <ProgressProvider>
                <SRSProvider>
                  <TutorialProvider>
                    <GameProvider>
                      <Shell />
                    </GameProvider>
                  </TutorialProvider>
                </SRSProvider>
              </ProgressProvider>
            </ToastProvider>
          </LocalizationProvider>
        </LanguageProvider>
      </MigrationInitializer>
    </ErrorBoundary>
  );
}
