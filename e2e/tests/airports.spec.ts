// Havalimanı sayfaları (Parça 1 M6b, D-076): /havalimanlari listesi ve /istasyon/<ICAO> sayfaları,
// veritabanındaki OurAirports verisinden ve resmî ad tablosundan sunucuda çizilir. Kod adreste büyük
// harfli ICAO'dur: küçük harf ya da IATA kodu kalıcı yönlendirmeyle ona gider, bilinmeyen kod gerçek
// 404 döner (akış başlamadan; yumuşak 404 yok). "Canlı haritada aç" haritayı havalimanında açar.
// Liste Türkiye tablosuyla başlar, ardından Türkiye dışındakilerin tablosu gelir (M6d, D-080);
// onların sayfalarının ayrıntısı foreign-airports.spec.ts'tedir.
import { expect, test } from '@playwright/test'
import { jsonLdNodes, metaContents, nodesOfType, titles, type JsonLdNode } from '../html'
import {
  AIRPORT_COUNT,
  API_URL,
  aircraftRow,
  FOREIGN_AIRPORT_COUNT,
  LISTED_AIRPORT_COUNT,
  MILITARY_AIRFIELDS,
  RING1_AIRPORT,
  airportListCodes,
  declineAnalytics,
  enPath,
  expectRedirect,
  fetchRaw,
  PRIMARY_AIRPORT,
  PRIMARY_AIRPORT_NEIGHBOURS,
  sitePath,
  TAXI_AIRCRAFT,
  waitForMap,
  WEB_URL,
} from '../support'

const { icao, iata } = PRIMARY_AIRPORT
const STATION_PATH = `/istasyon/${icao}`

/**
 * DHMİ listesinde olmayan sivil alanın adı (kullanıcı isteği ve kararı 2026-10-03, D-084): Ankara
 * (Etimesgut), bakanlığın verdiği ad (packages/shared/src/reference/airport-names.ts). Aynı karardaki
 * beş askerî hava üssü D-107'den beri listelenmez (aşağıda).
 */
const RENAMED_AIRPORTS = [
  {
    icao: 'LTAD',
    iata: 'ANK',
    tr: 'Ankara (Etimesgut) Havalimanı',
    en: 'Ankara (Etimesgut) Airport',
  },
] as const

