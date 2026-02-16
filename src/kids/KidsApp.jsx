import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import GameKids from './components/GameKids.jsx';
import ParentDashboard from './components/ParentDashboard.jsx';
import ProfileSetup from './components/ProfileSetup.jsx';
import RewardArea from './components/RewardArea.jsx';
import SettingsKids from './components/SettingsKids.jsx';
import { KidsProgressProvider } from './context/KidsProgressContext.jsx';
import { StickerRewardProvider } from './context/StickerRewardContext.jsx';

const PROFILE_KEY = 'kidsProfileV1';
const SETTINGS_KEY = 'kidsSettingsV1';

function useStoredState(key, fallback) {
  const [value, setValue] = React.useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function KidsAppInner() {
  const { languageId, appLanguageId } = useLanguage();
  const [profile, setProfile] = useStoredState(PROFILE_KEY, null);
  const [settings, setSettings] = useStoredState(SETTINGS_KEY, {
    breakReminderMinutes: 10,
    highContrast: false,
    reducedMotion: false,
    clickMode: true,
    slowRiver: false,
    audioRate: 1,
  });
  const [showDashboard, setShowDashboard] = React.useState(false);
  const [breakLocked, setBreakLocked] = React.useState(false);
  const [gateAnswer, setGateAnswer] = React.useState('');

  React.useEffect(() => {
    if (!profile) return undefined;
    const timeout = setTimeout(() => setBreakLocked(true), settings.breakReminderMinutes * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [profile, settings.breakReminderMinutes]);

  if (!profile) {
    return <ProfileSetup onComplete={setProfile} />;
  }

  if (breakLocked) {
    const expectedAnswer = 7;
    return (
      <section className="kids-card">
        <h2>⏸️ Break Time</h2>
        <p>Ask a parent to unlock. What is 3 + 4?</p>
        <input value={gateAnswer} onChange={(event) => setGateAnswer(event.target.value)} />
        <button
          type="button"
          onClick={() => {
            if (Number(gateAnswer) === expectedAnswer) {
              setBreakLocked(false);
              setGateAnswer('');
            }
          }}
        >
          Parent unlock
        </button>
      </section>
    );
  }

  return (
    <div className="kids-layout">
      <header className="kids-header">
        <h1>Letter River Kids</h1>
        <p>Hello {profile.name}! Track: {profile.track}</p>
        <button type="button" onClick={() => setShowDashboard((value) => !value)}>
          {showDashboard ? 'Back to game' : 'Parent dashboard'}
        </button>
      </header>
      {showDashboard ? (
        <>
          <SettingsKids settings={settings} onChange={setSettings} />
          <ParentDashboard profile={profile} />
        </>
      ) : (
        <>
          <GameKids profile={profile} settings={settings} languageId={languageId} appLanguageId={appLanguageId} />
          <RewardArea />
        </>
      )}
    </div>
  );
}

export default function KidsApp() {
  return (
    <KidsProgressProvider>
      <StickerRewardProvider>
        <KidsAppInner />
      </StickerRewardProvider>
    </KidsProgressProvider>
  );
}
