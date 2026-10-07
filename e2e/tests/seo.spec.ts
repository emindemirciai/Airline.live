// Keşfedilebilirlik (Parça 1 M6b, D-076). Arama motorları ve yapay zekâ tarayıcıları sayfayı çoğunlukla
// JavaScript çalıştırmadan okur; testler bu yüzden `request` ile alınan ham yanıtı denetler:
// - her genel sayfa ve `/en` ikizi: 200, doğru `<html lang>`, beklenen başlık, tek ve kendini gösteren
//   mutlak canonical, karşılıklı tr/en/x-default hreflang (x-default İngilizce), hepsi `<head>` içinde
//   (GPTBot User-Agent'ıyla da; `htmlLimitedBots`); ayrıştırılabilir JSON-LD sayfa gövdesindedir
//   (`<main>`; React satır içi JSON-LD betiğini `<head>`'e taşımaz)
// - noindex kuralları: /durum, admin; askerî hava üsleri 404 (D-107; istasyon sayfasının noindex
//   bağlantısı birim testindedir: airport-metadata.test.ts); sorgulu adreslerin canonical'ı
//   sorgusuzdur
// - kök dosyalar: robots.txt, sitemap.xml, llms.txt, manifest, ikonlar, OG görselleri
// - X-Robots-Tag: web'in /api/* yolları ve API host'unun bütün yanıtları
import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  headOf,
  hreflangs,
  htmlLang,
  jsonLdBlocks,
  jsonLdNodes,
  linksByRel,
  markdownLinks,
  metaContents,
  nodesOfType,
  parseRobots,
  parseSitemap,
  pngSize,
  nodeTypes,
  titles,
} from '../html'
import {
  API_URL,
  enPath,
  fetchRaw,
  GPTBOT_USER_AGENT,
  INDEXABLE_LISTED_AIRPORT_COUNT,
  KKTC_AIRPORT,
  MILITARY_AIRFIELDS,
  PRIMARY_AIRPORT,
  REPLAY_AIRCRAFT,
  RING1_AIRPORT,
  RING2_AIRPORT,
  RING3_AIRPORT,
  RING4_AIRPORT,
  NON_ICAO_AIRPORT,
  UNLISTED_FOREIGN_AIRPORT,
  sitePath,
  STATIC_PUBLIC_PATHS,
  WEB_HOST,
} from '../support'

type Locale = 'tr' | 'en'

/** Saat içermeyen W3C tarih biçimi (site haritasında sürüm ve yürürlük tarihleri). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Verilen anın İstanbul takvimindeki günü, `YYYY-MM-DD` (changelog tarihleri bu takvimdedir). */
function istanbulDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms)
}

const STATION_PATH = `/istasyon/${PRIMARY_AIRPORT.icao}`
const SUFFIX = ' · havayolu'

function exactTitle(title: string): RegExp {
  return new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

interface PublicPage {
  /** Türkçe yol; İngilizce ikizi `enPath(path)`. */
  path: string
  title: Record<Locale, RegExp>
  /** Sayfadaki JSON-LD'de bulunması gereken türler (docs: brief §b, D-076). */
  jsonLd: string[]
}

/** Başlıklar i18n'deki `seo.*` metinleridir; düzen şablonu " · havayolu" ekler (ana sayfa mutlaktır). */
const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    title: {
      tr: exactTitle(`Türkiye canlı uçak haritası ve uçuş takibi${SUFFIX}`),
      en: exactTitle(`Live flight tracker and aircraft map for Türkiye${SUFFIX}`),
    },
    jsonLd: ['WebSite', 'Organization'],
  },
  {
    path: '/havalimanlari',
    title: {
      tr: /^Türkiye['’]deki havalimanları: IATA ve ICAO kodları · havayolu$/,
      en: exactTitle(`Airports in Türkiye: IATA and ICAO codes${SUFFIX}`),
    },
    jsonLd: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  },
  {
    path: STATION_PATH,
    title: {
      tr: /^İstanbul Havalimanı \(IST\/LTFM\) canlı hava trafiği ve pistler · havayolu$/,
      en: /^Istanbul Airport \(IST\/LTFM\) live air traffic and runways · havayolu$/,
    },
    jsonLd: ['WebPage', 'Airport', 'BreadcrumbList'],
  },
  {
    path: '/hakkinda',
    title: {
      tr: exactTitle(`Hakkında: veri kaynakları ve yöntem${SUFFIX}`),
      en: exactTitle(`About: data sources and method${SUFFIX}`),
    },
    jsonLd: ['AboutPage'],
  },
  {
    path: '/yenilikler',
    title: { tr: exactTitle(`Yenilikler${SUFFIX}`), en: exactTitle(`What’s new${SUFFIX}`) },
    jsonLd: ['WebPage'],
  },
  {
    path: '/kullanim-kosullari',
    title: {
      tr: exactTitle(`Kullanım koşulları${SUFFIX}`),
      en: exactTitle(`Terms of use${SUFFIX}`),
    },
    jsonLd: ['WebPage'],
  },
]

