/**
 * Paylaşılan bağlantının (`/?hex=`) çözümü (docs/prompts/parca-1.md → M6: bağlantı aynı uçağı
 * seçer). Saf durum makinesi; yan etkiler (arama isteği, seçim, kamera) live-map.tsx'tedir.
 *
 * 1. `search`: uçak canlı önbellekte aranır (`/v1/search`). Bulunursa seçilir.
 * 2. Arama sonuçsuz kalır ya da hata verirse (ör. açılıştan hemen sonra 503, 429) `wait`: ilk tam
 *    görüntü beklenir; uçak görünümdeyse depoda vardır ve oradan seçilir.
 * 3. İlk görüntüde de yoksa arama bir kez daha yapılır; yine yoksa `missing`: arama alanında
 *    "bulunamadı" metni çıkar. Uçak sonra görünüme girerse yine seçilir.
 * Kullanıcı kendisi bir uçak seçer ya da kartı kapatırsa süreç biter (`done`).
 */

/** Paylaşılan bağlantı için yapılan en fazla arama (ilki + ilk görüntüden sonra bir kez). */
export const SHARED_LINK_SEARCHES = 2

export type SharedLinkState =
  | { phase: 'search'; hex: string; attempt: number }
  | { phase: 'wait'; hex: string; attempt: number }
  | { phase: 'missing'; hex: string }
  | { phase: 'done' }

export const SHARED_LINK_DONE: SharedLinkState = { phase: 'done' }

export function initialSharedLink(hex: string | null): SharedLinkState {
  return hex === null ? SHARED_LINK_DONE : { phase: 'search', hex, attempt: 1 }
}

/** Uçağı arayan hex; süreç bitmişse null. */
export function pendingHex(state: SharedLinkState): string | null {
  return state.phase === 'done' ? null : state.hex
}

/** Arama sonucu: bulunduysa süreç biter (uçak seçilir), bulunamadıysa ilk görüntü beklenir. */
export function afterSearch(state: SharedLinkState, found: boolean): SharedLinkState {
  if (state.phase !== 'search') return state
  if (found) return SHARED_LINK_DONE
  return { phase: 'wait', hex: state.hex, attempt: state.attempt }
}

/**
 * Depo değişti. `present`: uçak depoda (seçilir, süreç biter). `snapshotReceived`: en az bir tam
 * görüntü alındı; beklenen uçak onda da yoksa arama yinelenir ya da "bulunamadı" gösterilir.
 */
export function afterStore(
  state: SharedLinkState,
  present: boolean,
  snapshotReceived: boolean,
): SharedLinkState {
  if (state.phase === 'done') return state
  if (present) return SHARED_LINK_DONE
  if (state.phase !== 'wait' || !snapshotReceived) return state
  return state.attempt < SHARED_LINK_SEARCHES
    ? { phase: 'search', hex: state.hex, attempt: state.attempt + 1 }
    : { phase: 'missing', hex: state.hex }
}
