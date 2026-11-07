import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, ScrollRestoration, createHashRouter, RouterProvider, useLocation, useNavigationType } from 'react-router';

import ErrorBoundary from './components/CrashScreen.jsx';
import RecoveryScreen from './components/RecoveryScreen.jsx';
import { recordError } from './store/errors.js';
import Fanfare from './components/Fanfare.jsx';
import SaveBar from './components/SaveBar.jsx';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import Intro from './components/Intro.jsx';
import { closeTopOverlay } from './lib/overlays.js';
import RestTimer from './components/RestTimer.jsx';
import { useTimer } from './store/useTimer.js';
import TabBar from './components/TabBar.jsx';
import { todayISO } from './lib/dates.js';
import { routesFor } from './lib/flags.js';
import { dirOf, localeOf, setLocale, t } from './lib/i18n.js';
import { introLine, shouldPlayIntro } from './lib/intro.js';
import { needsSetup } from './lib/setup.js';
import Setup from './views/Setup.jsx';
import { programDayFor } from './lib/schedule.js';
import { activePlan } from './lib/plan.js';
import { timesOf } from './lib/times.js';
import { APP } from './lib/version.js';
import { catchErrors } from './store/errors.js';
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
const MyRoutine = lazy(() => import('./views/MyRoutine.jsx'));
const Routines = lazy(() => import('./views/Routines.jsx'));
const Snapshots = lazy(() => import('./views/Snapshots.jsx'));
const Lab = lazy(() => import('./views/Lab.jsx'));

catchErrors();
const Quests = lazy(() => import('./views/Quests.jsx'));
const Shopping = lazy(() => import('./views/Shopping.jsx'));
const Stats = lazy(() => import('./views/Stats.jsx'));
const Session = lazy(() => import('./views/Session.jsx'));

// Detail pages slide in from the right (left in RTL); Back slides the other
// way; tabs fade (styles.css, .route).
const TABS = new Set(['/', '/plan', '/workout', '/meals', '/stats']);

function Shell() {
  const { pathname } = useLocation();
  const back = useNavigationType() === 'POP';
  const timing = useTimer((t) => Boolean(t.endsAt));
  return (
    <>
      {/* New pages open at the top; Back returns to where you were (UX-03). */}
      <ScrollRestoration />
      <div key={pathname} className={`route ${TABS.has(pathname) ? 'tab-in' : back ? 'pop-in' : 'push-in'}${timing ? (pathname === '/workout' ? ' with-timer' : ' with-pill') : ''}`}>
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<div className="page" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
      <RestTimer compact={pathname !== '/workout'} />
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
    // Routes with a flag are left out of builds where the flag is off.
    children: routesFor([
      { path: '/', element: <Today /> },
      { path: '/plan', element: <Plan /> },
      { path: '/plan/mine', element: <MyRoutine /> },
      { path: '/plan/mine/:key', element: <MyRoutine /> },
      { path: '/plan/routines', element: <Routines /> },
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
      { path: '/settings/:section', element: <Settings /> },
      { path: '/shopping', element: <Shopping /> },
      { path: '/session/:type', element: <Session /> },
      { path: '/quests', element: <Quests /> },
      { path: '/profile', element: <Profile /> },
      { path: '/snapshots', element: <Snapshots /> },
      { path: '/lab', element: <Lab />, flag: 'example_lab' },
      { path: '*', element: <Today /> },
    ], APP),
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
    next = programDayFor(today, activePlan(data, content), data.session_moves || []);
  } catch {
    next = null;
  }
  const doneToday = data.workouts.some((w) => w.log_date === today && w.finished_at && (w.workout_type || 'gym') === 'gym');
  return introLine({ next, time: timesOf(data, content).session_time, doneToday, firstRun: data.workouts.length === 0 });
}

/** Android back: close the top sheet first, then go back a screen, and
 * only leave the app from the first screen (E6-S7). */
function listenBackButton() {
  if (!Capacitor.isNativePlatform()) return;
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (closeTopOverlay()) return;
    if (canGoBack && window.history.length > 1 && window.location.hash !== '#/') window.history.back();
    else CapApp.exitApp();
  });
}

export default function App() {
  const { ready, hydrate, loadError, startError } = useData();
  const [intro, setIntro] = useState(undefined); // undefined: not decided yet, null: no intro
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    hydrate().then(() => {
      const loc = setLocale(localeOf(useData.getState().data));
      document.documentElement.lang = loc;
      document.documentElement.dir = dirOf(loc);
      if (useData.getState().loadError || useData.getState().startError) return;
      // A fresh phone gets the first-time setup instead of the intro (E5-S2).
      if (needsSetup(useData.getState().data)) { setSetup(true); setIntro(null); } else setIntro(introFor());
      // Keep two weeks of reminders queued on every open.
      scheduleReminders(content, useData.getState().data.settings.notifications);
      startPhoneSync();
      listenBackButton();
    }).catch((err) => {
      // Never a black screen (TL-03): anything that throws while starting
      // lands on the recovery screen, with the data untouched.
      recordError(err instanceof Error ? err : new Error(String(err)));
      useData.setState({ startError: 'failed', ready: true });
    });
  }, [hydrate]);
  const endIntro = useCallback(() => setIntro(null), []);
  if (!ready) return null;
  if (loadError) {
    // The saved data is from a newer version of the app. Nothing is
    // written until a version that reads it is installed.
    return (
      <div className="page" role="alert">
        <h1 className="page-title">{t('update.title')}</h1>
        <p className="page-sub">{loadError}</p>
        <p className="muted small">{t('update.safe')}</p>
      </div>
    );
  }
  if (startError) return <RecoveryScreen kind={startError} />;
  if (setup) return <><Setup onDone={() => setSetup(false)} /><SaveBar /></>;
  return (
    <>
      <RouterProvider router={router} />
      <SaveBar />
      {typeof intro === 'string' ? <Intro line={intro} onDone={endIntro} /> : null}
    </>
  );
}