/** Sayfa düğümü türleri: `inLanguage` sayfanın diliyle aynı olmalı. */
const PAGE_NODE_TYPES = ['WebPage', 'CollectionPage', 'AboutPage']

interface Inspected {
  html: string
  head: string
  lang: string | undefined
  canonical: string
  alternates: Record<string, string>
  robots: string[]
}

/** Sayfayı ham HTML olarak alır; canonical ve hreflang'ın `<head>` içinde olduğunu doğrular. */
async function inspect(
  request: APIRequestContext,
  path: string,
  userAgent = GPTBOT_USER_AGENT,
): Promise<Inspected> {
  const { response, body: html } = await fetchRaw(request, path, { 'user-agent': userAgent })
  expect(response.status(), `GET ${path}`).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^text\/html/)
  const head = headOf(html)
  expect(head, `${path}: <head> var`).not.toBe('')

  const canonicals = linksByRel(html, 'canonical')
  expect(canonicals, `${path}: belgede tek canonical`).toHaveLength(1)
  expect(linksByRel(head, 'canonical'), `${path}: canonical <head> içinde`).toHaveLength(1)

  return {
    html,
    head,
    lang: htmlLang(html),
    canonical: canonicals[0]?.href ?? '',
    alternates: hreflangs(head),
    robots: metaContents(html, 'robots'),
  }
}

function hasNoindex(robots: string[]): boolean {
  return robots.some((content) => /\bnoindex\b/i.test(content))
}

function directives(robots: string[]): string[] {
  return robots.flatMap((content) => content.split(',').map((d) => d.trim().toLowerCase()))
}

async function expectPng(
  request: APIRequestContext,
  path: string,
  size?: { width: number; height: number },
): Promise<void> {
  const response = await request.get(path, { timeout: 60_000 })
  expect(response.status(), `GET ${path}`).toBe(200)
  expect(response.headers()['content-type'], `${path}: içerik türü`).toMatch(/^image\/png/)
  const actual = pngSize(await response.body())
  expect(actual, `${path}: PNG`).not.toBeNull()
  if (size) expect(actual, `${path}: boyut`).toEqual(size)
}

