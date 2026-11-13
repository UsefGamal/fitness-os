import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import { formatDate } from '../lib/dates.js';
import { addPhoto, beforeAfter, POSES, removePhoto, timeline } from '../lib/photos.js';
import { photoLockOn, setPhotoLock } from '../lib/photoLock.js';
import { isPhotosOpen, phoneHasLock, photoLockEvent, securePhotos, unlockPhotos } from '../store/photoLock.js';
import { deletePhoto, photoUrl, storePhoto } from '../store/photos.js';
import { t } from '../lib/i18n.js';
import { useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

function Img({ path, className, alt = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    photoUrl(path).then((u) => live && setSrc(u), () => live && setSrc(''));
    return () => { live = false; };
  }, [path]);
  if (src === '') return <span className="muted small">Missing{alt ? <span className="sr-only">: {alt}</span> : null}</span>;
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

/** P14-13: Photos opens with the phone's own lock. A cold start, or 60 s
 * away from Photos, locks it again; the app's own camera and file picker
 * don't count. A forgotten lock never deletes anything. */
export default function Photos() {
  const data = useData((s) => s.data);
  const lockOn = photoLockOn(data);
  const [hasLock, setHasLock] = useState(undefined);
  const [open, setOpen] = useState(() => isPhotosOpen());
  const [asking, setAsking] = useState(false);
  useEffect(() => { phoneHasLock().then(setHasLock); }, []);
  useEffect(() => {
    photoLockEvent('return');
    setOpen(isPhotosOpen());
    securePhotos(true);
    const vis = () => {
      if (document.visibilityState === 'hidden') photoLockEvent('leave');
      else { photoLockEvent('return'); setOpen(isPhotosOpen()); }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      photoLockEvent('leave');
      securePhotos(false);
    };
  }, []);
  const needLock = lockOn && hasLock === true;
  const unlock = async () => {
    setAsking(true);
    const ok = await unlockPhotos(t('photoLock.title'), t('photoLock.subtitle'));
    setAsking(false);
    setOpen(ok);
  };
  // Ask once on the way in, so opening Photos is one step.
  const asked = useRef(false);
  useEffect(() => {
    if (needLock && !open && !asked.current) { asked.current = true; unlock(); }
  });
  if (lockOn && hasLock === undefined) return <div className="page" />;
  if (needLock && !open) return <PhotosLocked onUnlock={unlock} asking={asking} />;
  return <PhotosBody hasLock={hasLock} />;
}

function PhotosLocked({ onUnlock, asking }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> {t('nav.back')}</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{t('photoLock.title')}</h1>
      <p className="page-sub">{t('photoLock.lockedBody')}</p>
      <button type="button" className="btn" disabled={asking} onClick={onUnlock}>{t('photoLock.unlock')}</button>
      <p className="muted small" style={{ marginTop: 12 }}>{t('photoLock.forgot')}</p>
    </div>
  );
}

/** Progress photos: front, side and back, kept only on this phone. */
function PhotosBody({ hasLock }) {
  const navigate = useNavigate();
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const fileRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [viewing, setViewing] = useState(null);
  const today = useToday();
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
      <button type="button" className="btn" disabled={busy} onClick={() => { photoLockEvent('external'); fileRef.current?.click(); }}><Icon name="plus" /> {busy ? 'Saving…' : `Add a ${pose} photo for today`}</button>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={pick} />

      {hasLock === true ? (
        <div className="list" style={{ marginTop: 12 }}>
          <button type="button" className="list-row" aria-pressed={photoLockOn(data)} onClick={() => update((d) => setPhotoLock(d, !photoLockOn(d)))}>
            <Icon name="lock" /><div className="grow"><div>{t('photoLock.toggle')}</div><div className="meta">{t('photoLock.toggleNote')}</div></div>
            <span className={`check${photoLockOn(data) ? ' on' : ''}`}>{photoLockOn(data) ? <Icon name="check" /> : null}</span>
          </button>
        </div>
      ) : hasLock === false ? <p className="muted small" style={{ margin: '12px 4px 0' }}>{t('photoLock.noLock')}</p> : null}

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
              <button key={k} type="button" className="photo-cell" onClick={() => setViewing(d.photos[k])}><Img path={d.photos[k].file} alt={`${l} photo, ${d.date}`} /></button>
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
            <button type="button" className="btn ghost" style={{ width: 140, color: 'var(--danger)' }} onClick={() => setConfirming(viewing)}><Icon name="trash" /> Delete</button>
            {confirming ? <ConfirmSheet title={t('photos.deleteTitle')} body={t('photos.deleteBody')} action={t('photos.deleteTitle')} onConfirm={() => remove(confirming)} onClose={() => setConfirming(null)} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
