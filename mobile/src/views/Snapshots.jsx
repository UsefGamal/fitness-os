// Snapshots (E2-S3): the copies kept before each app update, import or
// restore, newest first. Restoring one keeps a snapshot of what is there
// now, so a restore can be undone too.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { ImportError, parseSnapshot, summarize } from '../lib/dataFile.js';
import { listSnapshots, readSnapshot } from '../store/snapshots.js';
import { content, useData } from '../store/useData.js';

const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function when(at) {
  return new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Snapshots() {
  const { replaceAll } = useData();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [picked, setPicked] = useState(null); // { snap, data }
  const [msg, setMsg] = useState('');

  useEffect(() => {
    listSnapshots().then(setList, () => setList([]));
  }, []);

  const open = async (snap) => {
    setMsg('');
    const text = await readSnapshot(snap.name);
    if (!text) {
      setMsg("That snapshot can't be read.");
      return;
    }
    try {
      setPicked({ snap, data: parseSnapshot(text, content) });
    } catch (err) {
      setMsg(err instanceof ImportError ? err.message : "That snapshot can't be read.");
    }
  };

  const restore = async () => {
    const t = summarize(picked.data);
    await replaceAll(picked.data, 'restore');
    setPicked(null);
    setMsg(`Restored: ${n(t.workouts, 'workout')} and ${n(t.weighIns, 'weigh-in')}. What was here before is kept as a new snapshot.`);
    setList(await listSnapshots());
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Snapshots</h1>
      <p className="page-sub">The app keeps a copy of your data before each update, import or restore. The newest 7 are kept, on this phone only.</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}

      {picked ? (
        <section className="card stack">
          <strong>Go back to {when(picked.snap.at)}?</strong>
          <div className="muted small">
            This snapshot has {n(summarize(picked.data).workouts, 'workout')}, {n(summarize(picked.data).sets, 'set')} and {n(summarize(picked.data).weighIns, 'weigh-in')}. Anything logged since then is replaced, but kept as a new snapshot first.
          </div>
          <button type="button" className="btn" onClick={restore}>Restore this snapshot</button>
          <button type="button" className="btn ghost" onClick={() => setPicked(null)}>Cancel</button>
        </section>
      ) : null}

      {list && !list.length ? <div className="card muted small">No snapshots yet. One is kept automatically before the next update or import.</div> : null}
      {list && list.length ? (
        <div className="list">
          {list.map((s) => (
            <button key={s.name} type="button" className="list-row" onClick={() => open(s)}>
              <Icon name="undo" />
              <div className="grow"><div>{when(s.at)}</div><div className="meta">{s.label}</div></div>
              <Icon name="chev" className="icon chev" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
