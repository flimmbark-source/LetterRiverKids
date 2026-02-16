import { useMemo } from 'react';
import { useProgress } from '../context/ProgressContext.jsx';

/**
 * Hook for accessing kid mode state and settings
 * Centralizes kid mode detection logic
 */
export function useKidMode() {
  const { player, updateKidSettings, toggleKidMode } = useProgress();

  const value = useMemo(() => ({
    isKidMode: player.kidMode ?? true, // Default to kid mode
    kidSettings: player.kidSettings ?? {
      ageBand: '4-6',
      track: 'explorer',
      parentMode: false,
      onboardingComplete: false
    },
    ageBand: player.kidSettings?.ageBand ?? '4-6',
    track: player.kidSettings?.track ?? 'explorer',
    parentMode: player.kidSettings?.parentMode ?? false,
    onboardingComplete: player.kidSettings?.onboardingComplete ?? false,
    updateKidSettings,
    toggleKidMode,
    // Helper flags for easier conditionals
    isYounger: (player.kidSettings?.ageBand ?? '4-6') === '4-6',
    isOlder: (player.kidSettings?.ageBand ?? '4-6') === '7-9',
    isExplorer: (player.kidSettings?.track ?? 'explorer') === 'explorer',
    isBuilder: (player.kidSettings?.track ?? 'explorer') === 'builder'
  }), [player.kidMode, player.kidSettings, updateKidSettings, toggleKidMode]);

  return value;
}

export default useKidMode;
