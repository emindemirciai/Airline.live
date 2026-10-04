/**
 * "Haritada görünen uçaklar" listesinin geniş ekrandaki (768 px ve üstü) açık ya da daraltılmış hâli
 * (D-085): cihazda (localStorage) saklanır, varsayılan açıktır. Telefonda liste her açılışta kapalı
 * başlar ve hâli saklanmaz (live-map.tsx). Depolama kapalı ya da bozuk olabilir (gizli pencere,
 * silinmiş site verisi): her erişim korunur, okunamayan ya da geçersiz değer açık sayılır.
 */

export const AIRCRAFT_LIST_KEY = 'hy:map:list'

/** Saklanan değerler. */
export type AircraftListState = 'open' | 'closed'

/** Kayıt yoksa, okunamıyorsa ya da geçersizse liste açıktır. */
export function loadAircraftListOpen(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return true
  try {
    return storage.getItem(AIRCRAFT_LIST_KEY) !== ('closed' satisfies AircraftListState)
  } catch {
    return true
  }
}

/** Yazılamazsa (kota, kapalı depolama) sessizce geçer; hâl bu sayfa açıkken geçerli kalır. */
export function saveAircraftListOpen(
  storage: Pick<Storage, 'setItem'> | null,
  open: boolean,
): void {
  if (!storage) return
  const value: AircraftListState = open ? 'open' : 'closed'
  try {
    storage.setItem(AIRCRAFT_LIST_KEY, value)
  } catch {
    // Depolama kullanılamıyor: hâl yalnızca bu sayfa açıkken geçerlidir.
  }
}
