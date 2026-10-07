/**
 * Havalimanı arama motoru (D-108): canlı haritanın arama kutusu yazarken havalimanı önerir. Saf ve
 * bağımsızdır: hiçbir şey içe aktarmaz (ad tabloları da). Dizini kuran kod (web'de
 * `panels/airport-search-index.ts`) her havalimanının adlarını, yerlerini ve ülkelerini verir; motor
 * yalnız metinleri karşılaştırır. Böylece motor, ileride (M6j) aynen API'ye taşınabilir.
 *
 * Eşleşme kuralları:
 * - **Katlama** (`foldSearchText`): büyük-küçük harf, Türkçe harfler (İ, ı), aksanlar ve noktalama yok
 *   sayılır; İSTANBUL, Istanbul, ıstanbul aynıdır. Harf ve rakam dışındaki her şey sözcük ayracıdır.
 * - **Dolgu sözcükleri** (`AIRPORT_SEARCH_STOP_WORDS`): "havalimanı", "airport", "international"
 *   gibi sözcükler sayılmaz; "antalya havalimanı" = "antalya". Sorgu hiçbir şey bulmazsa sondaki
 *   yarım yazılmış dolgu sözcüğü de sayılmaz ("antalya hava", "athens inter", 32 karakterde kesilmiş
 *   "… Havaliman"): yazarken liste kapanmaz, sonuç sözcük bitince aynıdır.
 * - **Yalnız sözcük başı:** sorgunun her sözcüğü bir sözcüğün başına uymalıdır; sözcük ortası hiçbir
 *   zaman eşleşmez ("port" "Airport"u, "ist" "Priştine"yi bulmaz).
 * - **Basamaklar**, iyiden kötüye: tam kod (IATA ya da ICAO) > başlangıç (sorgu bir adın ya da yerin
 *   başı) > sözcükler (her sorgu sözcüğü bir ad, yer ya da kod sözcüğünün başı; "LTF", "ES" gibi kod
 *   önekleri dahil) > ülke (en az 3 harf; sözcükler ülke adlarında da aranır). Bir basamağın içinde
 *   çağıranın sırası korunur.
 * - **Tam kod** yalnız İngilizce harf ve rakamdan oluşan 3–4 karakterlik sorgudur (kırpılır, boşluk
 *   atılır, Türkçe klavyenin İ ve ı harfleri I ve i olur: "İST" IST'dir). Başka bir harf kod
 *   olamaz: "küt" Kutaisi'nin KUT kodu değil, Kütahya'nın (Zafer) ve Kutaisi'nin adının başıdır.
 * - **3 harfli sorgu** da aynı basamaklarla aranır: tam kod önce, sonra adın ya da yerin başı ve
 *   sözcük başı ("sab" ve "gok" Sabiha Gökçen, "ant" Antalya). Havayolu kodu biçimindeki sorgu
 *   ("THY") bir sözcük başını da bulabilir (Sfaks Thyna); bu bir öneri listesidir. Enter'da
 *   havalimanının doğrudan açılması arama kutusunun kuralıdır (`search-box-model.ts`
 *   `submitOutcome`, D-108): tam kod ya da aranan sorgunun en az 4 harfiyle tek eşleşme. Aranan
 *   sorgunun harf sayısı sonuçla döner (`queryLetters`): dolgu sözcükleri ve yedekte atılan yarım
 *   dolgu sözcüğü sayılmaz ("THY airport" ve "THY h" 3 harftir).
 * - **Rakamlı ya da hex sorgu** (`airportQueryKind` → `code`) yalnız tam kod arar: "TK1985" ya da
 *   "4BB26C" hiçbir havalimanı adına uymaz.
 *
 * Sorgu hiçbir zaman düzenli ifadeye çevrilmez; karşılaştırma `includes` iledir.
 */

/** Bir aramada dönen en fazla havalimanı. */
export const AIRPORT_SEARCH_LIMIT = 8

/** Aramanın en kısa sorgusu (boşluksuz, katlanmış). */
export const AIRPORT_SEARCH_MIN_LENGTH = 2

/** Ülke basamağının en kısa sorgusu (harf; boşluk sayılmaz). */
const COUNTRY_MIN_LENGTH = 3

