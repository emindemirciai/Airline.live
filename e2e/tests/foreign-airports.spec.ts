// Diğer ülkelerdeki havalimanları, 1.–4. halka (Parça 1 M6d, D-080; M6g, D-088; M6h, D-090; M6i.2,
// D-102; D-106; D-110). Listelenen havalimanları IATA kodlu Türkiye havalimanları (askerî hava üsleri
// hariç, D-107) ve IATA kodlu en yakın Türkiye havalimanına en çok 5.000 km olan, OurAirports'ta
// tarifeli seferi kayıtlı ya da savaş nedeniyle kapalı (kapanış tablosu, D-110), dört karakterli
// ICAO'su olan büyük ve orta boy yabancı havalimanlarıdır. Veri
// tools/fixtures/ourairports'taki commit'li alt kümeden (2026-10-01 indirmesi), hava durumu elle
// yazılmış fixture'dan gelir. Denetlenenler:
// - API: `scope=listed` (56 + 77 + 104 + 283 + 720; askerî üsler yok, D-107), halka ve uzaklık
//   alanları (1. halka ≤ 500 km, 2. halka 500–1.000 km, sınırdaki Ben Gurion 500; 3. halka
//   1.000–2.000 km; 4. halka 2.000–5.000 km), Kihihi (UG-0002, KHX) ve New York JFK yok, `country`
//   ile birlikte 400; tek havalimanı ve hava durumu yabancı havalimanını da çözer; haritanın kaydı
//   (`include=map`, M6j.2, D-111) aynı listeyi verir, pist uçları yalnız 1.–3. halkada, takma ad
//   `identAlias`'ta; toplu hava `scope=listed` yalnız `format=raw` ile (yoksa 400)
// - /havalimanlari: Türkiye tablosundan sonra "Diğer ülkelerdeki havalimanları" tablosu (1.184 satır,
//   ülkeye göre Türkçe sıralı, ülke sütunu; Türkiye'ye uzaklık sütunu yok, D-106); Kahire, Viyana ve
//   Londra satırları
// - /istasyon/HECA (2. halka), /istasyon/LOWW (3. halka) ve /istasyon/EGLL (4. halka), iki dilde: ad,
//   ülke, dizine eklenir, yerel saat havalimanınınki; Viyana'nın ve Londra'nın başlığı çekim alanının
//   dışında oldukları için canlı trafik vaat etmez (D-106); `?havalimani=HECA`, `?havalimani=LOWW` ve
//   `?havalimani=EGLL` haritada o havalimanında açar, pencere ülkeyi ve yerel saati gösterir
// - /istasyon/lhr → 308 /istasyon/EGLL; /istasyon/KHX yönlendirmeden 404 (D-101)
// - adres takma adı (D-109): /istasyon/UTSS → 308 /istasyon/UZSS; 5. halkanın SPIM'i, WABP ve
//   askerî liste (PWAK, YBOK, PKWA) 404
// - savaş nedeniyle kapalı havalimanları (D-110): /istasyon/UUOO (Voronej) ve /istasyon/UKBB (Kiev
//   Borispil; OurAirports'ta tarifesiz) "Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri)", iki
//   dilde; /istasyon/HSFS "… kapalı olabilir (2023’ten beri)"; yeniden açılan /istasyon/URKK notsuz;
//   /havalimanlari'da adın altında 35 not; haritada Odessa'nın penceresi notu gösterir
// - /istasyon/LGAV ve /en/istasyon/LGAV: ülke, hava durumu, harita bağlantısı, dizine eklenir,
//   JSON-LD `addressCountry` GR; /istasyon/LCEN KKTC'yi gösterir ve JSON-LD'de ülke kodu yazmaz;
//   IATA kodu yönlendirir; fixture'da olup listelenmeyen uzak havalimanı 404
// - harita: `?havalimani=LGAV` Atina'da açar; pin ve "Havalimanları" listesi pencereyi açar; pencere
//   il yerine ülkeyi gösterir; pencerenin havası tek havalimanı isteğiyle gelir (D-090)
// - yerel saat (M6f, D-084): pencerede ve sayfada Atina'nın saati UTC farkıyla ("23:05 (UTC+2)");
//   sayfada gün doğumu ve batımı, METAR/TAF kaydının girişi yerel saat ve şu anki fark, satırlarda
//   UTC saati yanında; dilimi bilinmeyen havalimanının UTC yedeği ("Saatler UTC’dir", D-106 (c),
//   D-109) hava durumunda da kayıtta da yok
import { expect, test, type Locator, type Page } from '@playwright/test'
import { jsonLdNodes, metaContents, nodesOfType, titles, type JsonLdNode } from '../html'
import { mapCenter } from '../label-canvas'
import {
  AIRPORT_COUNT,
  airportListCodes,
  API_URL,
  APP_NAME,
  CIVIL_CLOSURE_AIRPORT,
  CIVIL_CLOSURE_COUNT,
  declineAnalytics,
  enPath,
  expectRedirect,
  fetchRaw,
  FOREIGN_AIRPORT_COUNT,
  FOREIGN_MILITARY_AIRFIELDS,
  IDENT_ALIAS_AIRPORT,
  KKTC_AIRPORT,
  LABEL_SETTINGS_KEY,
  LISTED_AIRPORT_COUNT,
  MAP_CLOSURE_AIRPORT,
  POSSIBLE_CLOSURE_AIRPORT,
  REOPENED_AIRPORT,
  RING1_AIRPORT,
  RING1_AIRPORT_COUNT,
  RING1_WEATHER_AIRPORTS,
  RING2_AIRPORT,
  RING2_AIRPORT_COUNT,
  RING2_BOUNDARY_AIRPORT,
  RING3_AIRPORT,
  RING3_AIRPORT_COUNT,
  RING4_AIRPORT,
  RING4_AIRPORT_COUNT,
  RING_LIMITS_KM,
  NON_ICAO_AIRPORT,
  UNLISTED_FOREIGN_AIRPORT,
  waitForMap,
  WAR_CLOSURE_AIRPORT,
  WEB_URL,
} from '../support'

const { icao, iata } = RING1_AIRPORT
const STATION_PATH = `/istasyon/${icao}`
const KKTC_PATH = `/istasyon/${KKTC_AIRPORT.icao}`
const RING2_PATH = `/istasyon/${RING2_AIRPORT.icao}`
const RING3_PATH = `/istasyon/${RING3_AIRPORT.icao}`
const RING4_PATH = `/istasyon/${RING4_AIRPORT.icao}`
const CLOSURE_PATH = `/istasyon/${CIVIL_CLOSURE_AIRPORT.icao}`
const WAR_PATH = `/istasyon/${WAR_CLOSURE_AIRPORT.icao}`
/** Atina'nın saat dilimi (`airportTimeZone`, tzdb; D-084). */
const ATHENS_TIME_ZONE = 'Europe/Athens'

