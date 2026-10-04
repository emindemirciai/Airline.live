/**
 * Canlı haritanın renkleri. Web ve mobil aynı değerleri kullanır; harita üstündeki her şey opaktır
 * (etiket, panel, iz çizgisi), saydamlık kullanılmaz. Tek istisna ülke sınırının koyu kenarıdır
 * (borders.ts, D-092): içerik değil, beyaz kesikli çizginin her altlıkta okunmasını sağlayan bir
 * haledir; çizginin kendisi opaktır. Altlık uydu görüntüsüdür; uçak, iz ve pin
 * renkleri kullanıcının tasarım tuvalindendir (v2). Panel, etiket ve kod kutusu renkleri sitenin
 * "Açık turkuaz" temasındandır (D-081): opak beyaz kutu, ince açık turkuaz kenar, koyu yazı.
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
} as const

export type MapColorName = keyof typeof MAP_COLORS
