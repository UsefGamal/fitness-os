import { lazy, Suspense, useEffect } from 'react';
import { Outlet, createHashRouter, RouterProvider, useLocation } from 'react-router';

import Fanfare from './components/Fanfare.jsx';
import RestTimer from './components/RestTimer.jsx';
import TabBar from './components/TabBar.jsx';
import { scheduleReminders } from './store/notify.js';
import { startPhoneSync } from './store/phoneSync.js';
import { content, useData } from './store/useData.js';
import Meals from './views/Meals.jsx';
import Plan from './views/Plan.jsx';
import Settings from './views/Settings.jsx';
import Today from './views/Today.jsx';
import Workout from './views/Workout.jsx';

// Screens you open now and then load on first use, so start-up stays quick.
const CatalogueDetail = lazy(() => import('./views/CatalogueDetail.jsx'));
const ExerciseDetail = lazy(() => import('./views/ExerciseDetail.jsx'));
const History = lazy(() => import('./views/History.jsx'));
const HistoryList = lazy(() => import('./views/HistoryList.jsx'));
const Intervals = lazy(() => import('./views/Intervals.jsx'));
const FollowAlong = lazy(() => import('./views/FollowAlong.jsx'));
const Photos = lazy(() => import('./views/Photos.jsx'));
const Library = lazy(() => import('./views/Library.jsx'));
const Profile = lazy(() => import('./views/Profile.jsx'));
const Quests = lazy(() => import('./views/Quests.jsx'));
const Shopping = lazy(() => import('./views/Shopping.jsx'));
const Stats = lazy(() => import('./views/Stats.jsx'));
const Session = lazy(() => import('./views/Session.jsx'));

// Detail pages slide in from the right; tabs fade (styles.css, .route).
const TABS = new Set(['/', '/plan', '/workout', '/meals', '/stats']);

function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <div key={pathname} className={`route ${TABS.has(pathname) ? 'tab-in' : 'push-in'}`}>
        <Suspense fallback={<div className="page" />}>
          <Outlet />
        </Suspense>
      </div>
      <RestTimer />
      <Fanfare />
      <TabBar />
    </>
  );
}

// Hash routes: the app is served from files inside the APK, so there's no
// server to send every path back to index.html.
const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/plan', element: <Plan /> },
      { path: '/workout', element: <Workout /> },
      { path: '/intervals', element: <Intervals /> },
      { path: '/follow', element: <FollowAlong /> },
      { path: '/photos', element: <Photos /> },
      { path: '/meals', element: <Meals /> },
      { path: '/stats', element: <Stats /> },
      { path: '/history', element: <HistoryList /> },
      { path: '/history/:id', element: <History /> },
      { path: '/library', element: <Library /> },
      { path: '/library/:id', element: <ExerciseDetail /> },
      { path: '/catalogue/:id', element: <CatalogueDetail /> },
      { path: '/settings', element: <Settings /> },
      { path: '/shopping', element: <Shopping /> },
      { path: '/session/:type', element: <Session /> },
      { path: '/quests', element: <Quests /> },
      { path: '/profile', element: <Profile /> },
      { path: '*', element: <Today /> },
    ],
  },
]);

export default function App() {
  const { ready, hydrate } = useData();
  useEffect(() => {
    hydrate().then(() => {
      // Keep two weeks of reminders queued on every open.
      scheduleReminders(content, useData.getState().data.settings.notifications);
      startPhoneSync();
    });
  }, [hydrate]);
  if (!ready) return null;
  return <RouterProvider router={router} />;
}