/** Sayfadaki metinler (packages/i18n → `airports`, `map.airportPopup`, `weather`). */
const COPY = {
  tr: {
    listPath: '/havalimanlari',
    foreignHeading: 'Diğer ülkelerdeki havalimanları',
    foreignHeaders: ['Havalimanı', 'Ülke', 'IATA', 'ICAO', 'En uzun pist'],
    country: RING1_AIRPORT.countryTr,
    ring2Country: RING2_AIRPORT.countryTr,
    ring2Name: RING2_AIRPORT.nameTr,
    ring3Country: RING3_AIRPORT.countryTr,
    ring3Name: RING3_AIRPORT.nameTr,
    ring4Country: RING4_AIRPORT.countryTr,
    ring4Name: RING4_AIRPORT.nameTr,
    titleOutside: 'pistler ve havalimanı bilgileri',
    closure: CIVIL_CLOSURE_AIRPORT.noteTr,
    possibleClosure: POSSIBLE_CLOSURE_AIRPORT.noteTr,
    warName: WAR_CLOSURE_AIRPORT.nameTr,
    warLocation: WAR_CLOSURE_AIRPORT.locationTr,
    /** Raporu olmayan havalimanının hava durumu metni (`weather.age.none`). */
    noCurrentReport: 'güncel bir havacılık hava raporu yok',
    /** Pencerenin raporsuz durumu (`map.airportPopup.noReport`). */
    popupNoReport: 'Hava durumu raporu yok',
    kktc: new RegExp(KKTC_AIRPORT.shortTr),
    collator: 'tr-TR',
    listButton: 'Havalimanları',
    weather: 'Hava durumu',
    wind: 'Rüzgâr',
    speedUnit: 'km/sa',
    observed: /Gözlem \d{2}:\d{2}/,
    localTime: 'Yerel saat',
    sunrise: /Gün doğumu \d{2}:\d{2}/,
    sunset: /Gün batımı \d{2}:\d{2}/,
    /** Saat dilimi bilinmeyen havalimanının yedeği (`weather.utcTime`, `log.introUtc`; D-109). */
    utcFallback: 'Saatler UTC’dir',
    log: 'METAR/TAF kaydı',
    logLocal: /Saatler havalimanının yerel saatidir \(şu an UTC\+[23]\); UTC yanında yazılır\./,
  },
  en: {
    listPath: enPath('/havalimanlari'),
    foreignHeading: 'Airports in other countries',
    foreignHeaders: ['Airport', 'Country', 'IATA', 'ICAO', 'Longest runway'],
    country: RING1_AIRPORT.countryEn,
    ring2Country: RING2_AIRPORT.countryEn,
    ring2Name: RING2_AIRPORT.nameEn,
    ring3Country: RING3_AIRPORT.countryEn,
    ring3Name: RING3_AIRPORT.nameEn,
    ring4Country: RING4_AIRPORT.countryEn,
    ring4Name: RING4_AIRPORT.nameEn,
    titleOutside: 'runways and airport information',
    closure: CIVIL_CLOSURE_AIRPORT.noteEn,
    possibleClosure: POSSIBLE_CLOSURE_AIRPORT.noteEn,
    warName: WAR_CLOSURE_AIRPORT.nameEn,
    warLocation: WAR_CLOSURE_AIRPORT.locationEn,
    noCurrentReport: 'no current aviation weather report',
    popupNoReport: 'No weather report',
    kktc: new RegExp(`${KKTC_AIRPORT.shortEn}|Turkish Republic of Northern Cyprus`),
    collator: 'en-GB',
    listButton: 'Airports',
    weather: 'Weather',
    wind: 'Wind',
    speedUnit: 'km/h',
    observed: /Observed \d{2}:\d{2}/,
    localTime: 'Local time',
    sunrise: /Sunrise \d{2}:\d{2}/,
    sunset: /Sunset \d{2}:\d{2}/,
    utcFallback: 'Times are in UTC',
    log: 'METAR/TAF log',
    logLocal: /Times are the airport’s local time \(currently UTC\+[23]\), with UTC alongside\./,
  },
} as const

interface ListedAirport {
  icao?: unknown
  iata?: unknown
  country?: unknown
  ring?: unknown
  distanceToTrKm?: unknown
  identAlias?: unknown
  runways?: { lengthFt?: unknown; ends?: unknown[] }[]
}

