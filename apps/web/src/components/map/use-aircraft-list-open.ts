'use client'

import { useSyncExternalStore } from 'react'
import {
  AIRCRAFT_LIST_KEY,
  loadAircraftListOpen,
  saveAircraftListOpen,
} from '../../lib/map/list-settings'

/**
 * Uçak listesinin geniş ekrandaki açık ya da daraltılmış hâli (D-085) cihazda saklanır
 * (`hy:map:list`). Sunucu çizimi ve hidrasyon varsayılanla (açık) yapılır, ardından kayıtlı hâl
 * okunur; başka sekmedeki değişiklik `storage` olayıyla gelir. Depolama kapalıysa hâl yalnızca sayfa
 * açıkken geçerlidir. Telefondaki aç/kapa bu kayda bağlı değildir (aircraft-table.tsx).
 */
let current: boolean | null = null
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function notify(): void {
  for (const listener of [...listeners]) listener()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== AIRCRAFT_LIST_KEY) return
  current = null
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): boolean {
  current ??= loadAircraftListOpen(storage())
  return current
}

const getServerSnapshot = (): boolean => true

function setAircraftListOpen(open: boolean): void {
  current = open
  saveAircraftListOpen(storage(), open)
  notify()
}

export function useAircraftListOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [open, setAircraftListOpen]
}
