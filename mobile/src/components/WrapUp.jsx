import { useMemo, useState } from 'react';

import { hm } from '../lib/activity.js';
import { checkLine } from '../lib/dataCheck.js';
import { fromISO, LOCALE } from '../lib/dates.js';
import { firstName } from '../lib/home.js';
import { t } from '../lib/i18n.js';
import { APP } from '../lib/version.js';
import { identityLine, pictureLines, summaryLine, weekStats, weekText } from '../lib/weekStats.js';
import { shareImage, shareText } from '../store/share.js';
import { drawWeekPicture } from '../store/weekPicture.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

const dayMonth = (iso) => fromISO(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

/** Home's card for the week that just ended (WRAP-1). */
export function WrapCard({ stats, onOpen, onDismiss }) {
  return (
    <div className="backup-line" role="status">
      <button type="button" className="grow backup-link wrap-open" onClick={onOpen}>
        <Icon name="trophy" className="icon tone-accent" />
        <span className="grow"><strong>{t('wrap.title')}</strong> <span className="muted">{summaryLine(stats)}</span><span className="wrap-see">{t('wrap.open')}</span></span>
        <Icon name="chev" className="icon chev" />
      </button>
      <button type="button" className="icon-btn" aria-label={t('wrap.dismiss')} onClick={onDismiss}><Icon name="x" /></button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="list-row">
      <div className="grow">{label}</div>
      <strong className="num">{value}</strong>
    </div>
  );
}

/** The week in numbers that only count up, then the identity line. */
export function WrapSheet({ data, content, week, onClose }) {
  const stats = useMemo(() => weekStats(data, content, week), [data, content, week]);
  const [withName, setWithName] = useState(false);
  const [feel, setFeel] = useState('');
  const [msg, setMsg] = useState('');
  const name = firstName(data.profile);
  const s = stats.sessions;
  const identity = identityLine(stats);
  const title = t('wrap.sheetTitle', { from: dayMonth(stats.week.start), to: dayMonth(stats.week.end) });

  const sharePicture = async () => {
    const url = drawWeekPicture({
      title: t('wrap.pictureTitle'),
      range: `${dayMonth(stats.week.start)} – ${dayMonth(stats.week.end)}`,
      lines: pictureLines(stats),
      identity,
      name: withName ? name : '',
    });
    const r = await shareImage(t('wrap.pictureTitle'), `fitness-os-week-${stats.week.start}.png`, url);
    setMsg(r === 'downloaded' ? t('wrap.saved') : '');
  };
  const sendWeek = async () => {
    const r = await shareText(t('wrap.sendTitle'), weekText(stats, { feel, check: checkLine(data) }));
    setMsg(r === 'copied' ? t('wrap.copied') : '');
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="list">
        <Row label={t('wrap.rowSessions')} value={s.planned ? t('wrap.ofN', { done: s.done, planned: s.planned }) : s.done} />
        <Row label={t('wrap.rowSets')} value={stats.workSets} />
        <Row label={t('wrap.rowMealDays')} value={stats.mealDays} />
        {stats.proteinDays != null ? <Row label={t('wrap.rowProtein')} value={stats.proteinDays} /> : null}
        {stats.steps != null ? <Row label={t('wrap.rowSteps')} value={stats.steps.toLocaleString(LOCALE)} /> : null}
        {stats.sleepMin != null ? <Row label={t('wrap.rowSleep')} value={hm(stats.sleepMin)} /> : null}
      </div>
      {identity ? <p className="wrap-identity">{identity}</p> : null}

      {name ? (
        <label className="row" style={{ gap: 10, minHeight: 44 }}>
          <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span>{t('wrap.addName')}</span>
        </label>
      ) : null}
      <button type="button" className="btn secondary" onClick={sharePicture}><Icon name="upload" /> {t('wrap.share')}</button>

      {APP.flavor === 'friends' ? (
        <section className="stack" style={{ marginTop: 16 }}>
          <strong>{t('wrap.sendTitle')}</strong>
          <label className="field">
            <span>{t('wrap.feel')}</span>
            <input type="text" maxLength={200} value={feel} onChange={(e) => setFeel(e.target.value)} />
          </label>
          <button type="button" className="btn" onClick={sendWeek}><Icon name="upload" /> {t('wrap.send')}</button>
          <p className="muted small" style={{ margin: 0 }}>{t('wrap.sendNote')}</p>
        </section>
      ) : null}
      {msg ? <p className="muted small" role="status">{msg}</p> : null}
    </Sheet>
  );
}