test.describe('genel sayfalar', () => {
  for (const page of PUBLIC_PAGES) {
    const paths: Record<Locale, string> = { tr: page.path, en: enPath(page.path) }

    test(`${paths.tr} ve ${paths.en}: başlık, canonical ve hreflang <head>'de, JSON-LD gövdede (GPTBot)`, async ({
      request,
    }) => {
      const result = {} as Record<Locale, Inspected>
      for (const locale of ['tr', 'en'] as const) {
        const path = paths[locale]
        const inspected = await inspect(request, path)
        result[locale] = inspected

        expect(inspected.lang, `${path}: <html lang>`).toBe(locale)
        const headTitles = titles(inspected.head)
        expect(headTitles, `${path}: <head> içinde tek <title>`).toHaveLength(1)
        expect(headTitles[0], `${path}: başlık`).toMatch(page.title[locale])

        const description = metaContents(inspected.head, 'description')
        expect(description, `${path}: tek açıklama`).toHaveLength(1)
        expect(description[0]?.trim().length ?? 0, `${path}: açıklama boş değil`).toBeGreaterThan(0)

        expect(sitePath(inspected.canonical, `${path} canonical`), `${path}: canonical`).toBe(path)
        expect(Object.keys(inspected.alternates).sort(), `${path}: hreflang`).toEqual([
          'en',
          'tr',
          'x-default',
        ])
        expect(sitePath(inspected.alternates.tr, `${path} hreflang tr`)).toBe(paths.tr)
        expect(sitePath(inspected.alternates.en, `${path} hreflang en`)).toBe(paths.en)
        // x-default İngilizce sürümdür (kullanıcı kararı 2026-09-29, D-076).
        expect(inspected.alternates['x-default'], `${path}: x-default`).toBe(
          inspected.alternates.en,
        )
        // Her dil sürümü kendini de listeler.
        expect(inspected.alternates[locale], `${path}: kendi hreflang'ı`).toBe(inspected.canonical)

        expect(hasNoindex(inspected.robots), `${path}: noindex yok`).toBe(false)

        const ogUrl = metaContents(inspected.head, 'og:url')
        expect(ogUrl, `${path}: og:url`).toHaveLength(1)
        expect(ogUrl[0]).toBe(inspected.canonical)
        expect(metaContents(inspected.head, 'og:locale'), `${path}: og:locale`).toEqual([
          locale === 'tr' ? 'tr_TR' : 'en_US',
        ])

        expect(jsonLdBlocks(inspected.html).length, `${path}: JSON-LD`).toBeGreaterThan(0)
        expect(jsonLdBlocks(inspected.head), `${path}: JSON-LD gövdede`).toHaveLength(0)
        const nodes = jsonLdNodes(inspected.html)
        for (const type of page.jsonLd) {
          expect(nodesOfType(nodes, type).length, `${path}: JSON-LD ${type}`).toBeGreaterThan(0)
        }
        const pageNodes = nodes.filter((node) =>
          nodeTypes(node).some((type) => PAGE_NODE_TYPES.includes(type)),
        )
        for (const node of pageNodes) {
          expect(node.inLanguage, `${path}: ${String(node['@type'])}.inLanguage`).toBe(locale)
        }
      }
      // Karşılıklılık: iki dil sürümü aynı hreflang kümesini verir.
      expect(result.en.alternates, `${paths.en} ↔ ${paths.tr}`).toEqual(result.tr.alternates)
    })
  }

  test('tarayıcı User-Agent’ıyla da başlık, canonical ve hreflang <head>’dedir', async ({
    request,
  }) => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    const inspected = await inspect(request, STATION_PATH, chrome)
    expect(titles(inspected.head)).toHaveLength(1)
    expect(Object.keys(inspected.alternates).sort()).toEqual(['en', 'tr', 'x-default'])
  })

  test('ana sayfanın JSON-LD’si WebSite ve Organization; arama kutusu işaretlemesi yok', async ({
    request,
  }) => {
    const { html } = await inspect(request, '/')
    const nodes = jsonLdNodes(html)
    const website = nodesOfType(nodes, 'WebSite')[0]
    expect(website?.name).toBe('havayolu')
    expect(sitePath(String(website?.url), 'WebSite.url')).toBe('/')
    expect(website?.inLanguage).toEqual(['tr', 'en'])
    // Google site içi arama kutusunu 2024-11-21'de kaldırdı; SearchAction eklenmez.
    expect(nodesOfType(nodes, 'SearchAction')).toHaveLength(0)
    const organization = nodesOfType(nodes, 'Organization')[0]
    expect(organization?.name).toBe('havayolu')
    expect(organization?.logo, 'Organization.logo').toBeTruthy()
  })
})

