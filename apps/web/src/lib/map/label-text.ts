/**
 * Harita etiketinin metni (domain.md → Harita etiketleri, D-072). v1'de (D-075 §4):
 * - 1. satır sefer no ("TK-974"); bilinmiyorsa çağrı kodu, o da yoksa tescil, o da yoksa hex;
 *   sefer no dışındakiler gri
 * - Tam etikette bir satır daha: hız ve yükseklik ("431 km/sa, 333 m", yerdeyse "28 km/sa, yerde").
 *   Ayraç virgüldür: sayıdan önce "·" eksi gibi okunur (kullanıcı kararı 2026-10-02, D-081)
 *
 * Güzergâh ve pist satırları verileri gelince eklenir (güzergâh Parça 2 M2, pist hizası Parça 2
 * motoru); her uçakta "Güzergâh ?" yazmak yalnızca gürültü olurdu.
 */
import { formatAltitude, formatFlightNumber, formatSpeed, type UnitSystem } from '@havayolu/i18n'
import type { Locale, PublicAircraft } from '@havayolu/shared'

export type LabelMode = 'hidden' | 'short' | 'full'

export interface LabelContent {
  primary: string
  /** Sefer no bilinmiyor: birincil satır gri yazılır. */
  primaryMuted: boolean
  /** Birincil satırın altındaki satırlar (Kısa etikette boş). */
  lines: string[]
}

export type AircraftTitleKind = 'flight' | 'callsign' | 'registration' | 'hex'

export interface AircraftTitle {
  text: string
  /** Başlığın kaynağı; `flight` dışındakiler gri yazılır. */
  kind: AircraftTitleKind
}

/**
 * Uçağın adı: etiket, bilgi kartı başlığı, tablo ve arama sonucu aynı sırayı kullanır. Sefer no
 * ("TK-974"), yoksa çağrı kodu, yoksa tescil (tasarım tuvali: "TC-JVI"), o da yoksa büyük harfli
 * hex. PIA/LADD uçakta tescil API'den gelmez; hex'e düşülür.
 */
export function aircraftTitle(
  ac: Pick<PublicAircraft, 'fn' | 'cs' | 'reg' | 'hex'>,
): AircraftTitle {
  if (ac.fn) return { text: formatFlightNumber(ac.fn.airline, ac.fn.number), kind: 'flight' }
  const callsign = ac.cs?.trim()
  if (callsign) return { text: callsign, kind: 'callsign' }
  const registration = ac.reg?.trim()
  if (registration) return { text: registration, kind: 'registration' }
  return { text: ac.hex.toUpperCase(), kind: 'hex' }
}

export function labelContent(
  ac: PublicAircraft,
  mode: 'short' | 'full',
  opts: { locale: Locale; units: UnitSystem },
): LabelContent {
  const title = aircraftTitle(ac)
  const lines: string[] = []
  // İkisi de bilinmiyorsa "—, —" yazılmaz.
  if (mode === 'full' && (ac.gs !== null || ac.alt !== null || ac.gnd)) {
    const speed = formatSpeed(ac.gs, opts)
    const altitude = formatAltitude(ac.alt, { ...opts, onGround: ac.gnd })
    lines.push(`${speed}, ${altitude}`)
  }
  return { primary: title.text, primaryMuted: title.kind !== 'flight', lines }
}
