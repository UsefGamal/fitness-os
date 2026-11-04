import { NavLink } from 'react-router';

import Icon from './Icon.jsx';

// openGym's tab bar: Home / Plan / Start / Meals / Stats.
const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/plan', label: 'Plan', icon: 'calendar' },
  { to: '/workout', label: 'Start', icon: 'play', cls: 'start' },
  { to: '/meals', label: 'Meals', icon: 'meals' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${t.cls || ''}${isActive ? ' active' : ''}`}>
          <Icon name={t.icon} className="icon" />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
