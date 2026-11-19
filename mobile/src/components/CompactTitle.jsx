import { useEffect, useState } from 'react';

/**
 * MOVE-1, collapsing large title: a page starts with its big title, and once
 * that has scrolled under the top of the screen a small bar with the same
 * words fades in at the top, the way phone apps do. It reads the page's own
 * .page-title, so no page has to opt in. Hidden from screen readers: the
 * real heading is still there.
 */
export default function CompactTitle({ pathname }) {
  const [title, setTitle] = useState('');
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    let io = null;
    // The page may still be loading: look again for a moment.
    let tries = 0;
    const find = () => {
      const h = document.querySelector('.route .page-title');
      if (!h) {
        if (tries < 10) { tries += 1; timer = setTimeout(find, 150); }
        return;
      }
      setTitle(h.textContent || '');
      io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
      io.observe(h);
    };
    let timer = setTimeout(find, 0);
    return () => { clearTimeout(timer); io?.disconnect(); };
  }, [pathname]);
  if (!title) return null;
  return <div className={`compact-title${shown ? ' on' : ''}`} aria-hidden="true"><span>{title}</span></div>;
}
