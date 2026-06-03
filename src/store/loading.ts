import { create } from 'zustand'

export type LoadingPhase = 'hidden' | 'appear' | 'glow' | 'zoom' | 'out' | 'done'

interface LoadingStore {
  playing: boolean
  phase: LoadingPhase
  play: (onComplete?: () => void) => void
  stop: () => void
}

let activeTimers: NodeJS.Timeout[] = []

export const useLoadingStore = create<LoadingStore>((set) => ({
  playing: false,
  phase: 'done',
  play: (onComplete) => {
    // Clear any active timers to prevent conflicts
    activeTimers.forEach(clearTimeout)
    activeTimers = []

    set({ playing: true, phase: 'hidden' })

    const t1 = setTimeout(() => set({ phase: 'appear' }), 120)
    const t2 = setTimeout(() => set({ phase: 'glow' }), 600)
    const t3 = setTimeout(() => set({ phase: 'zoom' }), 1500)
    const t4 = setTimeout(() => set({ phase: 'out' }), 2400)
    const t5 = setTimeout(() => {
      set({ phase: 'done', playing: false })
      onComplete?.()
    }, 2900)

    activeTimers = [t1, t2, t3, t4, t5]
  },
  stop: () => {
    activeTimers.forEach(clearTimeout)
    activeTimers = []
    set({ playing: false, phase: 'done' })
  },
}))
