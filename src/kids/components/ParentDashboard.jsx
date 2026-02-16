import React from 'react';
import { useKidsProgress } from '../context/KidsProgressContext.jsx';

function formatDue(dateMs) {
  if (!dateMs) return 'now';
  return new Date(dateMs).toLocaleString();
}

export default function ParentDashboard({ profile }) {
  const { state, upcomingReviews, exportJson } = useKidsProgress();
  const masteredCount = Object.values(state.letters).filter((letter) => (letter.streak ?? 0) >= 2).length;

  return (
    <section className="kids-card">
      <h3>📈 Parent Dashboard</h3>
      <p>{profile.name} has mastered {masteredCount} letters so far.</p>
      <p>Total play time: {Math.round((state.totalTimeMs ?? 0) / 60000)} minutes</p>
      <h4>Upcoming Reviews</h4>
      <ul>
        {upcomingReviews.map((review) => (
          <li key={review.id}>{review.id} · streak {review.streak} · {formatDue(review.dueAt)}</li>
        ))}
      </ul>
      <details>
        <summary>Export progress JSON</summary>
        <pre>{exportJson()}</pre>
      </details>
    </section>
  );
}
