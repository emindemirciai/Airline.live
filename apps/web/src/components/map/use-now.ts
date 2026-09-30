'use client'

import { useSyncExternalStore } from 'react'
import { monotonicNow } from '../../lib/live/clock'

/**
 * Saniyelik saat ("son görülme", veri yaşı). Tek bir zamanlayıcı bütün abonelere yeter; abone
 * kalmayınca durur. Sunucu çiziminde 0 döner (saate bağlı metinler yalnızca istemcide çıkar).
 * Depodaki zamanlarla aynı, geri gitmeyen saati kullanır (clock.ts).
 */
const TICK_MS = 1_000

let now = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timer === null) {
    now = monotonicNow()
    timer = setInterval(() => {
      now = monotonicNow()
      for (const notify of [...listeners]) notify()
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => now
const getServerSnapshot = () => 0

/** Saniyede bir ilerleyen saat, istemcinin geri gitmeyen saati (ms). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
