/**
 * Utility to clean up and migrate localStorage data
 * Run this if you encounter data structure errors
 */

export function cleanupPlayerData() {
  try {
    const keys = Object.keys(localStorage).filter(key =>
      key.includes('player') || key.includes('progress')
    );

    console.log('[Storage Cleanup] Found keys:', keys);

    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return;

        const parsed = JSON.parse(data);

        // Fix: Ensure modesPlayed is an array
        if (parsed.modesPlayed !== undefined && !Array.isArray(parsed.modesPlayed)) {
          parsed.modesPlayed = [];
        }

        // Fix: Ensure totals exists and is properly structured
        if (parsed.totals) {
          if (typeof parsed.totals.sessions !== 'number') {
            parsed.totals.sessions = 0;
          }
          if (typeof parsed.totals.perfectCatches !== 'number') {
            parsed.totals.perfectCatches = 0;
          }
        }

        // Fix: Add kidMode if missing
        if (parsed.kidMode === undefined) {
          parsed.kidMode = true;
        }

        // Fix: Add kidSettings if missing
        if (!parsed.kidSettings) {
          parsed.kidSettings = {
            ageBand: '4-6',
            track: 'explorer',
            parentMode: false,
            onboardingComplete: false
          };
        }

        // Save cleaned data back
        localStorage.setItem(key, JSON.stringify(parsed));
        console.log(`[Storage Cleanup] Cleaned: ${key}`);
      } catch (err) {
        console.warn(`[Storage Cleanup] Failed to clean ${key}:`, err);
      }
    });

    console.log('[Storage Cleanup] Complete!');
    return true;
  } catch (error) {
    console.error('[Storage Cleanup] Error:', error);
    return false;
  }
}

export function resetPlayerData() {
  if (!confirm('This will reset all your progress. Are you sure?')) {
    return false;
  }

  try {
    const keys = Object.keys(localStorage).filter(key =>
      key.includes('player') ||
      key.includes('progress') ||
      key.includes('badges') ||
      key.includes('streak') ||
      key.includes('daily')
    );

    keys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[Storage Reset] Removed: ${key}`);
    });

    console.log('[Storage Reset] Complete! Please refresh the page.');
    return true;
  } catch (error) {
    console.error('[Storage Reset] Error:', error);
    return false;
  }
}

// Auto-run cleanup on import (safe operation)
if (typeof window !== 'undefined') {
  console.log('[Storage Cleanup] Running automatic cleanup...');
  cleanupPlayerData();
}
