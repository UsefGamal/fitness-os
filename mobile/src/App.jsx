import { useEffect } from 'react';
import { Outlet, createHashRouter, RouterProvider } from 'react-router';

import RestTimer from './components/RestTimer.jsx';
import TabBar from './components/TabBar.jsx';
import { scheduleReminders } from './store/notify.js';
import { content, useData } from './store/useData.js';
import History from './views/History.jsx';
import Meals from './views/Meals.jsx';
import Plan from './views/Plan.jsx';
import Settings from './views/Settings.jsx';
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
      { path: '/meals', element: <Meals /> },
      { path: '/stats', element: <Stats /> },
      { path: '/history/:id', element: <History /> },
      { path: '/settings', element: <Settings /> },
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
    });
  }, [hydrate]);
  if (!ready) return null;
  return <RouterProvider router={router} />;
}
