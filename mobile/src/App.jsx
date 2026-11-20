import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, createHashRouter, RouterProvider, useLocation, useNavigationType } from 'react-router';

import ErrorBoundary from './components/CrashScreen.jsx';
import RecoveryScreen from './components/RecoveryScreen.jsx';
import { recordError } from './store/errors.js';
import Fanfare from './components/Fanfare.jsx';
import Announcer from './components/Announcer.jsx';
import SaveBar from './components/SaveBar.jsx';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import Intro from './components/Intro.jsx';
import PermissionsSheet from './components/PermissionsSheet.jsx';
import { askPermissionsOnOpen } from './lib/reminderHealth.js';
import { closeTopOverlay } from './lib/overlays.js';
import RestTimer from './components/RestTimer.jsx';
import { useTimer } from './store/useTimer.js';
import TabBar from './components/TabBar.jsx';
import useSwipeTabs from './components/useSwipeTabs.js';
import { moduleOn } from './lib/data.js';
import { tabPaths } from './lib/swipeNav.js';
import { todayISO } from './lib/dates.js';
import { routesFor } from './lib/flags.js';
import { dirOf, localeOf, setLocale, t } from './lib/i18n.js';
import { introLine, isNewOpen, shouldPlayIntro } from './lib/intro.js';
import { needsSetup } from './lib/setup.js';
import { tourDue } from './lib/tour.js';
import { backAction, inGymMode } from './lib/gymMode.js';
import { pauseWorkout } from './lib/training.js';
import { announce } from './lib/announce.js';
import { needsScreening } from './lib/safety.js';
import Screening from './views/Screening.jsx';
import Setup from './views/Setup.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import { programDayFor } from './lib/schedule.js';
import { activePlan } from './lib/plan.js';
import { effectiveTimes } from './lib/ramadan.js';
import { sessionAt } from './lib/times.js';
import { APP } from './lib/version.js';
import { catchErrors, collectNativeCrashes } from './store/errors.js';
import { startPhoneSync } from './store/phoneSync.js';
import { content, useData } from './store/useData.js';
import Meals from './views/Meals.jsx';
import Plan from './views/Plan.jsx';
import Settings from './views/Settings.jsx';
import Today from './views/Today.jsx';
import Workout from './views/Workout.jsx';
import { reduceMotion, textScale, textSize, themeChoice } from './lib/theme.js';
import { applyTheme, followPhone } from './store/theme.js';
import { ghostOut, installMotion, morphLanded } from './store/motionFx.js';
import { pageMotion } from './lib/motion.js';
import CompactTitle from './components/CompactTitle.jsx';

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
const CheckIn = lazy(() => import('./views/CheckIn.jsx'));
const Routines = lazy(() => import('./views/Routines.jsx'));
const Snapshots = lazy(() => import('./views/Snapshots.jsx'));
const Lab = lazy(() => import('./views/Lab.jsx'));

catchErrors();
// Native crashes and a dead WebView from the last run go into the ring (P14-15).
collectNativeCrashes().catch(() => {});
const Quests = lazy(() => import('./views/Quests.jsx'));
const Shopping = lazy(() => import('./views/Shopping.jsx'));
const Stats = lazy(() => import('./views/Stats.jsx'));
const MealLibrary = lazy(() => import('./views/MealLibrary.jsx'));
const MealDetail = lazy(() => import('./views/MealDetail.jsx'));
const FitnessTest = lazy(() => import('./views/FitnessTest.jsx'));
const Session = lazy(() => import('./views/Session.jsx'));

// Detail pages slide in from the right (left in RTL); Back slides the other
// way; tabs fade (styles.css, .route).
const TABS = new Set(['/', '/plan', '/workout', '/meals', '/stats']);
// Pages opened since the app started: a tab's cards rise in only the first time.
const SEEN = new Set();

