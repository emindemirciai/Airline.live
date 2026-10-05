/**
 * Canlı haritanın renkleri. Web ve mobil aynı değerleri kullanır; harita üstündeki her şey opaktır
 * (etiket, panel, iz çizgisi), saydamlık kullanılmaz. İki istisna vardır:
 * - ülke sınırının koyu kenarı (borders.ts, D-092): içerik değil, beyaz kesikli çizginin her
 *   altlıkta okunmasını sağlayan bir haledir; çizginin kendisi opaktır.
 * - ülke adları (country-labels.ts, D-095, D-099): az saydam beyaz yazı (0,85), az saydam koyu hale
 *   (0,9), zeminsiz (kullanıcı kararları "Saydam olsun", sonra "az biraz daha belirgin olsun").
 *   Altlık adların içinden biraz görünür; pin, kod ve uçaklar adların üstünde çizilir. Buradaki
 *   renkler opaktır; saydamlık katmanda `withAlpha` ile verilir.
 *
 * Altlık uydu görüntüsüdür; uçak, iz ve pin renkleri kullanıcının tasarım tuvalindendir (v2). Panel,
 * etiket ve kod kutusu renkleri sitenin "Açık turkuaz" temasındandır (D-081): opak beyaz kutu, ince
 * açık turkuaz kenar, koyu yazı.
 */
export const MAP_COLORS = {
  /** Harita zemini: uydu karoları gelmeden ve düz altlıkta görünen koyu zemin (test stiliyle aynı). */
  background: '#0B1016',
  /** Panel yüzeyi. */
  panel: '#FFFFFF',
  /** Panelin yükseltilmiş yüzeyi (olgu kutusu, üzerine gelinen satır). */
  panelRaised: '#EAF7F8',
  /** Panel kenarı ve ayırıcı çizgi. */
  line: '#B9E2E6',
  /** Giriş kutusu ve düğme kenarı (beyaza karşı 3,32:1, WCAG 1.4.11). */
  lineStrong: '#6A949C',
  /** Ana metin (beyaza karşı 15,07:1). */
  ink: '#0B2A33',
  /** İkincil metin (beyaza karşı 6,05:1). */
  muted: '#4B6770',
  /** Uçak etiketinin ve büyük havalimanının kod kutusunun dolgusu. */
  labelBox: '#FFFFFF',
  /** Etiket ve kod kutusunun ince kenarı. */
  labelBorder: '#B9E2E6',
  /** Etiket ve kod yazısı, etiketi uçağa bağlayan çizgi (beyaza karşı 15,07:1). */
  labelInk: '#0B2A33',
  /** Sefer no bilinmeyince çağrı kodu (beyaza karşı 6,05:1). */
  labelMuted: '#4B6770',
  /** Orta ve küçük havalimanının kod kutusu (yazıyla 11,69:1). */
  airportChipMinor: '#CBE8EB',
  /** THY uçağının gövdesi ve etiketindeki şerit. */
  thyRed: '#E30A17',
  /** THY uçağının kenarı ve kuyruk vurgusu. */
  thyWhite: '#FFFFFF',
  /** Seçili uçak (ikon, etiket zemini, bağlantı çizgisi). */
  selected: '#FFB300',
  /** Seçili uçağın etiket yazısı (kehribara karşı 10,52:1). */
  selectedInk: '#111111',
  /** Diğer uçakların gövdesi. */
  aircraft: '#EEF3F7',
  /** Uçak ikonunun kenarı (THY dışı). */
  aircraftOutline: '#0B1016',
  /** Seçili uçağın havadaki izi. */
  airTrack: '#FFB300',
  /** Seçili uçağın yerdeki izi (teker koyduktan sonra). */
  groundTrack: '#22D3EE',
  /** Havalimanı pini (kırmızı iğne; THY kırmızısından ayrı ton). */
  airport: '#E53935',
  /** Havalimanı pininin beyaz kenarı ve başındaki nokta (uydu ve koyu altlıkta okunur). */
  airportOutline: '#FFFFFF',
  /** Pinin en dıştaki koyu hattı (açık altlıkta beyaz kenar kaybolmasın). */
  airportHalo: '#0B1016',
  /** Ülke sınırının beyaz kesikli çizgisi (D-092). */
  border: '#FFFFFF',
  /** Ülke sınırının altındaki koyu kenar (yarı saydam hale; açık toprakta da çizgi okunur). */
  borderCasing: '#0B2A33',
  /** Ülke adının yazısı (D-095); haritada `COUNTRY_LABEL_TEXT_ALPHA` saydamlıkla çizilir. */
  countryLabel: '#FFFFFF',
  /** Ülke adının koyu halesi (D-095, D-099); haritada `COUNTRY_LABEL_HALO_ALPHA` saydamlıkla. */
  countryLabelHalo: '#000000',
} as const

export type MapColorName = keyof typeof MAP_COLORS

/**
 * Opak `#RRGGBB` rengini verilen saydamlıkla CSS `rgba()` yazar: `withAlpha('#FFFFFF', 0.6)` →
 * `'rgba(255, 255, 255, 0.6)'`. Saydamlık 0–1 aralığında olmalı; biçimsiz renk ya da aralık dışı
 * saydamlık `RangeError` fırlatır.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new RangeError(`expected #RRGGBB colour: ${hex}`)
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError(`alpha must be between 0 and 1: ${alpha}`)
  }
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}
