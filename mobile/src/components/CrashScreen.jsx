// Shown instead of a blank screen when a screen throws (E1-S4). It offers
// a backup first, then a bug report the person sends themselves.
import { Component, useState } from 'react';

import { toDataFile } from '../lib/dataFile.js';
import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { startLine } from '../lib/dataCheck.js';
import { APP } from '../lib/version.js';
import { recordError } from '../store/errors.js';
import { logStart } from '../store/native.js';
import { saveExport } from '../store/mirror.js';
import { useData } from '../store/useData.js';
import ReportSheet from './ReportSheet.jsx';

function CrashScreen() {
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState(false);
  const backup = async () => {
    try {
      const where = await saveExport(`fitness-os-backup-${todayISO()}.json`, toDataFile(useData.getState().data));
      setMsg(where ? t('crash.backupSaved') : t('crash.backupDownloaded'));
    } catch {
      setMsg(t('crash.backupFailed'));
    }
  };
  return (
    <div className="page" role="alert">
      <h1 className="page-title">{t('crash.title')}</h1>
      <p className="page-sub">{t('crash.body')}</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}
      <div className="stack">
        <button type="button" className="btn" onClick={backup}>{t('crash.backup')}</button>
        <button type="button" className="btn secondary" onClick={() => setReport(true)}>{t('crash.report')}</button>
        <button type="button" className="btn ghost" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>{t('crash.reload')}</button>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>{t('crash.reportNote')}</p>
      {report ? <ReportSheet onClose={() => setReport(false)} /> : null}
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    recordError(Object.assign(error instanceof Error ? error : new Error(String(error)), { stack: `${error?.stack || ''}\n${info?.componentStack || ''}` }));
    // The release update test reads this: a crash screen is never a pass (PROOF-1).
    logStart(startLine({ version: APP.version, error: 'crash' }));
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}