test.describe('noindex ve canonical kuralları', () => {
  test('/durum ve /en/durum noindex, follow', async ({ request }) => {
    for (const path of ['/durum', '/en/durum']) {
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      const robots = directives(metaContents(body, 'robots'))
      expect(robots, path).toContain('noindex')
      expect(robots, path).toContain('follow')
      expect(robots, path).not.toContain('nofollow')
    }
  })

  test('askerî hava üslerinin sayfası yok (D-107): ICAO ve IATA adresleri iki dilde 404, yönlenme yok', async ({
    request,
  }) => {
    for (const { icao, iata } of MILITARY_AIRFIELDS) {
      for (const code of [icao, iata, icao.toLowerCase()]) {
        for (const path of [`/istasyon/${code}`, enPath(`/istasyon/${code}`)]) {
          const { response } = await fetchRaw(request, path)
          expect(response.status(), path).toBe(404)
          expect(response.headers().location, path).toBeUndefined()
        }
      }
    }
  })

  test('admin sayfaları noindex, nofollow', async ({ request }) => {
    for (const path of ['/admin', '/admin/giris']) {
      // /admin oturumsuz girişe yönlenir; son sayfa denetlenir.
      const response = await request.get(path, { timeout: 60_000 })
      expect(response.status(), path).toBe(200)
      const robots = directives(metaContents(await response.text(), 'robots'))
      expect(robots, path).toContain('noindex')
      expect(robots, path).toContain('nofollow')
    }
  })

  test('sorgulu adreslerin canonical’ı sorgusuz sayfadır', async ({ request }) => {
    const cases: [string, string][] = [
      [`/?hex=${REPLAY_AIRCRAFT.hex}`, '/'],
      [`/en?hex=${REPLAY_AIRCRAFT.hex}`, '/en'],
      [`/?havalimani=${PRIMARY_AIRPORT.icao}`, '/'],
      [`/havalimanlari?utm_source=e2e`, '/havalimanlari'],
    ]
    for (const [path, canonical] of cases) {
      const inspected = await inspect(request, path)
      expect(sitePath(inspected.canonical, `${path} canonical`), path).toBe(canonical)
    }
  })
})

