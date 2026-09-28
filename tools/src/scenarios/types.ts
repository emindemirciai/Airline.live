/**
 * readsb `aircraft.json` biçimi (yerel alıcının sunduğu zarf; data-sources.md §2). Senaryolar bu
 * biçimde kare üretir; replay alıcısı onu olduğu gibi sunar ve `localReceiver` ayrıştırıcısı okur.
 * Yalnızca senaryoların doldurduğu alanlar tiplidir; gerçek readsb daha fazlasını gönderebilir.
 */
export interface ReadsbAircraft {
  hex: string
  /** Çağrı kodu; readsb 8 karaktere boşlukla tamamlar. */
  flight?: string
  /** Tescil. */
  r?: string
  /** ICAO tip kodu. */
  t?: string
  category?: string
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  baro_rate?: number
  lat: number
  lon: number
  /** Konumun yaşı, saniye. */
  seen_pos: number
  /** Son mesajın yaşı, saniye. */
  seen: number
  squawk?: string
  dbFlags: number
  type: string
}

export interface ReadsbFrame {
  /** Ölçüm anı, epoch **saniye** (ondalıklı). */
  now: number
  /** Alıcının açılıştan beri çözdüğü mesaj sayısı. */
  messages: number
  aircraft: ReadsbAircraft[]
}

/** Zamanın saf fonksiyonu olan sentetik trafik: aynı an her zaman aynı kareyi verir. */
export interface Scenario {
  name: string
  frameAt(epochMs: number): ReadsbFrame
}
