import React from 'react';
import { useStickerRewards } from '../context/StickerRewardContext.jsx';

export default function RewardArea() {
  const { stickers } = useStickerRewards();

  return (
    <section className="kids-card">
      <h3>🌈 River World</h3>
      <p>Stickers unlocked: {stickers.length}</p>
      <div className="kids-sticker-grid" aria-live="polite">
        {stickers.length ? stickers.map((sticker, index) => (
          <span key={`${sticker.unlockedAt}-${index}`} className="kids-sticker">{sticker.icon}</span>
        )) : <span>Earn stickers by getting correct answers in a row.</span>}
      </div>
    </section>
  );
}
