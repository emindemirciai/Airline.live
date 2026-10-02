import { format, NO_VALUE } from '@havayolu/i18n'
import type { PublicAircraft } from '@havayolu/shared'
import { aircraftTitle } from '../../../lib/map/label-text'

/**
 * Panellerin ortak metin biçimleri (saf fonksiyonlar). Birimli değerler `@havayolu/i18n`
 * biçimleyicilerindedir, uçağın adı (`aircraftTitle`) etiketlerle ortaktır (label-text.ts);
 * burada yalnızca panellere özgü olanlar vardır.
 */

/**
 * Arama sonucu satırı: "ad, tip, tescil" (bilinmeyenler atlanır; ad tescilse bir kez yazılır). Ayraç
 * virgüldür: tescil rakamla başlayabilir (9H-, 4X-, 5B-) ve önündeki "·" eksi gibi okunur
 * (kullanıcı kararı 2026-10-02, D-081).
 */
export function searchResultText(
  ac: Pick<PublicAircraft, 'fn' | 'cs' | 'hex' | 'type' | 'reg'>,
): string {
  const title = aircraftTitle(ac)
  const parts = [title.text, ac.type, title.kind === 'registration' ? null : ac.reg].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  )
  return parts.join(', ')
}

/** Konum kaynağı: bilinen iki değer okunur hâle getirilir, diğerleri olduğu gibi gösterilir. */
export function positionSourceLabel(psrc: string): string {
  if (psrc === 'mlat') return 'MLAT'
  if (psrc === 'adsb_icao') return 'ADS-B'
  return psrc
}

/**
 * Geçen süre: 60 sn'nin altında saniye, üstünde dakika; ikisi de aşağı yuvarlanır. Saat farkıyla
 * gelecekte kalan zaman 0 sn sayılır.
 */
export function elapsedText(
  since: number,
  now: number,
  messages: { secondsAgo: string; minutesAgo: string },
): string {
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  if (seconds < 60) return format(messages.secondsAgo, { s: seconds })
  return format(messages.minutesAgo, { m: Math.floor(seconds / 60) })
}

/** İz yönü, tam derece (0–359°). */
export function formatTrack(trk: number | null): string {
  if (trk === null || !Number.isFinite(trk)) return NO_VALUE
  const degrees = ((Math.round(trk) % 360) + 360) % 360
  return `${degrees}°`
}

/**
 * Konum "enlem, boylam", 3 ondalık (~100 m). Koordinat yazımı dilden bağımsızdır (nokta ondalık,
 * ASCII eksi); kopyalanıp başka bir haritaya yapıştırılabilir.
 */
export function formatPosition(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
}

/** Boş ya da bilinmeyen metin alanının gösterimi. */
export function textOrDash(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value : NO_VALUE
}
