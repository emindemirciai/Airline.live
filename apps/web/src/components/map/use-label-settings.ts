'use client'

import { useSyncExternalStore } from 'react'
import {
  copyLabelSettings,
  DEFAULT_LABEL_SETTINGS,
  LABEL_SETTINGS_KEY,
  loadLabelSettings,
  saveLabelSettings,
  type LabelSettings,
} from '../../lib/map/label-settings'

/**
 * Etiket ayarı (uçaklar Gizle / Kısa / Tam, havalimanları Gizle / Simge / Simge ve kod, ülke adları
 * Gizle / Göster) cihazda saklanır. Sunucu çizimi ve hidrasyon varsayılanla (uçaklar Tam,
 * havalimanları Simge ve kod, ülke adları Göster) yapılır, ardından kayıtlı ayar okunur; başka
 * sekmedeki değişiklik `storage` olayıyla gelir. Depolama kapalıysa ayar yalnızca sayfa açıkken
 * geçerlidir.
 */
let current: LabelSettings | null = null
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
  if (event.key !== null && event.key !== LABEL_SETTINGS_KEY) return
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

function getSnapshot(): LabelSettings {
  current ??= loadLabelSettings(storage())
  return current
}

const getServerSnapshot = (): LabelSettings => DEFAULT_LABEL_SETTINGS

function setLabelSettings(next: LabelSettings): void {
  current = copyLabelSettings(next)
  saveLabelSettings(storage(), current)
  notify()
}

export function useLabelSettings(): [LabelSettings, (next: LabelSettings) => void] {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [settings, setLabelSettings]
}
