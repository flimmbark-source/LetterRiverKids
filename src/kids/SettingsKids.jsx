import React from 'react';
import { useKidsSettings } from './context/KidsSettingsContext.jsx';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-2xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-900">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />
    </label>
  );
}

export default function SettingsKids() {
  const { settings, updateSettings } = useKidsSettings();

  return (
    <section className="grid gap-3 rounded-3xl border-4 border-sky-200 bg-sky-50 p-4">
      <h3 className="text-xl font-black text-sky-900">Parent accessibility settings</h3>
      <Toggle label="Click mode (no drag)" checked={settings.clickMode} onChange={(value) => updateSettings({ clickMode: value })} />
      <Toggle label="Slow river mode" checked={settings.slowRiver} onChange={(value) => updateSettings({ slowRiver: value })} />
      <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => updateSettings({ reducedMotion: value })} />
      <Toggle label="High contrast" checked={settings.highContrast} onChange={(value) => updateSettings({ highContrast: value })} />

      <label className="rounded-2xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-900">
        Session break timer (minutes): {settings.sessionLimitMinutes}
        <input
          type="range"
          min={5}
          max={20}
          step={1}
          className="mt-2 w-full"
          value={settings.sessionLimitMinutes}
          onChange={(event) => updateSettings({ sessionLimitMinutes: Number(event.target.value) })}
        />
      </label>
    </section>
  );
}
