// The tick pop (SA-05): when a tap turns a round tick on, it pops once. It
// is added after React has rendered the new state, so a page that opens with
// ticks already on never pops them all at once.
let installed = false;

export function installPops() {
  if (installed || !globalThis.document) return;
  installed = true;
  document.addEventListener('click', (e) => {
    const host = e.target.closest?.('button, label, [role="button"]');
    const tick = e.target.closest?.('.check') || host?.querySelector?.('.check');
    if (!tick) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!tick.isConnected || !tick.classList.contains('on')) return;
      tick.classList.remove('pop');
      void tick.offsetWidth; // restart the animation
      tick.classList.add('pop');
      tick.addEventListener('animationend', () => tick.classList.remove('pop'), { once: true });
    }));
  }, true);
}
