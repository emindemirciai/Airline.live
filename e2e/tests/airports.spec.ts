// Havalimanı sayfaları (Parça 1 M6b, D-076): /havalimanlari listesi ve /istasyon/<ICAO> sayfaları,
// veritabanındaki OurAirports verisinden ve resmî ad tablosundan sunucuda çizilir. Kod adreste büyük
// harfli ICAO'dur: küçük harf ya da IATA kodu kalıcı yönlendirmeyle ona gider, bilinmeyen kod gerçek
// 404 döner (akış başlamadan; yumuşak 404 yok). "Canlı haritada aç" haritayı havalimanında açar.
import { expect, test } from '@playwright/test'
import { jsonLdNodes, metaContents, nodesOfType, titles, type JsonLdNode } from '../html'
import {
  AIRPORT_COUNT,
  aircraftRow,
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

  test('liste sayfası: bütün havalimanları sıralı ItemList’te', async ({ request }) => {
    const { response, body } = await fetchRaw(request, '/havalimanlari')
    expect(response.status()).toBe(200)
    const items = listElements(nodesOfType(jsonLdNodes(body), 'ItemList')[0])
    expect(items).toHaveLength(AIRPORT_COUNT)
    expect(items.map((item) => item.position)).toEqual(
      Array.from({ length: AIRPORT_COUNT }, (_, i) => i + 1),
    )
    const paths = items.map((item, i) => sitePath(listItemUrl(item), `ListItem ${i + 1}`))
    expect(paths.every((path) => /^\/istasyon\/[A-Z0-9]{4}$/.test(path))).toBe(true)
    expect(new Set(paths).size).toBe(AIRPORT_COUNT)
    expect(paths).toContain(STATION_PATH)
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
    const table = page.locator('main table')
    await expect(table).toHaveCount(1)
    await expect(table.locator('caption')).not.toBeEmpty()
    await expect(table.locator('tbody tr')).toHaveCount(AIRPORT_COUNT)
    await expect(table.locator('tbody tr:has(a[href^="/istasyon/"])')).toHaveCount(AIRPORT_COUNT)

    await table.locator(`a[href="${STATION_PATH}"]`).first().click()
    await expect(page).toHaveURL(`${WEB_URL}${STATION_PATH}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `${PRIMARY_AIRPORT.nameTr} (${iata}/${icao})`,
    )
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
    await expect(table.locator('tbody tr')).toHaveCount(AIRPORT_COUNT)
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

  test('klavye odak halkası iki temada da zemine karşı en az 3:1 kontrastlıdır', async ({
    page,
  }) => {
    // WCAG 2.1 SC 1.4.11 (odak göstergesi); açık temada sarı işaret rengi 1,6:1 kalırdı.
    const targets: [string, string][] = [
      ['/havalimanlari', 'main .table-wrap'],
      ['/havalimanlari', 'main nav a'],
      [STATION_PATH, `main a[href="/?havalimani=${icao}"]`],
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
          return {
            focusVisible: element.matches(':focus-visible'),
            outlineStyle: computed.outlineStyle,
            outlineWidth: Number.parseFloat(computed.outlineWidth),
            outline: computed.outlineColor,
            backgrounds: [getComputedStyle(document.body).backgroundColor, surface],
          }
        })
        const label = `${colorScheme} ${path} ${selector}`
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
