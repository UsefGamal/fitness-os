import { NavLink } from 'react-router';

import { moduleOn } from '../lib/data.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';

// openGym's tab bar: Home / Plan / Start / Meals / Stats.
const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/plan', label: 'Plan', icon: 'calendar' },
  { to: '/workout', label: 'Start', icon: 'play', cls: 'start' },
  { to: '/meals', label: 'Meals', icon: 'meals', module: 'meals' },
  { to: '/library', label: 'Library', icon: 'book', onlyWhenOff: 'meals' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
];

export default function TabBar() {
  const data = useData((s) => s.data);
  // Meals is this app's extra tab; with the Meals module off, openGym's
  // Library takes its place so there are always five.
  const tabs = TABS.filter((t) => (t.module ? moduleOn(data, t.module) : t.onlyWhenOff ? !moduleOn(data, t.onlyWhenOff) : true));
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${t.cls || ''}${isActive ? ' active' : ''}`}>
          <Icon name={t.icon} className="icon" />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
