import { useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { ACTIVITY, DIRECTIONS, GAIN_SURPLUS, PROTEIN_G_PER_KG, goalIssues, macroTargets, minGoalWeight, profileOf, safeGoalDate, saveProfile } from '../lib/macros.js';
import { settleSetup } from '../lib/setup.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

const ACTIVITY_LABELS = {
  sedentary: 'Sedentary: little or no exercise',
  light: 'Light: exercise 1-3 days a week',
  moderate: 'Moderate: exercise 3-5 days a week',
  active: 'Active: hard exercise 6-7 days a week',
  very_active: 'Very active: hard exercise and a physical job',
};

const num = (v) => (v === '' || v == null ? null : Number(v));

export default function Profile() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = useToday();
  const [p, setP] = useState(() => ({ gender: '', activity_level: 'moderate', ...profileOf(data) }));
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setP({ ...p, [k]: e.target.value }); setSaved(false); };

  const clean = {
    ...p,
    height_cm: num(p.height_cm),
    start_weight_kg: num(p.start_weight_kg),
    goal_weight_low_kg: num(p.goal_weight_low_kg),
    goal_weight_high_kg: num(p.goal_weight_high_kg),
    name: typeof p.name === 'string' ? p.name.trim().slice(0, 30) : undefined,
  };
  const errors = [];
  if (!(clean.height_cm >= 100 && clean.height_cm <= 250)) errors.push('Height must be between 100 and 250 cm.');
  if (!(clean.goal_weight_low_kg >= 30 && clean.goal_weight_high_kg <= 300 && clean.goal_weight_low_kg <= clean.goal_weight_high_kg)) errors.push('Goal weights must be 30-300 kg, low first.');
  if (clean.start_weight_kg != null && !(clean.start_weight_kg >= 30 && clean.start_weight_kg <= 300)) errors.push('Start weight must be 30-300 kg.');
  if (!p.gender) errors.push('Pick the sex used for the calorie formula.');
  if (!p.date_of_birth || p.date_of_birth > today) errors.push('Pick a date of birth in the past.');
  if (!p.goal_date) errors.push('Pick a goal date.');
  if (goalIssues(clean).includes('bmi')) errors.push(t('profile.bmiLow', { min: minGoalWeight(clean.height_cm) }));

  const preview = macroTargets(saveProfile(data, clean, today), content.nutrition, today);
  const safeDate = preview.source !== 'plan' ? safeGoalDate(preview) : null;

  const save = (e) => {
    e.preventDefault();
    if (errors.length) return;
    update((d) => settleSetup(saveProfile(d, clean, today)));
    setSaved(true);
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Profile</h1>
      <p className="page-sub">Your stats set the daily calorie and macro targets.</p>

      <section className="card">
        <div className="muted small">Daily target{preview.source === 'plan' ? ' (the plan\'s default until your profile is filled in and you log a weigh-in)' : ''}</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 6, margin: '4px 0 8px' }}>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{preview.kcal}</span><span className="muted">kcal</span>
        </div>
        <div className="muted small">Protein {preview.protein} g · carbs {preview.carbs} g · fat {preview.fat} g · fiber {preview.fiber} g</div>
        {preview.source !== 'plan' && preview.mode === 'maintain' ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.maintain', preview)}</div> : null}
        {preview.source !== 'plan' && preview.mode === 'recomp' ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.recomp', { ...preview, protein_per_kg: PROTEIN_G_PER_KG.recomp })}</div> : null}
        {preview.source !== 'plan' && preview.mode === 'gain' ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.gain', { ...preview, surplus: GAIN_SURPLUS })}</div> : null}
        {preview.source === 'profile' && preview.mode === 'lose' ? (
          <div className="muted small" style={{ marginTop: 8 }}>
            BMR {preview.bmr} × activity = {preview.tdee} kcal maintenance at {preview.weight} kg
            {preview.pace > 0 ? `, minus ${preview.deficit} kcal a day for about ${preview.pace} kg a week.` : '.'}
          </div>
        ) : null}
        {preview.source === 'watch' && preview.mode === 'lose' ? (
          <div className="muted small" style={{ marginTop: 8 }}>
            BMR {preview.bmr} × 1.2 + ¾ of your {preview.active_avg} active kcal a day (last week, days with the phone or watch on) = {preview.tdee} kcal maintenance at {preview.weight} kg
            {preview.pace > 0 ? `, minus ${preview.deficit} kcal a day for about ${preview.pace} kg a week.` : '.'} Switch this off in Settings → Health Connect.
          </div>
        ) : null}
        {preview.source !== 'plan' && preview.mode === 'lose' ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.protein', { goal: preview.goal_weight })}</div> : null}
        {preview.reasons?.includes('capped') ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.capped', preview)}</div> : null}
        {preview.reasons?.includes('floor') ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.floor', preview)}</div> : null}
        {safeDate ? <div className="muted small" style={{ marginTop: 8 }}>{t('profile.safeDate', { pace: preview.pace, goal: preview.goal_weight, date: formatDate(safeDate) })}</div> : null}
        {safeDate && p.goal_date && p.goal_date < safeDate ? (
          <button type="button" className="btn secondary small" style={{ marginTop: 8, minHeight: 44 }} onClick={() => { setP({ ...p, goal_date: safeDate }); setSaved(false); }}>{t('profile.useDate', { date: formatDate(safeDate) })}</button>
        ) : null}
      </section>

      <form className="card stack" onSubmit={save}>
        <label className="field"><span>{t('profile.name')}</span><input type="text" autoComplete="given-name" maxLength={30} value={p.name ?? ''} onChange={set('name')} /></label>
        <div className="row">
          <label className="field grow"><span>Height (cm)</span><input type="number" inputMode="decimal" value={p.height_cm ?? ''} onChange={set('height_cm')} /></label>
          <label className="field grow"><span>Sex</span>
            <select value={p.gender} onChange={set('gender')}><option value="" disabled>Choose</option>{content.nutrition.tdee.genders.map((g) => <option key={g} value={g}>{g === 'male' ? 'Male' : 'Female'}</option>)}</select>
          </label>
        </div>
        <label className="field"><span>Date of birth</span><input type="date" value={p.date_of_birth || ''} max={today} onChange={set('date_of_birth')} /></label>
        <label className="field"><span>Activity</span>
          <select value={p.activity_level} onChange={set('activity_level')}>{Object.keys(ACTIVITY).map((k) => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}</select>
        </label>
        <label className="field"><span>{t('profile.direction')}</span>
          <select value={p.direction || 'lose'} onChange={set('direction')}>{DIRECTIONS.map((k) => <option key={k} value={k}>{t(`profile.dir.${k}`)}</option>)}</select>
        </label>
        <label className="field"><span>Start weight (kg, blank = first weigh-in)</span><input type="number" inputMode="decimal" step="0.1" value={p.start_weight_kg ?? ''} onChange={set('start_weight_kg')} /></label>
        <div className="row">
          <label className="field grow"><span>Goal low (kg)</span><input type="number" inputMode="decimal" step="0.5" value={p.goal_weight_low_kg ?? ''} onChange={set('goal_weight_low_kg')} /></label>
          <label className="field grow"><span>Goal high (kg)</span><input type="number" inputMode="decimal" step="0.5" value={p.goal_weight_high_kg ?? ''} onChange={set('goal_weight_high_kg')} /></label>
        </div>
        <label className="field"><span>Goal date</span><input type="date" value={p.goal_date || ''} onChange={set('goal_date')} /></label>
        {errors.length ? <div className="small" style={{ color: 'var(--danger)' }} role="alert">{errors[0]}</div> : null}
        <button type="submit" className="btn" disabled={!!errors.length}>{saved ? <><Icon name="check" /> Saved</> : 'Save'}</button>
      </form>
    </div>
  );
}