function isRecord(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `<dl>` satırının değeri: etiketi tam olarak `label` olan görünür `<dt>`'nin ardındaki `<dd>`. */
function row(scope: Locator, label: string): Locator {
  return scope
    .locator('dt')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`), visible: true })
    .first()
    .locator('xpath=following-sibling::dd[1]')
}

test.describe('API', () => {
  test('scope=listed: 56 Türkiye + 1.184 Türkiye dışı havalimanı (77 + 104 + 283 + 720; savaş kapanışlarıyla, D-110); halka ve uzaklık; 5. halka ve ICAO’suz havalimanı yok', async ({
    request,
  }) => {
    for (const path of [
      '/v1/airports?scope=listed',
      '/v1/airports?scope=listed&include=runways',
      '/v1/airports?scope=listed&include=map',
    ]) {
      const response = await request.get(`${API_URL}${path}`)
      expect(response.status(), path).toBe(200)
      const airports = ((await response.json()) as { airports?: ListedAirport[] }).airports ?? []
      expect(airports, path).toHaveLength(LISTED_AIRPORT_COUNT)
      const turkey = airports.filter((airport) => airport.country === 'TR')
      const foreign = airports.filter((airport) => airport.country !== 'TR')
      expect(turkey, `${path}: Türkiye`).toHaveLength(AIRPORT_COUNT)
      expect(foreign, `${path}: Türkiye dışı`).toHaveLength(FOREIGN_AIRPORT_COUNT)
      expect(foreign.filter((airport) => airport.ring === 1)).toHaveLength(RING1_AIRPORT_COUNT)
      expect(foreign.filter((airport) => airport.ring === 2)).toHaveLength(RING2_AIRPORT_COUNT)
      expect(foreign.filter((airport) => airport.ring === 3)).toHaveLength(RING3_AIRPORT_COUNT)
      expect(foreign.filter((airport) => airport.ring === 4)).toHaveLength(RING4_AIRPORT_COUNT)
      for (const airport of turkey) {
        expect(airport.ring, `${String(airport.icao)}: halka`).toBe(0)
        expect(airport.distanceToTrKm, `${String(airport.icao)}: uzaklık`).toBeNull()
      }
      for (const airport of foreign) {
        const label = String(airport.icao)
        expect([1, 2, 3, 4], `${label}: halka`).toContain(airport.ring)
        expect(typeof airport.distanceToTrKm, `${label}: uzaklık`).toBe('number')
        const km = airport.distanceToTrKm as number
        if (airport.ring === 1) {
          expect(km, label).toBeGreaterThan(0)
          expect(km, label).toBeLessThanOrEqual(RING_LIMITS_KM[1])
        } else if (airport.ring === 2) {
          // Halka tam uzaklıktandır, `distanceToTrKm` tam km'ye yuvarlıdır: 500,44 km → 500 (LLBG).
          expect(km, label).toBeGreaterThanOrEqual(RING_LIMITS_KM[1])
          expect(km, label).toBeLessThanOrEqual(RING_LIMITS_KM[2])
        } else if (airport.ring === 3) {
          // 3. halkanın en yakını Gachsaran, 1.006 km: 1.000 km sınırında yuvarlama vakası yoktur.
          expect(km, label).toBeGreaterThan(RING_LIMITS_KM[2])
          expect(km, label).toBeLessThanOrEqual(RING_LIMITS_KM[3])
        } else {
          // 4. halkanın en yakını Barselona, 2.003 km; en uzağı Ulan Batur, 4.981 km (D-102).
          expect(km, label).toBeGreaterThan(RING_LIMITS_KM[3])
          expect(km, label).toBeLessThanOrEqual(RING_LIMITS_KM[4])
        }
        expect(airport.country, `${label}: ülke kodu`).toMatch(/^[A-Z]{2}$/)
        // Değişmez kural (D-101): listelenen her havalimanının dört karakterli ICAO'su vardır.
        expect(airport.icao, `${label}: ICAO`).toMatch(/^[A-Z0-9]{4}$/)
      }
      const athens = airports.find((airport) => airport.icao === icao)
      expect(athens?.iata).toBe(iata)
      expect(athens?.country).toBe(RING1_AIRPORT.country)
      // Ercan OurAirports'ta CY'dir; API ham ülke kodunu verir, KKTC gösterimi arayüzdedir (D-080).
      expect(airports.find((airport) => airport.icao === KKTC_AIRPORT.icao)?.country).toBe('CY')
      const cairo = airports.find((airport) => airport.icao === RING2_AIRPORT.icao)
      expect(cairo).toMatchObject({
        iata: RING2_AIRPORT.iata,
        country: RING2_AIRPORT.country,
        ring: 2,
      })
      expect(
        airports.find((airport) => airport.icao === RING2_BOUNDARY_AIRPORT.icao),
      ).toMatchObject({ ring: 2, distanceToTrKm: RING2_BOUNDARY_AIRPORT.distanceToTrKm })
      expect(airports.find((airport) => airport.icao === RING3_AIRPORT.icao)).toMatchObject({
        iata: RING3_AIRPORT.iata,
        country: RING3_AIRPORT.country,
        ring: 3,
      })
      expect(airports.find((airport) => airport.icao === RING4_AIRPORT.icao)).toMatchObject({
        iata: RING4_AIRPORT.iata,
        country: RING4_AIRPORT.country,
        ring: 4,
      })
      // Kihihi (UG-0002, KHX) dört karakterli ICAO'su olmadığı için listede yoktur (D-101).
      expect(airports.some((airport) => airport.icao === NON_ICAO_AIRPORT.ident)).toBe(false)
      expect(airports.some((airport) => airport.iata === NON_ICAO_AIRPORT.iata)).toBe(false)
      // Savaş nedeniyle kapalı havalimanları listededir (D-110): Voronej (OurAirports'ta tarifeli) ve
      // Kiev Borispil (tarifesiz, kapanış tablosuyla).
      expect(airports.some((airport) => airport.icao === CIVIL_CLOSURE_AIRPORT.icao)).toBe(true)
      expect(airports.find((airport) => airport.icao === WAR_CLOSURE_AIRPORT.icao)).toMatchObject({
        iata: WAR_CLOSURE_AIRPORT.iata,
        country: 'UA',
        ring: 2,
      })
      expect(airports.some((airport) => airport.icao === UNLISTED_FOREIGN_AIRPORT.icao)).toBe(false)
      if (path.includes('include=runways')) expect(athens?.runways?.length ?? 0).toBeGreaterThan(0)
      if (path.includes('include=map')) {
        // Haritanın kaydı (D-111): pist uzunlukları her halkada, uçlar yalnız 1.–3. halkada (canlı
        // veri kapsaması); 4. halkanın uçları uçak yaklaşınca tek havalimanı ucundan istenir.
        expect(athens?.runways?.length ?? 0).toBeGreaterThan(0)
        expect(athens?.runways?.every((runway) => Array.isArray(runway.ends))).toBe(true)
        const ring4 = airports.find((airport) => airport.icao === RING4_AIRPORT.icao)
        expect(ring4?.runways?.length ?? 0).toBeGreaterThan(0)
        expect(ring4?.runways?.some((runway) => 'ends' in runway)).toBe(false)
        for (const airport of airports) {
          const withEnds = (airport.runways ?? []).some((runway) => 'ends' in runway)
          if (withEnds) expect([0, 1, 2, 3], String(airport.icao)).toContain(airport.ring)
        }
        // Arama takma adı tam kod olarak bulur (D-109): kayıt takma adı taşır.
        expect(
          airports.find((airport) => airport.icao === IDENT_ALIAS_AIRPORT.icao)?.identAlias,
        ).toBe(IDENT_ALIAS_AIRPORT.alias)
      }
    }

    // Geriye uyumluluk: varsayılan yine Türkiye'dir; `country` ile `scope` birlikte verilemez.
    const turkey = await request.get(`${API_URL}/v1/airports?country=TR`)
    expect(((await turkey.json()) as { airports?: unknown[] }).airports).toHaveLength(AIRPORT_COUNT)
    const both = await request.get(`${API_URL}/v1/airports?country=TR&scope=listed`, {
      failOnStatusCode: false,
    })
    expect(both.status()).toBe(400)
  })

  test('tek havalimanı ve hava durumu Türkiye dışındaki havalimanını ICAO ve IATA koduyla çözer', async ({
    request,
  }) => {
    for (const code of [icao, iata.toLowerCase()]) {
      const response = await request.get(`${API_URL}/v1/airports/${code}`)
      expect(response.status(), code).toBe(200)
      const body = (await response.json()) as ListedAirport
      expect(body.icao, code).toBe(icao)
      expect(body.iata, code).toBe(iata)
    }
    const weather = await request.get(`${API_URL}/v1/airports/${iata}/weather`)
    expect(weather.status()).toBe(200)
    const body = (await weather.json()) as { icao?: unknown; metar?: { raw?: unknown } | null }
    expect(body.icao).toBe(icao)
    expect(String(body.metar?.raw)).toContain(icao)
  })

  test('toplu hava: scope=listed bütün listelenen havalimanları (1.240), yalnız ham biçimde; 1. halka fixture istasyonlarında METAR; ICAO’suz havalimanı yok', async ({
    request,
  }) => {
    // Çözümlenmiş toplu yanıt yalnız ülke isteğindedir (D-111): scope=listed format=raw ister.
    for (const query of ['scope=listed', 'scope=listed&format=full']) {
      const full = await request.get(`${API_URL}/v1/weather?${query}`, { failOnStatusCode: false })
      expect(full.status(), query).toBe(400)
      expect(((await full.json()) as { error?: unknown }).error, query).toBe('format_required')
    }
    const response = await request.get(`${API_URL}/v1/weather?scope=listed&format=raw`)
    expect(response.status()).toBe(200)
    const stations =
      (
        (await response.json()) as {
          stations?: { icao?: unknown; metar?: { raw?: unknown } | null }[]
        }
      ).stations ?? []
    expect(stations).toHaveLength(LISTED_AIRPORT_COUNT)
    expect(stations.some((station) => station.icao === NON_ICAO_AIRPORT.ident)).toBe(false)
    expect(stations.every((station) => /^[A-Z0-9]{4}$/.test(String(station.icao)))).toBe(true)
    for (const station of RING1_WEATHER_AIRPORTS) {
      const entry = stations.find((item) => item.icao === station)
      expect(String(entry?.metar?.raw), `${station}: METAR`).toContain(station)
    }
    const both = await request.get(`${API_URL}/v1/weather?country=TR&scope=listed`, {
      failOnStatusCode: false,
    })
    expect(both.status()).toBe(400)
  })
})

test.describe('havalimanı listesi', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]

    test(`${copy.listPath}: Diğer ülkelerdeki havalimanları tablosu 1.184 satır, ülkeye göre sıralı; satır sayfayı açar`, async ({
      page,
    }) => {
      await page.goto(copy.listPath)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 2, name: copy.foreignHeading })).toBeVisible()
      const table = main.getByRole('table', { name: new RegExp(copy.foreignHeading) })
      await expect(table).toHaveCount(1)
      await expect(table.locator('thead th')).toHaveText([...copy.foreignHeaders])
      const rows = table.locator('tbody tr')
      await expect(rows).toHaveCount(FOREIGN_AIRPORT_COUNT)

      // Ülke sütunu sayfanın dilinin alfabesiyle sıralıdır (ilk `<td>`; ad `<th scope="row">`).
      const countries = (await rows.locator('td:nth-of-type(1)').allTextContents()).map((text) =>
        text.trim(),
      )
      const collator = new Intl.Collator(copy.collator)
      expect(countries).toEqual([...countries].sort((a, b) => collator.compare(a, b)))

      const athens = rows.filter({ hasText: icao })
      await expect(athens).toHaveCount(1)
      await expect(athens).toContainText(copy.country)
      await expect(athens).toContainText(iata)
      await expect(rows.filter({ hasText: KKTC_AIRPORT.icao })).toContainText(copy.kktc)
      // 2. halkadan Kahire (D-088): ad ve ülke. Halka uzaklıkları API testinde denetlenir (D-106).
      const cairo = rows.filter({ hasText: RING2_AIRPORT.icao })
      await expect(cairo).toHaveCount(1)
      await expect(cairo).toContainText(copy.ring2Name)
      await expect(cairo).toContainText(copy.ring2Country)
      // 3. halkadan Viyana (D-090): ad ve ülke.
      const vienna = rows.filter({ hasText: RING3_AIRPORT.icao })
      await expect(vienna).toHaveCount(1)
      await expect(vienna).toContainText(copy.ring3Name)
      await expect(vienna).toContainText(copy.ring3Country)
      // 4. halkadan Londra (D-102): ad ve ülke.
      const london = rows.filter({ hasText: RING4_AIRPORT.icao })
      await expect(london).toHaveCount(1)
      await expect(london).toContainText(copy.ring4Name)
      await expect(london).toContainText(copy.ring4Country)
      // Dört karakterli ICAO'su olmayan Kihihi (KHX) tabloda yoktur (D-101).
      await expect(rows.filter({ hasText: NON_ICAO_AIRPORT.iata })).toHaveCount(0)

      const href = locale === 'tr' ? STATION_PATH : enPath(STATION_PATH)
      await athens.locator(`a[href="${href}"]`).click()
      await expect(page).toHaveURL(`${WEB_URL}${href}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(`(${iata}/${icao})`)
    })
  }
})

