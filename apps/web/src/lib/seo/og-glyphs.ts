/**
 * Paylaşım görsellerinin harf süzgeci (D-111). Satori bir harfi verilen yazı tiplerinin hiçbirinde
 * bulamazsa `fonts.googleapis.com`'dan yazı tipi indirir; bu canlı dış istek kurallara aykırıdır
 * (og-fonts.ts). 5. halkanın kaynak adlarında Overpass'ın latin ve latin-ext alt kümelerinde
 * olmayan harfler vardır (Vietnamca "Phú Quốc", "Huế"; Arapça ekler). Görsele giden her metin
 * önce `foldOgText`'ten geçer: yazı tiplerinde olan harf olduğu gibi kalır, olmayan harf temel
 * harfine indirilir (NFD, işaretler atılır: ố → o, ế → e), o da yoksa düşer (Arapça, Çince).
 *
 * `OG_GLYPH_RANGES`, dört `.woff` dosyasının (400 ve 800, latin ve latin-ext) `cmap` tablolarında
 * glifi olan kod noktalarıdır (iki kalınlıkta da aynı küme). Alt kümelerin CSS `unicode-range`'i
 * değil: aralıklarda glifi olmayan harfler de var (IPA'nın çoğu, U+1EA0–1EF1 Vietnamca). Yazı
 * tipleri değişirse `og-glyphs.test.ts` dosyaların kendisiyle karşılaştırır ve kırılır.
 */
export const OG_GLYPH_RANGES =
  'd,20-7e,a0-17f,181,186-18a,18e-194,196-199,19d,1a0-1a1,1a4-1a5,1a9,1ac-1b4,1b7,1c0-1f5,' +
  '1f8-21b,21e-21f,226-233,237,242-245,24b-24c,250-254,256-257,259,25b,25f-261,263,265-266,' +
  '268-269,26e-26f,272,279,27d-27e,283,288-28e,292,294-295,29e,2a1-2a4,2a6-2a7,2a9-2ac,2b0,2b2,' +
  '2b7-2ba,2bc,2c6-2c7,2c9,2d6,2da,2dc-2dd,2e1-2e3,300-301,303-304,308-309,323,1e04-1e05,' +
  '1e0c-1e0f,1e12-1e13,1e20-1e21,1e24-1e25,1e2e-1e2f,1e36-1e37,1e3c-1e3f,1e44-1e47,1e4a-1e4d,' +
  '1e50-1e53,1e62-1e63,1e6c-1e71,1e80-1e85,1e92-1e93,1e9e,1ef2-1ef9,2002,2009,200b,2013-2014,' +
  '2018-201a,201c-201e,2020,2022,2026,2032-2033,2039-203a,2044,20a1-20bf,2113,2122,2191,2193,' +
  '2212,2215,2c64,2c6d,2c72-2c73,a78b-a78d,a7aa,fffd'

const GLYPHS: ReadonlySet<number> = (() => {
  const set = new Set<number>()
  for (const range of OG_GLYPH_RANGES.split(',')) {
    const [start = '', end = start] = range.split('-')
    for (let cp = parseInt(start, 16); cp <= parseInt(end, 16); cp++) set.add(cp)
  }
  return set
})()

/** Kod noktasının glifi paylaşım görselinin yazı tiplerinde var mı. */
export function isOgGlyph(codePoint: number): boolean {
  return GLYPHS.has(codePoint)
}

const MARK = /\p{M}/u
/** Düşen harflerin ardında kalan uçtaki ayraçlar ("Guemar Airport - مطار" → "Guemar Airport"). */
const DANGLING = /^[\s\-–—,;:/·]+|[\s\-–—,;:/·]+$/g

/**
 * Metni paylaşım görselinin yazı tiplerine indirir: glifi olan harf kalır, olmayan harf NFD ile
 * temel harfine iner (işaretler atılır), temel harfin de glifi yoksa düşer. Düşen harflerin
 * bıraktığı boşluklar ve uçtaki ayraçlar temizlenir. Glifi olan metin (bugünkü bütün listelenen
 * adlar) değişmez.
 */
export function foldOgText(text: string): string {
  let folded = ''
  let changed = false
  for (const char of text) {
    if (isOgGlyph(char.codePointAt(0) ?? 0)) {
      folded += char
      continue
    }
    changed = true
    for (const part of char.normalize('NFD')) {
      if (!MARK.test(part) && isOgGlyph(part.codePointAt(0) ?? 0)) folded += part
    }
  }
  return changed ? folded.replace(/ {2,}/g, ' ').replace(DANGLING, '') : text
}
