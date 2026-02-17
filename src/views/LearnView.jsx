import React from 'react';
import { useLocalization } from '../context/LocalizationContext.jsx';
import { useGame } from '../context/GameContext.jsx';

export default function LearnView() {
  const { t } = useLocalization();
  const { openGame } = useGame();

  return (
    <div className="space-y-6 px-2 py-4">
      <header className="space-y-2 px-1">
        <h2 className="text-2xl font-bold" style={{ color: '#4a2208' }}>
          {t('read.title', 'Learn')}
        </h2>
        <p className="text-sm" style={{ color: '#6c3b14' }}>
          Practice your letters every day and watch your skills grow!
        </p>
      </header>

      {/* Encouragement card */}
      <div
        className="rounded-2xl p-5 text-center space-y-3"
        style={{
          background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
          border: '2px solid #A7F3D0',
        }}
      >
        <div className="text-5xl">🎓</div>
        <h3 className="text-xl font-bold" style={{ color: '#4a2208' }}>
          Keep Practicing!
        </h3>
        <p className="text-sm" style={{ color: '#6c3b14' }}>
          The best way to learn letters is to play Letter River every day. Each catch makes you stronger!
        </p>
        <button
          className="mt-2 rounded-full px-6 py-3 text-base font-bold shadow-lg transition-all"
          style={{
            border: 0,
            color: '#4a1a06',
            background: 'radial-gradient(circle at 20% 0, #ffe6c7 0, #ffb45f 40%, #ff7a3b 100%)',
            boxShadow: '0 4px 0 #c85a24, 0 7px 12px rgba(200, 90, 36, 0.5)',
          }}
          onClick={() => openGame({ autostart: false })}
        >
          Play Now! 🌊
        </button>
      </div>

      {/* Tips card */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: 'linear-gradient(135deg, #fff9eb 0%, #ffe5bd 100%)',
          border: '2px solid rgba(235, 179, 105, 0.7)',
        }}
      >
        <h3 className="text-base font-bold" style={{ color: '#4a2208' }}>
          💡 Quick Tips
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: '#6c3b14' }}>
          <li>🎯 Turn on <strong>Association Mode</strong> to see pictures next to letters</li>
          <li>🐢 Try <strong>Slow River Mode</strong> if letters move too fast</li>
          <li>👆 Use <strong>Click Mode</strong> instead of dragging</li>
          <li>🔊 Letters will say their sounds when they appear</li>
        </ul>
      </div>

      {/* Coming soon placeholder for future reading mechanics */}
      <div
        className="rounded-2xl p-4 opacity-60"
        style={{
          background: '#f3f4f6',
          border: '2px dashed #d1d5db',
        }}
      >
        <p className="text-sm text-center" style={{ color: '#6b7280' }}>
          More activities coming soon! 🚀
        </p>
      </div>
    </div>
  );
}
