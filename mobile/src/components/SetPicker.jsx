import RulerPicker from './RulerPicker.jsx';
import Sheet, { useCloseSheet } from './Sheet.jsx';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

/** The heaviest weight and most reps the rulers go to. */
export const PICK_MAX_KG = 300;
export const PICK_MAX_REPS = 100;
export const PICK_MAX_SECS = 600;

function LogButton({ onLog, disabled, text }) {
  const close = useCloseSheet(() => {});
  const log = () => { close(); onLog(); };
  return (
    <button type="button" className="btn" style={{ marginTop: 20 }} disabled={disabled} onClick={log}>
      <Icon name="check" /> {text}
    </button>
  );
}

/**
 * The next set's weight and reps as two rulers you drag sideways (Yusuf,
 * 27 Nov: "a scale, easier than the counters"). Each big number can still
 * be typed, and -/+ step by the exercise's weight step and by one rep.
 * Every change shows in the set table at once; "Log set" logs it.
 * @param {{ setNo: number, weight: number, reps: number, onWeight: (n: number) => void, onReps: (n: number) => void, kgStep: number, timed: boolean, onLog: () => void, canLog: boolean, onClose: () => void }} p
 */
export default function SetPicker({ setNo, weight, reps, onWeight, onReps, kgStep, timed, onLog, canLog, onClose }) {
  const logText = timed ? t('workout.logBarSecs', { n: setNo, secs: reps }) : t('workout.logBar', { n: setNo, kg: weight, reps });
  return (
    <Sheet title={t('picker.title', { n: setNo })} onClose={onClose}>
      <div className="set-picker" data-noswipe="">
        {timed ? null : (
          <>
            <div className="section-label">{t('picker.weight')}</div>
            <RulerPicker compact precise value={Math.min(weight, PICK_MAX_KG)} min={0} max={PICK_MAX_KG} step={0.5} major={5} nudge={kgStep} unit={t('story.kg')} label={t('workout.editKg', { n: setNo })} onChange={onWeight} />
          </>
        )}
        <div className="section-label">{t(timed ? 'picker.secs' : 'picker.reps')}</div>
        {timed ? (
          <RulerPicker compact value={Math.max(5, Math.min(reps, PICK_MAX_SECS))} min={0} max={PICK_MAX_SECS} step={5} major={30} nudge={5} unit={t('picker.secsUnit')} label={t('workout.editSecs', { n: setNo })} onChange={(v) => onReps(Math.max(5, v))} />
        ) : (
          <RulerPicker compact value={Math.max(1, Math.min(reps, PICK_MAX_REPS))} min={0} max={PICK_MAX_REPS} step={1} major={5} nudge={1} unit={t('picker.repsUnit')} label={t('workout.editReps', { n: setNo })} onChange={(v) => onReps(Math.max(1, v))} />
        )}
        <LogButton onLog={onLog} disabled={!canLog} text={logText} />
      </div>
    </Sheet>
  );
}
