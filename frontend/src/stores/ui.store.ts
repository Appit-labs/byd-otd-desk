import { create } from 'zustand';

interface UIState {
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
}));
