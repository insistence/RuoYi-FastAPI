import { create } from 'zustand'
const useAppStore = create((set) => ({
  sidebarOpened: true,
  setSidebarOpened: (sidebarOpened) => set({ sidebarOpened }),
  toggleSidebar: () => set((state) => ({ sidebarOpened: !state.sidebarOpened })),
}))
export default useAppStore
