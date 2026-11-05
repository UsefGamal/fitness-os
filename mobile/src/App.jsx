import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, createHashRouter, RouterProvider, useLocation } from 'react-router';

import Fanfare from './components/Fanfare.jsx';
import Intro from './components/Intro.jsx';
import RestTimer from './components/RestTimer.jsx';
import { useTimer } from './store/useTimer.js';
import TabBar from './components/TabBar.jsx';
import { todayISO } from './lib/dates.js';
import { introLine, shouldPlayIntro } from './lib/intro.js';
import { programDayFor } from './lib/schedule.js';
import { timesOf } from './lib/times.js';
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
  const timing = useTimer((t) => Boolean(t.endsAt));
  return (
    <>
      <div key={pathname} className={`route ${TABS.has(pathname) ? 'tab-in' : 'push-in'}${timing ? ' with-timer' : ''}`}>
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

/** Decides once per launch whether the intro plays, and what it says. */
function introFor() {
  const { data, activeWorkoutId } = useData.getState();
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!shouldPlayIntro({ data, hash: window.location.hash, reducedMotion, activeWorkout: Boolean(activeWorkoutId) })) return null;
  const today = todayISO();
  let next = null;
  try {
    next = programDayFor(today, content.training, data.session_moves || []);
  } catch {
    next = null;
  }
  const doneToday = data.workouts.some((w) => w.log_date === today && w.finished_at && (w.workout_type || 'gym') === 'gym');
  return introLine({ next, time: timesOf(data, content).session_time, doneToday, firstRun: data.workouts.length === 0 });
}

export default function App() {
  const { ready, hydrate } = useData();
  const [intro, setIntro] = useState(undefined); // undefined: not decided yet, null: no intro
  useEffect(() => {
    hydrate().then(() => {
      setIntro(introFor());
      // Keep two weeks of reminders queued on every open.
      scheduleReminders(content, useData.getState().data.settings.notifications);
      startPhoneSync();
    });
  }, [hydrate]);
  const endIntro = useCallback(() => setIntro(null), []);
  if (!ready) return null;
  return (
    <>
      <RouterProvider router={router} />
      {typeof intro === 'string' ? <Intro line={intro} onDone={endIntro} /> : null}
    </>
  );
}
