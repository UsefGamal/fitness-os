import { NavLink, useLocation } from 'react-router';

import { moduleOn } from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { feedback } from '../store/feedback.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';

// openGym's tab bar: Home / Plan / Start / Meals / Stats.
// Each tab has its own tone (MOVE-1, colour 4): the sliding highlight takes
// the colour of the tab it lands on.
const TABS = [
  { to: '/', label: 'tab.home', icon: 'home', end: true, tone: 'var(--accent)' },
  { to: '/plan', label: 'tab.plan', icon: 'calendar', tone: 'var(--accent)' },
  { to: '/workout', label: 'tab.start', icon: 'play', cls: 'start', tone: 'var(--accent)' },
  { to: '/meals', label: 'tab.meals', icon: 'meals', module: 'meals', tone: 'var(--tab-meals)' },
  { to: '/library', label: 'tab.library', icon: 'book', onlyWhenOff: 'meals', tone: 'var(--tab-library)' },
  { to: '/stats', label: 'tab.stats', icon: 'chart', tone: 'var(--tab-stats)' },
];
const isOn = (tab, path) => (tab.end ? path === tab.to : path === tab.to || path.startsWith(`${tab.to}/`));

export default function TabBar() {
  // Only the one switch it shows, so a save elsewhere doesn't redraw it.
  const mealsOn = useData((s) => moduleOn(s.data, 'meals'));
  // Meals is this app's extra tab; with the Meals module off, openGym's
  // Library takes its place so there are always five.
  const on = (m) => (m === 'meals' ? mealsOn : true);
  const tabs = TABS.filter((tab) => (tab.module ? on(tab.module) : tab.onlyWhenOff ? !on(tab.onlyWhenOff) : true));
  const { pathname } = useLocation();
  const at = tabs.findIndex((tab) => isOn(tab, pathname));
  return (
    <nav className="tabbar" aria-label={t('nav.main')} style={{ '--n': tabs.length }}>
      {at >= 0 ? <span className="tab-ind" aria-hidden="true" style={{ '--i': at, '--tone': tabs[at].tone }} /> : null}
      {tabs.map((tab, i) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          // The page slides in from the side of the tab you came from.
          state={at >= 0 && i !== at ? { swipe: i > at ? 'forward' : 'back' } : undefined}
          onClick={() => { if (i !== at) feedback('tap'); }}
          className={({ isActive }) => `tab ${tab.cls || ''}${isActive ? ' active' : ''}`}
          style={{ '--tone': tab.tone }}
        >
          <Icon name={tab.icon} className="icon" />
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  );
}
