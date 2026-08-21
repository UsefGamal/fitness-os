// A no-op touchstart listener is the standard fix for iOS Safari not
// firing :active on tap unless *something* on the page listens for touch
// events — without it, press feedback (button/card scale-down) silently
// never appears on iPhone, which is how this app is mostly used.
document.addEventListener('touchstart', function () {}, { passive: true });

// Instant visual feedback on "mark done" style toggles, then a background
// fetch that swaps in the freshly-rendered page instead of a full browser
// navigation — no framework, no fetch library, just the platform fetch()
// API, which the CSP's connect-src 'self' already allows.
document.addEventListener('submit', function (e) {
  const form = e.target;

  // Destructive actions (delete session/set/entry) confirm before submitting.
  // Kept as unobtrusive JS (not inline onsubmit=) so the app can run a
  // strict script-src 'self' Content-Security-Policy.
  if (form.classList.contains('confirm-delete')) {
    if (!window.confirm(form.dataset.confirm || 'Are you sure?')) {
      e.preventDefault();
    }
    return;
  }

  if (form.classList.contains('js-toggle')) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;

    e.preventDefault();

    const willBeDone = !btn.classList.contains('done');
    btn.classList.toggle('done', willBeDone);
    btn.classList.remove('pop');
    void btn.offsetWidth; // restart animation
    btn.classList.add('pop');
    btn.textContent = willBeDone
      ? (btn.dataset.doneLabel || '✓ Done')
      : (btn.dataset.undoneLabel || 'Mark done');

    if (willBeDone) spawnConfetti(btn);

    submitWithoutReload(form);
    return;
  }

  if (form.classList.contains('no-reload-form')) {
    e.preventDefault();

    // The "log a set" form (both the main form and each row's one-tap
    // "repeat this set" button — see gym_detail.html) starts the rest timer
    // the instant it's submitted, not after the server round-trip: the set
    // itself already happened physically, so the rest period starts now
    // regardless of network speed or an offline queue detour. Rest duration
    // comes from the chosen <option>'s data-rest (main form) or the form's
    // own data-rest (repeat button, no <select> to read from).
    if (form.classList.contains('add-set-form')) {
      const select = form.querySelector('[data-prefill-source]');
      const chosen = select && select.selectedOptions[0];
      const exerciseId = chosen ? chosen.value : null;
      const restSeconds = chosen && chosen.dataset.rest
        ? parseInt(chosen.dataset.rest, 10)
        : (form.dataset.rest ? parseInt(form.dataset.rest, 10) : null);

      startRestTimer(restSeconds || undefined);

      submitWithoutReload(form, function () {
        const newSelect = document.querySelector('[data-prefill-source]');
        if (exerciseId && newSelect) {
          newSelect.value = exerciseId;
          newSelect.dispatchEvent(new Event('change'));
        }
      });
      return;
    }

    submitWithoutReload(form);
  }
});

// Submits a form via fetch and swaps <main> with the freshly-rendered
// response instead of doing a full page navigation — same server routes,
// same redirect-on-success flow (fetch follows the 303 automatically), no
// backend changes needed. `onDone`, if given, runs after a successful swap
// (e.g. to restore state the fresh markup can't know about).
//
// Two distinct failure modes get different handling:
//   - The server responded but rejected the request (validation error, etc.)
//     — not a connectivity problem, so fall through to a real submit and let
//     the existing full-page ?error= flow in main.py handle it.
//   - fetch() itself rejected (offline, DNS failure, timeout) — a genuine
//     connectivity problem. For forms marked `.offline-queueable` this queues
//     the submission in localStorage instead of losing it (see the offline
//     queue below); everything else falls back to a real submit, same as
//     the validation-error case, so it isn't silently swallowed.
function submitWithoutReload(form, onDone) {
  fetch(form.action, { method: 'POST', body: new FormData(form) })
    .then(function (response) {
      if (!response.ok) {
        form.submit();
        return null;
      }
      return response.text().then(function (html) {
        return { html: html, url: response.url };
      });
    })
    .then(function (result) {
      if (!result) return;
      const newMain = new DOMParser().parseFromString(result.html, 'text/html').querySelector('main');
      const currentMain = document.querySelector('main');
      if (!newMain || !currentMain) {
        window.location.href = result.url;
        return;
      }
      currentMain.replaceWith(newMain);
      history.replaceState(null, '', result.url);
      if (onDone) onDone();
    })
    .catch(function () {
      if (form.classList.contains('offline-queueable')) {
        queueOfflineSubmit(form);
      } else {
        form.submit();
      }
    });
}