test.describe('havalimanı sayfası', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const path = locale === 'tr' ? STATION_PATH : enPath(STATION_PATH)

    test(`${path}: ülke, hava durumu ve harita bağlantısı; dizine eklenir, JSON-LD ülkesi GR`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${path}: robots`).not.toMatch(/noindex/)
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.iataCode).toBe(iata)
      expect(airport?.icaoCode).toBe(icao)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe(RING1_AIRPORT.country)

      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(`(${iata}/${icao})`)
      await expect(main).toContainText(copy.country)
      // Hava durumu bölümü yabancı havalimanında da vardır (fixture: LGAV 02016KT).
      const weather = main.getByRole('region', { name: copy.weather, exact: true })
      await expect(weather).toBeVisible()
      await expect(row(weather, copy.wind)).toContainText(copy.speedUnit)
      // Yerel saat Atina'nındır, UTC farkıyla (D-084); gün doğumu ve batımı yazılır. Dilimi
      // bilinmeyen havalimanının UTC yedeği ("Saatler UTC’dir"; D-106 (c), D-109) gösterilmez.
      const sun = weather.locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expect(sun).toContainText(copy.sunset)
      await expectLocalClock(sun.locator('li').first(), `${copy.localTime} `, loadedFrom)
      await expect(weather).not.toContainText(copy.utcFallback)
      // METAR/TAF kaydı da havalimanının yerel saatini ve şu anki farkını söyler; satırın UTC saati
      // yanında yazılır (yalnız UTC yedeğinde düşer, weather-log.tsx).
      const log = main.getByRole('region', { name: copy.log, exact: true })
      await expect(log).toContainText(copy.logLocal)
      await expect(log).not.toContainText(copy.utcFallback)
      const logUtc = log.locator('.weather-log-utc').first()
      await expect(logUtc).toBeVisible()
      await expect(logUtc).toHaveText(/^\d{2}:\d{2} UTC$/)
      const mapHref = locale === 'tr' ? `/?havalimani=${icao}` : `/en?havalimani=${icao}`
      await expect(main.locator(`a[href="${mapHref}"]`)).toBeVisible()
    })
  }

  test('/istasyon/LCEN ve /en/istasyon/LCEN: KKTC gösterilir; JSON-LD’de ülke kodu yazılmaz', async ({
    page,
    request,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      const path = locale === 'tr' ? KKTC_PATH : enPath(KKTC_PATH)
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.icaoCode, path).toBe(KKTC_AIRPORT.icao)
      // Gösterilen ülke (KKTC) OurAirports'un kodundan (CY) ayrıdır: JSON-LD yalnızca sayfada
      // görünen değeri yazar (D-080).
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry, `${path}: addressCountry`).toBeUndefined()

      await page.goto(path)
      await expect(page.locator('main')).toContainText(COPY[locale].kktc)
    }
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const ring2Path = locale === 'tr' ? RING2_PATH : enPath(RING2_PATH)

    test(`${ring2Path} (2. halka): ad, ülke, yerel saat Kahire’nin; dizine eklenir, JSON-LD ülkesi EG`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, ring2Path)
      expect(response.status(), ring2Path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${ring2Path}: robots`).not.toMatch(/noindex/)
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.icaoCode).toBe(RING2_AIRPORT.icao)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe(RING2_AIRPORT.country)

      await page.goto(ring2Path)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(
        `${copy.ring2Name} (${RING2_AIRPORT.iata}/${RING2_AIRPORT.icao})`,
      )
      await expect(main.locator('.airport-location')).toContainText(copy.ring2Country)
      // Saat dilimi Africa/Cairo (D-084 ülke tablosu): yerel saat ve gün doğumu yazılır.
      const sun = main
        .getByRole('region', { name: copy.weather, exact: true })
        .locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expectLocalClock(
        sun.locator('li').first(),
        `${copy.localTime} `,
        loadedFrom,
        RING2_AIRPORT.timeZone,
      )
    })
  }

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const ring3Path = locale === 'tr' ? RING3_PATH : enPath(RING3_PATH)

    test(`${ring3Path} (3. halka): ad, ülke, yerel saat Viyana’nın; dizine eklenir, JSON-LD ülkesi AT`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, ring3Path)
      expect(response.status(), ring3Path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${ring3Path}: robots`).not.toMatch(/noindex/)
      // Viyana canlı veri çekim alanının dışındadır: başlık ve og:title canlı trafik vaat etmez (D-106).
      const title = `${copy.ring3Name} (${RING3_AIRPORT.iata}/${RING3_AIRPORT.icao}): ${copy.titleOutside}`
      expect(titles(body)[0], `${ring3Path}: <title>`).toBe(`${title} · ${APP_NAME}`)
      expect(metaContents(body, 'og:title'), `${ring3Path}: og:title`).toEqual([title])
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.icaoCode).toBe(RING3_AIRPORT.icao)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe(RING3_AIRPORT.country)

      await page.goto(ring3Path)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(
        `${copy.ring3Name} (${RING3_AIRPORT.iata}/${RING3_AIRPORT.icao})`,
      )
      await expect(main.locator('.airport-location')).toContainText(copy.ring3Country)
      // Viyana'nın notu yoktur (kapanış tablosunda değil, D-110).
      await expect(main.locator('.civil-closure')).toHaveCount(0)
      // Saat dilimi Europe/Vienna (D-084 ülke tablosu): yerel saat ve gün doğumu yazılır.
      const sun = main
        .getByRole('region', { name: copy.weather, exact: true })
        .locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expectLocalClock(
        sun.locator('li').first(),
        `${copy.localTime} `,
        loadedFrom,
        RING3_AIRPORT.timeZone,
      )
    })
  }

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const ring4Path = locale === 'tr' ? RING4_PATH : enPath(RING4_PATH)

    test(`${ring4Path} (4. halka): ad, ülke, yerel saat Londra’nın; dizine eklenir, JSON-LD ülkesi GB`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, ring4Path)
      expect(response.status(), ring4Path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${ring4Path}: robots`).not.toMatch(/noindex/)
      // Londra canlı veri çekim alanının dışındadır: başlık ve og:title canlı trafik vaat etmez (D-106).
      const title = `${copy.ring4Name} (${RING4_AIRPORT.iata}/${RING4_AIRPORT.icao}): ${copy.titleOutside}`
      expect(titles(body)[0], `${ring4Path}: <title>`).toBe(`${title} · ${APP_NAME}`)
      expect(metaContents(body, 'og:title'), `${ring4Path}: og:title`).toEqual([title])
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.icaoCode).toBe(RING4_AIRPORT.icao)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe(RING4_AIRPORT.country)

      await page.goto(ring4Path)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(
        `${copy.ring4Name} (${RING4_AIRPORT.iata}/${RING4_AIRPORT.icao})`,
      )
      await expect(main.locator('.airport-location')).toContainText(copy.ring4Country)
      await expect(main.locator('.civil-closure')).toHaveCount(0)
      // Saat dilimi Europe/London (D-101 ülke tablosu): yerel saat ve gün doğumu yazılır.
      const sun = main
        .getByRole('region', { name: copy.weather, exact: true })
        .locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expectLocalClock(
        sun.locator('li').first(),
        `${copy.localTime} `,
        loadedFrom,
        RING4_AIRPORT.timeZone,
      )
    })
  }

  test('/istasyon/UUOO ve /en/istasyon/UUOO: "Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri)" notu; dizine eklenir (D-110)', async ({
    page,
    request,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      const path = locale === 'tr' ? CLOSURE_PATH : enPath(CLOSURE_PATH)
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${path}: robots`).not.toMatch(/noindex/)

      await page.goto(path)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(
        `(${CIVIL_CLOSURE_AIRPORT.iata}/${CIVIL_CLOSURE_AIRPORT.icao})`,
      )
      // Not başlığın altında, görünür ve ekran okuyucuda not olarak okunur.
      const note = main.getByRole('note')
      await expect(note).toHaveText(COPY[locale].closure)
      await expect(note).toBeVisible()
      await expect(main.locator('header .civil-closure')).toHaveCount(1)
    }
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const path = locale === 'tr' ? WAR_PATH : enPath(WAR_PATH)

    test(`${path} (savaş nedeniyle kapalı, OurAirports'ta tarifesiz): not, yer, başlık canlı trafik vaat etmez, yerel saat Kiev'in; dizine eklenir (D-110)`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${path}: robots`).not.toMatch(/noindex/)
      const title = `${copy.warName} (${WAR_CLOSURE_AIRPORT.iata}/${WAR_CLOSURE_AIRPORT.icao}): ${copy.titleOutside}`
      expect(titles(body)[0], `${path}: <title>`).toBe(`${title} · ${APP_NAME}`)
      expect(metaContents(body, 'og:title'), `${path}: og:title`).toEqual([title])
      const description = metaContents(body, 'description')[0] ?? ''
      // Açıklamanın son cümlesi nottur; çevredeki uçakları vaat etmez.
      expect(description.endsWith(`${copy.closure}.`), `${path}: ${description}`).toBe(true)

      await page.goto(path)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(
        `${copy.warName} (${WAR_CLOSURE_AIRPORT.iata}/${WAR_CLOSURE_AIRPORT.icao})`,
      )
      await expect(main.locator('.airport-location')).toHaveText(copy.warLocation)
      const note = main.getByRole('note')
      await expect(note).toHaveText(copy.closure)
      await expect(note).toBeVisible()
      // Hava durumu fixture'ında raporu yok; yerel saat ve gün doğumu Kiev'in (Europe/Kiev).
      const weather = main.getByRole('region', { name: copy.weather, exact: true })
      await expect(weather).toContainText(copy.noCurrentReport, { timeout: 15_000 })
      const sun = weather.locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expectLocalClock(
        sun.locator('li').first(),
        `${copy.localTime} `,
        loadedFrom,
        WAR_CLOSURE_AIRPORT.timeZone,
      )
    })
  }

  test('belirsiz not (El Faşir), yeniden açılan Krasnodar notsuz; IATA kodu KBP UKBB’ye yönlendirir (D-110)', async ({
    page,
    request,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      const path = `/istasyon/${POSSIBLE_CLOSURE_AIRPORT.icao}`
      await page.goto(locale === 'tr' ? path : enPath(path))
      const note = page.locator('main').getByRole('note')
      await expect(note).toHaveText(COPY[locale].possibleClosure)
    }
    const { response } = await fetchRaw(request, `/istasyon/${REOPENED_AIRPORT.icao}`)
    expect(response.status()).toBe(200)
    await page.goto(`/istasyon/${REOPENED_AIRPORT.icao}`)
    await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main .civil-closure')).toHaveCount(0)
    await expectRedirect(request, `/istasyon/${WAR_CLOSURE_AIRPORT.iata.toLowerCase()}`, WAR_PATH)
    await expectRedirect(request, enPath(`/istasyon/${WAR_CLOSURE_AIRPORT.iata}`), enPath(WAR_PATH))
  })

  test('/havalimanlari: savaş nedeniyle kapalı 35 havalimanının satırında adın altında not (D-110)', async ({
    page,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      const copy = COPY[locale]
      await page.goto(copy.listPath)
      const table = page
        .locator('main')
        .getByRole('table', { name: new RegExp(copy.foreignHeading) })
      await expect(table.locator('.airports-closure')).toHaveCount(CIVIL_CLOSURE_COUNT)
      const kbp = table.locator('tbody tr').filter({ hasText: WAR_CLOSURE_AIRPORT.icao })
      await expect(kbp.locator('th .airports-closure')).toHaveText(copy.closure)
      await expect(kbp.locator('th a')).toHaveText(copy.warName)
      // Türkiye tablosunda not yok.
      await expect(page.locator('main table').first().locator('.airports-closure')).toHaveCount(0)
    }
  })

  test('IATA kodu ve küçük harf yönlendirir; listelenmeyen uzak havalimanı ve ICAO’suz KHX gerçek 404', async ({
    request,
  }) => {
    // 2., 3. ve 4. halka havalimanları da IATA koduyla bulunur (D-088, D-090, D-102).
    await expectRedirect(request, `/istasyon/${RING2_AIRPORT.iata.toLowerCase()}`, RING2_PATH)
    await expectRedirect(request, `/istasyon/${RING3_AIRPORT.iata.toLowerCase()}`, RING3_PATH)
    await expectRedirect(request, `/istasyon/${RING4_AIRPORT.iata.toLowerCase()}`, RING4_PATH)
    await expectRedirect(request, `/istasyon/${RING4_AIRPORT.icao.toLowerCase()}`, RING4_PATH)
    await expectRedirect(
      request,
      `/en/istasyon/${RING4_AIRPORT.iata.toLowerCase()}`,
      enPath(RING4_PATH),
    )
    await expectRedirect(
      request,
      `/en/istasyon/${RING3_AIRPORT.iata.toLowerCase()}`,
      enPath(RING3_PATH),
    )
    await expectRedirect(request, `/istasyon/${iata}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${iata.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${icao.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/en/istasyon/${iata.toLowerCase()}`, enPath(STATION_PATH))
    for (const path of [
      `/istasyon/${UNLISTED_FOREIGN_AIRPORT.icao}`,
      `/istasyon/${UNLISTED_FOREIGN_AIRPORT.iata}`,
      enPath(`/istasyon/${UNLISTED_FOREIGN_AIRPORT.icao}`),
      // Kihihi (D-101): IATA kodu KHX, kanonik kimliği UG-0002; 308 olmadan doğrudan 404
      // (`fetchRaw` yönlendirme izlemez). OurAirports kimliğiyle de sayfa yoktur.
      `/istasyon/${NON_ICAO_AIRPORT.iata}`,
      `/istasyon/${NON_ICAO_AIRPORT.iata.toLowerCase()}`,
      enPath(`/istasyon/${NON_ICAO_AIRPORT.iata}`),
      `/istasyon/${NON_ICAO_AIRPORT.ident}`,
    ]) {
      const { response } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(404)
      expect(response.headers()['location'], path).toBeUndefined()
    }
  })

  test('adres takma adı (D-109): kodu değişen havalimanının eski kodu kanonik adrese 308', async ({
    request,
  }) => {
    const { alias, icao, closedRingAlias, notAlias } = IDENT_ALIAS_AIRPORT
    await expectRedirect(request, `/istasyon/${alias}`, `/istasyon/${icao}`)
    await expectRedirect(request, `/istasyon/${alias.toLowerCase()}`, `/istasyon/${icao}`)
    await expectRedirect(request, enPath(`/istasyon/${alias}`), enPath(`/istasyon/${icao}`))
    // API tek havalimanı ucu da takma adla kanonik kaydı verir ve takma adı yazar.
    const api = await request.get(`${API_URL}/v1/airports/${alias}`)
    expect(api.status()).toBe(200)
    expect(await api.json()).toMatchObject({ icao, identAlias: alias })
    // Halkası kapalı havalimanının takma adı, başka satırın ICAO'su olan kimlik ve askerî liste:
    // yönlendirmesiz 404.
    for (const path of [
      `/istasyon/${closedRingAlias}`,
      `/istasyon/${notAlias}`,
      ...FOREIGN_MILITARY_AIRFIELDS.map((code) => `/istasyon/${code}`),
    ]) {
      const { response } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(404)
      expect(response.headers()['location'], path).toBeUndefined()
    }
    expect((await request.get(`${API_URL}/v1/airports/${notAlias}`)).status()).toBe(404)
  })
})

