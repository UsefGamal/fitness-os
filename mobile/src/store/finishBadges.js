// Badges earned by the workout that was just finished (design laws plan #5).
// Fanfare hands them here instead of popping its card over the finish card,
// and the finish card shows them as one row: one peak, nothing to dismiss.
// In memory only: nothing about it is saved.
import { create } from 'zustand';

export const useFinishBadges = create((set) => ({
  list: [],
  add: (badges) => set((s) => ({ list: [...s.list, ...badges.filter((b) => !s.list.some((x) => x.id === b.id))] })),
  clear: () => set({ list: [] }),
}));
