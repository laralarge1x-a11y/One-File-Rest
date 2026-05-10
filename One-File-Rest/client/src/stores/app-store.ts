import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activeModal: string | null;
  setActiveModal: (v: string | null) => void;
  casesView: 'list' | 'kanban' | 'timeline';
  setCasesView: (v: 'list' | 'kanban' | 'timeline') => void;
  casesFilter: string;
  setCasesFilter: (v: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  activeModal: null,
  setActiveModal: (v) => set({ activeModal: v }),
  casesView: 'list',
  setCasesView: (v) => set({ casesView: v }),
  casesFilter: 'all',
  setCasesFilter: (v) => set({ casesFilter: v }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}));