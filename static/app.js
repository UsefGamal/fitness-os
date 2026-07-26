// Instant visual feedback on "mark done" style toggles before the page
// reloads with the real server state. No framework, no fetch/AJAX — just a
// brief client-side flourish so completing something feels satisfying.
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

  if (!form.classList.contains('js-toggle')) return;

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

  setTimeout(function () { form.submit(); }, 260);
});

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