function Shell() {
  const { pathname, state } = useLocation();
  const back = useNavigationType() === 'POP';
  const timing = useTimer((t) => Boolean(t.endsAt));
  // Swipe left or right on a tab page to open the tab next to it.
  const mealsOn = useData((s) => moduleOn(s.data, 'meals'));
  const locale = useData((s) => localeOf(s.data));
  const tabSwipe = useSwipeTabs(pathname, { rtl: dirOf(locale) === 'rtl', tabs: tabPaths(mealsOn) });
  // Gym mode (UIUX-4): no tab bar and no tab swipes while a workout runs.
  const gym = useData((s) => inGymMode(s.data, s.activeWorkoutId, pathname));
  useLayoutEffect(() => { document.documentElement.classList.toggle('gym', gym); }, [gym]);
  const swipe = gym ? {} : tabSwipe;
  // MOVE-2: how this page comes in and the last one leaves (lib/motion.js).
  const motion = pageMotion({ isTab: TABS.has(pathname), swipe: state?.swipe || null, back, seen: SEEN.has(pathname) });
  const motionRef = useRef(motion);
  // Written during render on purpose: React drops the old page (and calls
  // setRoute below) before any effect of this render runs.
  // eslint-disable-next-line react-hooks/refs
  motionRef.current = motion;
  useEffect(() => { SEEN.add(pathname); }, [pathname]);
  // MOVE-1: a tapped card grows into this page once it is on screen.
  const routeRef = useRef(null);
  // The route's ref: when React drops the old page, a copy of it animates out.
  const setRoute = useCallback((el) => {
    if (el) routeRef.current = el;
    else ghostOut(routeRef.current, motionRef.current.ghost);
  }, []);
  useLayoutEffect(() => { morphLanded(routeRef.current); }, [pathname]);
  // Ticks and done rows only animate when they change, not when a page opens
  // with them already done: the page counts as settled after its entrance.
  useEffect(() => {
    const id = setTimeout(() => routeRef.current?.classList.add('settled'), 450);
    return () => clearTimeout(id);
  }, [pathname]);
  return (
    <>
      {/* New pages open at the top; Back returns to where you were (UX-03). */}
      <ScrollRestoration />
      <div key={pathname} ref={setRoute} {...swipe} className={`route ${motion.enter}${motion.rise ? ' rise' : ''}${timing ? (pathname === '/workout' ? ' with-timer' : ' with-pill') : ''}`}>
        <ErrorBoundary key={pathname}>
          {/* Rule 19: a page that is still loading says so (after a short
              delay, so a fast open never flashes the skeleton). */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
      <CompactTitle pathname={pathname} />
      <RestTimer compact={pathname !== '/workout'} />
      <Fanfare />
      <Announcer />
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
      { path: '/plan/checkin', element: <CheckIn /> },
      { path: '/workout', element: <Workout /> },
      { path: '/intervals', element: <Intervals /> },
      { path: '/follow', element: <FollowAlong /> },
      { path: '/photos', element: <Photos /> },
      { path: '/meals', element: <Meals /> },
      { path: '/meals/library', element: <MealLibrary /> },
      { path: '/meals/library/:key', element: <MealDetail /> },
      { path: '/stats', element: <Stats /> },
      { path: '/stats/fitness-test', element: <FitnessTest /> },
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
installMotion((to) => router.navigate(to));
// The pages a card opens load while the phone is idle, so the card can grow
// straight into a drawn page instead of a loading one (MOVE-1).
(globalThis.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
  for (const load of [() => import('./views/ExerciseDetail.jsx'), () => import('./views/History.jsx'), () => import('./views/MealDetail.jsx'), () => import('./views/CatalogueDetail.jsx'), () => import('./views/Stats.jsx'), () => import('./views/Library.jsx')]) load().catch(() => {});
});

/** Decides on each open whether the intro plays, and what it says. */
function introFor() {
  const { data, activeWorkoutId } = useData.getState();
  const reducedMotion = reduceMotion(data) || (typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  if (!data || !shouldPlayIntro({ hash: window.location.hash, reducedMotion, activeWorkout: Boolean(activeWorkoutId) })) return null;
  const today = todayISO();
  let next;
  try {
    next = programDayFor(today, activePlan(data, content), data.session_moves || []);
  } catch {
    next = null;
  }
  const doneToday = data.workouts.some((w) => w.log_date === today && w.finished_at && (w.workout_type || 'gym') === 'gym');
  return introLine({ next, time: sessionAt(effectiveTimes(data, content, today)), doneToday, firstRun: data.workouts.length === 0 });
}

/** Android back: close the top sheet first, then go back a screen, and
 * only leave the app from the first screen (E6-S7). */
function listenBackButton() {
  if (!Capacitor.isNativePlatform()) return;
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (closeTopOverlay()) return;
    // Gym mode: Back pauses the running workout and stays on it (UIUX-4).
    const st = useData.getState();
    const path = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
    if (backAction(st.data, st.activeWorkoutId, path) === 'pause') {
      st.update((d) => pauseWorkout(d, st.activeWorkoutId));
      announce(t('gym.paused'));
      return;
    }
    if (canGoBack && window.history.length > 1 && window.location.hash !== '#/') window.history.back();
    else CapApp.exitApp();
  });
}

/** Grey placeholder blocks in the shape of a page, shown while a screen's code loads. */
function PageLoading() {
  return (
    <div className="page page-loading" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="skel skel-title" />
      <div className="skel skel-card" />
      <div className="skel skel-card short" />
    </div>
  );
}

export default function App() {
  const ready = useData((s) => s.ready);
  const hydrate = useData((s) => s.hydrate);
  const loadError = useData((s) => s.loadError);
  const startError = useData((s) => s.startError);
  const screening = useData((s) => needsScreening(s.data));
  // ONB-3: the guided tour, once, after setup (and when Help asks again).
  const tour = useData((s) => tourDue(s.data, { workoutActive: Boolean(s.activeWorkoutId) }));
  // Light theme (THEME-1): before paint, so there is no dark flash.
  const theme = useData((s) => themeChoice(s.data));
  useLayoutEffect(() => { applyTheme(theme); return followPhone(theme); }, [theme]);
  // Text size (UIUX-2): one variable every font size reads.
  const ts = useData((s) => textScale(textSize(s.data)));
  useLayoutEffect(() => { document.documentElement.style.setProperty('--ts', String(ts)); }, [ts]);
  // Reduce motion (MOVE-2): the app's own switch, on top of the phone's.
  const calmMotion = useData((s) => reduceMotion(s.data));
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (calmMotion) root.dataset.motion = 'reduce';
    else delete root.dataset.motion;
  }, [calmMotion]);
  const [intro, setIntro] = useState(undefined); // undefined: not decided yet, null: no intro
  const [setup, setSetup] = useState(false);
  const [perms, setPerms] = useState(false);
  useEffect(() => {
    hydrate().then(() => {
      const loc = setLocale(localeOf(useData.getState().data));
      document.documentElement.lang = loc;
      document.documentElement.dir = dirOf(loc);
      if (useData.getState().loadError || useData.getState().startError) return;
      // A fresh phone gets the first-time setup instead of the intro (E5-S2).
      if (needsSetup(useData.getState().data)) { setSetup(true); setIntro(null); } else setIntro(introFor());
      // The one-time permissions step, shown once the intro is out of the way.
      setPerms(askPermissionsOnOpen({ native: Capacitor.isNativePlatform(), data: useData.getState().data }));
      // Reminders are queued once per start by startPhoneSync (watchReminders).
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
  // Every open plays the intro: also coming back to the app after a minute
  // or more away, not only a cold start.
  useEffect(() => {
    let hiddenAt = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      const away = hiddenAt == null ? NaN : Date.now() - hiddenAt;
      hiddenAt = null;
      const s = useData.getState();
      if (!s.ready || s.loadError || s.startError || needsSetup(s.data) || !isNewOpen(away)) return;
      const line = introFor();
      if (typeof line === 'string') setIntro(line);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
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
  if (setup) {
    return <><Setup onDone={() => { setSetup(false); setPerms(askPermissionsOnOpen({ native: Capacitor.isNativePlatform(), data: useData.getState().data })); }} /><SaveBar /></>;
  }
  // A phone set up before the safety check existed (or an older backup
  // just restored) answers it before anything else (SAFE-1).
  if (screening) return <><Screening /><SaveBar /></>;
  return (
    <>
      <RouterProvider router={router} />
      <SaveBar />
      {perms && intro === null ? <PermissionsSheet onDone={() => setPerms(false)} /> : null}
      {typeof intro === 'string' ? <Intro line={intro} onDone={endIntro} /> : null}
      {tour && !perms && intro === null ? <GuidedTour /> : null}
    </>
  );
}
