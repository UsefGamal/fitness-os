import Icon from './Icon.jsx';

/** Big +/- buttons so a set can be logged one-handed without the keyboard. */
export default function Stepper({ value, onChange, step = 1, min = 0, max = 1000, label, decimals = 0 }) {
  const set = (v) => {
    const n = Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
    onChange(Number(n.toFixed(decimals)));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Less ${label}`} onClick={() => set(value - step)}>
          <Icon name="minus" />
        </button>
        <input type="number" inputMode="decimal" value={value} onChange={(e) => set(parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
        <button type="button" aria-label={`More ${label}`} onClick={() => set(value + step)}>
          <Icon name="plus" />
        </button>
      </div>
    </label>
  );
}
