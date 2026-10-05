/**
 * Haritanın kendi yazı tipi (ülke adları, D-095): sitenin Overpass 600'ü, stilin `font-faces`
 * alanıyla. Dosyalar `@fontsource/overpass` 5.3.0'ın latin ve latin-ext 600 WOFF2 dosyalarıdır;
 * değiştirilmeden `public/fonts/`'a kopyalanmıştır (lisans `OFL.txt`). Harf aralıkları paketin
 * `600.css`'indeki `unicode-range` değerleridir: Türkçe İ, Ş ve Ğ latin-ext'tedir.
 *
 * MapLibre her dosyayı kendi aile adıyla tarayıcıya yükler ve harfleri 48 px'te TinySDF ile çizer;
 * dosya, aralığındaki bir harf ilk kez çizileceği zaman indirilir. Stile `glyphs` adresi eklenmez:
 * glif (`.pbf`) isteği gitmez, yerel test stilinde de dış istek yoktur. `font-faces` her `setStyle`
 * ile değiştiğinden haritaya verilen her stile eklenir (açılıştaki düz stil ve altlık zinciri).
 */
import { COUNTRY_LABEL_FONT } from '@havayolu/shared'
import type { MapStyle } from './basemap'

/** `font-faces` girdisi (style-spec `MLFontFace`). */
export interface MapFontFace {
  url: string
  'unicode-range': string[]
}

/** Yazı tipi dosyaları: yol ve harf aralıkları (latin önce; ortak harfler ondan çizilir). */
export const MAP_FONT_FILES: readonly { path: string; unicodeRange: readonly string[] }[] = [
  {
    path: '/fonts/overpass-latin-600-normal.woff2',
    unicodeRange: [
      'U+0000-00FF',
      'U+0131',
      'U+0152-0153',
      'U+02BB-02BC',
      'U+02C6',
      'U+02DA',
      'U+02DC',
      'U+0304',
      'U+0308',
      'U+0329',
      'U+2000-206F',
      'U+20AC',
      'U+2122',
      'U+2191',
      'U+2193',
      'U+2212',
      'U+2215',
      'U+FEFF',
      'U+FFFD',
    ],
  },
  {
    path: '/fonts/overpass-latin-ext-600-normal.woff2',
    unicodeRange: [
      'U+0100-02BA',
      'U+02BD-02C5',
      'U+02C7-02CC',
      'U+02CE-02D7',
      'U+02DD-02FF',
      'U+0304',
      'U+0308',
      'U+0329',
      'U+1D00-1DBF',
      'U+1E00-1E9F',
      'U+1EF2-1EFF',
      'U+2020',
      'U+20A0-20AB',
      'U+20AD-20C0',
      'U+2113',
      'U+2C60-2C7F',
      'U+A720-A7FF',
    ],
  },
]

/**
 * `font-faces` değeri, mutlak adreslerle (MapLibre'nin istek katmanı ve `transformRequest` mutlak
 * adres bekler). `origin` sayfanın kökenidir (`location.origin`). Ad `COUNTRY_LABEL_FONT`'tur.
 */
export function mapFontFaces(origin: string): Record<string, MapFontFace[]> {
  return {
    [COUNTRY_LABEL_FONT]: MAP_FONT_FILES.map(({ path, unicodeRange }) => ({
      url: new URL(path, origin).href,
      'unicode-range': [...unicodeRange],
    })),
  }
}

/**
 * Stile haritanın yazı tipini ekler. Stilin kendi `font-faces` girdileri korunur (aynı ad varsa
 * bizimki geçerlidir); `glyphs` eklenmez ve stilin kendi `glyphs` adresi değişmez. Girdi değişmez.
 */
export function withMapFonts(style: MapStyle, origin: string): MapStyle {
  return { ...style, 'font-faces': { ...style['font-faces'], ...mapFontFaces(origin) } }
}
