import React from 'react';

const STICKER_STORAGE_KEY = 'kidsRewardsV1';

const stickers = ['🐸', '🦊', '🐳', '🌈', '⭐', '🍀', '🦋', '🍓', '🚤', '🪷'];

const StickerRewardContext = React.createContext(null);

function loadRewards() {
  try {
    return JSON.parse(localStorage.getItem(STICKER_STORAGE_KEY) ?? '{"unlocked":[],"world":[]}');
  } catch {
    return { unlocked: [], world: [] };
  }
}

export function StickerRewardProvider({ children }) {
  const [rewardState, setRewardState] = React.useState(loadRewards);

  React.useEffect(() => {
    localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(rewardState));
  }, [rewardState]);

  const unlockSticker = React.useCallback((letterId) => {
    const sticker = stickers[Math.floor(Math.random() * stickers.length)];
    setRewardState((prev) => ({
      unlocked: [...prev.unlocked, { sticker, letterId, unlockedAt: Date.now() }],
      world: [...prev.world, { id: `${Date.now()}-${Math.random()}`, sticker }]
    }));
    return sticker;
  }, []);

  const value = React.useMemo(() => ({ rewardState, unlockSticker }), [rewardState, unlockSticker]);
  return <StickerRewardContext.Provider value={value}>{children}</StickerRewardContext.Provider>;
}

export function useStickerReward() {
  const ctx = React.useContext(StickerRewardContext);
  if (!ctx) throw new Error('useStickerReward must be used inside provider');
  return ctx;
}
