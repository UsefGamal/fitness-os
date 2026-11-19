/**
 * MOVE-1, rolling digits: each digit is a column of 0-9 that slides to its
 * value, like an odometer, so a changed weight rolls instead of jumping.
 * Screen readers get the plain number. Non-digits (".", "-") stay still.
 */
export default function RollNumber({ value }) {
  const text = String(value ?? '');
  return (
    <span className="roll">
      <span className="sr-only">{text}</span>
      {[...text].map((ch, i) => (/\d/.test(ch) ? (
        // Keyed from the end so "99.8" -> "100.1" keeps the decimals in place.
        <span key={`d${text.length - i}`} className="roll-d" aria-hidden="true" style={{ transform: `translateY(-${Number(ch)}em)` }}>
          {'0123456789'.split('').map((d) => <span key={d}>{d}</span>)}
        </span>
      ) : <span key={`s${text.length - i}`} className="roll-s" aria-hidden="true">{ch}</span>))}
    </span>
  );
}
