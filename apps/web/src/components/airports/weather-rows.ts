import { weatherText, type WeatherTextOptions } from '@havayolu/i18n'
import type { PhenomenonPresence, WeatherSummary, WeatherText } from '@havayolu/shared'

/**
 * Hava durumu satırları (M6d ek istekleri, 2026-10-02): harita penceresi ve havalimanı sayfası aynı
 * satırları aynı sözcüklerle ve aynı vurguyla yazar. Saf modül; çizim `weather-row-list.tsx`'tedir.
 *
 * Vurgu (D-081, D-083 ile genişledi):
 * - havalimanında var olan olay (`PhenomenonPresence` → `present`): yağmur mavi, kar açık mavi, sis
 *   ve pus gri, dolu ve diğer olaylar (toz, kum, hortum, volkanik kül…) kehribar;
 * - etkili rüzgâr (`windLevel`; MGM meydan uyarısı eşiği): rüzgâr satırı kehribar, yanında şiddetin
 *   adı ("Kuvvetli rüzgâr", "Fırtına" …);
 * - şimşek ve yıldırım riski (`lightning`: havalimanında ya da çevresinde oraj, kümülonimbüs):
 *   gök gürültüsü satırı kehribar, metni uyarıyı yazar.
 * "Yok", çevredeki ve kısa süre önceki diğer olaylar ile "Belirlenemedi" sade kalır.
 */
export type WeatherTone = 'wind' | 'rain' | 'snow' | 'thunder' | 'fog' | 'hail' | 'other'

export interface WeatherRow {
  /** Satır adı (`data-row`): wind, rain, snow, thunder, fog, hail, other, visibility, clouds… */
  key: string
  label: string
  value: string
  /** Var olan olayın vurgusu; olay yoksa ya da belirlenemediyse null. */
  tone: WeatherTone | null
  /** Değerin yanında vurgulanan etiket (rüzgârın şiddeti: "Kuvvetli rüzgâr", "Fırtına"); yoksa null. */
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
 * Rüzgâr (hamle; etkiliyse vurgu ve şiddet etiketi), yağmur, kar, gök gürültüsü (şimşek ve yıldırım
 * uyarısı), sis ve pus her zaman; dolu ve diğer olaylar yalnız varsa; görüş. Metinler
 * `summarizeMetar` → `weatherText`'ten gelir.
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
      ...row('wind', t.rows.wind, r.wind, summary.windLevel ? 'wind' : null),
      strong: summary.windLevel ? t.wind.level[summary.windLevel] : null,
    },
    row('rain', t.rows.rain, r.rain, toneIf('rain', p.rain)),
    row('snow', t.rows.snow, r.snow, toneIf('snow', p.snow)),
    row('thunder', t.rows.thunder, r.thunderstorm, summary.lightning ? 'thunder' : null),
    row('fog', t.rows.fog, r.fog, toneIf('fog', p.fog)),
    ...(r.hail ? [row('hail', t.rows.hail, r.hail, toneIf('hail', p.hail))] : []),
    ...(r.other ? [row('other', t.rows.other, r.other, toneIf('other', p.other))] : []),
    row('visibility', t.rows.visibility, r.visibility),
  ]
}
