// Small inline icon set (our own strokes, 24x24).
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  play: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z',
  meals: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  check: 'M5 12l5 5L20 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3z',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M10 2h4',
  scale: 'M4 20h16l-2-12H6zM9 8a3 3 0 0 1 6 0',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  cart: 'M3 4h2l2.4 11h10.2L20 8H6.2M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  pause: 'M8 5v14M16 5v14',
  skip: 'M5 5l9 7-9 7zM19 5v14',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  waves: 'M2 12h3l3-7 4 14 3-9 2 4h5',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  medal: 'M7 3l3 6M17 3l-3 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 13v4',
  kettlebell: 'M9 8a3 3 0 0 1 6 0M8 9h8l2 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z',
  sunrise: 'M3 18h18M7 18a5 5 0 0 1 10 0M12 5v4M5 10l2 2M19 10l-2 2M8 21h8',
  person: 'M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 10h14M12 10v5M9 22l3-7 3 7',
  barbell: 'M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8',
  tape: 'M3 12a6 6 0 1 0 12 0 6 6 0 1 0-12 0M15 12h6v4h-6M9 10v4',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
};

export default function Icon({ name, className = 'icon', title }) {
  return (
    <svg className={className} data-icon={name} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