// ── Stepper buttons (±reps, ±weight) and exercise-select prefill ──────
// Delegated on document (not bound per-button) so both work immediately
// on the swapped-in markup after submitWithoutReload, with no re-init step.
document.addEventListener('click', function (e) {
  const stepBtn = e.target.closest('.stepper-btn');
  if (stepBtn) {
    const form = stepBtn.closest('form');
    const field = form && form.querySelector('[name="' + stepBtn.dataset.stepTarget + '"]');
    if (field) {
      const step = parseFloat(stepBtn.dataset.step);
      const current = parseFloat(field.value) || 0;
      const min = field.min !== '' ? parseFloat(field.min) : -Infinity;
      const max = field.max !== '' ? parseFloat(field.max) : Infinity;
      const next = Math.min(max, Math.max(min, current + step));
      field.value = Number.isInteger(step) ? String(next) : next.toFixed(1);
    }
    return;
  }

  const preset = e.target.closest('.rest-preset-btn');
  if (preset) {
    startRestTimer(parseInt(preset.dataset.timerSeconds, 10));
    return;
  }

  if (e.target.closest('[data-timer-toggle]')) {
    if (restTimer.running) stopRestTimer(); else startRestTimer();
    return;
  }

  if (e.target.closest('[data-timer-reset]')) {
    stopRestTimer();
    restTimer.remaining = defaultRestSeconds();
    renderTimerDisplay();
    return;
  }

  if (e.target.closest('[data-stopwatch-toggle]')) {
    toggleStopwatch();
    return;
  }

  if (e.target.closest('[data-stopwatch-reset]')) {
    resetStopwatch();
    return;
  }

  const pushEnableBtn = e.target.closest('[data-push-enable]');
  if (pushEnableBtn) {
    enablePush(pushEnableBtn);
    return;
  }

  const pushDisableBtn = e.target.closest('[data-push-disable]');
  if (pushDisableBtn) {
    disablePush(pushDisableBtn);
  }
});

document.addEventListener('change', function (e) {
  if (!e.target.matches('[data-prefill-source]')) return;
  const option = e.target.selectedOptions[0];
  const form = e.target.closest('form');
  if (!option || !form) return;
  const repsField = form.querySelector('[data-prefill-field="reps"]');
  const weightField = form.querySelector('[data-prefill-field="weight_kg"]');
  if (repsField && option.dataset.reps) repsField.value = option.dataset.reps;
  if (weightField && option.dataset.weight) weightField.value = option.dataset.weight;
});

// ── Rest timer ──────────────────────────────────────────────────────
// One shared timer, not tied to a specific DOM node — the display is
// re-queried on every tick rather than cached, so the countdown survives
// the <main> swap that happens if the user logs another set mid-rest.
const restTimer = { intervalId: null, remaining: 0, running: false };
let audioCtx = null;

function defaultRestSeconds() {
  const widget = document.querySelector('.rest-timer');
  return (widget && parseInt(widget.dataset.defaultSeconds, 10)) || 90;
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function renderTimerDisplay() {
  const display = document.querySelector('[data-timer-display]');
  if (display) display.textContent = formatTimer(restTimer.remaining);
}

function stopRestTimer() {
  clearInterval(restTimer.intervalId);
  restTimer.intervalId = null;
  restTimer.running = false;
  const toggle = document.querySelector('[data-timer-toggle]');
  if (toggle) toggle.textContent = 'Start';
}

function startRestTimer(seconds) {
  clearInterval(restTimer.intervalId);
  restTimer.remaining = typeof seconds === 'number' && seconds > 0 ? seconds : defaultRestSeconds();
  restTimer.running = true;
  renderTimerDisplay();
  const toggle = document.querySelector('[data-timer-toggle]');
  if (toggle) toggle.textContent = 'Pause';
  restTimer.intervalId = setInterval(function () {
    restTimer.remaining -= 1;
    renderTimerDisplay();
    if (restTimer.remaining <= 0) {
      stopRestTimer();
      announceRestDone();
    }
  }, 1000);
}

function announceRestDone() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  // Web Audio can throw if the browser blocks it (no prior user gesture
  // on this page, or an old Safari) — vibration/the visual "0:00" already
  // carry the signal, so a beep failure is fine to swallow silently.
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (err) { /* see comment above */ }
}

