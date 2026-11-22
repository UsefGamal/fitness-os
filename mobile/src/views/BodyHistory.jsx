import { useState } from 'react';
import { Link, useParams } from 'react-router';

import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import WeighInSheet from '../components/WeighInSheet.jsx';
import { MEASURES } from '../lib/bodyStats.js';
import { formatDate } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { useToday } from '../store/today.js';
import { useData } from '../store/useData.js';

/** Stats > Body > Body measurements: each tape measure's latest number,
 * its change since the first, and a small line once there are two. */
function Measurements({ data, onLog }) {
  const rows = MEASURES.map((k) => ({ k, logs: data.body_logs.filter((b) => b[k] != null) })).filter((r) => r.logs.length);
  return (
    <>
      <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={onLog}><Icon name="tape" /> {t('body.logMeasures')}</button>
      {rows.length ? rows.map(({ k, logs }) => {
        const now = logs[logs.length - 1][k];
        const diff = Math.round((now - logs[0][k]) * 10) / 10;
        return (
          <section key={k} className="card">
            <div className="row between"><strong>{t(`body.name.${k}`)}</strong><strong className="wavg-kg">{t('body.cm', { cm: now })}</strong></div>
            <div className="muted small">
              {logs.length > 1 ? t('body.since', { diff: `${diff > 0 ? '+' : ''}${diff}`, date: formatDate(logs[0].log_date) }) : t('body.onlyOne', { date: formatDate(logs[0].log_date) })}
            </div>
            {logs.length > 1 ? <LineChart points={logs.map((b) => ({ date: b.log_date, value: b[k] }))} unit="cm" label={t(`body.name.${k}`)} summary={t('body.nTimes', { n: logs.length })} /> : null}
          </section>
        );
      }) : <EmptyState art="chart" title={t('body.measEmptyTitle')} note={t('body.measEmpty')} />}
    </>
  );
}

/** Stats > Body > Weigh-in history: every weigh-in, newest first; tap one
 * to change or delete it (UX-23). */
function WeighIns({ data, onEdit }) {
  if (!data.body_logs.length) return <EmptyState art="history" title={t('body.histEmptyTitle')} note={t('body.histEmpty')} />;
  return (
    <div className="list">
      {[...data.body_logs].reverse().map((b) => {
        const cms = MEASURES.filter((k) => b[k] != null).map((k) => `${t(`body.name.${k}`).toLowerCase()} ${b[k]}`);
        return (
          <button key={b.id} type="button" className="list-row" onClick={() => onEdit(b)}>
            <div className="grow">
              <div><span className="sr-only">{t('body.edit')} </span>{t('wchart.kg', { kg: b.weight_kg })}</div>
              {cms.length ? <div className="meta">{cms.join(' · ')} cm</div> : null}
            </div>
            <span className="meta">{formatDate(b.log_date)}</span>
            <Icon name="chev" className="icon chev" />
          </button>
        );
      })}
    </div>
  );
}

/** The two secondary Body screens (Body review, 22 Nov): measurements and
 * the full weigh-in list, so the Body tab itself stays short. */
export default function BodyHistory() {
  const { section } = useParams();
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const [sheet, setSheet] = useState(null); // { entry } | { measures: true }
  const isMeasures = section === 'measurements';
  return (
    <div className="page">
      <Link to="/stats?tab=body" className="btn ghost small" style={{ paddingInlineStart: 0, alignSelf: 'flex-start' }}><Icon name="back" /> {t('stats.tab.body')}</Link>
      <h1 className="page-title" style={{ marginTop: 4 }}>{t(isMeasures ? 'body.measTitle' : 'body.histTitle')}</h1>
      <p className="page-sub">{t(isMeasures ? 'body.measSub' : 'body.histSub', { n: data.body_logs.length })}</p>
      {isMeasures ? <Measurements data={data} onLog={() => setSheet({ measures: true })} /> : <WeighIns data={data} onEdit={(entry) => setSheet({ entry })} />}
      {sheet ? <WeighInSheet data={data} update={update} today={today} entry={sheet.entry || null} measures={!!sheet.measures} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
