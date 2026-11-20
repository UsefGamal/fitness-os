/** An empty screen gets a small line drawing and, where there is one, the
 * one action that fills it (LF-10). The drawings are our own duotone SVG:
 * grey shapes with one green stroke that rises like the Tafra mark. */
const ART = {
  // A week page with the leap stroke rising across it.
  history: (
    <>
      <rect className="ea-g" x="30" y="14" width="60" height="54" rx="8" />
      <path className="ea-g" d="M30 28h60M44 9v10M76 9v10" />
      <path className="ea-a" d="M40 58l14-10 8 5 18-17" />
      <circle className="ea-f" cx="80" cy="36" r="3" />
    </>
  ),
  // A lens over a dumbbell.
  search: (
    <>
      <path className="ea-g" d="M30 44h30M26 36v16M34 38v12M56 38v12M64 36v16" />
      <circle className="ea-a" cx="72" cy="32" r="14" />
      <path className="ea-a" d="M82 42l12 12" />
    </>
  ),
  // A bowl with steam.
  meals: (
    <>
      <path className="ea-g" d="M24 42h72a36 22 0 0 1-72 0z" />
      <path className="ea-g" d="M50 72h20" />
      <path className="ea-a" d="M48 32c-4-6 4-8 0-16M60 32c-4-6 4-8 0-16M72 32c-4-6 4-8 0-16" />
    </>
  ),
  // A barbell lifting on a rising diagonal.
  strength: (
    <>
      <path className="ea-g" d="M24 54h72M30 44v20M38 47v14M82 47v14M90 44v20" />
      <path className="ea-a" d="M42 34l18-14 6 6 16-12" />
      <path className="ea-a" d="M76 14h7v7" />
    </>
  ),
  // A chart waiting for its line.
  chart: (
    <>
      <path className="ea-g" d="M26 14v52h68" />
      <path className="ea-g ea-dash" d="M34 56l14-8 12 4 14-14 14-8" />
      <circle className="ea-f" cx="34" cy="56" r="3.5" />
    </>
  ),
};

export default function EmptyState({ art = 'chart', title, note, children, className = '' }) {
  return (
    <section className={`card empty-state${className ? ` ${className}` : ''}`}>
      <svg className="empty-art" viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">{ART[art]}</svg>
      {title ? <h2 className="section-title empty-title">{title}</h2> : null}
      {note ? <p className="muted small empty-note">{note}</p> : null}
      {children}
    </section>
  );
}
