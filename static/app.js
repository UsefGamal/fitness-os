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
    submitWithoutReload(form);
  }
});

// Submits a form via fetch and swaps <main> with the freshly-rendered
// response instead of doing a full page navigation — same server routes,
// same redirect-on-success flow (fetch follows the 303 automatically), no
// backend changes needed. Falls back to a real form submit (full reload)
// on any failure, so a network hiccup or a JS error never leaves the user
// stuck without the form having gone through at all.
function submitWithoutReload(form) {
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
    })
    .catch(function () {
      form.submit();
    });
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