test.describe('harita: Türkiye dışındaki havalimanı', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: `?havalimani=` uçuşu
  // beklemesiz ve kesin olur (weather.spec.ts ile aynı).
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ selected: 'full', others: 'hidden' }))
    }, LABEL_SETTINGS_KEY)
  })

  test('?havalimani=LGAV Atina’da açar; pin pencereyi açar; pencere il yerine ülkeyi gösterir', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    // Pencerenin hava isteği tek havalimanınındır (D-090): toplu yanıt (`/v1/weather`) istenmez.
    const weatherRequests: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin === API_URL && url.pathname.includes('weather')) {
        weatherRequests.push(`${url.pathname}${url.search}`)
      }
    })
    await page.goto(`/?havalimani=${icao}`)
    await waitForMap(page)
    // Harita Atina'dadır: görünümün ortasına en yakın havalimanı ATH (Türkiye dışındaki pin ve kodu).
    await expect.poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 }).toBe(iata)

    // Pinin başı: ucu havalimanı merkezinde (harita ortası), baş ~15 px yukarıda. Atina'nın
    // çevresinde canlı uçak yoktur (çekim alanı Türkiye'dedir); tıklama havalimanınındır.
    const popup = mapPopup(page)
    const center = await mapCenter(page)
    await expect(async () => {
      await page.mouse.click(center.x, center.y - 13)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup).toContainText(`${iata} · ${icao}`)
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.tr.country)
    // Yerel saat Atina'nındır, UTC farkıyla: "23:05 (UTC+2)" (D-084).
    await expectLocalClock(row(popup, COPY.tr.localTime), '', loadedFrom)
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      STATION_PATH,
    )
    // Hava durumu tek havalimanı isteğinden gelir (`/v1/airports/LGAV/weather`, D-090).
    const weather = popup.getByRole('region', { name: COPY.tr.weather })
    await expect(row(weather, COPY.tr.wind)).toContainText(COPY.tr.speedUnit, { timeout: 15_000 })
    await expect(weather).toContainText(COPY.tr.observed)
    expect(weatherRequests).toContain(`/v1/airports/${icao}/weather`)
    expect(weatherRequests.filter((path) => path.startsWith('/v1/weather'))).toEqual([])
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  test('İngilizce: "Airports" listesinden klavyeyle açılır; ülke Greece, bağlantı /en altında', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(enPath(`/?havalimani=${icao}`))
    await waitForMap(page)
    await expect
      .poll(async () => (await airportListCodes(page, COPY.en.listButton))[0], { timeout: 30_000 })
      .toBe(iata)
    const toggle = page.getByRole('button', { name: COPY.en.listButton, exact: true })
    await toggle.focus()
    await page.keyboard.press('Enter')
    const item = page.getByRole('button', { name: new RegExp(`^${iata}\\b`) })
    await item.focus()
    await page.keyboard.press('Enter')
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toBeFocused()
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.en.country)
    await expectLocalClock(row(popup, COPY.en.localTime), '', loadedFrom)
    await expect(popup.getByRole('link', { name: /Airport page/ })).toHaveAttribute(
      'href',
      enPath(STATION_PATH),
    )
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('2. halka: ?havalimani=HECA Kahire’de açar; listeden açılan pencere Mısır’ı ve Kahire’nin saatini gösterir (D-088)', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(`/?havalimani=${RING2_AIRPORT.icao}`)
    await waitForMap(page)
    // Harita Kahire'dedir: görünümün ortasına en yakın havalimanı CAI (2. halkanın pini ve kodu;
    // Kahire Başkent ve Gize Sfenks havalimanları da yakındadır).
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe(RING2_AIRPORT.iata)
    const toggle = page.getByRole('button', { name: COPY.tr.listButton, exact: true })
    await toggle.click()
    await page.getByRole('button', { name: new RegExp(`^${RING2_AIRPORT.iata}\\b`) }).click()
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', RING2_AIRPORT.icao)
    await expect(popup).toContainText(`${RING2_AIRPORT.iata} · ${RING2_AIRPORT.icao}`)
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.tr.ring2Country)
    await expectLocalClock(row(popup, COPY.tr.localTime), '', loadedFrom, RING2_AIRPORT.timeZone)
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      RING2_PATH,
    )
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  test('3. halka: ?havalimani=LOWW Viyana’da açar; listeden açılan pencere Avusturya’yı ve Viyana’nın saatini gösterir (D-090)', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(enPath(`/?havalimani=${RING3_AIRPORT.icao}`))
    await waitForMap(page)
    // Harita Viyana'dadır: görünümün ortasına en yakın havalimanı VIE (Bratislava ~48 km uzakta).
    await expect
      .poll(async () => (await airportListCodes(page, COPY.en.listButton))[0], { timeout: 30_000 })
      .toBe(RING3_AIRPORT.iata)
    const toggle = page.getByRole('button', { name: COPY.en.listButton, exact: true })
    await toggle.click()
    await page.getByRole('button', { name: new RegExp(`^${RING3_AIRPORT.iata}\\b`) }).click()
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', RING3_AIRPORT.icao)
    await expect(popup).toContainText(`${RING3_AIRPORT.iata} · ${RING3_AIRPORT.icao}`)
    await expect(popup.getByRole('heading', { name: RING3_AIRPORT.nameEn })).toBeVisible()
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.en.ring3Country)
    await expect(popup.getByRole('note')).toHaveCount(0)
    await expectLocalClock(row(popup, COPY.en.localTime), '', loadedFrom, RING3_AIRPORT.timeZone)
    await expect(popup.getByRole('link', { name: /Airport page/ })).toHaveAttribute(
      'href',
      enPath(RING3_PATH),
    )
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  test('4. halka: ?havalimani=EGLL Londra’da açar; listeden açılan pencere Birleşik Krallık’ı ve Londra’nın saatini gösterir (D-102)', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(`/?havalimani=${RING4_AIRPORT.icao}`)
    await waitForMap(page)
    // Harita Londra'dadır: görünümün ortasına en yakın havalimanı LHR (London City ~36 km, Gatwick
    // ~41 km uzakta).
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe(RING4_AIRPORT.iata)
    const toggle = page.getByRole('button', { name: COPY.tr.listButton, exact: true })
    await toggle.click()
    await page.getByRole('button', { name: new RegExp(`^${RING4_AIRPORT.iata}\\b`) }).click()
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', RING4_AIRPORT.icao)
    await expect(popup).toContainText(`${RING4_AIRPORT.iata} · ${RING4_AIRPORT.icao}`)
    await expect(popup.getByRole('heading', { name: RING4_AIRPORT.nameTr })).toBeVisible()
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.tr.ring4Country)
    await expect(popup.getByRole('note')).toHaveCount(0)
    await expectLocalClock(row(popup, COPY.tr.localTime), '', loadedFrom, RING4_AIRPORT.timeZone)
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      RING4_PATH,
    )
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })
})

