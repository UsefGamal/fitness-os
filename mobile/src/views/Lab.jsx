// Debug builds only (flag example_lab, absent from release builds): the
// feature flags and a button that throws, to check the crash screen.
import { useState } from 'react';

import { FLAGS, flagOn } from '../lib/flags.js';
import { APP } from '../lib/version.js';

export default function Lab() {
  const [boom, setBoom] = useState(false);
  if (boom) throw new Error('Test crash from the Lab screen');
  return (
    <div className="page">
      <h1 className="page-title">Lab</h1>
      <p className="page-sub">Debug build {APP.version} ({APP.build}). Release builds don't have this screen.</p>
      <div className="list">
        {Object.entries(FLAGS).map(([name, f]) => (
          <div key={name} className="list-row"><div className="grow"><div>{name}</div><div className="meta">{f.note}</div></div><span className="meta">{flagOn(name, APP) ? 'on' : 'off'}</span></div>
        ))}
      </div>
      <button type="button" className="btn secondary" style={{ marginTop: 16 }} onClick={() => setBoom(true)}>Trigger a test crash</button>
    </div>
  );
}
