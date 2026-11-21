import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// The launcher icon (Tafra mark): Android picks the most specific folder, so a
// leftover drawable-v24 copy of the foreground silently replaced the logo on
// every phone (19 Nov 2026). There must be exactly one foreground and one
// monochrome layer, and the adaptive icons must point at them.
const RES = new URL('../../android/app/src/main/res/', import.meta.url);

test('launcher icon: one foreground and one monochrome drawable, no folder overrides them', () => {
  const dirs = readdirSync(RES).filter((d) => d.startsWith('drawable') || d.startsWith('mipmap'));
  for (const name of ['ic_launcher_foreground', 'ic_launcher_monochrome']) {
    const found = dirs.filter((d) => readdirSync(new URL(`${d}/`, RES)).some((f) => f.startsWith(`${name}.`)));
    assert.deepEqual(found, ['drawable'], `${name} lives only in drawable/`);
  }
});

test('launcher icon: both adaptive icons use the Tafra layers', () => {
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = readFileSync(new URL(`mipmap-anydpi-v26/${f}`, RES), 'utf8');
    assert.match(xml, /foreground android:drawable="@drawable\/ic_launcher_foreground"/);
    assert.match(xml, /monochrome android:drawable="@drawable\/ic_launcher_monochrome"/);
  }
  const fg = readFileSync(new URL('drawable/ic_launcher_foreground.xml', RES), 'utf8');
  assert.match(fg, /#FF30D158/, 'the mark is green');
  assert.ok(existsSync(new URL('mipmap-xxxhdpi/ic_launcher.png', RES)));
});

// Samsung's "Add to Home screen?" sheet showed "Couldn't add widget" over a
// grey box (19 Nov 2026): the widget had no preview of its own, so the
// launcher tried to draw one from the live layout. Give it a picture.
test('widget: the picker has a preview image', () => {
  const xml = readFileSync(new URL('xml/widget_today_info.xml', RES), 'utf8');
  assert.match(xml, /android:previewImage="@drawable\/widget_preview"/);
  assert.ok(existsSync(new URL('drawable-nodpi/widget_preview.png', RES)));
});

// Notification icons (20 Nov 2026): reminders showed the full app icon while the
// rest timer showed the ط mark. Every notification uses the one status icon.
test('notifications: reminders and native notifications all use ic_stat_bolt', async () => {
  const cfg = JSON.parse(readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.plugins.LocalNotifications.smallIcon, 'ic_stat_bolt');
  assert.equal(cfg.plugins.LocalNotifications.iconColor.toLowerCase(), '#30d158');
  const { NOTIFY_ICON } = await import('./reminders.js');
  assert.equal(NOTIFY_ICON, 'ic_stat_bolt');
  const stat = readdirSync(RES).filter((d) => d.startsWith('drawable') && readdirSync(new URL(`${d}/`, RES)).some((f) => f.startsWith('ic_stat_bolt.')));
  assert.deepEqual(stat, ['drawable'], 'ic_stat_bolt lives only in drawable/');
  const JAVA = new URL('../../android/app/src/main/java/', import.meta.url);
  const files = readdirSync(JAVA, { recursive: true }).filter((f) => String(f).endsWith('.java'));
  for (const f of files) {
    const src = readFileSync(new URL(String(f), JAVA), 'utf8');
    for (const m of src.matchAll(/setSmallIcon\(([^)]*)\)/g)) assert.equal(m[1], 'R.drawable.ic_stat_bolt', `${f} uses the Tafra status icon`);
  }
});
