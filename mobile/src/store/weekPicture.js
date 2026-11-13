// The wrap-up as a picture to share (WRAP-1): 1080 x 1350, effort only.
// What it may show comes from lib/weekStats.js pictureLines and
// identityLine; this file only draws.

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Draw the card; returns a PNG data: URL. `name` only when the person
 * ticked "Add my name". */
export function drawWeekPicture({ title, range, lines, identity, name = '' }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // One card, the app's own surface colour, with the green accent bar.
  g.fillStyle = '#1c1c1e';
  if (g.roundRect) {
    g.beginPath();
    g.roundRect(60, 60, W - 120, H - 120, 48);
    g.fill();
  } else g.fillRect(60, 60, W - 120, H - 120);
  g.fillStyle = '#30d158';
  g.fillRect(60, 160, 12, 120);

  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff';
  g.font = `700 84px ${FONT}`;
  g.fillText(title, 120, 236);
  g.fillStyle = '#98989f';
  g.font = `400 40px ${FONT}`;
  g.fillText(name ? `${name} · ${range}` : range, 120, 300);

  let y = 470;
  for (const { label, value } of lines) {
    g.fillStyle = '#98989f';
    g.font = `400 40px ${FONT}`;
    g.fillText(label, 120, y);
    g.fillStyle = '#fff';
    g.font = `700 96px ${FONT}`;
    g.fillText(value, 120, y + 104);
    y += 230;
  }

  if (identity) {
    g.fillStyle = '#30d158';
    g.font = `700 56px ${FONT}`;
    g.fillText(identity, 120, H - 200);
  }
  g.fillStyle = '#98989f';
  g.font = `400 34px ${FONT}`;
  g.fillText('Fitness OS', 120, H - 120);
  return canvas.toDataURL('image/png');
}
