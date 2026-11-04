import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { capitalize } from '../lib/catalogue.js';
import { alternatives, byCluster, forGroup, sharedMuscles } from '../lib/similar.js';
import Icon from './Icon.jsx';

/** "Train the same muscles with…": catalogue exercises like `entry` (or,
 * with no catalogue match, strength work for `group`), grouped by the
 * equipment they need. Chips narrow the list to one kind of equipment. */
export default function Alternatives({ entry, group, catalogue }) {
  const [only, setOnly] = useState(null);
  const ranked = useMemo(() => {
    if (!catalogue) return [];
    if (entry) return alternatives(entry, catalogue.exercises);
    return group ? forGroup(group, catalogue.exercises) : [];
  }, [catalogue, entry, group]);
  if (!ranked.length) return null;
  const groups = byCluster(ranked, only ? 8 : 3);
  const shown = only ? groups.filter((g) => g.cluster === only) : groups;

  return (
    <>
      <div className="section-label">{entry ? 'Same muscles, other ways' : `Other ${group.toLowerCase()} exercises`}</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '0 4px 10px' }}>
        <button type="button" className={`chip${only ? '' : ' accent'}`} onClick={() => setOnly(null)}>All</button>
        {groups.map((g) => (
          <button key={g.cluster} type="button" className={`chip${only === g.cluster ? ' accent' : ''}`} onClick={() => setOnly(only === g.cluster ? null : g.cluster)}>{g.cluster}</button>
        ))}
      </div>
      {shown.map((g) => (
        <div key={g.cluster}>
          {only ? null : <div className="muted small" style={{ margin: '10px 16px 6px' }}>{g.cluster}</div>}
          <div className="list">
            {g.items.map(({ entry: alt, score }) => (
              <Link key={alt.id} to={`/catalogue/${encodeURIComponent(alt.id)}`} className="list-row">
                {alt.photos?.[0] ? <img className="thumb" src={`exercise-db/${alt.photos[0]}`} alt="" loading="lazy" decoding="async" /> : <span className="thumb blank" />}
                <div className="grow">
                  <div>{alt.name}</div>
                  <div className="meta">
                    {entry ? `${capitalize(sharedMuscles(entry, alt).join(', '))} · ${Math.round(score * 100)}% match` : capitalize(alt.primary.join(', '))}
                  </div>
                </div>
                <Icon name="chev" className="icon chev" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