function isRecord(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** ListItem'ın gösterdiği adres: `item` (metin ya da düğüm) veya `url`. */
function listItemUrl(item: JsonLdNode): string | undefined {
  if (typeof item.item === 'string') return item.item
  if (isRecord(item.item)) {
    const nested = item.item.url ?? item.item['@id']
    if (typeof nested === 'string') return nested
  }
  return typeof item.url === 'string' ? item.url : undefined
}

function listElements(node: JsonLdNode | undefined): JsonLdNode[] {
  const elements = node?.itemListElement
  return Array.isArray(elements) ? elements.filter(isRecord) : []
}

test.describe('adres biçimi', () => {
  test('küçük harfli ICAO ve IATA kodu kalıcı yönlendirmeyle büyük harfli ICAO’ya gider', async ({
    request,
  }) => {
    await expectRedirect(request, `/istasyon/${icao.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${iata}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${iata.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/en/istasyon/${iata.toLowerCase()}`, enPath(STATION_PATH))
    await expectRedirect(request, `/en/istasyon/${icao.toLowerCase()}`, enPath(STATION_PATH))
  })

  test('bilinmeyen ya da hatalı kod gerçek 404 döner', async ({ request, page }) => {
    for (const path of [
      '/istasyon/ZZZZ',
      '/istasyon/ZZZ',
      '/istasyon/LTF-',
      '/istasyon/LTFMX',
      '/en/istasyon/ZZZZ',
    ]) {
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(404)
      // notFound() sayfa çiziminde fırlatıldığında Next sunucu HTML'i olarak boş bir hata kabuğu
      // (`<html id="__next_error__">`, `lang` yok) gönderir; 404 sayfasını istemci çizer. Dil bu
      // yüzden ham yanıtta <title>'dan, tarayıcıda `<html lang>`'dan denetlenir.
      expect(metaContents(body, 'robots').join(', '), `${path}: robots`).toContain('noindex')
      expect(titles(body)[0], `${path}: <title>`).toMatch(
        path.startsWith('/en/') ? /^Page not found(?:\s|$)/ : /^Sayfa bulunamadı(?:\s|$)/,
      )
    }

    const response = await page.goto(enPath('/istasyon/ZZZZ'))
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  })
})

test.describe('yapılandırılmış veri', () => {
  test('havalimanı sayfası: Airport, WebPage ve sıralı BreadcrumbList', async ({ request }) => {
    for (const locale of ['tr', 'en'] as const) {
      const path = locale === 'tr' ? STATION_PATH : enPath(STATION_PATH)
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      const nodes = jsonLdNodes(body)

      const airport = nodesOfType(nodes, 'Airport')[0]
      expect(airport, `${path}: Airport`).toBeDefined()
      expect(airport?.iataCode).toBe(iata)
      expect(airport?.icaoCode).toBe(icao)
      // Ad sayfanın dilindeki görünen addır (işaretlenen değer sayfada da görünür).
      expect(airport?.name).toBe(locale === 'tr' ? PRIMARY_AIRPORT.nameTr : PRIMARY_AIRPORT.nameEn)
      const geo = isRecord(airport?.geo) ? airport.geo : {}
      // Havalimanı merkezi İstanbul'un kuzeyinde; rakım metre cinsinden yalın sayıdır (schema.org).
      expect(typeof geo.latitude).toBe('number')
      expect(typeof geo.longitude).toBe('number')
      expect(typeof geo.elevation).toBe('number')
      expect(geo.latitude as number).toBeGreaterThan(41.1)
      expect(geo.latitude as number).toBeLessThan(41.4)
      expect(geo.longitude as number).toBeGreaterThan(28.5)
      expect(geo.longitude as number).toBeLessThan(29)
      expect(geo.elevation as number).toBeGreaterThan(0)
      expect(geo.elevation as number).toBeLessThan(200)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe('TR')

      const page = nodesOfType(nodes, 'WebPage')[0]
      expect(page?.inLanguage).toBe(locale)
      expect(Number.isNaN(Date.parse(String(page?.dateModified))), 'WebPage.dateModified').toBe(
        false,
      )

      const crumbs = listElements(nodesOfType(nodes, 'BreadcrumbList')[0])
      expect(crumbs.map((crumb) => crumb.position)).toEqual([1, 2, 3])
      const crumbPaths = crumbs
        .map(listItemUrl)
        .map((url, i) => (url === undefined ? undefined : sitePath(url, `breadcrumb ${i + 1}`)))
      const prefix = locale === 'en' ? '/en' : ''
      expect(crumbPaths[0]).toBe(prefix || '/')
      expect(crumbPaths[1]).toBe(`${prefix}/havalimanlari`)
      // Son öğe sayfanın kendisidir; adresi yazılmayabilir.
      if (crumbPaths[2] !== undefined) expect(crumbPaths[2]).toBe(`${prefix}${STATION_PATH}`)
    }
  })

  test('liste sayfası: iki tablodaki bütün havalimanları görünen sırayla ItemList’te', async ({
    request,
  }) => {
    const { response, body } = await fetchRaw(request, '/havalimanlari')
    expect(response.status()).toBe(200)
    const items = listElements(nodesOfType(jsonLdNodes(body), 'ItemList')[0])
    expect(items).toHaveLength(LISTED_AIRPORT_COUNT)
    expect(items.map((item) => item.position)).toEqual(
      Array.from({ length: LISTED_AIRPORT_COUNT }, (_, i) => i + 1),
    )
    const paths = items.map((item, i) => sitePath(listItemUrl(item), `ListItem ${i + 1}`))
    expect(paths.every((path) => /^\/istasyon\/[A-Z0-9]{4}$/.test(path))).toBe(true)
    expect(new Set(paths).size).toBe(LISTED_AIRPORT_COUNT)
    expect(paths).toContain(STATION_PATH)
    // Önce Türkiye tablosu, sonra Türkiye dışındakiler (D-080): Atina ilk 56 öğenin içinde değildir.
    expect(paths.indexOf(`/istasyon/${RING1_AIRPORT.icao}`)).toBeGreaterThanOrEqual(AIRPORT_COUNT)
  })
})

test.describe('tarayıcıda', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  test('/havalimanlari bütün havalimanlarını tabloda listeler; satır sayfayı açar', async ({
    page,
  }) => {
    await page.goto('/havalimanlari')
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Önce Türkiye, sonra Türkiye dışındakiler (M6d, D-080): iki gerçek tablo, ikisinin de başlığı var.
    const tables = page.locator('main table')
    await expect(tables).toHaveCount(2)
    for (const caption of await tables.locator('caption').all())
      await expect(caption).not.toBeEmpty()
    const table = tables.first()
    await expect(table.locator('tbody tr')).toHaveCount(AIRPORT_COUNT)
    await expect(table.locator('tbody tr:has(a[href^="/istasyon/"])')).toHaveCount(AIRPORT_COUNT)
    await expect(tables.nth(1).locator('tbody tr')).toHaveCount(FOREIGN_AIRPORT_COUNT)

    await table.locator(`a[href="${STATION_PATH}"]`).first().click()
    await expect(page).toHaveURL(`${WEB_URL}${STATION_PATH}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `${PRIMARY_AIRPORT.nameTr} (${iata}/${icao})`,
    )
  })

  test('başlıktaki logo (D-086): işaret süstür, bağlantının adı yalnızca yazı; maske kendi kimliğiyle', async ({
    page,
  }) => {
    await page.goto('/havalimanlari')
    const brand = page.locator('header.site-header a.brand')
    await expect(brand).toHaveCount(1)
    // Başlıkta adı yalnızca 'havayolu' olan tek bağlantı; işaret ada bir şey eklemez (sayfadaki yol
    // bağlantısı da 'havayolu' adını taşır, o yüzden başlıkla sınırlanır).
    await expect(
      page.locator('header.site-header').getByRole('link', { name: 'havayolu', exact: true }),
    ).toHaveCount(1)
    await expect(brand).toHaveAccessibleName('havayolu')
    const mark = brand.locator('svg.brand-mark')
    await expect(mark).toHaveAttribute('aria-hidden', 'true')
    const box = await mark.boundingBox()
    // 16 px yazının 1,5 katı.
    expect(box?.width).toBeCloseTo(24, 0)
    expect(box?.height).toBeCloseTo(24, 0)
    const masks = await mark.evaluate((svg) => {
      const reference = svg.querySelector('circle')?.getAttribute('mask') ?? ''
      const id = /^url\(#(.+)\)$/.exec(reference)?.[1] ?? ''
      return {
        id,
        found: id !== '' && document.getElementById(id)?.tagName.toLowerCase() === 'mask',
        sameId: document.querySelectorAll(`[id="${id}"]`).length,
      }
    })
    expect(masks.found, masks.id).toBe(true)
    expect(masks.sameId).toBe(1)
  })

  test('havalimanı sayfası: yol, pist tablosu, yakın havalimanları, sınırlar', async ({ page }) => {
    await page.goto(STATION_PATH)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1 })).toContainText(`(${iata}/${icao})`)
    // Görünür yol: havayolu › Havalimanları › İstanbul Havalimanı.
    await expect(main.locator('nav:has(a[href="/havalimanlari"])')).toHaveCount(1)

    // Pist tablosu: her pist bir satır (LTFM'de 6), başlıklı gerçek tablo.
    const runways = main.locator('table').filter({ hasText: '35L' })
    await expect(runways).toHaveCount(1)
    await expect(runways.locator('caption')).not.toBeEmpty()
    await expect(runways.locator('tbody tr')).toHaveCount(PRIMARY_AIRPORT.runways)

    for (const neighbour of PRIMARY_AIRPORT_NEIGHBOURS) {
      await expect(main.locator(`a[href="/istasyon/${neighbour}"]`).first()).toBeVisible()
    }
    // "Sefer sayısı, rötar ve iptal" bölümü ADS-B'nin sınırları için yöntem sayfasına bağlanır (M6c).
    await expect(main.locator('a[href="/hakkinda"]').first()).toBeVisible()
  })

  test('"Canlı haritada aç" haritayı havalimanının çevresinde açar (açılış görünümü IST’nin yerine)', async ({
    page,
  }) => {
    // Açılış görünümü IST olduğundan (D-079) başka bir havalimanıyla denenir: Esenboğa.
    await page.goto('/istasyon/LTAC')
    await page.locator('main a[href="/?havalimani=LTAC"]').click()
    await page.waitForURL((url) => url.pathname === '/')
    await waitForMap(page)
    // Harita ESB'dedir: görünümün ortasına en yakın havalimanı ESB, LTFM'deki taksi uçağı görünmez.
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe('ESB')
    await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toHaveCount(0, { timeout: 30_000 })
  })

  test('İngilizce liste ve havalimanı sayfası /en altında kalır', async ({ page }) => {
    await page.goto('/en/havalimanlari')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const table = page.locator('main table')
    await expect(table.first().locator('tbody tr')).toHaveCount(AIRPORT_COUNT)
    await expect(table.locator('tbody tr')).toHaveCount(LISTED_AIRPORT_COUNT)
    await expect(table.locator('a[href^="/istasyon/"]')).toHaveCount(0)

    await table
      .locator(`a[href="${enPath(STATION_PATH)}"]`)
      .first()
      .click()
    await expect(page).toHaveURL(`${WEB_URL}${enPath(STATION_PATH)}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator(`main a[href="/en?havalimani=${icao}"]`)).toBeVisible()
    for (const neighbour of PRIMARY_AIRPORT_NEIGHBOURS) {
      await expect(page.locator(`main a[href="/en/istasyon/${neighbour}"]`).first()).toBeVisible()
    }
  })

  test('Ankara (Etimesgut) iki dilde adlanır (D-084); Atina’nın en yakını İzmir Adnan Menderes, askerî üs değil (D-107)', async ({
    page,
  }) => {
    // Önceden iki dilde OurAirports adıyla yazılıyordu ("Etimesgut Air Base").
    for (const { icao: code, iata: codeIata, tr, en } of RENAMED_AIRPORTS) {
      for (const [locale, name] of [
        ['tr', tr],
        ['en', en],
      ] as const) {
        const path = locale === 'tr' ? `/istasyon/${code}` : enPath(`/istasyon/${code}`)
        await page.goto(path)
        const main = page.locator('main')
        await expect(main.getByRole('heading', { level: 1 }), path).toHaveText(
          `${name} (${codeIata}/${code})`,
        )
        expect(await page.title(), path).toContain(name)
        // Başka dilde olduğu `lang` ile işaretlenen ögeler (OurAirports'taki ad, İngilizce sayfada
        // resmî Türkçe ad) ve JSON-LD (`alternateName` OurAirports adıdır) dışında sayfada öbür
        // dilin cins adı yoktur.
        const own = await main.evaluate((node) => {
          const copy = node.cloneNode(true) as HTMLElement
          for (const tagged of copy.querySelectorAll('[lang], script')) tagged.remove()
          return copy.textContent ?? ''
        })
        expect(own, path).not.toMatch(
          locale === 'tr' ? /\b(Air Base|Airbase|Airport)\b/ : /Havalimanı|Hava Üssü/,
        )
      }
    }
    // v0.22.1'e kadar Atina, Sakız ve Kalamata'nın satırı Çiğli Hava Üssü'nü gösteriyordu (275 km).
    for (const [path, label, link, name] of [
      [
        `/istasyon/${RING1_AIRPORT.icao}`,
        'Türkiye’deki en yakın havalimanı',
        '/istasyon/LTBJ',
        'İzmir Adnan Menderes Havalimanı (ADB)',
      ],
      [
        enPath(`/istasyon/${RING1_AIRPORT.icao}`),
        'Nearest airport in Türkiye',
        '/en/istasyon/LTBJ',
        'Izmir Adnan Menderes Airport (ADB)',
      ],
    ] as const) {
      await page.goto(path)
      const fact = page
        .locator('main dt', { hasText: label })
        .locator('xpath=following-sibling::dd[1]')
      await expect(fact.locator(`a[href="${link}"]`), path).toHaveText(name)
      await expect(fact, path).toContainText(/\b284 km\b/)
      await expect(page.locator('main'), path).not.toContainText(/Hava Üssü|Air Base|Airbase/)
    }
  })

  test('askerî hava üsleri hiçbir yerde yok (D-107): liste, sayfa, en yakınlar, API', async ({
    page,
    request,
  }) => {
    for (const path of ['/havalimanlari', enPath('/havalimanlari')]) {
      await page.goto(path)
      const main = page.locator('main')
      await expect(main.locator('table').first().locator('tbody tr')).toHaveCount(AIRPORT_COUNT)
      for (const { icao: code, iata: codeIata, tr, en } of MILITARY_AIRFIELDS) {
        await expect(main.locator(`a[href$="/istasyon/${code}"]`), `${path} ${code}`).toHaveCount(0)
        await expect(main, `${path} ${codeIata}`).not.toContainText(
          new RegExp(`\\b${codeIata}\\b|${tr} Hava Üssü|${en} Air Base`),
        )
      }
    }
    // Sayfası yok: ICAO ve IATA adresi 404, yönlenme yok (seo.spec.ts iki dili de sınar).
    for (const { icao: code, iata: codeIata } of MILITARY_AIRFIELDS) {
      for (const path of [`/istasyon/${code}`, `/istasyon/${codeIata}`]) {
        const { response } = await fetchRaw(request, path)
        expect(response.status(), path).toBe(404)
      }
    }
    // API: listelerde yok; tek havalimanı, güncel hava ve kayıt 404 airport_not_found.
    const listed = (await (await request.get(`${API_URL}/v1/airports?scope=listed`)).json()) as {
      airports: { icao: string; iata: string; country: string }[]
    }
    const turkey = (await (await request.get(`${API_URL}/v1/airports?country=TR`)).json()) as {
      airports: { icao: string }[]
    }
    expect(listed.airports.filter((a) => a.country === 'TR')).toHaveLength(AIRPORT_COUNT)
    for (const { icao: code, iata: codeIata } of MILITARY_AIRFIELDS) {
      expect(
        listed.airports.map((a) => a.icao),
        code,
      ).not.toContain(code)
      expect(
        listed.airports.map((a) => a.iata),
        codeIata,
      ).not.toContain(codeIata)
      expect(
        turkey.airports.map((a) => a.icao),
        code,
      ).not.toContain(code)
      for (const path of [
        `/v1/airports/${code}`,
        `/v1/airports/${codeIata}`,
        `/v1/airports/${code}/weather`,
        `/v1/airports/${codeIata}/weather/history`,
      ]) {
        const response = await request.get(`${API_URL}${path}`, { failOnStatusCode: false })
        expect(response.status(), path).toBe(404)
        expect(((await response.json()) as { error?: unknown }).error, path).toBe(
          'airport_not_found',
        )
      }
    }
    // v0.22.1'de üssü "En yakın havalimanları"nda ya da aynı il cümlesinde gösteren sayfalar.
    for (const code of ['LTBJ', 'LTBY', 'LTBF', 'LTFD', 'LGHI']) {
      const path = `/istasyon/${code}`
      await page.goto(path)
      for (const { icao: base } of MILITARY_AIRFIELDS) {
        await expect(
          page.locator(`main a[href="/istasyon/${base}"]`),
          `${path} ${base}`,
        ).toHaveCount(0)
      }
      await expect(page.locator('main'), path).not.toContainText(/Hava Üssü/)
    }
  })

  test.describe('dar ekran', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    test('liste ve havalimanı sayfası 320 px’te yatay kaymaz', async ({ page }) => {
      for (const path of ['/havalimanlari', STATION_PATH]) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, path).toBeLessThanOrEqual(0)
      }
    })
  })

  test('klavye odak halkası zemine karşı en az 3:1 kontrastlıdır; koyu tercih temayı değiştirmez', async ({
    page,
  }) => {
    // WCAG 2.1 SC 1.4.11 (odak göstergesi). "Açık turkuaz" tek temadır (D-081): halka sayfa ve panel
    // zemininde #0a6e78'dir (5,45 ve 5,98:1), başlık şeridinde beyazdır (4,57:1). Sarı işaret rengi
    // açık zeminde 1,6:1 kalırdı.
    const targets: [string, string][] = [
      ['/havalimanlari', 'main .table-wrap'],
      ['/havalimanlari', 'main nav a'],
      [STATION_PATH, `main a[href="/?havalimani=${icao}"]`],
      ['/havalimanlari', 'header.site-header nav a'],
    ]
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (const [path, selector] of targets) {
        await page.goto(path)
        // Klavye kullanımı: sonraki odak da `:focus-visible` sayılır.
        await page.keyboard.press('Tab')
        const target = page.locator(selector).first()
        await target.focus()
        const style = await target.evaluate((element) => {
          // Kart ve tablo zemini (`--surface`): değişken rengi hesaplanmış `rgb()` olarak okunur.
          const probe = document.createElement('div')
          probe.style.backgroundColor = 'var(--surface)'
          document.body.append(probe)
          const surface = getComputedStyle(probe).backgroundColor
          probe.remove()
          const computed = getComputedStyle(element)
          const pageBackground = getComputedStyle(document.body).backgroundColor
          // Başlık şeridindeki bağlantının zemini şerittir; diğerleri sayfa ve panel zeminindedir.
          const header = element.closest('.site-header')
          return {
            focusVisible: element.matches(':focus-visible'),
            outlineStyle: computed.outlineStyle,
            outlineWidth: Number.parseFloat(computed.outlineWidth),
            outline: computed.outlineColor,
            pageBackground,
            backgrounds: header
              ? [getComputedStyle(header).backgroundColor]
              : [pageBackground, surface],
          }
        })
        const label = `${colorScheme} ${path} ${selector}`
        // Tek tema: koyu tercihte de sayfa zemini açık turkuazdır (#eaf7f8).
        expect(style.pageBackground, label).toBe('rgb(234, 247, 248)')
        expect(style.focusVisible, label).toBe(true)
        expect(style.outlineStyle, label).toBe('solid')
        expect(style.outlineWidth, label).toBeGreaterThanOrEqual(2)
        for (const background of style.backgrounds) {
          expect(
            contrastRatio(style.outline, background),
            `${label} / ${background}`,
          ).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })
})

/** `rgb(…)`, `rgba(…)` ya da `#rrggbb` → [r, g, b] (0–255). */
function parseColor(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim())
  if (hex)
    return [1, 2, 3].map((i) => Number.parseInt(hex[i] ?? '0', 16)) as [number, number, number]
  const rgb = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value)
  if (!rgb) throw new Error(`unparsed colour: ${value}`)
  return [1, 2, 3].map((i) => Number(rgb[i])) as [number, number, number]
}

/** WCAG 2.1 bağıl parlaklık ve kontrast oranı. */
function contrastRatio(a: string, b: string): number {
  const luminance = (colour: string) => {
    const [r, g, bl] = parseColor(colour).map((channel) => {
      const c = channel / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}
