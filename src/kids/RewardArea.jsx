import React from 'react';
import { useStickerReward } from './context/StickerRewardContext.jsx';

export default function RewardArea() {
  const { rewardState } = useStickerReward();

  return (
    <section className="rounded-3xl border-4 border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-xl font-black text-emerald-900">River World</h3>
      <p className="text-sm font-semibold text-emerald-800">Stickers earned: {rewardState.unlocked.length}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rewardState.world.slice(-20).map((item) => (
          <span key={item.id} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-2xl">
            {item.sticker}
          </span>
        ))}
      </div>
    </section>
  );
}