test.describe('kök dosyalar', () => {
  test('robots.txt: tek * grubu, yalnızca Bytespider engelli, mutlak Sitemap', async ({
    request,
  }) => {
    const { response, body } = await fetchRaw(request, '/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^text\/plain/)
    const robots = parseRobots(body)

    // Adlandırılmış grup yalnızca engellenen tarayıcı içindir; izinli bir botun kendi grubu `*`
    // grubundaki Disallow satırlarını geçersiz kılardı (RFC 9309 §2.2.1).
    expect(robots.groups.map((g) => g.userAgents.join(',')).sort()).toEqual(['*', 'Bytespider'])
    const all = robots.groups.find((g) => g.userAgents.includes('*'))
    expect(all?.rules).toEqual(
      expect.arrayContaining(['allow: /', 'disallow: /admin', 'disallow: /api/', 'disallow: /dil']),
    )
    expect(all?.rules.some((rule) => /^disallow: \/_next/.test(rule))).toBe(false)
    expect(all?.rules.some((rule) => /^clean-param: hex&havalimani\b/.test(rule))).toBe(true)
    const bytespider = robots.groups.find((g) => g.userAgents.includes('Bytespider'))
    expect(bytespider?.rules).toEqual(['disallow: /'])

    expect(robots.sitemaps).toHaveLength(1)
    expect(sitePath(robots.sitemaps[0], 'Sitemap')).toBe('/sitemap.xml')
  })

  test('sitemap.xml: yalnızca indekslenen sayfalar, TR ve EN, karşılıklı hreflang', async ({
    request,
  }) => {
    const { response, body } = await fetchRaw(request, '/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/xml/)
    expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    const entries = parseSitemap(body)

    // Havalimanları: Türkiye'nin dizine eklenen 56'sı ve Türkiye dışındaki 1.161'i (1.–4. halka;
    // D-080, D-084, D-088, D-090, D-102): (1.217 + 5) × 2 = 2.444 adres (50.000 sınırının çok
    // altında).
    expect(entries).toHaveLength((INDEXABLE_LISTED_AIRPORT_COUNT + STATIC_PUBLIC_PATHS.length) * 2)
    expect(entries).toHaveLength(2444)
    const byLoc = new Map(entries.map((entry) => [entry.loc, entry]))
    expect(byLoc.size, 'yinelenen adres yok').toBe(entries.length)
    const paths = entries.map((entry) => sitePath(entry.loc, 'loc'))

    const ring1Path = `/istasyon/${RING1_AIRPORT.icao}`
    const ring2Path = `/istasyon/${RING2_AIRPORT.icao}`
    const kktcPath = `/istasyon/${KKTC_AIRPORT.icao}`
    const ring4Path = `/istasyon/${RING4_AIRPORT.icao}`
    for (const path of [
      ...STATIC_PUBLIC_PATHS,
      STATION_PATH,
      ring1Path,
      ring2Path,
      kktcPath,
      ring4Path,
    ]) {
      expect(paths).toContain(path)
      expect(paths).toContain(enPath(path))
    }
    expect(paths.filter((p) => /^\/istasyon\/[A-Z0-9]{4}$/.test(p))).toHaveLength(
      INDEXABLE_LISTED_AIRPORT_COUNT,
    )
    expect(paths.filter((p) => /^\/en\/istasyon\/[A-Z0-9]{4}$/.test(p))).toHaveLength(
      INDEXABLE_LISTED_AIRPORT_COUNT,
    )
    for (const excluded of [
      '/durum',
      '/en/durum',
      // Askerî hava üsleri (D-107).
      ...MILITARY_AIRFIELDS.flatMap(({ icao }) => [
        `/istasyon/${icao}`,
        enPath(`/istasyon/${icao}`),
      ]),
      // Fixture'da olup listelenmeyen uzak havalimanı (D-080) ve dört karakterli ICAO'su olmayan
      // Kihihi (D-101).
      `/istasyon/${UNLISTED_FOREIGN_AIRPORT.icao}`,
      `/istasyon/${NON_ICAO_AIRPORT.ident}`,
      `/istasyon/${NON_ICAO_AIRPORT.iata}`,
    ]) {
      expect(paths).not.toContain(excluded)
    }
    expect(paths.filter((p) => /\/(admin|api|dil)(\/|$)|\?/.test(p))).toEqual([])

    for (const entry of entries) {
      expect(Object.keys(entry.alternates).sort(), entry.loc).toEqual(['en', 'tr', 'x-default'])
      expect(entry.alternates['x-default'], entry.loc).toBe(entry.alternates.en)
      expect([entry.alternates.tr, entry.alternates.en], entry.loc).toContain(entry.loc)
      for (const locale of ['tr', 'en'] as const) {
        const twin = byLoc.get(entry.alternates[locale] ?? '')
        expect(twin, `${entry.loc} → ${locale}`).toBeDefined()
        expect(twin?.alternates, `${entry.loc} ↔ ${locale}`).toEqual(entry.alternates)
      }
    }

    // lastmod yalnızca doğrulanabilir tarihse yazılır (verinin değişme anı), istek anı değildir.
    const now = Date.now()
    for (const entry of entries) {
      if (entry.lastmod === undefined) continue
      const time = Date.parse(entry.lastmod)
      expect(Number.isNaN(time), `${entry.loc}: lastmod`).toBe(false)
      if (DATE_ONLY.test(entry.lastmod)) {
        // Yalnızca gün (sürüm ve yürürlük tarihi) İstanbul takvimindedir; `Date.parse` onu UTC gece
        // yarısı okur ve 00:00–03:00 arasında "gelecekte" sayardı. Gün, İstanbul'daki bugünle kıyaslanır.
        expect(
          entry.lastmod <= istanbulDate(now),
          `${entry.loc}: lastmod (${entry.lastmod}) gelecekte değil`,
        ).toBe(true)
      } else {
        expect(time, `${entry.loc}: lastmod gelecekte değil`).toBeLessThanOrEqual(now)
      }
    }
    const lastmodOf = (path: string) =>
      entries.find((entry) => sitePath(entry.loc, 'loc') === path)?.lastmod
    const stationTimes = entries
      .filter((entry) => /\/istasyon\//.test(entry.loc))
      .map((entry) => Date.parse(entry.lastmod ?? ''))
    expect(
      stationTimes.every((time) => !Number.isNaN(time)),
      'havalimanlarında lastmod',
    ).toBe(true)
    // Liste sayfası dizine eklenmeyenler dahil bütün havalimanlarını gösterir; tarihi en yeni değişikliktir.
    expect(Date.parse(lastmodOf('/havalimanlari') ?? '')).toBeGreaterThanOrEqual(
      Math.max(...stationTimes),
    )
    expect(lastmodOf('/yenilikler'), '/yenilikler: en yeni sürüm tarihi').toBeDefined()

    const again = await fetchRaw(request, '/sitemap.xml')
    expect(again.body, 'iki istek arasında değişmez').toBe(body)
  })

  test('llms.txt: mutlak bağlantılar, indekslenen her havalimanı için bir satır; Türkiye dışındakiler ayrı', async ({
    request,
  }) => {
    const { response, body } = await fetchRaw(request, '/llms.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^text\/plain;\s*charset=utf-8/i)
    expect(body.startsWith('# havayolu\n')).toBe(true)
    expect(body).toMatch(/^> \S/m)
    // E-posta adresi ya da kişisel veri yoktur.
    expect(body).not.toMatch(/[^\s@()]+@[^\s@()]+\.[a-z]{2,}/i)

    // Bütün bağlantılar mutlaktır; site dışı olanlar veri kaynaklarıdır (ADSB.lol, ODbL, OurAirports).
    const links = markdownLinks(body)
    for (const link of links) {
      expect(link.href, `llms.txt ${link.label}`).toMatch(/^https?:\/\//)
    }
    const paths = links
      .filter((link) => new URL(link.href).host === WEB_HOST)
      .map((link) => sitePath(link.href, `llms.txt ${link.label}`))
    for (const path of ['/', '/en', '/havalimanlari', '/en/havalimanlari', '/hakkinda']) {
      expect(paths).toContain(path)
    }
    const airportLines = body
      .split('\n')
      .filter((line) => /^- \[.+\]\(https?:\/\/[^)]+\/istasyon\/[A-Z0-9]{4}\)/.test(line))
    expect(airportLines).toHaveLength(INDEXABLE_LISTED_AIRPORT_COUNT)
    const icaos = new Set(
      paths.flatMap((path) => /^(?:\/en)?\/istasyon\/([A-Z0-9]{4})$/.exec(path)?.slice(1) ?? []),
    )
    expect(icaos.size).toBe(INDEXABLE_LISTED_AIRPORT_COUNT)
    expect(icaos.has(PRIMARY_AIRPORT.icao)).toBe(true)
    for (const { icao } of MILITARY_AIRFIELDS) expect(icaos.has(icao), icao).toBe(false)
    expect(icaos.has(UNLISTED_FOREIGN_AIRPORT.icao)).toBe(false)
    expect(icaos.has(RING4_AIRPORT.icao)).toBe(true)
    expect(body).not.toContain(NON_ICAO_AIRPORT.ident)
    expect(body).not.toContain(`(${NON_ICAO_AIRPORT.iata}/`)
    // Türkiye dışındakiler ayrı bir bölümdedir (D-080): başlık Türkiye listesinden sonra gelir; Atina
    // (1. halka), Kahire (2. halka), Viyana (3. halka) ve Londra (4. halka) satırları o bölümdedir.
    // Başlık 2. halkadan beri "Türkiye dışındaki havalimanları"dır (kullanıcı kararı 2026-10-03,
    // D-088); kapsam 4. halkadan beri 5.000 km'dir (D-102).
    const lines = body.split('\n')
    const foreignHeading = lines.indexOf(
      '## Türkiye dışındaki havalimanları / Airports outside Türkiye',
    )
    expect(foreignHeading, 'Türkiye dışındakiler başlığı').toBeGreaterThan(0)
    expect(body).not.toMatch(/[Yy]akın ülke|neighbouring/)
    expect(body).toContain('uzaklığı en fazla 5.000 km olan')
    expect(body).toContain('at most 5,000 km from the nearest airport in Türkiye')
    const ring1Line = lines.findIndex((line) => line.includes(`/istasyon/${RING1_AIRPORT.icao})`))
    const ring2Line = lines.findIndex((line) => line.includes(`/istasyon/${RING2_AIRPORT.icao})`))
    const ring3Line = lines.findIndex((line) => line.includes(`/istasyon/${RING3_AIRPORT.icao})`))
    const ring4Line = lines.findIndex((line) => line.includes(`/istasyon/${RING4_AIRPORT.icao})`))
    const primaryLine = lines.findIndex((line) =>
      line.includes(`/istasyon/${PRIMARY_AIRPORT.icao})`),
    )
    expect(primaryLine).toBeLessThan(foreignHeading)
    expect(ring1Line).toBeGreaterThan(foreignHeading)
    expect(ring2Line).toBeGreaterThan(foreignHeading)
    expect(ring3Line).toBeGreaterThan(foreignHeading)
    expect(ring4Line).toBeGreaterThan(foreignHeading)
  })

  test('manifest ve ikonlar', async ({ request }) => {
    const { response, body } = await fetchRaw(request, '/manifest.webmanifest')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^application\/manifest\+json/)
    const manifest = JSON.parse(body) as {
      name?: string
      start_url?: string
      lang?: string
      icons?: { src: string; sizes?: string; type?: string }[]
    }
    expect(manifest.name).toBe('havayolu')
    expect(manifest.start_url).toBe('/')
    expect(manifest.lang).toBe('tr')
    const sizes = (manifest.icons ?? []).map((icon) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icon of manifest.icons ?? []) {
      const [width, height] = (icon.sizes ?? '').split('x').map(Number)
      const src = icon.src.startsWith('http') ? sitePath(icon.src, 'manifest icon') : icon.src
      await expectPng(request, src, width && height ? { width, height } : undefined)
    }

    const { body: html } = await fetchRaw(request, '/')
    const head = headOf(html)
    const icons = [...linksByRel(head, 'icon'), ...linksByRel(head, 'apple-touch-icon')]
    expect(linksByRel(head, 'apple-touch-icon')).toHaveLength(1)
    for (const icon of icons) {
      const href = icon.href ?? ''
      const path = href.startsWith('http') ? sitePath(href, 'icon') : href
      const iconResponse = await request.get(path, { timeout: 60_000 })
      expect(iconResponse.status(), `GET ${path}`).toBe(200)
      expect(iconResponse.headers()['content-type'], path).toMatch(/^image\//)
    }

    const favicon = await request.get('/favicon.ico', { timeout: 60_000 })
    expect(favicon.status()).toBe(200)
    expect(favicon.headers()['content-type']).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)/)
  })

  test('OG görselleri: site görseli ve havalimanı görseli 1200×630 PNG', async ({ request }) => {
    const size = { width: 1200, height: 630 }
    const about = await inspect(request, '/hakkinda')
    const aboutImages = metaContents(about.head, 'og:image')
    expect(aboutImages).toHaveLength(1)
    expect(metaContents(about.head, 'twitter:card')).toEqual(['summary_large_image'])
    const sitePathOfImage = sitePath(aboutImages[0], 'og:image')
    expect(sitePathOfImage).toMatch(/^\/og\/site(\?|$)/)
    await expectPng(request, sitePathOfImage, size)

    const home = await inspect(request, '/')
    expect(metaContents(home.head, 'og:image')).toEqual(aboutImages)

    const station = await inspect(request, STATION_PATH)
    const stationImages = metaContents(station.head, 'og:image')
    expect(stationImages).toHaveLength(1)
    const stationImage = sitePath(stationImages[0], 'og:image')
    expect(stationImage).toMatch(new RegExp(`^${STATION_PATH}/opengraph-image`))
    await expectPng(request, stationImage, size)
    // Görsel dilden bağımsızdır; EN sayfası aynı adresi gösterir.
    const stationEn = await inspect(request, enPath(STATION_PATH))
    expect(metaContents(stationEn.head, 'og:image')).toEqual(stationImages)
  })
})

test.describe('X-Robots-Tag', () => {
  test('web’in /api/* yolları noindex başlığı taşır', async ({ request }) => {
    const { response } = await fetchRaw(request, '/api/version')
    expect(response.status()).toBe(200)
    expect(response.headers()['x-robots-tag']).toMatch(/noindex/)
  })

  test('API host’u: robots.txt her şeyi kapatır, her yanıt noindex', async ({ request }) => {
    const robots = await request.get(`${API_URL}/robots.txt`)
    expect(robots.status()).toBe(200)
    expect(robots.headers()['content-type']).toMatch(/^text\/plain/)
    const parsed = parseRobots(await robots.text())
    expect(parsed.groups).toEqual([{ userAgents: ['*'], rules: ['disallow: /'] }])
    expect(robots.headers()['x-robots-tag']).toMatch(/noindex/)

    const health = await request.get(`${API_URL}/health`)
    expect(health.headers()['x-robots-tag']).toMatch(/noindex/)
    const missing = await request.get(`${API_URL}/yok`, { failOnStatusCode: false })
    expect(missing.status()).toBe(404)
    expect(missing.headers()['x-robots-tag']).toMatch(/noindex/)
  })
})
