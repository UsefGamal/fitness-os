/** The week as seven day tabs: weekday, session name, a tick when done.
 * With `onPick` each day is a tab button; `picked` (a date) is the open one
 * (BeFit item 9). */
export default function WeekStrip({ week, doneDates = new Set(), onPick, picked = null }) {
  return (
    <div className="week" role={onPick ? undefined : 'list'}>
      {week.map((d) => {
        const cls = ['week-day', d.key === 'rest' && 'rest', d.isToday && 'today', doneDates.has(d.date) && 'done', onPick && picked === d.date && 'picked'].filter(Boolean).join(' ');
        const inner = (
          <>
            <div className="d">{d.short}<span className="sr-only">:</span>{doneDates.has(d.date) ? <span className="tick" aria-hidden="true">✓</span> : null}</div>
            {d.tile && d.tile !== d.label ? (
              <div className="s"><span aria-hidden="true">{d.tile}</span><span className="sr-only">{d.label}</span></div>
            ) : <div className="s">{d.label}</div>}
            {d.isToday ? <span className="sr-only">, today</span> : null}
            {onPick && doneDates.has(d.date) ? <span className="sr-only">, done</span> : null}
          </>
        );
        return onPick ? (
          <button key={d.date} type="button" className={cls} style={{ border: undefined, color: 'inherit' }} aria-pressed={picked === d.date} onClick={() => onPick(d)}>
            {inner}
          </button>
        ) : (
          <div key={d.date} className={cls} role="listitem">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
