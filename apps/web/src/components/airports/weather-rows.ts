import { weatherText, type WeatherTextOptions } from '@havayolu/i18n'
import {
  WIND_TIERS,
  type PhenomenonPresence,
  type WeatherSummary,
  type WeatherText,
  type WindTier,
} from '@havayolu/shared'

/**
 * Hava durumu satırları (M6d ek istekleri, 2026-10-02): harita penceresi ve havalimanı sayfası aynı
 * satırları aynı sözcüklerle ve aynı vurguyla yazar. Saf modül; çizim `weather-row-list.tsx`'tedir.
 *
 * Vurgu (D-081, D-083 ile genişledi):
 * - havalimanında var olan olay (`PhenomenonPresence` → `present`): yağmur mavi, kar açık mavi, sis
 *   ve pus gri, dolu ve diğer olaylar (toz, kum, hortum, volkanik kül…) kehribar;
 * - rüzgâr (`windTier`; derecelendirilmiş, kullanıcı isteği 2026-10-04): rüzgâr varsa satır her zaman
 *   renklidir ve basamağın adı yazılır. Gösterilen hız ≤ 10 km/sa (sakin dahil) açık yeşil, değer
 *   "Sakin" ya da "Hafif ve değişken yönlü" demiyorsa "Hafif rüzgâr" etiketi; 11–19 km/sa limon yeşili
 *   "Hafif-orta rüzgâr"; 20 km/sa ve üstü sarı "Orta rüzgâr"; ortalama 17–19 kt ya da hamle 25–29
 *   kt kehribar ("Sert rüzgâr", "Hamleli rüzgâr"); MGM meydan uyarısı eşiğinden 34 kt'ye turuncu
 *   ("Kuvvetli hamle", "Kuvvetli rüzgâr", "Çok kuvvetli rüzgâr"); 34 kt ve üstü kırmızı ("Fırtına"
 *   … "Kasırga şiddetinde rüzgâr"; adlar D-116). Rüzgâr kesmesi bildirildiyse (`WS R34`) satır en
 *   az kehribardır, değerin altında "Rüzgâr kesmesi bildirildi: pist 34";
 * - şimşek ve yıldırım riski (`lightning`: havalimanında ya da çevresinde oraj, kümülonimbüs):
 *   gök gürültüsü satırı kehribar, metni uyarıyı yazar.
 * "Yok", çevredeki ve kısa süre önceki diğer olaylar ile "Belirlenemedi" sade kalır (bilinmeyen
 * rüzgâr ve NIL dahil).
 */
export type WeatherTone = WindTier | 'rain' | 'snow' | 'thunder' | 'fog' | 'hail' | 'other'

export interface WeatherRow {
  /** Satır adı (`data-row`): wind, rain, snow, thunder, fog, hail, other, visibility, clouds… */
  key: string
  label: string
  value: string
  /** Var olan olayın ya da rüzgâr basamağının vurgusu; olay yoksa ya da belirlenemediyse null. */
  tone: WeatherTone | null
  /**
   * Değerin yanında vurgulanan etiket: rüzgâr basamağının adı ("Hafif rüzgâr", "Hafif-orta rüzgâr",
   * "Orta rüzgâr") ya da şiddetin adı ("Sert rüzgâr", "Kuvvetli rüzgâr", "Fırtına"); yoksa null.
   */
  strong: string | null
  /** Değerin altındaki ek satır (rüzgâr kesmesi: "Rüzgâr kesmesi bildirildi: pist 34"); yoksa null. */
  note?: string | null
}

function toneIf(tone: WeatherTone, presence: PhenomenonPresence): WeatherTone | null {
  return presence === 'present' ? tone : null
}

/** Vurgusuz, etiketsiz satır (bulut, sıcaklık, nem, basınç, eğilim). */
export function plainRow(key: string, label: string, value: string): WeatherRow {
  return { key, label, value, tone: null, strong: null }
}

/** Rüzgâr kesmesinin satıra verdiği en düşük basamak: kehribar (D-083, değişmedi). */
const SHEAR_TIER: WindTier = 'fresh'

/** Basamak en az `floor`; bilinmeyen rüzgârda `floor`. */
function atLeast(tier: WindTier | null, floor: WindTier): WindTier {
  return tier !== null && WIND_TIERS.indexOf(tier) >= WIND_TIERS.indexOf(floor) ? tier : floor
}

/**
 * Basamağın adı: şiddet düzeyi varsa onun adı (kehribar, turuncu, kırmızı); yoksa "Orta rüzgâr",
 * "Hafif-orta rüzgâr" ya da (değer hızı yazıyorsa) "Hafif rüzgâr". "Sakin" ve "Hafif ve değişken
 * yönlü" değerleri basamağı zaten söyler.
 */
function windTag(summary: WeatherSummary, t: WeatherTextOptions['t']): string | null {
  if (summary.windLevel) return t.wind.level[summary.windLevel]
  switch (summary.windTier) {
    case 'moderate':
      return t.wind.moderate
    case 'breeze':
      return t.wind.breeze
    case 'calm':
      return summary.windLight === 'light' ? t.wind.light : null
    default:
      return null
  }
}

/**
 * Rüzgâr satırının vurgusu, etiketi ve ek satırı (D-083): renk basamağı `windTier`'dan, etiket
 * basamağın adıdır. Rüzgâr kesmesi satırı en az kehribar yapar; kesme rüzgârın kendi basamağını
 * yükselttiyse (hafif, hafif-orta, orta rüzgâr) basamağın adı yazılmaz: renk kesmedendir ve kesme
 * satırı bunu söyler (kehribar satırda "Hafif-orta rüzgâr" yazmak rengi rüzgâra bağlardı).
 */
function windRow(summary: WeatherSummary, options: WeatherTextOptions): WeatherRow {
  const { t } = options
  const shear = summary.windShear ? weatherText(summary.windShear, options) : null
  const own = summary.windTier
  const tone = shear ? atLeast(own, SHEAR_TIER) : own
  return {
    key: 'wind',
    label: t.rows.wind,
    value: weatherText(summary.rows.wind, options),
    tone,
    strong: tone === own ? windTag(summary, t) : null,
    note: shear,
  }
}

/**
 * Rüzgâr (derecelendirilmiş renk ve basamağın adı, hamle, rüzgâr kesmesi), yağmur, kar, gök
 * gürültüsü (şimşek ve yıldırım uyarısı), sis ve pus her zaman; dolu ve diğer olaylar yalnız varsa;
 * görüş. Metinler `summarizeMetar` → `weatherText`'ten gelir.
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
    windRow(summary, options),
    row('rain', t.rows.rain, r.rain, toneIf('rain', p.rain)),
    row('snow', t.rows.snow, r.snow, toneIf('snow', p.snow)),
    row('thunder', t.rows.thunder, r.thunderstorm, summary.lightning ? 'thunder' : null),
    row('fog', t.rows.fog, r.fog, toneIf('fog', p.fog)),
    ...(r.hail ? [row('hail', t.rows.hail, r.hail, toneIf('hail', p.hail))] : []),
    ...(r.other ? [row('other', t.rows.other, r.other, toneIf('other', p.other))] : []),
    row('visibility', t.rows.visibility, r.visibility),
  ]
}
