import React from 'react';

const STORAGE_KEY = 'kidsSettingsV1';

const defaults = {
  childName: '',
  age: 4,
  track: 'explorer',
  preferredLanguage: 'en',
  clickMode: true,
  slowRiver: true,
  reducedMotion: false,
  highContrast: false,
  animationIntensity: 'medium',
  gameSpeed: 1,
  voiceVolume: 1,
  musicVolume: 0.5,
  effectsVolume: 0.8,
  sessionLimitMinutes: 10,
  onboardingComplete: false
};

const KidsSettingsContext = React.createContext(null);

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function KidsSettingsProvider({ children }) {
  const [settings, setSettings] = React.useState(loadSettings);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  React.useEffect(() => {
    document.body.classList.toggle('high-contrast', settings.highContrast);
  }, [settings.highContrast]);

  const updateSettings = React.useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = React.useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <KidsSettingsContext.Provider value={value}>{children}</KidsSettingsContext.Provider>;
}

export function useKidsSettings() {
  const ctx = React.useContext(KidsSettingsContext);
  if (!ctx) throw new Error('useKidsSettings must be used inside KidsSettingsProvider');
  return ctx;
}
