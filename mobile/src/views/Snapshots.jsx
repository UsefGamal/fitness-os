// Snapshots (E2-S3): the copies kept before each app update, import or
// restore, newest first. Restoring one keeps a snapshot of what is there
// now, so a restore can be undone too.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { ImportError, parseSnapshot, summarize } from '../lib/dataFile.js';
import { t } from '../lib/i18n.js';
import { listSnapshots, readSnapshot } from '../store/snapshots.js';
import { content, useData } from '../store/useData.js';

// count.workout / count.workouts and so on; Arabic plurals get their own keys later.
const n = (count, key) => t(count === 1 ? `count.${key}` : `count.${key}s`, { n: count });

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
      setMsg(t('snap.unreadable'));
      return;
    }
    try {
      setPicked({ snap, data: parseSnapshot(text, content) });
    } catch (err) {
      setMsg(err instanceof ImportError ? err.message : t('snap.unreadable'));
    }
  };

  const restore = async () => {
    const c = summarize(picked.data);
    await replaceAll(picked.data, 'restore');
    setPicked(null);
    setMsg(t('snap.restored', { workouts: n(c.workouts, 'workout'), weighIns: n(c.weighIns, 'weighIn') }));
    setList(await listSnapshots());
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> {t('nav.back')}</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{t('snap.title')}</h1>
      <p className="page-sub">{t('snap.intro')}</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}

      {picked ? (
        <section className="card stack">
          <strong>{t('snap.confirm', { when: when(picked.snap.at) })}</strong>
          <div className="muted small">
            {t('snap.detail', { workouts: n(summarize(picked.data).workouts, 'workout'), sets: n(summarize(picked.data).sets, 'set'), weighIns: n(summarize(picked.data).weighIns, 'weighIn') })}
          </div>
          <button type="button" className="btn" onClick={restore}>{t('snap.restore')}</button>
          <button type="button" className="btn ghost" onClick={() => setPicked(null)}>{t('common.cancel')}</button>
        </section>
      ) : null}

      {list && !list.length ? <div className="card muted small">{t('snap.none')}</div> : null}
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
