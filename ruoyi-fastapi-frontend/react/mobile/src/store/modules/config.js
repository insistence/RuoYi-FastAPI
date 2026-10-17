import { create } from 'zustand'
import config from '@/config'
export const useConfigStore = create((set) => ({
  config,
  setConfig: (value) => set({ config: value }),
}))
