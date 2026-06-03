import { create } from 'zustand'

interface LoadingStore {
  playing: boolean
  play: () => void
  stop: () => void
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  playing: false,
  play: () => set({ playing: true }),
  stop: () => set({ playing: false }),
}))