/** Sayılmayan dolgu sözcükleri (katlanmış biçimde). */
export const AIRPORT_SEARCH_STOP_WORDS: readonly string[] = [
  'havalimani',
  'havaalani',
  'uluslararasi',
  'bolgesel',
  'airport',
  'international',
  'intl',
  'regional',
  'airfield',
  'aerodrome',
  'municipal',
]

const STOP: ReadonlySet<string> = /*#__PURE__*/ new Set(AIRPORT_SEARCH_STOP_WORDS)

/** Eşleşmenin basamağı, iyiden kötüye: tam kod, başlangıç, sözcükler, ülke. */
export type AirportSearchMatch = 'code' | 'start' | 'words' | 'country'

/** Sorgunun türü: aranmaz (`none`), yalnız tam kod (`code`) ya da metin (`text`). */
export type AirportQueryKind = 'none' | 'code' | 'text'

// eslint-disable-next-line no-control-regex -- ASCII'nin tamamı (denetim karakterleri dahil).
const ASCII = /^[\x00-\x7f]*$/

/** NFD'nin ayırmadığı harflerin karşılıkları (küçük harf). */
const EXTRA_LETTERS: Readonly<Record<string, string>> = {
  ı: 'i',
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
}

/**
 * Karşılaştırma biçimi: aksanlar atılır, küçük harfe çevrilir, NFD'nin ayırmadığı harfler
 * (ı, ł, ø, …) karşılığına döner; harf ve rakam dışındaki her dizi tek boşluk olur, baştaki ve
 * sondaki boşluk atılır. "İSTANBUL" → "istanbul", "Selçuk-Efes" → "selcuk efes", "Łódź" → "lodz".
 * Yalnız ASCII metinde (adların çoğu) aynı sonuç kısa yoldan çıkar: ayrıştırma ve aksan yoktur.
 */
export function foldSearchText(value: string): string {
  if (ASCII.test(value))
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[ıłøđðþæœß]/g, (letter) => EXTRA_LETTERS[letter] ?? letter)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Katlanmış sözcükler, dolgu sözcükleri atılmış. */
function searchTokens(value: string): string[] {
  const folded = foldSearchText(value)
  if (folded === '') return []
  return folded.split(' ').filter((token) => !STOP.has(token))
}

const HEX_QUERY = /^~?[0-9a-f]{6}$/i
const DIGIT = /\p{N}/u

/**
 * Sorgunun türü:
 * - `none`: boşluksuz katlanmış metin 2 karakterden kısa ya da dolgu sözcükleri atılınca sözcük
 *   kalmıyor ("havalimanı").
 * - `code`: katlanmış metinde rakam var ya da sorgu hex biçiminde (`~?` + 6 onaltılık hane); yalnız
 *   tam kod aranır.
 * - `text`: öbürleri.
 */
export function airportQueryKind(query: string): AirportQueryKind {
  const folded = foldSearchText(query)
  if (folded.replace(/ /g, '').length < AIRPORT_SEARCH_MIN_LENGTH) return 'none'
  if (searchTokens(query).length === 0) return 'none'
  if (DIGIT.test(folded) || HEX_QUERY.test(query.trim())) return 'code'
  return 'text'
}

/** Dizine giren havalimanı: değeri, kodları ve aranan metinleri. */
export interface AirportSearchEntry<T> {
  value: T
  /** IATA kodu; yoksa boş metin. */
  iata: string
  icao: string
  /** Adlar (iki dilde görünen ad, resmî ad, kaynak adı). */
  names: readonly string[]
  /** Yerler (il, şehir, yerleşim; iki dilde). */
  places: readonly string[]
  /** Ülke adları (kısa ve uzun, iki dilde). */
  countries: readonly string[]
}

/** Dizinin iç kaydı: her şey kurulurken bir kez hesaplanır. */
interface IndexedAirport<T> {
  value: T
  iata: string
  icao: string
  /** Her ad ve yerin sözcükleri, `\u0001` ile ayrılmış ve başlanmış. */
  starts: string
  /** Ad, yer ve kod sözcükleri, boşlukla ayrılmış ve başlanmış. */
  words: string
  /** Ülke sözcükleri, boşlukla ayrılmış ve başlanmış. */
  countryWords: string
}

