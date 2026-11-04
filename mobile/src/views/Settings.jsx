import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { todayISO } from '../lib/dates.js';
import { MODULES } from '../lib/data.js';
import { clock, REST_CHOICES, setTraining, SOUND_SETS, TARGET_CHOICES, trainingSettings, VOLUMES } from '../lib/training.js';
import { ALL_PLATES, BARS } from '../lib/plates.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { applyImport, bodyCsv, mealsCsv, previewImport, readWorkoutCsv, toCsv } from '../lib/csv.js';
import { ImportError, parseDataFile, summarize, toDataFile } from '../lib/dataFile.js';
import { saveExport } from '../store/mirror.js';
import { Health, isNative } from '../store/native.js';
import { healthSettings, syncHealth } from '../store/phoneSync.js';
import { enableReminders, scheduleReminders } from '../store/notify.js';
import { content, useData } from '../store/useData.js';

const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default function Settings() {
  const { data, update, replaceAll } = useData();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const csvRef = useRef(null);
  const [csv, setCsv] = useState(null); // { text, unit, parsed, preview }
  const s = summarize(data);
  const health = healthSettings(data);
  const [hcStatus, setHcStatus] = useState(isNative() ? 'checking' : 'unavailable');
  useEffect(() => {
    if (!isNative()) return;
    Health.status().then((r) => setHcStatus(r.status), () => setHcStatus('unavailable'));
  }, []);

  const setHealth = (changes) => update((d) => ({ ...d, settings: { ...d.settings, health: { ...healthSettings(d), ...changes } } }));
  const toggleHealth = async () => {
    if (health.enabled) {
      setHealth({ enabled: false });
      setMsg('Health Connect off. Nothing already shared is deleted; remove it in Health Connect if you want.');
      return;
    }
    try {
      const { granted } = await Health.connect();
      if (!granted) {
        setMsg('Health Connect needs both permissions: read weight and write exercise.');
        return;
      }
      setHealth({ enabled: true, weights_since: 0, workouts_since: 0 });
      const r = await syncHealth({ all: true });
      setMsg(r ? `Health Connect on. Added ${n(r.weighIns, 'weigh-in')} and shared ${n(r.workouts, 'workout')}.` : 'Health Connect on.');
    } catch (err) {
      setMsg(err?.message || 'Could not connect to Health Connect.');
    }
  };
  const syncNow = async () => {
    try {
      const r = await syncHealth();
      setMsg(r ? `Synced: ${n(r.weighIns, 'new weigh-in')}, ${n(r.workouts, 'workout')} shared.` : 'Health Connect is off.');
    } catch (err) {
      setMsg(err?.message || 'Sync failed.');
    }
  };

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

  const readCsv = (text, unit) => {
    const parsed = readWorkoutCsv(text, { unit });
    setCsv({ text, unit, parsed, preview: previewImport(data, parsed) });
  };

  const pickCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      readCsv(await file.text(), 'kg');
      setMsg('');
    } catch (err) {
      setMsg(err.message || 'Could not read that file.');
    }
  };

  const confirmCsv = () => {
    const p = csv.preview;
    update((d) => applyImport(d, previewImport(d, csv.parsed)));
    setCsv(null);
    setMsg(`Added ${n(p.workouts.length, 'workout')} and ${n(p.sets, 'set')} from ${csv.parsed.source}.`);
  };

  const exportCsv = async () => {
    try {
      const day = todayISO();
      const where = await saveExport(`fitness-os-workouts-${day}.csv`, toCsv(data), 'text/csv');
      await saveExport(`fitness-os-body-${day}.csv`, bodyCsv(data), 'text/csv');
      await saveExport(`fitness-os-meals-${day}.csv`, mealsCsv(data), 'text/csv');
      setMsg(where ? 'Workouts, body and meals CSVs saved to Documents on your phone.' : 'Workouts, body and meals CSVs downloaded.');
    } catch {
      setMsg('Could not save the CSV. Check storage permission and try again.');
    }
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

      <div className="section-label">You</div>
      <div className="list">
        <button type="button" className="list-row" onClick={() => navigate('/profile')}><Icon name="user" /><div className="grow">Profile and macro targets</div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={() => navigate('/quests')}><Icon name="star" /><div className="grow">Quests</div><Icon name="chev" className="icon chev" /></button>
      </div>

      <div className="section-label">Your data</div>
      <div className="list">
        <div className="list-row"><div className="grow">On this phone</div><span className="meta">{n(s.workouts, 'workout')} · {n(s.weighIns, 'weigh-in')}</span></div>
        <button type="button" className="list-row" onClick={() => fileRef.current?.click()}><Icon name="upload" /><div className="grow">Import your data</div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={exportNow}><Icon name="download" /><div className="grow">Export a backup</div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={() => csvRef.current?.click()}><Icon name="upload" /><div className="grow"><div>Import workouts from Strong or Hevy</div><div className="meta">Their CSV export; you see what's added first</div></div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={exportCsv}><Icon name="download" /><div className="grow"><div>Export as CSV</div><div className="meta">Workouts (one row per set), body and meals, for spreadsheets</div></div><Icon name="chev" className="icon chev" /></button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pick} />
      <input ref={csvRef} type="file" accept="text/csv,.csv,text/plain" hidden onChange={pickCsv} />
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

      {csv ? (
        <section className="card stack">
          <strong>Add these workouts from {csv.parsed.source}?</strong>
          {csv.parsed.source === 'Strong' ? (
            <div className="seg" role="group" aria-label="Weights in the file are in">
              {['kg', 'lb'].map((u) => <button key={u} type="button" className={csv.unit === u ? 'on' : ''} onClick={() => readCsv(csv.text, u)}>Weights in {u}</button>)}
            </div>
          ) : null}
          <div className="muted small">
            {csv.preview.workouts.length
              ? `${n(csv.preview.workouts.length, 'workout')} and ${n(csv.preview.sets, 'set')}, ${csv.preview.from} to ${csv.preview.to}.`
              : 'Nothing new in this file.'}
            {csv.preview.duplicates ? ` ${n(csv.preview.duplicates, 'workout')} already here, skipped.` : ''}
            {csv.parsed.skipped ? ` ${n(csv.parsed.skipped, 'row')} left out (warm-ups, rest timers, empty sets).` : ''}
            {' '}Nothing already on this phone changes.
          </div>
          {csv.preview.newExercises.length ? (
            <div className="small preview-list"><div className="muted">New exercises ({csv.preview.newExercises.length}):</div>{csv.preview.newExercises.join(', ')}</div>
          ) : null}
          {csv.preview.workouts.length ? <div className="small muted">First: {csv.preview.workouts[0].label}, {csv.preview.workouts[0].sets[0].exercise} {csv.preview.workouts[0].sets[0].weightKg} kg × {csv.preview.workouts[0].sets[0].reps}</div> : null}
          <button type="button" className="btn" onClick={confirmCsv} disabled={!csv.preview.workouts.length}>Add {n(csv.preview.workouts.length, 'workout')}</button>
          <button type="button" className="btn ghost" onClick={() => setCsv(null)}>Cancel</button>
        </section>
      ) : null}

      <TrainingSettings data={data} update={update} />

      <div className="section-label">Reminders</div>
      <div className="list">
        <button type="button" className="list-row" onClick={toggleReminders} aria-pressed={data.settings.notifications}>
          <Icon name="bell" />
          <div className="grow"><div>Workout and meal reminders</div><div className="meta">30 min before {content.training.session_time} on training days, and at each meal time</div></div>
          <span className={`check${data.settings.notifications ? ' on' : ''}`}>{data.settings.notifications ? <Icon name="check" /> : null}</span>
        </button>
      </div>

      <div className="section-label">Health Connect</div>
      <div className="list">
        {hcStatus === 'available' ? (
          <>
            <button type="button" className="list-row" onClick={toggleHealth} aria-pressed={health.enabled}>
              <Icon name="scale" />
              <div className="grow"><div>Sync with Health Connect</div><div className="meta">Read weigh-ins from your scale, share finished workouts</div></div>
              <span className={`check${health.enabled ? ' on' : ''}`}>{health.enabled ? <Icon name="check" /> : null}</span>
            </button>
            {health.enabled ? (
              <button type="button" className="list-row" onClick={syncNow}><Icon name="download" /><div className="grow">Sync now</div><Icon name="chev" className="icon chev" /></button>
            ) : null}
          </>
        ) : (
          <div className="list-row"><div className="grow"><div>Sync with Health Connect</div><div className="meta">{
            hcStatus === 'update_required' ? 'Update the Health Connect app from the Play Store first.'
              : hcStatus === 'checking' ? 'Checking…' : 'Available in the phone app on Android 9 and newer with Health Connect installed.'
          }</div></div></div>
        )}
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Health Connect is Android's on-phone health store. Nothing goes to a server.</p>

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

function Toggle({ on, onClick, title, note, icon }) {
  return (
    <button type="button" className="list-row" onClick={onClick} aria-pressed={on}>
      {icon ? <Icon name={icon} /> : null}
      <div className="grow"><div>{title}</div>{note ? <div className="meta">{note}</div> : null}</div>
      <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
    </button>
  );
}

function Choice({ label, value, onChange, options }) {
  return (
    <label className="list-row">
      <div className="grow">{label}</div>
      <select style={{ width: 'auto' }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

/** Settings → Training: rest defaults, auto-start, sounds, vibration, target length. */
function TrainingSettings({ data, update }) {
  const t = trainingSettings(data);
  const set = (changes) => update((d) => setTraining(d, changes));
  const rest = REST_CHOICES.map((sec) => [sec, clock(sec)]);
  return (
    <>
      <div className="section-label">Training</div>
      <div className="list">
        <Choice label="Rest for big lifts" value={t.rest_compound} onChange={(v) => set({ rest_compound: Number(v) })} options={rest} />
        <Choice label="Rest for small lifts" value={t.rest_isolation} onChange={(v) => set({ rest_isolation: Number(v) })} options={rest} />
        <Toggle on={t.auto_rest} onClick={() => set({ auto_rest: !t.auto_rest })} title="Start rest after each set" note="The timer starts when you log a set" />
        <Choice label="Target workout length" value={t.target_min} onChange={(v) => set({ target_min: Number(v) })}
          options={TARGET_CHOICES.map((m) => [m, m ? `${m} min` : 'Off'])} />
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Your trainer's rest for an exercise always comes first; these are for exercises without one.</p>

      <div className="section-label">Bar and plates</div>
      <div className="list">
        <Choice label="Bar" value={t.bar} onChange={(v) => set({ bar: v })} options={Object.entries(BARS).map(([k, b]) => [k, `${b.label} (${b.kg} kg)`])} />
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ width: '100%' }}>Plates you have</div>
          {ALL_PLATES.map((p) => {
            const on = t.plates.includes(p);
            return (
              <button key={p} type="button" className={`chip${on ? ' accent' : ''}`} aria-pressed={on}
                onClick={() => set({ plates: on ? t.plates.filter((x) => x !== p) : [...t.plates, p].sort((a, b) => b - a) })}>{p} kg</button>
            );
          })}
        </div>
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Used for the plates-per-side line and warm-up sets on barbell lifts.</p>

      <div className="section-label">Sounds and vibration</div>
      <div className="list">
        <Toggle icon="sound" on={t.sounds} onClick={() => set({ sounds: !t.sounds })} title="Sounds" note="Rest start, 3-2-1, rest done, workout start and save, new records" />
        {t.sounds ? (
          <>
            <Choice label="Volume" value={t.volume} onChange={(v) => set({ volume: v })} options={Object.keys(VOLUMES).map((k) => [k, k[0].toUpperCase() + k.slice(1)])} />
            <Choice label="Sound set" value={t.sound_set} onChange={(v) => set({ sound_set: v })} options={Object.entries(SOUND_SETS)} />
            <button type="button" className="list-row" onClick={() => { unlockAudio(); feedback('test', { force: true }); }}><Icon name="play" /><div className="grow">Play a test sound</div></button>
          </>
        ) : null}
        <Toggle on={t.vibrate} onClick={() => set({ vibrate: !t.vibrate })} title="Vibrate" note="Buzz at rest done, new records and saved workouts" />
      </div>
    </>
  );
}
