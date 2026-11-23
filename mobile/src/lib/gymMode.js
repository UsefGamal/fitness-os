// Gym mode (UIUX-4): one hand, no accidental exits. While a workout is
// running on the workout screen the tab bar hides, Log set stays in thumb
// reach at the bottom, and Android Back pauses the workout instead of
// leaving it. A switch in Settings > Training, on unless someone turned it
// off (design laws #8, 1.1.39). Pure; gymMode.test.js.
import { setTraining, trainingSettings } from './training.js';

export function gymModeOn(data) {
  return trainingSettings(data).gym_mode !== false;
}

export function setGymMode(data, on) {
  return setTraining(data, { gym_mode: on === true });
}

/** The running workout, if any: started, not finished. */
export function runningWorkout(data, activeId) {
  return (data?.workouts || []).find((w) => w.id === activeId && !w.finished_at) || null;
}

/** Is the app in gym mode right now? On, on the workout screen, with a
 * workout running and not paused. */
export function inGymMode(data, activeId, pathname) {
  if (!gymModeOn(data) || pathname !== '/workout') return false;
  const w = runningWorkout(data, activeId);
  return Boolean(w && !w.paused_at);
}

/** What Android Back does: 'pause' in gym mode (it never leaves a running
 * workout), else 'default' (close a sheet, go back, leave from Home). */
export function backAction(data, activeId, pathname) {
  return inGymMode(data, activeId, pathname) ? 'pause' : 'default';
}