// ── Duration stopwatch (cardio/padel session logging) ────────────────
// Counts up from Start to Stop, then writes the elapsed whole minutes into
// the paired duration field (data-duration-target on the .duration-stopwatch
// wrapper) — for timing a session live instead of guessing the duration
// afterward. Independent of the rest timer above (different page, never
// both present at once), so a second, separate piece of state is simplest.
const stopwatch = { intervalId: null, startedAt: null, elapsedMs: 0, running: false };

function formatStopwatch(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function renderStopwatchDisplay() {
  const display = document.querySelector('[data-stopwatch-display]');
  if (!display) return;
  const liveMs = stopwatch.elapsedMs + (stopwatch.running ? Date.now() - stopwatch.startedAt : 0);
  display.textContent = formatStopwatch(liveMs);
}

function toggleStopwatch() {
  const toggle = document.querySelector('[data-stopwatch-toggle]');
  if (stopwatch.running) {
    stopwatch.elapsedMs += Date.now() - stopwatch.startedAt;
    stopwatch.running = false;
    clearInterval(stopwatch.intervalId);
    if (toggle) toggle.textContent = 'Resume';

    const widget = document.querySelector('.duration-stopwatch');
    const targetName = widget && widget.dataset.durationTarget;
    const field = targetName && document.querySelector('[name="' + targetName + '"]');
    if (field) field.value = Math.max(1, Math.round(stopwatch.elapsedMs / 60000));
  } else {
    stopwatch.startedAt = Date.now();
    stopwatch.running = true;
    if (toggle) toggle.textContent = 'Stop';
    stopwatch.intervalId = setInterval(renderStopwatchDisplay, 1000);
  }
}

function resetStopwatch() {
  clearInterval(stopwatch.intervalId);
  stopwatch.intervalId = null;
  stopwatch.elapsedMs = 0;
  stopwatch.running = false;
  stopwatch.startedAt = null;
  const toggle = document.querySelector('[data-stopwatch-toggle]');
  if (toggle) toggle.textContent = 'Start';
  renderStopwatchDisplay();
}

// ── Offline queue (gym / padel session logging) ───────────────────────
// Gym sets and padel sessions are the two things most likely to get logged
// somewhere with bad signal (a gym basement, an outdoor court). A form
// marked `.offline-queueable` that hits a genuine network failure (see
// submitWithoutReload's catch) gets queued in localStorage instead of
// losing the input; the queue auto-flushes on the next 'online' event or
// page load, in submission order, one at a time so a mid-flush failure
// doesn't reorder anything.
const OFFLINE_QUEUE_KEY = 'fitos-offline-queue';

function readOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function writeOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    // localStorage unavailable (private browsing, quota) — the queue just
    // won't survive a reload; the form still submitted via the normal
    // fallback path in submitWithoutReload's caller, so nothing is lost
    // for this request, only for a *future* offline retry.
  }
  renderOfflineIndicator(queue.length);
}

function renderOfflineIndicator(count) {
  const el = document.querySelector('[data-offline-indicator]');
  if (!el) return;
  el.hidden = count === 0;
  el.textContent = count === 0 ? '' : (count === 1 ? '1 queued' : count + ' queued');
}

function queueOfflineSubmit(form) {
  const queue = readOfflineQueue();
  queue.push({
    action: form.action,
    body: new URLSearchParams(new FormData(form)).toString(),
  });
  writeOfflineQueue(queue);
}

