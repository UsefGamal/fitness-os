import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { todayISO } from '../lib/dates.js';
import { MODULES } from '../lib/data.js';
import { ImportError, parseDataFile, summarize, toDataFile } from '../lib/dataFile.js';
import { saveExport } from '../store/mirror.js';
import { enableReminders, scheduleReminders } from '../store/notify.js';
import { content, useData } from '../store/useData.js';

const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default function Settings() {
  const { data, update, replaceAll } = useData();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const s = summarize(data);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseDataFile(await file.text(), content);
      setPendingImport(parsed);
      setMsg('');
    } catch (err) {
      setMsg(err instanceof ImportError ? err.message : 'Could not read that file.');
    }
  };

  const confirmImport = () => {
    replaceAll(pendingImport);
    const t = summarize(pendingImport);
    setPendingImport(null);
    setMsg(`Imported ${n(t.workouts, 'workout')}, ${n(t.sets, 'set')}, ${n(t.weighIns, 'weigh-in')} and ${n(t.meals, 'meal')}.`);
  };

  const exportNow = async () => {
    try {
      const where = await saveExport(`fitness-os-backup-${todayISO()}.json`, toDataFile(data));
      setMsg(where ? 'Saved to Documents on your phone.' : 'Backup downloaded.');
    } catch {
      setMsg('Could not save the backup. Check storage permission and try again.');
    }
  };

  const toggleReminders = async () => {
    const on = !data.settings.notifications;
    if (on && !(await enableReminders())) {
      setMsg('Notifications are blocked. Allow them for Fitness OS in Android settings.');
      return;
    }
    update((d) => ({ ...d, settings: { ...d.settings, notifications: on } }));
    await scheduleReminders(content, on);
    setMsg(on ? `Reminders on: 30 min before each ${content.training.session_time} session and at meal times.` : 'Reminders off.');
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Settings</h1>
      {msg ? <div className="card small" role="status">{msg}</div> : null}

      <div className="section-label">Your data</div>
      <div className="list">
        <div className="list-row"><div className="grow">On this phone</div><span className="meta">{n(s.workouts, 'workout')} · {n(s.weighIns, 'weigh-in')}</span></div>
        <button type="button" className="list-row" onClick={() => fileRef.current?.click()}><Icon name="upload" /><div className="grow">Import your data</div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={exportNow}><Icon name="download" /><div className="grow">Export a backup</div><Icon name="chev" className="icon chev" /></button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pick} />
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Your data stays on this phone, with no server and no account. Export a backup now and then; uninstalling the app deletes its data.</p>

      {pendingImport ? (
        <section className="card stack">
          <strong>Replace what's on this phone?</strong>
          <div className="muted small">
            The file has {n(summarize(pendingImport).workouts, 'workout')}, {n(summarize(pendingImport).sets, 'set')}, {n(summarize(pendingImport).weighIns, 'weigh-in')} and {n(summarize(pendingImport).meals, 'meal')}. What's in the app now ({n(s.workouts, 'workout')}) will be replaced.
          </div>
          <button type="button" className="btn" onClick={confirmImport}>Import and replace</button>
          <button type="button" className="btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
        </section>
      ) : null}

      <div className="section-label">Reminders</div>
      <div className="list">
        <button type="button" className="list-row" onClick={toggleReminders} aria-pressed={data.settings.notifications}>
          <Icon name="bell" />
          <div className="grow"><div>Workout and meal reminders</div><div className="meta">30 min before {content.training.session_time} on training days, and at each meal time</div></div>
          <span className={`check${data.settings.notifications ? ' on' : ''}`}>{data.settings.notifications ? <Icon name="check" /> : null}</span>
        </button>
      </div>

      <div className="section-label">Modules</div>
      <div className="list">
        {MODULES.map((m) => {
          const on = data.settings?.modules?.[m.key] !== false;
          return (
            <button key={m.key} type="button" className="list-row" aria-pressed={on}
              onClick={() => update((d) => ({ ...d, settings: { ...d.settings, modules: { ...(d.settings?.modules || {}), [m.key]: !on } } }))}>
              <div className="grow"><div>{m.label}</div><div className="meta">{m.note}</div></div>
              <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
            </button>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Switching a module off only hides it. Nothing is deleted.</p>

      <div className="section-label">About</div>
      <div className="list">
        <div className="list-row"><div className="grow">Plan</div><span className="meta">{content.training.trainer_plan.name || "Trainer's U-L-PPL"}</span></div>
        <div className="list-row"><div className="grow">Version</div><span className="meta">0.3.0</span></div>
      </div>
    </div>
  );
}