test.describe('harita: savaş nedeniyle kapalı havalimanı (D-110)', () => {
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ selected: 'full', others: 'hidden' }))
    }, LABEL_SETTINGS_KEY)
  })

  test('?havalimani=UKOO Odessa’da açar; listeden açılan pencere savaş notunu ve raporsuz havayı gösterir', async ({
    page,
  }) => {
    await page.goto(`/?havalimani=${MAP_CLOSURE_AIRPORT.icao}`)
    await waitForMap(page)
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe(MAP_CLOSURE_AIRPORT.iata)
    const toggle = page.getByRole('button', { name: COPY.tr.listButton, exact: true })
    await toggle.click()
    await page.getByRole('button', { name: new RegExp(`^${MAP_CLOSURE_AIRPORT.iata}\\b`) }).click()
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', MAP_CLOSURE_AIRPORT.icao)
    await expect(popup.getByRole('note')).toHaveText(COPY.tr.closure)
    await expect(popup).toContainText(COPY.tr.popupNoReport, { timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })
})

test.describe('yerel saat yardımcısı', () => {
  test('zoneClocks: Londra kışın "UTC" (fark yazılmaz), yazın "UTC+1"; Atina "UTC+2/+3" (D-102)', () => {
    const at = (iso: string) => Date.parse(iso)
    const once = (timeZone: string, iso: string) => zoneClocks(timeZone, at(iso), at(iso))
    expect(once('Europe/London', '2026-12-06T09:05:00Z')).toEqual(['09:05 (UTC)'])
    expect(once('Europe/London', '2026-07-06T09:05:00Z')).toEqual(['10:05 (UTC+1)'])
    expect(once('Europe/Athens', '2026-12-06T09:05:00Z')).toEqual(['11:05 (UTC+2)'])
    expect(once('Europe/Athens', '2026-07-06T09:05:00Z')).toEqual(['12:05 (UTC+3)'])
  })
})