function flushOfflineQueue() {
  const queue = readOfflineQueue();
  if (!queue.length) return;
  const [next, ...rest] = queue;
  fetch(next.action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: next.body,
  })
    .then(function () {
      // The server responded at all (regardless of status) — connectivity
      // is back, so this item is done being retried either way. A rejected
      // status means it was stale/invalid, not that we're still offline;
      // dropping it here (rather than leaving it to block every item behind
      // it forever) is the tradeoff, at the cost of that one item silently
      // not making it in — acceptable for how rarely it should happen.
      writeOfflineQueue(rest);
      if (rest.length) {
        flushOfflineQueue();
      } else {
        window.location.reload();
      }
    })
    .catch(function () {
      // fetch() itself rejected — genuinely still offline. Leave the whole
      // queue untouched; the next 'online' event or page load retries it.
    });
}

window.addEventListener('online', flushOfflineQueue);
document.addEventListener('DOMContentLoaded', function () {
  renderOfflineIndicator(readOfflineQueue().length);
  if (navigator.onLine) flushOfflineQueue();
});

// ── Push notification opt-in (Settings page) ───────────────────────────
// Registers /sw.js (root-scoped — see main.py) and subscribes/unsubscribes
// through the browser's PushManager, syncing the subscription to the
// backend via routers/push.py. Evening-nudge sending itself is a server
// cron (routers/reminders.py) — this is only the opt-in plumbing.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function setPushStatus(text) {
  const el = document.querySelector('[data-push-status]');
  if (el) el.textContent = text;
}

function initPushSettings() {
  const enableBtn = document.querySelector('[data-push-enable]');
  const disableBtn = document.querySelector('[data-push-disable]');
  if (!enableBtn && !disableBtn) return; // not on Settings, or not configured server-side

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setPushStatus("Push notifications aren't supported in this browser.");
    return;
  }

  navigator.serviceWorker.register('/sw.js')
    .then(function (registration) {
      return registration.pushManager.getSubscription();
    })
    .then(function (existing) {
      if (existing) {
        setPushStatus('Reminders are on.');
        if (disableBtn) disableBtn.hidden = false;
      } else {
        setPushStatus('Reminders are off.');
        if (enableBtn) enableBtn.hidden = false;
      }
    })
    .catch(function () {
      setPushStatus('Could not check notification status.');
    });
}

function enablePush(button) {
  setPushStatus('Requesting permission…');
  Notification.requestPermission()
    .then(function (permission) {
      if (permission !== 'granted') {
        setPushStatus('Permission denied — enable notifications for this site in your browser settings to turn reminders on.');
        return null;
      }
      return navigator.serviceWorker.ready
        .then(function (registration) {
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(button.dataset.vapidKey),
          });
        })
        .then(function (subscription) {
          const json = subscription.toJSON();
          return fetch('/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
          });
        });
    })
    .then(function (result) {
      if (!result) return;
      setPushStatus('Reminders are on.');
      button.hidden = true;
      const disableBtn = document.querySelector('[data-push-disable]');
      if (disableBtn) disableBtn.hidden = false;
    })
    .catch(function () {
      setPushStatus('Could not enable reminders — try again.');
    });
}

function disablePush(button) {
  navigator.serviceWorker.ready
    .then(function (registration) {
      return registration.pushManager.getSubscription();
    })
    .then(function (subscription) {
      if (!subscription) return null;
      const endpoint = subscription.endpoint;
      return subscription.unsubscribe().then(function () {
        return fetch('/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: endpoint }),
        });
      });
    })
    .then(function () {
      setPushStatus('Reminders are off.');
      button.hidden = true;
      const enableBtn = document.querySelector('[data-push-enable]');
      if (enableBtn) enableBtn.hidden = false;
    })
    .catch(function () {
      setPushStatus('Could not turn off reminders — try again.');
    });
}

document.addEventListener('DOMContentLoaded', initPushSettings);

function spawnConfetti(anchor) {
  const rect = anchor.getBoundingClientRect();
  const colors = ['#22c55e', '#fbbf24', '#a78bfa'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-particle';
    p.style.left = (rect.left + rect.width / 2) + 'px';
    p.style.top = (rect.top + rect.height / 2) + 'px';
    p.style.background = colors[i % colors.length];
    const angle = (Math.PI * 2 * i) / 10;
    p.style.setProperty('--dx', Math.cos(angle) * 44 + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * 44 + 'px');
    document.body.appendChild(p);
    setTimeout(function () { p.remove(); }, 650);
  }
}
