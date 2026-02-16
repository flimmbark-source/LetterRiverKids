import React from 'react';

export default function ProfileSetup({ onComplete }) {
  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState(4);
  const [track, setTrack] = React.useState('explorer');

  return (
    <section className="kids-card">
      <h2>👨‍👩‍👧 Parent Setup</h2>
      <p>Create a profile before your child starts playing.</p>
      <label>
        Child name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="River Friend" />
      </label>
      <label>
        Age
        <input type="number" min="3" max="7" value={age} onChange={(event) => setAge(Number(event.target.value) || 4)} />
      </label>
      <label>
        Track
        <select value={track} onChange={(event) => setTrack(event.target.value)}>
          <option value="explorer">Explorer (3–5)</option>
          <option value="builder">Builder (5–7)</option>
        </select>
      </label>
      <button type="button" onClick={() => onComplete({ name: name || 'River Friend', age, track })}>
        Start Kids Mode
      </button>
    </section>
  );
}
