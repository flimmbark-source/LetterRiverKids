import React from 'react';
import { useKidsSettings } from './context/KidsSettingsContext.jsx';

export default function ProfileSetup() {
  const { settings, updateSettings } = useKidsSettings();
  const [draft, setDraft] = React.useState({
    childName: settings.childName,
    age: settings.age,
    track: settings.track,
    preferredLanguage: settings.preferredLanguage
  });

  const completeSetup = () => {
    updateSettings({ ...draft, onboardingComplete: true });
  };

  return (
    <section className="rounded-3xl border-4 border-amber-200 bg-amber-50 p-6 shadow-lg">
      <h2 className="text-2xl font-black text-amber-900">Welcome to Letter River Kids</h2>
      <p className="mt-2 text-amber-700">Parent setup: choose age and learning track before your child starts.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold text-amber-800">
          Child name
          <input
            className="rounded-xl border-2 border-amber-300 p-2"
            value={draft.childName}
            onChange={(event) => setDraft((prev) => ({ ...prev, childName: event.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-amber-800">
          Age
          <input
            type="number"
            min={3}
            max={7}
            className="rounded-xl border-2 border-amber-300 p-2"
            value={draft.age}
            onChange={(event) => setDraft((prev) => ({ ...prev, age: Number(event.target.value) }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-amber-800">
          Track
          <select
            className="rounded-xl border-2 border-amber-300 p-2"
            value={draft.track}
            onChange={(event) => setDraft((prev) => ({ ...prev, track: event.target.value }))}
          >
            <option value="explorer">Explorer (ages 3–5)</option>
            <option value="builder">Builder (ages 5–7)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-amber-800">
          Voice language
          <select
            className="rounded-xl border-2 border-amber-300 p-2"
            value={draft.preferredLanguage}
            onChange={(event) => setDraft((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
          >
            <option value="en">English</option>
            <option value="he">Hebrew</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={completeSetup}
        className="mt-5 rounded-full bg-amber-500 px-5 py-3 font-black text-amber-950"
      >
        Save and Start
      </button>
    </section>
  );
}