/**
 * Dilimin (Atina, Kahire, Londra) `from`'dan şimdiye her dakikadaki yerel saati ve UTC farkı ("23:05
 * (UTC+2)"), Node'un `Intl`'iyle. Fark koda gömülmez: test yaz saati (UTC+3) ve kış saati (UTC+2)
 * günlerinde, geçiş anında (Atina 25 Ekim 2026 01:00 UTC, Kahire 29 Ekim 2026 21:00 UTC) bile aynı
 * biçimde deterministiktir.
 */
function zoneClocks(timeZone: string, from: number, to: number): string[] {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  })
  const values = new Set<string>()
  for (let at = from - (from % 60_000); at <= to; at += 60_000) {
    const parts = new Map(format.formatToParts(at).map((part) => [part.type, part.value]))
    // ICU 78 sıfır farkı "GMT+0" yazar (eski sürümler "GMT"); sayfa "UTC" yazar (`utcOffsetLabel(0)`).
    const offset = (parts.get('timeZoneName') ?? '')
      .replace(/^GMT(?:[+-]0)?$/, 'UTC')
      .replace('GMT', 'UTC')
    values.add(`${parts.get('hour')}:${parts.get('minute')} (${offset})`)
  }
  return [...values]
}

/**
 * Öğe `prefix` + havalimanının yerel saatini UTC farkıyla yazar ("Yerel saat 23:05 (UTC+2)"; dilim
 * verilmezse Atina). Sayfa saati çizim anından (sunucu) ya da 30 sn adımlı ada saatinden gelir:
 * beklenen değerler sayfanın istendiği andan (`from`, 30 sn pay) okuma anına kadarki dakikalardır.
 * Atina ve Kahire yazın UTC+3, kışın UTC+2'dir; Viyana yazın UTC+2, kışın UTC+1 (D-090); Londra
 * yazın UTC+1, kışın UTC (fark yazılmaz: "09:05 (UTC)"; D-102).
 */
async function expectLocalClock(
  locator: Locator,
  prefix: string,
  from: number,
  timeZone: string = ATHENS_TIME_ZONE,
): Promise<void> {
  await expect(locator).toHaveText(
    new RegExp(`^\\s*${prefix}\\d{2}:\\d{2} \\(UTC(?:\\+[1-3])?\\)\\s*$`),
  )
  const shown = ((await locator.textContent()) ?? '').trim()
  const expected = zoneClocks(timeZone, from - 31_000, Date.now() + 2_000).map(
    (value) => prefix + value,
  )
  expect(expected, `yerel saat (${timeZone}): ${shown}`).toContain(shown)
}

function mapPopup(page: Page): Locator {
  return page.locator('.live-map [role="dialog"].map-popup')
}
