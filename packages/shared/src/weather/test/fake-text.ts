import {
  renderWeatherText,
  WEATHER_PHRASE_KEYS,
  type Measure,
  type WeatherPhraseKey,
  type WeatherText,
} from '../phrase'

/**
 * Test sözlüğü: her anahtar kendi adını ve değişkenlerini yazar ("weather.wind.gust({speed})").
 * Kayıtta olmayan anahtar hata fırlatır; böylece özetleyicinin yalnız kayıtlı anahtarları ve
 * kayıttaki değişkenleri kullandığı her testte denetlenir (eksik değişken de hata fırlatır).
 */
export function keyTemplate(key: WeatherPhraseKey): string {
  const params = WEATHER_PHRASE_KEYS[key]
  if (params === undefined) throw new Error(`Kayıtsız metin anahtarı: ${key}`)
  return params.length === 0 ? key : `${key}(${params.map((p) => `{${p}}`).join(',')})`
}

export function fakeMeasure(m: Measure): string {
  switch (m.measure) {
    case 'speed':
      return `${m.kt}kt`
    case 'visibility':
      return `${m.meters}m`
    case 'height':
      return `${m.ft}ft`
    case 'temperature':
      return `${m.celsius}C`
    case 'pressure':
      return `${m.hpa}hPa`
    case 'time':
      return `t${m.iso.slice(11, 16)}`
    case 'date':
      return `d${m.iso.slice(0, 10)}`
  }
}

/** Anahtar biçiminde, büyük harfe çevirmeden metin. */
export function fake(value: WeatherText | null): string | null {
  if (value === null) return null
  return renderWeatherText(
    value,
    { locale: 'en', text: keyTemplate, measure: fakeMeasure },
    { capitalize: false },
  )
}
