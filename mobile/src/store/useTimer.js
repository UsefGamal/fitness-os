import { create } from 'zustand';

import { cancelRestDone, scheduleRestDone } from './notify.js';

export const useTimer = create((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  start(seconds, label) {
    if (!seconds) return;
    set({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
    scheduleRestDone(seconds, label);
  },
  add(seconds) {
    const { endsAt } = get();
    if (!endsAt) return;
    const next = Math.max(Date.now(), endsAt) + seconds * 1000;
    set({ endsAt: next });
    scheduleRestDone(Math.round((next - Date.now()) / 1000), get().label);
  },
  stop() {
    set({ endsAt: null });
    cancelRestDone();
  },
}));
