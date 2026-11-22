import { t } from '../lib/i18n.js';
import { tagGroups } from '../lib/muscles.js';

// TAG-1: a shape per group, so a tag reads without its colour too.
const SHAPE = {
  Legs: <path d="M5 0 10 10H0z" />,
  Chest: <rect width="10" height="10" rx="1.5" />,
  Back: <circle cx="5" cy="5" r="5" />,
  Shoulders: <path d="M5 0 10 5 5 10 0 5z" />,
  Arms: <rect y="3" width="10" height="4" rx="2" />,
  Core: <path d="M5 0 9.3 2.5v5L5 10 .7 7.5v-5z" />,
};

/** Small coloured tags for the muscle groups a target works. */
export default function MuscleTags({ target, groups = tagGroups(target) }) {
  if (!groups.length) return null;
  return (
    <span className="mtags" role="img" aria-label={t('mtag.aria', { groups: groups.map((g) => t(`mtag.${g}`)).join(', ') })}>
      {groups.map((g) => (
        <span key={g} className={`mtag mtag-${g.toLowerCase()}`} aria-hidden="true">
          <svg viewBox="0 0 10 10">{SHAPE[g]}</svg>{t(`mtag.${g}`)}
        </span>
      ))}
    </span>
  );
}
