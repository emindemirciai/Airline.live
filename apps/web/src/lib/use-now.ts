'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { monotonicNow } from './live/clock'
import type { WallClock } from './wall-clock'

/**
 * Saniyelik saat ("son görülme", canlı veri yaşı). Tek bir zamanlayıcı bütün abonelere yeter; abone
 * kalmayınca durur. Sunucu çiziminde 0 döner (saate bağlı metinler yalnızca istemcide çıkar).
 * Depodaki zamanlarla aynı, geri gitmeyen saati kullanır (live/clock.ts): yalnızca istemci içindeki
 * süreler içindir, sunucu zamanlarıyla karşılaştırılmaz (onlar için `useWallNow`).
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

const nullSnapshot = () => null

/**
 * Sunucu saatine bağlı duvar saati (`WallClock`), `stepMs` katlarına yuvarlanmış: bileşen yalnızca
 * adım değişince yeniden çizilir. Saniyede bir ve sekme yeniden görünür olunca (`visibilitychange`,
 * geri-ileri önbelleğinden dönüş `pageshow`) yeniden okunur: cihaz uykudan dönünce saat hemen
 * doğrudur. Görünür olunca cihaz kipindeki saatin çapası da yeniden kurulur (`resync`; sunucu
 * kipinde etkisizdir). Sunucu çiziminde ve hidrasyonda null döner (çağıran sunucunun çizim anını
 * kullanır).
 */
export function useWallNow(clock: WallClock, stepMs: number): number | null {
  const step = Math.max(1_000, Math.floor(stepMs))
  const store = useMemo(() => wallNowStore(clock, step), [clock, step])
  return useSyncExternalStore(store.subscribe, store.get, nullSnapshot)
}

function wallNowStore(clock: WallClock, step: number) {
  const read = () => Math.floor(clock.now() / step) * step
  let value: number | null = null
  const listeners = new Set<() => void>()
  let stop: (() => void) | null = null
  const update = () => {
    const next = read()
    if (next === value) return
    value = next
    for (const notify of [...listeners]) notify()
  }
  // Sekme yeniden görünür olunca cihaz kipindeki saat çapasını yeniden kurar (wall-clock.ts).
  const resume = () => {
    clock.resync()
    update()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') resume()
  }
  return {
    get: () => (value ??= read()),
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      if (stop === null) {
        const interval = setInterval(update, TICK_MS)
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('pageshow', resume)
        stop = () => {
          clearInterval(interval)
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('pageshow', resume)
        }
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && stop !== null) {
          stop()
          stop = null
        }
      }
    },
  }
}
