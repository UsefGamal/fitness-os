import { useEffect, useState } from 'react';

// The dataset has a start and an end photo per exercise. Alternating them
// shows the movement, like a slow animation; tap to pause.
export default function ExercisePhotos({ entry, compact = false }) {
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = entry?.photos.length || 0;
  useEffect(() => {
    if (n < 2 || paused) return undefined;
    const id = setInterval(() => setFrame((f) => (f + 1) % n), 1100);
    return () => clearInterval(id);
  }, [n, paused]);
  if (!n) return null;
  return (
    <button type="button" className={`photos${compact ? ' compact' : ''}`} onClick={() => setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'}>
      {entry.photos.map((src, i) => (
        <img key={src} src={`exercise-db/${src}`} alt={i === frame ? `${entry.name}, ${i === 0 ? 'start' : 'end'} position` : ''} decoding="async" className={i === frame % n ? 'on' : ''} />
      ))}
      {paused ? <span className="photos-badge">Paused</span> : null}
    </button>
  );
}
