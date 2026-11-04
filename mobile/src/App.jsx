import { useEffect } from 'react';
import { Outlet, createHashRouter, RouterProvider } from 'react-router';

import RestTimer from './components/RestTimer.jsx';
import TabBar from './components/TabBar.jsx';
import { scheduleReminders } from './store/notify.js';
import { startPhoneSync } from './store/phoneSync.js';
import { content, useData } from './store/useData.js';
import CatalogueDetail from './views/CatalogueDetail.jsx';
import ExerciseDetail from './views/ExerciseDetail.jsx';
import History from './views/History.jsx';
import HistoryList from './views/HistoryList.jsx';
import Intervals from './views/Intervals.jsx';
import Library from './views/Library.jsx';
import Meals from './views/Meals.jsx';
import Plan from './views/Plan.jsx';
import Profile from './views/Profile.jsx';
import Quests from './views/Quests.jsx';
import Session from './views/Session.jsx';
import Settings from './views/Settings.jsx';
import Shopping from './views/Shopping.jsx';
import Stats from './views/Stats.jsx';
import Today from './views/Today.jsx';
import Workout from './views/Workout.jsx';

function Shell() {
  return (
    <>
      <Outlet />
      <RestTimer />
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
