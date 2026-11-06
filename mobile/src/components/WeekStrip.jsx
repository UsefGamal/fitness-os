export default function WeekStrip({ week, doneDates = new Set(), onPick }) {
  return (
    <div className="week" role={onPick ? undefined : 'list'}>
      {week.map((d) => {
        const cls = ['week-day', d.key === 'rest' && 'rest', d.isToday && 'today', doneDates.has(d.date) && 'done'].filter(Boolean).join(' ');
        const inner = (
          <>
            <div className="d">{d.short}{doneDates.has(d.date) ? <span className="tick" aria-hidden="true">✓</span> : null}</div>
            <div className="s">{d.tile || d.label}</div>
          </>
        );
        return onPick ? (
          <button key={d.date} type="button" className={cls} style={{ border: undefined, color: 'inherit' }} onClick={() => onPick(d)} aria-label={`${d.short}: ${d.label}${d.isToday ? ', today' : ''}${doneDates.has(d.date) ? ', done' : ''}`}>
            {inner}
          </button>
        ) : (
          <div key={d.date} className={cls} role="listitem" aria-label={`${d.short}: ${d.label}${d.isToday ? ', today' : ''}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
