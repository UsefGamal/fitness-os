import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import { pageOf, ROOT_PAGES } from '../lib/settingsPages.js';
import { RELEASES_URL, safeOutside, SHARE_APP_TEXT } from '../lib/links.js';
import InstallGuide from '../components/InstallGuide.jsx';
import AutoBackup from '../components/AutoBackup.jsx';
import { dateRange } from '../lib/autoBackup.js';
import { longDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { MODULES } from '../lib/data.js';
import Stepper from '../components/Stepper.jsx';
import { HAPTIC_LEVELS, hapticLevel, REWARD_LEVELS } from '../lib/rewards.js';
import { clock, REST_CHOICES, setTraining, SOUND_SETS, TARGET_CHOICES, trainingSettings, VOLUMES } from '../lib/training.js';
import { ALL_PLATES, BARS } from '../lib/plates.js';
import { KINDS, ownedKinds, PRESETS } from '../lib/equipment.js';
import { LEVELS } from '../lib/levels.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { applyImport, bodyCsv, CSV_MAX_BYTES, mealsCsv, previewImport, readWorkoutCsv, toCsv } from '../lib/csv.js';
import { checkLine } from '../lib/dataCheck.js';
import { widgetPrivate } from '../lib/widget.js';
import { isEncrypted } from '../lib/backupCrypto.js';
import { unlockBackup } from '../store/autoBackup.js';
import { UnlockSheet } from '../components/PassphraseSheets.jsx';
import { ImportError, keepSafety, loosenedGates, MAX_FILE_BYTES, parseDataFile, summarize, toDataFile, toShareCopy } from '../lib/dataFile.js';
import { saveExport } from '../store/mirror.js';
import { slotLabel } from '../lib/meals.js';
import { isTime, leadText, REMIND_CHOICES, setTimes, timesOf } from '../lib/times.js';
import { Health, isNative, signingCode } from '../store/native.js';
import { healthSettings, syncHealth } from '../store/phoneSync.js';
import { enableReminders, scheduleReminders } from '../store/notify.js';
import { content, useData } from '../store/useData.js';
import { gatesOn, isMinorNow, screeningState, setHide } from '../lib/safety.js';
import Screening from './Screening.jsx';
import RamadanSettings from '../components/RamadanSettings.jsx';
import ReminderCheck from '../components/ReminderCheck.jsx';
import { t, t as tr } from '../lib/i18n.js';
import { APP } from '../lib/version.js';
import { notesUpTo } from '../lib/whatsNew.js';
import { WHATS_NEW } from '../lib/whatsNewNotes.js';
import WhatsNewSheet from '../components/WhatsNewSheet.jsx';
import { shareText, shareTextFile } from '../store/share.js';
import ReportSheet from '../components/ReportSheet.jsx';

const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const EXTRA_NAMES = { steps: 'steps', active_kcal: 'active calories', sleep: 'sleep', resting_hr: 'resting heart rate' };
function extrasText(list) {
  const names = list.map((k) => EXTRA_NAMES[k] || k);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

function lastBackupText(data) {
  const at = data.settings?.last_backup_at;
  if (!at) return 'No backup yet';
  const days = Math.floor((Date.now() - at) / 86400000);
  return days === 0 ? 'Last backup today' : `Last backup ${n(days, 'day')} ago`;
}

export default function Settings() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const replaceAll = useData((s) => s.replaceAll);
  const navigate = useNavigate();
  const { section } = useParams();
  // P14-08: the code the release notes list, read from Android itself.
  const [signing, setSigning] = useState(null);
  useEffect(() => { signingCode().then(setSigning); }, []);
  const page = pageOf(section);
  // The root lists the pages; each page shows only its own part (E5-S1).
  const show = (key) => page?.key === key;
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState(false);
  const [news, setNews] = useState(false);
  const [screening, setScreening] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const csvRef = useRef(null);
  const [csv, setCsv] = useState(null); // { text, unit, parsed, preview }
  const s = summarize(data);
  const health = healthSettings(data);
  const [hcStatus, setHcStatus] = useState(isNative() ? 'checking' : 'unavailable');
  const [hcExtras, setHcExtras] = useState([]); // allowed optional reads: steps, active_kcal, sleep, resting_hr
  useEffect(() => {
    if (!isNative()) return;
    Health.status().then((r) => { setHcStatus(r.status); setHcExtras(r.extras || []); }, () => setHcStatus('unavailable'));
  }, []);

  const setHealth = (changes) => update((d) => ({ ...d, settings: { ...d.settings, health: { ...healthSettings(d), ...changes } } }));
  const toggleHealth = async () => {
    if (health.enabled) {
      setHealth({ enabled: false });
      setMsg('Health Connect off. Nothing already shared is deleted; remove it in Health Connect if you want.');
      return;
    }
    try {
      const { granted, extras } = await Health.connect({ extras: false });
      setHcExtras(extras || []);
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
  const allowActivity = async () => {
    try {
      const { extras } = await Health.connect({ extras: true });
      setHcExtras(extras || []);
      const r = await syncHealth({ all: true });
      setMsg(extras?.length ? `Reading ${extrasText(extras)}. ${n(r?.days || 0, 'day')} found.` : 'Nothing extra allowed. You can change this in Health Connect any time.');
    } catch (err) {
      setMsg(err?.message || 'Could not open Health Connect.');
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

  // BAK-1: an encrypted backup opens with this phone's key, or asks for
  // the recovery passphrase; then the same checks and preview as any file.
  const [locked, setLocked] = useState(null);
  const openText = async (text) => {
    if (isEncrypted(text)) {
      try {
        const plain = await unlockBackup(text);
        if (plain == null) {
          setLocked(text);
          setMsg('');
          return;
        }
        text = plain;
      } catch {
        setMsg(t('unlock.damaged'));
        return;
      }
    }
    restoreText(text);
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMsg('That file is too big to be a Fitness OS backup (over 10 MB), so nothing was changed.');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      setMsg('Could not read that file.');
      return;
    }
    await openText(text);
  };

  // BAK-1: the newest automatic backup goes through the same checks and
  // the same preview as a file the person picked.
  const restoreText = (text) => {
    try {
      setPendingImport(parseDataFile(text, content));
      setMsg('');
    } catch (err) {
      setMsg(err instanceof ImportError ? err.message : 'Could not read that file.');
    }
  };

  // P14-10: a file that would switch off a safety limit this phone has on
  // asks first, with this phone's answers kept by default.
  const loosened = pendingImport ? loosenedGates(data, pendingImport) : [];
  const confirmImport = async (keep = false) => {
    const t = summarize(pendingImport);
    await replaceAll(keep ? keepSafety(data, pendingImport) : pendingImport, 'import');
    setPendingImport(null);
    setMsg(`Imported ${n(t.workouts, 'workout')}, ${n(t.sets, 'set')}, ${n(t.weighIns, 'weigh-in')} and ${n(t.meals, 'meal')}. What was here before is kept in Snapshots.`);
  };

  const readCsv = (text, unit) => {
    const parsed = readWorkoutCsv(text, { unit });
    setCsv({ text, unit, parsed, preview: previewImport(data, parsed) });
  };

  const pickCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) {
      setMsg('That file is too big (over 10 MB), so nothing was changed.');
      return;
    }
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

  // UPD-1: one fixed sentence and the download link; nothing about the person.
  const shareApp = async () => {
    const r = await shareText(t('settings.share'), SHARE_APP_TEXT);
    if (r === 'copied') setMsg(t('settings.shareCopied'));
  };

  const exportNow = async () => {
    try {
      const where = await saveExport(`fitness-os-backup-${todayISO()}.json`, toDataFile(data));
      update((d) => ({ ...d, settings: { ...d.settings, last_backup_at: Date.now() } }));
      setMsg(where ? 'Saved to Documents on your phone.' : 'Backup downloaded.');
    } catch {
      setMsg('Could not save the backup. Check storage permission and try again.');
    }
  };

  // P14-14: a copy to show someone, without health data; never restorable.
  const shareCopy = async () => {
    try {
      await shareTextFile(t('share.title'), `fitness-os-copy-${todayISO()}.json`, toShareCopy(data));
    } catch {
      setMsg(t('share.failed'));
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
    const t = timesOf(data, content);
    setMsg(on ? `Reminders on: ${leadText(t.remind_before)} each ${t.session_time} session and at meal times.` : 'Reminders off.');
  };

  if (screening) return <Screening onDone={() => setScreening(false)} onCancel={() => setScreening(false)} />;
  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{page ? t(page.title) : t('settings.title')}</h1>
      {msg ? <div className="card small" role="status">{msg}</div> : null}
      {report ? <ReportSheet onClose={() => setReport(false)} /> : null}
      {news ? <WhatsNewSheet notes={notesUpTo(APP.version, WHATS_NEW)} onClose={() => setNews(false)} /> : null}

      {!page ? (
        <div className="list">
          <button type="button" className="list-row" onClick={() => navigate('/profile')}><Icon name="user" /><div className="grow">{t('settings.profile')}</div><Icon name="chev" className="icon chev" /></button>
          {D.moduleOn(data, 'quests') ? <button type="button" className="list-row" onClick={() => navigate('/quests')}><Icon name="star" /><div className="grow">{t('settings.quests')}</div><Icon name="chev" className="icon chev" /></button> : null}
          {ROOT_PAGES.map((p) => (
            <button key={p.key} type="button" className="list-row" onClick={() => navigate(`/settings/${p.key}`)}>
              <Icon name={p.icon} /><div className="grow"><div>{t(p.title)}</div><div className="meta">{t(p.note)}</div></div><Icon name="chev" className="icon chev" />
            </button>
          ))}
          <button type="button" className="list-row" onClick={shareApp}><Icon name="upload" /><div className="grow"><div>{t('settings.share')}</div><div className="meta">{t('settings.shareNote')}</div></div><Icon name="chev" className="icon chev" /></button>
        </div>
      ) : null}

      {show('install') ? <InstallGuide /> : null}

      {show('data') ? (<>
      <div className="section-label">Your data</div>
      <div className="list">
        <div className="list-row"><div className="grow">On this phone</div><span className="meta">{n(s.workouts, 'workout')} · {n(s.weighIns, 'weigh-in')}</span></div>
        <button type="button" className="list-row" onClick={() => fileRef.current?.click()}><Icon name="upload" /><div className="grow">Import your data</div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={exportNow}><Icon name="download" /><div className="grow"><div>Export a backup</div><div className="meta">{lastBackupText(data)}</div></div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={shareCopy}><Icon name="upload" /><div className="grow"><div>{t('share.title')}</div><div className="meta">{t('share.note')}</div></div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={() => navigate('/snapshots')}><Icon name="undo" /><div className="grow"><div>Snapshots</div><div className="meta">Copies kept before each update, import or restore</div></div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={() => csvRef.current?.click()}><Icon name="upload" /><div className="grow"><div>Import workouts from Strong or Hevy</div><div className="meta">Their CSV export; you see what's added first</div></div><Icon name="chev" className="icon chev" /></button>
        <button type="button" className="list-row" onClick={exportCsv}><Icon name="download" /><div className="grow"><div>Export as CSV</div><div className="meta">Workouts (one row per set), body and meals, for spreadsheets</div></div><Icon name="chev" className="icon chev" /></button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json,.enc,application/octet-stream" hidden onChange={pick} />
      <input ref={csvRef} type="file" accept="text/csv,.csv,text/plain" hidden onChange={pickCsv} />
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Your data stays on this phone, with no server and no account. Export a backup now and then; uninstalling the app deletes its data.</p>

      <AutoBackup onRestore={openText} onMsg={setMsg} />
      {locked ? <UnlockSheet text={locked} onClose={() => setLocked(null)} onOpen={(plain) => { setLocked(null); restoreText(plain); }} /> : null}

      {pendingImport ? (
        <section className="card stack">
          <strong>Replace what's on this phone?</strong>
          <div className="muted small">
            The file has {n(summarize(pendingImport).workouts, 'workout')}, {n(summarize(pendingImport).sets, 'set')}, {n(summarize(pendingImport).weighIns, 'weigh-in')} and {n(summarize(pendingImport).meals, 'meal')}. What's in the app now ({n(s.workouts, 'workout')}) will be replaced.{dateRange(pendingImport) ? ` ${t('import.range', { first: longDate(dateRange(pendingImport).first), last: longDate(dateRange(pendingImport).last) })}` : ''}
          </div>
          {loosened.length ? (
            <div className="stack" style={{ gap: 6 }} role="group" aria-labelledby="still-true">
              <strong id="still-true">{t('import.stillTrue')}</strong>
              <div className="muted small">{t('import.stillTrueNote')}</div>
              <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
                {loosened.map((g) => <li key={g}>{t(`import.gate.${g}`)}</li>)}
              </ul>
              <button type="button" className="btn" onClick={() => confirmImport(true)}>{t('import.keepSafety')}</button>
              <button type="button" className="btn ghost" onClick={() => confirmImport(false)}>{t('import.useFileSafety')}</button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => confirmImport(false)}>Import and replace</button>
          )}
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

      </>) : null}

      {show('training') ? <TrainingSettings data={data} update={update} /> : null}

      {show('times') ? <TimesSettings data={data} update={update} toggleReminders={toggleReminders} /> : null}
      {show('times') ? <RamadanSettings data={data} update={update} /> : null}

      {show('health') ? (<>
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
              <>
                <button type="button" className="list-row" onClick={allowActivity}>
                  <Icon name="heart" />
                  <div className="grow"><div>Steps, sleep and heart rate</div><div className="meta">{hcExtras.length ? `Reading ${extrasText(hcExtras)}. Tap to change.` : 'Optional, from your phone or watch. Tap to allow.'}</div></div>
                  <Icon name="chev" className="icon chev" />
                </button>
                <button type="button" className="list-row" aria-pressed={health.adaptive === true} onClick={() => setHealth({ adaptive: health.adaptive !== true })}>
                  <Icon name="flame" />
                  <div className="grow"><div>Calorie target follows activity</div><div className="meta">Uses the last week's active calories, only on days with 2,000+ steps. Off: the activity level in Profile.</div></div>
                  <span className={`check${health.adaptive === true ? ' on' : ''}`}>{health.adaptive === true ? <Icon name="check" /> : null}</span>
                </button>
                <button type="button" className="list-row" onClick={syncNow}><Icon name="download" /><div className="grow">Sync now</div><Icon name="chev" className="icon chev" /></button>
              </>
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
      </>) : null}

      {show('modules') ? (<>
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
      {D.moduleOn(data, 'water') ? (
        <div className="card">
          <Stepper label={t('settings.waterGoal')} value={D.waterGoal(data)} onChange={(ml) => update((d) => D.setWaterGoal(d, ml))} step={D.WATER_GOAL.step} min={D.WATER_GOAL.min} max={D.WATER_GOAL.max} />
          <div className="muted small" style={{ marginTop: 8 }}>{t('settings.waterGoalNote')}</div>
        </div>
      ) : null}
      <div className="list">
        <Toggle on={widgetPrivate(data)} title={t('widget.private')} note={t('widget.privateNote')}
          onClick={() => update((d) => ({ ...d, settings: { ...d.settings, widget_private: !widgetPrivate(d) } }))} />
      </div>
      </>) : null}

      {show('safety') ? (<>
      <div className="section-label">{t('safety.section')}</div>
      <div className="list">
        <div className="list-row"><div className="grow"><div>{t('safety.title')}</div><div className="meta">{t(`safety.state.${screeningState(data, todayISO())}`)}</div></div></div>
        <button type="button" className="list-row" onClick={() => setScreening(true)}><Icon name="check" /><div className="grow">{t(data.safety?.skipped ? 'safety.answer' : 'safety.again')}</div><Icon name="chev" className="icon chev" /></button>
      </div>
      {gatesOn(data, todayISO()).length ? (
        <section className="card">
          <div className="muted small" style={{ marginBottom: 6 }}>{t('safety.limitsOn')}</div>
          <ul className="safety-gates">
            {gatesOn(data, todayISO()).map((g) => <li key={g}>{t(`safety.gate.${g}`)}</li>)}
          </ul>
          {isMinorNow(data, todayISO()) ? <div className="muted small" style={{ marginTop: 6 }}>{t('safety.minor')}</div> : null}
        </section>
      ) : null}
      <div className="section-label">{t('safety.hideSection')}</div>
      <div className="list">
        <Toggle on={data.safety?.hide_weight === true} title={t('safety.hideWeight')} note={t('safety.hideWeightNote')} onClick={() => update((d) => setHide(d, 'hide_weight', d.safety?.hide_weight !== true))} />
        <Toggle on={data.safety?.hide_kcal === true} title={t('safety.hideKcal')} note={t('safety.hideKcalNote')} onClick={() => update((d) => setHide(d, 'hide_kcal', d.safety?.hide_kcal !== true))} />
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>{t('safety.calm')}</p>
      </>) : null}

      {show('about') ? (<>
      <div className="section-label">About</div>
      <div className="list">
        <div className="list-row"><div className="grow">Plan</div><span className="meta">{content.training.trainer_plan.name}</span></div>
        <div className="list-row"><div className="grow"><div>Version</div><div className="meta">{APP.version} ({APP.build}) · {t(`about.flavor.${APP.flavor}`)} · {t('about.data', { schema: data.schemaVersion })}</div></div></div>
        <button type="button" className="list-row" onClick={exportNow}><Icon name="download" /><div className="grow"><div>{t('about.backup')}</div><div className="meta">{lastBackupText(data)}</div></div><Icon name="chev" className="icon chev" /></button>
        <a className="list-row" href={safeOutside(RELEASES_URL)} target="_blank" rel="noreferrer"><Icon name="upload" /><div className="grow"><div>{t('about.update')}</div><div className="meta">{t('about.updateNote')} {t('about.updateHave', { version: APP.version })}</div></div><Icon name="chev" className="icon chev" /></a>
        <div className="list-row"><div className="grow"><div>{t('about.signing')}</div><div className="meta">{t('about.signingNote')} {t('about.signingSame')}</div></div><span className="meta" style={{ fontFamily: 'ui-monospace, monospace' }}>{signing || '-'}</span></div>
        <button type="button" className="list-row" onClick={() => navigate('/settings/install')}><Icon name="info" /><div className="grow"><div>{t('about.help')}</div><div className="meta">{t('about.helpNote')}</div></div><Icon name="chev" className="icon chev" /></button>
        <div className="list-row"><div className="grow"><div>{t('about.check')}</div><div className="meta">{t('about.checkNote')}</div><div className="meta" data-testid="data-check" aria-label={t('about.checkAria', { line: checkLine(data) })} style={{ fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>{checkLine(data).split(' · ').map((part, i) => <span key={i}>{i ? ' · ' : ''}<span style={{ whiteSpace: 'nowrap' }}>{part}</span></span>)}</div></div></div>
        <p className="muted small" style={{ margin: '4px 16px 12px' }}>{t('about.notInstalled')}</p>
        {notesUpTo(APP.version, WHATS_NEW).length ? <button type="button" className="list-row" onClick={() => setNews(true)}><Icon name="star" /><div className="grow"><div>{t('whatsNew.title')}</div><div className="meta">{t('whatsNew.note')}</div></div><Icon name="chev" className="icon chev" /></button> : null}
        <button type="button" className="list-row" onClick={() => setReport(true)}><Icon name="upload" /><div className="grow"><div>{t('about.report')}</div><div className="meta">{t('about.reportNote')}</div></div><Icon name="chev" className="icon chev" /></button>
      </div>
      </>) : null}
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
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>The plan's rest for an exercise always comes first; these are for exercises without one.</p>

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

      <div className="section-label">{tr('levels.title')}</div>
      <div className="list">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {LEVELS.map((l) => <button key={l} type="button" className={`chip${t.level === l ? ' accent' : ''}`} aria-pressed={t.level === l} onClick={() => set({ level: t.level === l ? null : l })}>{tr(`levels.${l}`)}</button>)}
        </div>
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>{tr('levels.note')}</p>

      <div className="section-label">Equipment you have</div>
      <div className="list">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => {
            const owned = ownedKinds(t);
            const on = p.kinds === null ? owned === null : owned !== null && owned.length === p.kinds.length && p.kinds.every((k) => owned.includes(k));
            return <button key={p.key} type="button" className={`chip${on ? ' accent' : ''}`} aria-pressed={on} onClick={() => set({ equipment: p.kinds })}>{p.label}</button>;
          })}
        </div>
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ width: '100%' }}>Or tick what you have <span className="meta">(bodyweight always counts)</span></div>
          {KINDS.map((k) => {
            const owned = ownedKinds(t);
            const on = owned === null || owned.includes(k);
            const next = on ? (owned || KINDS).filter((x) => x !== k) : [...(owned || []), k];
            return <button key={k} type="button" className={`chip${on ? ' accent' : ''}`} aria-pressed={on} onClick={() => set({ equipment: next.length === KINDS.length ? null : next })}>{k}</button>;
          })}
        </div>
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>When something is missing, the workout screen offers the closest same-muscle exercise you can do instead.</p>

      <div className="section-label">Sounds and vibration</div>
      <div className="list">
        <Toggle icon="sound" on={t.sounds} onClick={() => set({ sounds: !t.sounds })} title="Sounds" note="Rest start, 3-2-1, rest done and workout start" />
        {t.sounds ? (
          <>
            <Choice label="Volume" value={t.volume} onChange={(v) => set({ volume: v })} options={Object.keys(VOLUMES).map((k) => [k, k[0].toUpperCase() + k.slice(1)])} />
            <Choice label="Sound set" value={t.sound_set} onChange={(v) => set({ sound_set: v })} options={Object.entries(SOUND_SETS)} />
            <button type="button" className="list-row" onClick={() => { unlockAudio(); feedback('test', { force: true }); }}><Icon name="play" /><div className="grow">Play a test sound</div></button>
          </>
        ) : null}
        <Choice label={tr('settings.touchSounds')} value={t.reward_sounds} onChange={(v) => set({ reward_sounds: v })} options={Object.entries(REWARD_LEVELS)} />
        <p className="muted small" style={{ margin: '0 16px 8px' }}>{tr('settings.touchSoundsNote')}</p>
        {/* The old Vibrate switch stays in step, for an older app reading this backup. */}
        <Choice label={tr('settings.vibration')} value={hapticLevel(t)} onChange={(v) => set({ haptics: v, vibrate: v !== 'off' })} options={Object.entries(HAPTIC_LEVELS)} />
        <p className="muted small" style={{ margin: '0 16px 8px' }}>{tr('settings.vibrationNote')}</p>
      </div>
    </>
  );
}

function TimeRow({ label, value, onChange, note }) {
  return (
    <label className="list-row">
      <div className="grow"><div>{label}</div>{note ? <div className="meta">{note}</div> : null}</div>
      <input type="time" step="300" style={{ width: 'auto', minWidth: 112 }} value={value} onChange={(e) => isTime(e.target.value) && onChange(e.target.value)} />
    </label>
  );
}

/** Settings → Times and reminders: when you train and eat, and how early
 * the reminders come. Reminders reschedule themselves after a change. */
function TimesSettings({ data, update, toggleReminders }) {
  const t = timesOf(data, content);
  const set = (changes) => update((d) => setTimes(d, changes));
  const on = Boolean(data.settings.notifications);
  return (
    <>
      <div className="section-label">Training times</div>
      <div className="list">
        <Choice label={tr('week.startsOn')} value={data.profile?.week_start === 'mon' ? 'mon' : 'sun'} onChange={(v) => update((d) => ({ ...d, profile: { ...d.profile, week_start: v } }))} options={[['sun', tr('week.sunday')], ['mon', tr('week.monday')]]} />
        <Toggle on={t.session_varies} onClick={() => set({ session_varies: !t.session_varies })} title={tr('times.varies')} note={tr(t.session_varies ? 'times.variesOn' : 'times.variesOff')} />
        {t.session_varies ? null : <TimeRow label="Morning session" note="Every training day in the plan" value={t.session_time} onChange={(v) => set({ session_time: v })} />}
        <TimeRow label="Evening session" note="The optional slot you fill on Plan" value={t.evening_time} onChange={(v) => set({ evening_time: v })} />
      </div>

      <div className="section-label">Reminders</div>
      <div className="list">
        <Toggle icon="bell" on={on} onClick={toggleReminders} title="Reminders" note={on ? 'On for the next two weeks, kept up to date' : 'Off: nothing is scheduled'} />
        {on ? (
          <>
            <Choice label="Before a session" value={t.remind_before} onChange={(v) => set({ remind_before: Number(v) })} options={REMIND_CHOICES.map((m) => [m, m ? `${m} min` : 'At start time'])} />
            {t.session_varies ? null : <Toggle on={t.remind_workouts !== false} onClick={() => set({ remind_workouts: t.remind_workouts === false })} title="Morning session" note={`${leadText(t.remind_before)} ${t.session_time} on training days`} />}
            <Toggle on={t.remind_evening !== false} onClick={() => set({ remind_evening: t.remind_evening === false })} title="Evening session" note={`${leadText(t.remind_before)} ${t.evening_time} when one is planned`} />
            <Toggle on={t.remind_meals === true} onClick={() => set({ remind_meals: t.remind_meals !== true })} title="Meals" note="At each meal time below" />
            <ReminderCheck />
          </>
        ) : null}
      </div>

      <div className="section-label">Meal times</div>
      <div className="list">
        {Object.entries(t.meal_times).map(([slot, v]) => <TimeRow key={slot} label={slotLabel(slot)} value={v} onChange={(x) => set({ meal_times: { [slot]: x } })} />)}
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>Times are used for reminders, the Today and Plan screens, the widget and Health Connect.</p>
    </>
  );
}
