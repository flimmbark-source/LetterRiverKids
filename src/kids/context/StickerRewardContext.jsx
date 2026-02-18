import React from 'react';

const STORAGE_KEY = 'kidsStickersV1';
const STICKERS = ['🐸', '🐟', '🦆', '🌈', '🌼', '🛶', '🦋', '🌟'];

const StickerRewardContext = React.createContext(null);

export function StickerRewardProvider({ children }) {
  const [stickers, setStickers] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
  }, [stickers]);

  const unlockSticker = React.useCallback(() => {
    const unlocked = STICKERS[Math.floor(Math.random() * STICKERS.length)];
    setStickers((previous) => [...previous, { icon: unlocked, unlockedAt: Date.now() }]);
    return unlocked;
  }, []);

  const value = React.useMemo(() => ({ stickers, unlockSticker }), [stickers, unlockSticker]);
  return <StickerRewardContext.Provider value={value}>{children}</StickerRewardContext.Provider>;
}

export function useStickerRewards() {
  const context = React.useContext(StickerRewardContext);
  if (!context) throw new Error('useStickerRewards must be used within StickerRewardProvider');
  return context;
}