/**
 * Arama dizini (`createAirportSearchIndex`); içi saklıdır. `T` dizindeki değerlerin türüdür
 * (`searchAirportIndex` onları döndürür).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `T` aramanın dönüş türünü taşır.
export interface AirportSearchIndex<T> {
  /** Dizindeki havalimanı sayısı. */
  readonly size: number
}

/** Dizinlerin iç kayıtları; dizin nesnesi anahtardır (nesne dışarıdan değiştirilemez). */
const INDEX_ITEMS: WeakMap<object, readonly IndexedAirport<unknown>[]> = /*#__PURE__*/ new WeakMap()

const START = '\u0001'

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)]
}

/**
 * Dizini kurar; çağıranın sırası korunur (bir basamağın içindeki sonuç sırası budur). Her kayıt için
 * metinler bir kez katlanır; 3.500 havalimanında kurulum bir kezlik ve kısadır.
 */
export function createAirportSearchIndex<T>(
  entries: readonly AirportSearchEntry<T>[],
): AirportSearchIndex<T> {
  // Aynı metin (ülke, il, şehir adı) birçok kayıtta geçer: kurulum boyunca bir kez katlanır.
  const folded = new Map<string, readonly string[]>()
  const tokensOf = (text: string): readonly string[] => {
    let tokens = folded.get(text)
    if (tokens === undefined) {
      tokens = searchTokens(text)
      folded.set(text, tokens)
    }
    return tokens
  }
  // Bir ülkenin havalimanları aynı ülke metnini paylaşır (3.500 kayıtta bellek).
  const countryTexts = new Map<string, string>()
  const countryWordsOf = (countries: readonly string[]): string => {
    const key = countries.join(START)
    let text = countryTexts.get(key)
    if (text === undefined) {
      text = ` ${unique(countries.flatMap((country) => tokensOf(country))).join(' ')}`
      countryTexts.set(key, text)
    }
    return text
  }
  const items = entries.map((entry): IndexedAirport<T> => {
    const texts = unique([...entry.names, ...entry.places])
    const phrases = unique(texts.map((text) => tokensOf(text).join(' '))).filter(Boolean)
    const codes = [entry.iata, entry.icao].map((code) => foldSearchText(code)).filter(Boolean)
    const words = unique([...texts.flatMap((text) => tokensOf(text)), ...codes])
    return {
      value: entry.value,
      iata: entry.iata.trim().toUpperCase(),
      icao: entry.icao.trim().toUpperCase(),
      starts: START + phrases.join(START),
      words: ` ${words.join(' ')}`,
      countryWords: countryWordsOf(entry.countries),
    }
  })
  const index: AirportSearchIndex<T> = Object.freeze({ size: items.length })
  INDEX_ITEMS.set(index, items)
  return index
}

/** Bir sonuç: havalimanının değeri ve eşleşmenin basamağı. */
export interface AirportSearchHit<T> {
  value: T
  match: AirportSearchMatch
}

/** Bir aramanın sonucu (`searchAirportIndex`). */
export interface AirportIndexResult<T> {
  /** İyi basamak önce, en fazla `limit` sonuç. */
  hits: AirportSearchHit<T>[]
  /** Bütün eşleşmelerin sayısı. */
  total: number
  /**
   * Aranan sorgudaki harf sayısı: katlanmış sözcüklerin harfleri; dolgu sözcükleri, yedekte atılan
   * yarım dolgu sözcüğü, rakam, boşluk ve noktalama sayılmaz ("esenboğa hav" 8, "THY airport" 3,
   * "s-a.b" 3). Enter kuralı bununla sayar (D-108).
   */
  queryLetters: number
}

const TIERS: readonly AirportSearchMatch[] = ['code', 'start', 'words', 'country']

const LETTER = /\p{L}/gu

/** Katlanmış sözcüklerdeki harf sayısı (rakam sayılmaz). */
function letterCount(tokens: readonly string[]): number {
  return tokens.join('').match(LETTER)?.length ?? 0
}

