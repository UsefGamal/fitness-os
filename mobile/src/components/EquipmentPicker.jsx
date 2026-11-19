import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { KINDS, ownedKinds, PRESETS } from '../lib/equipment.js';
import { t } from '../lib/i18n.js';
import { setTraining, trainingSettings } from '../lib/training.js';
import { useData } from '../store/useData.js';

/** What equipment you have: a preset row and one cell per kind. Used in
 * Settings > Training and, as a sheet, on the workout start screen. */
export function EquipmentPicker() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const owned = ownedKinds(trainingSettings(data));
  const set = (changes) => update((d) => setTraining(d, changes));
  return (
    <>
      <div className="section-label">{t('set.equipment')}</div>
      <div className="chip-row">
        {PRESETS.map((p) => {
          const on = p.kinds === null ? owned === null : owned !== null && owned.length === p.kinds.length && p.kinds.every((k) => owned.includes(k));
          return <button key={p.key} type="button" className={`chip${on ? ' accent' : ''}`} aria-pressed={on} onClick={() => set({ equipment: p.kinds })}>{p.label}</button>;
        })}
      </div>
      <div className="equip-grid">
        {KINDS.map((k) => {
          const on = owned === null || owned.includes(k);
          const next = on ? (owned || KINDS).filter((x) => x !== k) : [...(owned || []), k];
          return <button key={k} type="button" className={`equip-cell${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set({ equipment: next.length === KINDS.length ? null : next })}>{on ? <Icon name="check" /> : null}<span>{k}</span></button>;
        })}
      </div>
      <p className="muted small" style={{ margin: '8px 16px 12px' }}>{t('set.equipNote')}</p>
    </>
  );
}

/** MOVE-2: change equipment without leaving the workout. */
export default function EquipmentSheet({ onClose }) {
  return (
    <Sheet title={t('set.equipment')} onClose={onClose}>
      <EquipmentPicker />
    </Sheet>
  );
}
