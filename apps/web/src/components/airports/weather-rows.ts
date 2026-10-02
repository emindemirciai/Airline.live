import { weatherText, type WeatherTextOptions } from '@havayolu/i18n'
import type { PhenomenonPresence, WeatherSummary, WeatherText } from '@havayolu/shared'

/**
 * Hava durumu satırları (M6d ek istekleri, 2026-10-02): harita penceresi ve havalimanı sayfası aynı
 * satırları aynı sözcüklerle ve aynı vurguyla yazar. Saf modül; çizim `weather-row-list.tsx`'tedir.
 *
 * Vurgu yalnız havalimanında var olan olaydadır (`PhenomenonPresence` → `present`): yağmur mavi,
 * kar açık mavi, gök gürültüsü ve dolu kehribar, sis ve pus gri, diğer olaylar (toz, kum, hortum,
 * volkanik kül…) kehribar. "Yok", çevredeki ve kısa süre önceki olay ile "Belirlenemedi" sade kalır.
 */
export type WeatherTone = 'rain' | 'snow' | 'thunder' | 'fog' | 'hail' | 'other'

export interface WeatherRow {
  /** Satır adı (`data-row`): wind, rain, snow, thunder, fog, hail, other, visibility, clouds… */
  key: string
  label: string
  value: string
  /** Var olan olayın vurgusu; olay yoksa ya da belirlenemediyse null. */
  tone: WeatherTone | null
  /** Değerin yanında vurgulanan etiket ("Kuvvetli rüzgâr"); yoksa null. */
  strong: string | null
}

function toneIf(tone: WeatherTone, presence: PhenomenonPresence): WeatherTone | null {
  return presence === 'present' ? tone : null
}

/** Vurgusuz, etiketsiz satır (bulut, sıcaklık, nem, basınç, eğilim). */
export function plainRow(key: string, label: string, value: string): WeatherRow {
  return { key, label, value, tone: null, strong: null }
}

/**
 * Rüzgâr (hamle, kuvvetli rüzgâr etiketi), yağmur, kar, gök gürültüsü, sis ve pus her zaman; dolu ve
 * diğer olaylar yalnız varsa; görüş. Metinler `summarizeMetar` → `weatherText`'ten gelir.
 */
export function phenomenonRows(summary: WeatherSummary, options: WeatherTextOptions): WeatherRow[] {
  const { t } = options
  const { rows: r, presence: p } = summary
  const text = (value: WeatherText) => weatherText(value, options)
  const row = (
    key: string,
    label: string,
    value: WeatherText,
    tone: WeatherTone | null = null,
  ): WeatherRow => ({ key, label, value: text(value), tone, strong: null })
  return [
    {
      ...row('wind', t.rows.wind, r.wind),
      strong: summary.strongWind ? t.wind.strong : null,
    },
    row('rain', t.rows.rain, r.rain, toneIf('rain', p.rain)),
    row('snow', t.rows.snow, r.snow, toneIf('snow', p.snow)),
    row('thunder', t.rows.thunder, r.thunderstorm, toneIf('thunder', p.thunderstorm)),
    row('fog', t.rows.fog, r.fog, toneIf('fog', p.fog)),
    ...(r.hail ? [row('hail', t.rows.hail, r.hail, toneIf('hail', p.hail))] : []),
    ...(r.other ? [row('other', t.rows.other, r.other, toneIf('other', p.other))] : []),
    row('visibility', t.rows.visibility, r.visibility),
  ]
}
