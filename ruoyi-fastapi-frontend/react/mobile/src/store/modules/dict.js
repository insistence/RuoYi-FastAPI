import { create } from "zustand";
export default create((set, get) => ({
  dict: {},
  getDict: (key) => get().dict[key],
  setDict: (key, values) => set({ dict: { ...get().dict, [key]: values } }),
  clearDict: () => set({ dict: {} }),
}));
