import React from 'react';
import GameKids from './GameKids.jsx';
import ProfileSetup from './ProfileSetup.jsx';
import SettingsKids from './SettingsKids.jsx';
import RewardArea from './RewardArea.jsx';
import ParentDashboard from './ParentDashboard.jsx';
import { KidsSettingsProvider, useKidsSettings } from './context/KidsSettingsContext.jsx';
import { KidsProgressProvider } from './context/KidsProgressContext.jsx';
import { StickerRewardProvider } from './context/StickerRewardContext.jsx';

function KidsAppShell() {
  const { settings } = useKidsSettings();

  if (!settings.onboardingComplete) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <ProfileSetup />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <GameKids />
        <RewardArea />
      </div>
      <div className="space-y-4">
        <SettingsKids />
        <ParentDashboard />
      </div>
    </div>
  );
}

export default function KidsApp() {
  return (
    <KidsSettingsProvider>
      <KidsProgressProvider>
        <StickerRewardProvider>
          <KidsAppShell />
        </StickerRewardProvider>
      </KidsProgressProvider>
    </KidsSettingsProvider>
  );
}