/**
 * Sorguya uyan havalimanları, iyi basamak önce (basamağın içinde dizinin sırası), en fazla `limit`;
 * `total` bütün eşleşmelerin sayısıdır. `none` türündeki sorgu hiçbir şey bulmaz. Hiçbir şey
 * bulunmazsa ve sorgunun son sözcüğü bir dolgu sözcüğünün yarım yazılmış başıysa sözcük yokmuş gibi
 * yeniden aranır (`withoutPartialStopWord`); `queryLetters` o zaman kısalan sorgununkidir.
 */
export function searchAirportIndex<T>(
  index: AirportSearchIndex<T>,
  query: string,
  limit: number = AIRPORT_SEARCH_LIMIT,
): AirportIndexResult<T> {
  const result = searchQuery(index, query, limit)
  if (result.total > 0) return result
  const shorter = withoutPartialStopWord(query)
  return shorter === null ? result : searchAirportIndex(index, shorter, limit)
}

/**
 * Son sözcüğü bir dolgu sözcüğünün yarım yazılmış başı olan sorgunun ("antalya hava", "athens
 * inter", "istanbul airp") o sözcük atılmış biçimi; değilse null. Tek sözcüklü sorgu kısalmaz
 * ("hava" hiçbir şey bulmaz). Yalnız sorgu hiçbir şey bulmadığında kullanılır: "italy bol" Bologna'yı
 * bulur, bütün İtalya'yı değil.
 */
function withoutPartialStopWord(query: string): string | null {
  const words = foldSearchText(query).split(' ')
  const last = words[words.length - 1] ?? ''
  if (words.length < 2 || last === '' || STOP.has(last)) return null
  return AIRPORT_SEARCH_STOP_WORDS.some((word) => word.startsWith(last))
    ? words.slice(0, -1).join(' ')
    : null
}

/** Tam kod olabilecek sorgu: İngilizce harf ve rakam, 3–4 karakter. */
const CODE_QUERY = /^[A-Za-z0-9]{3,4}$/

/**
 * Sorgunun tam kod anahtarı: kırpılır, boşluk atılır, Türkçe klavyenin İ ve ı harfleri I ve i olur
 * (aksan atılmaz), büyük harf; kod olamıyorsa null ("küt", "Łódź", "TK1985"). Web'in yalnız kodla
 * aramasıyla (`search-box-model.ts` `airportCodeKey`) aynı kuraldır.
 */
function codeKey(query: string): string | null {
  const key = query.trim().replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/\s+/g, '')
  return CODE_QUERY.test(key) ? key.toUpperCase() : null
}

/** Sorgunun kendisiyle arama (dolgu sözcüğü yedeği yok). */
function searchQuery<T>(
  index: AirportSearchIndex<T>,
  query: string,
  limit: number,
): AirportIndexResult<T> {
  const tokens = searchTokens(query)
  const queryLetters = letterCount(tokens)
  const kind = airportQueryKind(query)
  if (kind === 'none') return { hits: [], total: 0, queryLetters }
  const key = codeKey(query)
  const phrase = tokens.join(' ')
  const inWords = (item: IndexedAirport<T>, token: string): boolean =>
    item.words.includes(` ${token}`)
  const inCountry = (item: IndexedAirport<T>, token: string): boolean =>
    item.countryWords.includes(` ${token}`)
  const countryTier = phrase.replace(/ /g, '').length >= COUNTRY_MIN_LENGTH
  const buckets: Record<AirportSearchMatch, T[]> = { code: [], start: [], words: [], country: [] }

  const items = (INDEX_ITEMS.get(index) ?? []) as readonly IndexedAirport<T>[]
  for (const item of items) {
    if (key !== null && (key === item.iata || key === item.icao)) {
      buckets.code.push(item.value)
      continue
    }
    if (kind === 'code') continue
    if (item.starts.includes(START + phrase)) {
      buckets.start.push(item.value)
      continue
    }
    if (tokens.every((token) => inWords(item, token))) {
      buckets.words.push(item.value)
      continue
    }
    if (countryTier && tokens.every((token) => inWords(item, token) || inCountry(item, token))) {
      buckets.country.push(item.value)
    }
  }

  const hits: AirportSearchHit<T>[] = []
  let total = 0
  for (const match of TIERS) {
    const values = buckets[match]
    total += values.length
    for (const value of values) {
      if (hits.length >= limit) break
      hits.push({ value, match })
    }
  }
  return { hits, total, queryLetters }
}
