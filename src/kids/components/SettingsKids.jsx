import React from 'react';

export default function SettingsKids({ settings, onChange }) {
  const update = (key, value) => onChange({ ...settings, [key]: value });

  return (
    <section className="kids-card">
      <h3>⚙️ Parent Controls</h3>
      <label>
        Screen-time reminder (minutes)
        <input
          type="number"
          min="5"
          max="30"
          value={settings.breakReminderMinutes}
          onChange={(event) => update('breakReminderMinutes', Number(event.target.value) || 10)}
        />
      </label>
      <label>
        Voice speed
        <input
          type="range"
          min="0.7"
          max="1.2"
          step="0.1"
          value={settings.audioRate}
          onChange={(event) => update('audioRate', Number(event.target.value))}
        />
      </label>
      <div className="kids-toggle-grid">
        <label><input type="checkbox" checked={settings.highContrast} onChange={(e) => update('highContrast', e.target.checked)} /> High contrast</label>
        <label><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} /> Reduced motion</label>
        <label><input type="checkbox" checked={settings.clickMode} onChange={(e) => update('clickMode', e.target.checked)} /> Click mode</label>
        <label><input type="checkbox" checked={settings.slowRiver} onChange={(e) => update('slowRiver', e.target.checked)} /> Slow river mode</label>
      </div>
    </section>
  );
}
