/**
 * Canlı haritanın renkleri (kullanıcının tasarım tuvali v2). Web ve mobil aynı değerleri kullanır;
 * harita üstündeki her şey opaktır (etiket, panel, iz çizgisi), saydamlık kullanılmaz.
 */
export const MAP_COLORS = {
  /** Harita zemini ve etiket kutusu dolgusu. */
  background: '#0B1016',
  /** Panel yüzeyi. */
  panel: '#141C25',
  /** Panelin yükseltilmiş yüzeyi (başlık, seçili satır). */
  panelRaised: '#17212B',
  /** Panel kenarı ve ayırıcı çizgi. */
  line: '#243240',
  /** Etiket kutusu kenarı ve belirgin ayırıcı. */
  lineStrong: '#34424F',
  /** Ana metin. */
  ink: '#EEF3F7',
  /** İkincil metin (ör. çağrı kodu, etiketin ikinci satırı, bağlantı çizgisi). */
  muted: '#A9B6C2',
  /** Daha soluk üçüncül metin (ör. ikinci birim). */
  mutedStrong: '#8795A3',
  /** THY uçağının gövdesi. */
  thyRed: '#E30A17',
  /** THY uçağının kenarı ve kuyruk vurgusu. */
  thyWhite: '#FFFFFF',
  /** Seçili uçak (ikon, etiket kenarı). */
  selected: '#FFB300',
  /** Diğer uçakların gövdesi. */
  aircraft: '#EEF3F7',
  /** Uçak ikonunun kenarı (THY dışı). */
  aircraftOutline: '#0B1016',
  /** Seçili uçağın havadaki izi. */
  airTrack: '#FFB300',
  /** Seçili uçağın yerdeki izi (teker koyduktan sonra). */
  groundTrack: '#22D3EE',
  /** Havalimanı noktası. */
  airport: '#FFFFFF',
  /** Havalimanı noktasının kenarı. */
  airportOutline: '#0B1016',
  /** Havalimanı IATA kodu (koyu zemin üstünde). */
  airportLabel: '#B9C5D0',
} as const

export type MapColorName = keyof typeof MAP_COLORS
