import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import { addPhoto, beforeAfter, POSES, removePhoto, timeline } from '../lib/photos.js';
import { deletePhoto, photoUrl, storePhoto } from '../store/photos.js';
import { t } from '../lib/i18n.js';
import { useData } from '../store/useData.js';

function Img({ path, className, alt = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    photoUrl(path).then((u) => live && setSrc(u), () => live && setSrc(''));
    return () => { live = false; };
  }, [path]);
  if (src === '') return <span className="muted small">Missing</span>;
  return src ? <img src={src} className={className} alt={alt} /> : null;
}

function Compare({ pair }) {
  const [cut, setCut] = useState(50);
  return (
    <div className="ba" style={{ '--cut': `${cut}%` }}>
      <Img path={pair.before.file} alt={`Before, ${pair.before.date}`} />
      <div className="after" style={{ position: 'absolute', inset: 0 }}><Img path={pair.after.file} alt={`After, ${pair.after.date}`} /></div>
      <div className="handle" />
      <span className="tag" style={{ left: 8 }}>{formatDate(pair.before.date)}</span>
      <span className="tag" style={{ right: 8 }}>{formatDate(pair.after.date)}</span>
      <input type="range" min="0" max="100" value={cut} onChange={(e) => setCut(Number(e.target.value))} aria-label="Slide between before and after" />
    </div>
  );
}

/** Progress photos: front, side and back, kept only on this phone. */
export default function Photos() {
  const navigate = useNavigate();
  const { data, update } = useData();
  const fileRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [viewing, setViewing] = useState(null);
  const today = todayISO();
  const days = timeline(data);
  const pair = beforeAfter(data, pose);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const path = await storePhoto(file, `${today}-${pose}-${Date.now()}`);
      update((d) => addPhoto(d, { date: today, pose, file: path }));
      setMsg('');
    } catch (err) {
      setMsg(err.message || 'Could not save that photo.');
    }
    setBusy(false);
  };

  const remove = async (p) => {
    update((d) => removePhoto(d, p.id));
    await deletePhoto(p.file);
    setViewing(null);
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Progress photos</h1>
      <p className="page-sub">Kept only on this phone, never in backups or anywhere else. The location and other photo details are removed when saved.</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}
      <div className="seg" style={{ marginBottom: 12 }}>
        {POSES.map(([k, l]) => <button key={k} type="button" className={pose === k ? 'on' : ''} onClick={() => setPose(k)}>{l}</button>)}
      </div>
      <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="plus" /> {busy ? 'Saving…' : `Add a ${pose} photo for today`}</button>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={pick} />

      {pair ? (
        <>
          <div className="section-label">Before and after</div>
          <section className="card"><Compare key={`${pair.before.id}-${pair.after.id}`} pair={pair} /><p className="muted small" style={{ margin: '8px 0 0', textAlign: 'center' }}>Drag across the photo to compare.</p></section>
        </>
      ) : <div className="card muted small" style={{ marginTop: 12 }}>Two {pose} photos on different days and a before/after slider shows up here.</div>}

      {days.length ? <div className="section-label">Timeline</div> : null}
      {days.map((d) => (
        <section key={d.date} className="card">
          <div className="muted small" style={{ marginBottom: 8 }}>{formatDate(d.date)}</div>
          <div className="photo-row">
            {POSES.map(([k, l]) => (d.photos[k] ? (
              <button key={k} type="button" className="photo-cell" aria-label={`${l} photo, ${d.date}`} onClick={() => setViewing(d.photos[k])}><Img path={d.photos[k].file} /></button>
            ) : <div key={k} className="photo-cell">{l}</div>))}
          </div>
        </section>
      ))}

      {viewing ? (
        <div className="timer-full" role="dialog" aria-label="Photo">
          <div className="muted">{formatDate(viewing.date)} · {POSES.find(([k]) => k === viewing.pose)?.[1]}</div>
          <div style={{ width: 'min(360px, 90vw)', aspectRatio: '3 / 4', borderRadius: 14, overflow: 'hidden' }}><Img path={viewing.file} className="fill-img" /></div>
          <div className="row" style={{ gap: 12 }}>
            <button type="button" className="btn secondary" style={{ width: 140 }} onClick={() => setViewing(null)}>Close</button>
            <button type="button" className="btn ghost" style={{ width: 140, color: '#ff453a' }} onClick={() => setConfirming(viewing)}><Icon name="trash" /> Delete</button>
            {confirming ? <ConfirmSheet title={t('photos.deleteTitle')} body={t('photos.deleteBody')} action={t('photos.deleteTitle')} onConfirm={() => remove(confirming)} onClose={() => setConfirming(null)} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
