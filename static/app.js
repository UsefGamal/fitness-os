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

    // The "log a set" form additionally re-selects the same exercise and
    // starts the rest timer once the swap lands, using data already sat on
    // the chosen <option> — see the exercise <select>'s data-reps/
    // data-weight/data-rest attributes in gym_detail.html.
    if (form.classList.contains('add-set-form')) {
      const select = form.querySelector('[data-prefill-source]');
      const chosen = select && select.selectedOptions[0];
      const exerciseId = chosen ? chosen.value : null;
      const restSeconds = chosen && chosen.dataset.rest ? parseInt(chosen.dataset.rest, 10) : null;

      submitWithoutReload(form, function () {
        const newSelect = document.querySelector('[data-prefill-source]');
        if (exerciseId && newSelect) {
          newSelect.value = exerciseId;
          newSelect.dispatchEvent(new Event('change'));
        }
        startRestTimer(restSeconds || undefined);
      });
      return;
    }

    submitWithoutReload(form);
  }
});

// Submits a form via fetch and swaps <main> with the freshly-rendered
// response instead of doing a full page navigation — same server routes,
// same redirect-on-success flow (fetch follows the 303 automatically), no
// backend changes needed. Falls back to a real form submit (full reload)
// on any failure, so a network hiccup or a JS error never leaves the user
// stuck without the form having gone through at all. `onDone`, if given,
// runs after the swap lands (e.g. to restore state the fresh markup can't
// know about, like an in-progress rest timer).
function submitWithoutReload(form, onDone) {
  fetch(form.action, { method: 'POST', body: new FormData(form) })
    .then(function (response) {
      if (!response.ok) throw new Error('request failed: ' + response.status);
      return response.text().then(function (html) {
        return { html: html, url: response.url };
      });
    })
    .then(function (result) {
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
      form.submit();
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
