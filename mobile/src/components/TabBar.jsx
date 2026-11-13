import { NavLink } from 'react-router';

import { moduleOn } from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';

// openGym's tab bar: Home / Plan / Start / Meals / Stats.
const TABS = [
  { to: '/', label: 'tab.home', icon: 'home', end: true },
  { to: '/plan', label: 'tab.plan', icon: 'calendar' },
  { to: '/workout', label: 'tab.start', icon: 'play', cls: 'start' },
  { to: '/meals', label: 'tab.meals', icon: 'meals', module: 'meals' },
  { to: '/library', label: 'tab.library', icon: 'book', onlyWhenOff: 'meals' },
  { to: '/stats', label: 'tab.stats', icon: 'chart' },
];

export default function TabBar() {
  // Only the one switch it shows, so a save elsewhere doesn't redraw it.
  const mealsOn = useData((s) => moduleOn(s.data, 'meals'));
  // Meals is this app's extra tab; with the Meals module off, openGym's
  // Library takes its place so there are always five.
  const on = (m) => (m === 'meals' ? mealsOn : true);
  const tabs = TABS.filter((tab) => (tab.module ? on(tab.module) : tab.onlyWhenOff ? !on(tab.onlyWhenOff) : true));
  return (
    <nav className="tabbar" aria-label={t('nav.main')}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `tab ${tab.cls || ''}${isActive ? ' active' : ''}`}>
          <Icon name={tab.icon} className="icon" />
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  );
}
