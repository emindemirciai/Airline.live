import { readdirSync, readFileSync } from 'node:fs'
import { getMessages } from '@havayolu/i18n'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  IDLE_FALLBACK_DELAY_MS,
  IDLE_FORCED_SLICE_MS,
  type IdleDeadlineLike,
  type IdleScheduler,
} from '../../lib/idle'
import type { MapAirport } from './airport-data'
import {
  AirportListPanelUnavailable,
  AirportPopupUnavailable,
  withChunkFallback,
  withImportFallback,
} from './chunk-fallback'
import { prebuildAirportSearch } from './panels/search-box'
import { NO_AIRPORT_RESULTS, type AirportSearchBuilder } from './panels/search-box-model'

/**
 * Havalimanı adları haritanın ilk paketine girmez (D-101): ad tablolarını (`airportDisplayName`)
 * kullanan havalimanı penceresi ve "Havalimanları" paneli yalnız dinamik importla yüklenir. Yurt dışı
 * ad ve şehir tabloları düz nesnedir (yardımcı çağrısı yok: Turbopack `#__PURE__` işaretli fonksiyonu
 * satır içine alınca çağrıları yan etki diye tembel parçada bırakıyordu, D-102); yaymalı birleşik
 * tablolar PURE işaretli fonksiyonda kurulur. `/` için First Load JS ölçümü önce/sonra plandadır
 * (M6i.1). Havalimanı aramasının ad dizini de (D-108) yalnız dinamik importla yüklenir; arama motoru
 * (`@havayolu/shared` `airport-search.ts`) hiçbir şey içe aktarmaz. Üçü tek tembel girişten gelir
 * (`airport-lazy.ts`): ayrı girişlerde paketleyici ad tablolarını her parça grubuna kopyalıyordu.
 */
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const staticImports = (text: string) =>
  [...text.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gms)].map((match) => match[1])

describe('ilk paket: havalimanı adları dinamik parçalarda (D-101)', () => {
  it('canlı harita pencereyi ve paneli statik import etmez', () => {
    const liveMap = source('./live-map.tsx')
    expect(staticImports(liveMap)).not.toContain('./airport-popup')
    expect(staticImports(liveMap)).not.toContain('./airport-lazy')
    expect(liveMap).toContain("import('./airport-lazy')")
    const control = source('./panels/airport-list-control.tsx')
    expect(staticImports(control)).not.toContain('./airport-list-panel')
    expect(staticImports(control)).not.toContain('../airport-lazy')
    expect(control).toContain("import('../airport-lazy')")
    expect(control).not.toContain('airportDisplayName')
    expect(source('./panels/index.ts')).not.toContain('airport-list-panel')
  })

  it('pencere, panel ve arama tek tembel girişten (tablolar bir kez; D-108)', () => {
    const lazy = source('./airport-lazy.ts')
    expect(staticImports(lazy)).toEqual([])
    const reexports = [...lazy.matchAll(/^export \{ (\w+) \} from '([^']+)'$/gm)].map(
      (match) => `${match[1]} ${match[2]}`,
    )
    expect(reexports).toEqual([
      'AirportPopup ./airport-popup',
      'AirportListPanel ./panels/airport-list-panel',
      'buildAirportSearch ./panels/airport-search-index',
    ])
    const lazyModule = /airport-lazy|airport-popup$|airport-list-panel|airport-search-index/
    for (const path of [
      './live-map.tsx',
      './panels/airport-list-control.tsx',
      './panels/search-box.tsx',
      './panels/search-box-model.ts',
      './panels/index.ts',
    ]) {
      const imports = staticImports(source(path)).filter((name) => lazyModule.test(name ?? ''))
      expect(imports, path).toEqual([])
    }
  })

  it('ad tablolarını yalnız dinamik parçalar kullanır', () => {
    expect(source('./airport-popup-model.ts')).toContain('airportDisplayName')
    expect(source('./panels/airport-list-panel.tsx')).toContain('airportDisplayName')
    expect(source('./panels/airport-search-index.ts')).toContain('airportDisplayName')
  })

  it('arama kutusu ad dizinini statik import etmez; motor hiçbir şey içe aktarmaz (D-108)', () => {
    const box = source('./panels/search-box.tsx')
    const model = source('./panels/search-box-model.ts')
    expect(staticImports(box)).not.toContain('./airport-search-index')
    expect(staticImports(model)).not.toContain('./airport-search-index')
    expect(box).toContain("import('../airport-lazy')")
    for (const text of [box, model]) {
      for (const name of [
        'airportDisplayName',
        'airportLocality',
        'provinceName',
        'airportCountryName',
        'airportSearchPlaces',
        'countrySearchAliases',
      ]) {
        expect(text).not.toContain(name)
      }
    }
    expect(source('./panels/index.ts')).not.toContain('airport-search-index')
    const reference = '../../../../../packages/shared/src/reference/'
    expect(staticImports(source(`${reference}airport-search.ts`))).toEqual([])
    // Yalnız aranan ek adlar düz nesnedir (çağrı yok) ve hiçbir şey içe aktarmaz.
    const places = source(`${reference}airport-search-places.ts`)
    expect(staticImports(places)).toEqual([])
    expect(places).toMatch(/export const AIRPORT_SEARCH_PLACES: [^=]+= \{\n {2}[A-Z0-9]{4}: \[/)
  })

  it('paylaşılan ad tabloları düz nesne ya da PURE işaretli fonksiyonda kurulur', () => {
    const reference = '../../../../../packages/shared/src/reference/'
    const tr = source(`${reference}airport-names.ts`)
    const foreign = source(`${reference}foreign-airport-names.ts`)
    const ringFour = source(`${reference}foreign-airport-names-r4.ts`)
    expect(tr).toMatch(/export const AIRPORT_NAMES: [^=]+= \/\*#__PURE__\*\/ \(\(\) => \(\{/)
    // Halkaların birleşik tabloları (D-102) da PURE işaretli fonksiyonda yayılır.
    for (const table of ['FOREIGN_AIRPORT_NAMES', 'FOREIGN_AIRPORT_CITIES']) {
      expect(foreign, table).toMatch(
        new RegExp(
          `export const ${table}: [^=]+= /\\*#__PURE__\\*/ \\(\\(\\) => \\(\\{\\n {2}\\.\\.\\.`,
        ),
      )
    }
    // Halkaların ad ve şehir tabloları düz nesnedir (çağrı yok): paketleyici kullanılmayınca atar.
    // Şehir tabloları D-101'de `city()` çağrılarıyla PURE fonksiyondaydı; Turbopack fonksiyonu satır
    // içine alıp 1.161 çağrıyı (~27 KB) tembel parçada bırakıyordu (D-102).
    expect(foreign).toMatch(/const RING1_3_AIRPORT_NAMES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{/)
    expect(ringFour).toMatch(/export const RING4_AIRPORT_NAMES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{/)
    expect(foreign).toMatch(/const RING1_3_AIRPORT_CITIES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{ tr: /)
    expect(ringFour).toMatch(
      /export const RING4_AIRPORT_CITIES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{ tr: /,
    )
    // 5. halkanın tabloları da düz nesnedir (D-109): 1.–5. halka tek tembel parçadadır.
    const ringFive = source(`${reference}foreign-airport-names-r5.ts`)
    expect(ringFive).toMatch(/export const RING5_AIRPORT_NAMES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{/)
    expect(ringFive).toMatch(
      /export const RING5_AIRPORT_CITIES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{ tr: /,
    )
    expect(foreign).toContain("from './foreign-airport-names-r5'")
    for (const text of [foreign, ringFour, ringFive]) expect(text).not.toMatch(/\bcity\(/)
  })

  it('haritanın ilk paketindeki askerî üs kuralı ad tablolarını içe aktarmaz (D-103, D-107)', () => {
    // `mapShownAirports` ad tablolarının modülündeyken (liste tablodan türetiliyordu) paketleyici
    // tabloları `/`'nin ilk paketine taşıyordu; kural kendi modülündedir ve hiçbir şey içe aktarmaz.
    expect(source('./live-map.tsx')).toContain('mapShownAirports')
    const reference = '../../../../../packages/shared/src/reference/'
    const military = source(`${reference}military-airfields.ts`)
    expect(military).toContain('export function mapShownAirports')
    expect(staticImports(military)).toEqual([])
    const names = source(`${reference}airport-names.ts`)
    expect(names).not.toContain('mapShownAirports')
    expect(names).not.toContain('isMilitaryAirfield')
  })
})

describe('ilk paket: ülke adlarının yerleşim tablosu dinamik parçada (D-100)', () => {
  const shared = '../../../../../packages/shared/'

  it('web kaynağında tablo ve noktalar modülü statik import edilmez; harita denetleyicisi dinamik import eder', () => {
    const lazy = [
      '@havayolu/shared/country-label-points',
      '@havayolu/shared/country-label-placements',
    ]
    const root = new URL('../../', import.meta.url)
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    expect(files.length).toBeGreaterThan(50)
    for (const file of files) {
      const text = readFileSync(new URL(file, root), 'utf8')
      for (const specifier of lazy) expect(staticImports(text), file).not.toContain(specifier)
    }
    const controller = source('./map-controller.ts')
    expect(controller).toContain("import('@havayolu/shared/country-label-points')")
    expect(controller).toContain('this.countryLabels.setPoints(chunk.countryLabelPoints)')
  })

  it('paylaşılan paketin ana girişi tabloyu vermez; katman modülü tabloyu yalnız tür olarak bilir', () => {
    expect(source(`${shared}src/map/index.ts`)).not.toMatch(/country-label-(placements|points)/)
    const labels = source(`${shared}src/map/country-labels.ts`)
    expect(staticImports(labels)).not.toContain('./country-label-placements')
    expect(labels).not.toContain('function countryLabelPoints')
    const manifest = JSON.parse(source(`${shared}package.json`)) as { exports: object }
    expect(manifest.exports).toEqual({
      '.': './src/index.ts',
      './country-label-placements': './src/map/country-label-placements.ts',
      './country-label-points': './src/map/country-label-points.ts',
      // Host kuralları (D-112): proxy ana girişin bütün tablolarını yüklemesin diye ayrı giriş.
      './hosts': './src/hosts.ts',
    })
  })
})

describe('parça yüklenemezse (D-101): yedek bileşen, hata ekranı yok', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const Real = () => null
  const Fallback = () => null

  it('değer yükleyicisi: ret yedeği verir, uyarı yazar, işlenmemiş ret bırakmaz', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const chunkError = new Error('Failed to load chunk')
      const fallback = (x: number) => x
      const failing = withImportFallback(() => Promise.reject(chunkError), fallback, 'Search')
      await expect(failing()).resolves.toBe(fallback)
      // Önceden isteme gibi sonucu beklenmeyen çağrı da reddedilmez.
      void failing()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(warn).toHaveBeenCalledTimes(2)
      expect(warn).toHaveBeenCalledWith('Search could not be loaded', chunkError)
      expect(unhandled).not.toHaveBeenCalled()

      const value = (x: number) => x + 1
      const working = withImportFallback(() => Promise.resolve(value), fallback, 'Search')
      await expect(working()).resolves.toBe(value)
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('yükleyici import() reddedilirse yedeği verir ve uyarı yazar; başarıda bileşeni', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const chunkError = Object.assign(new Error('Failed to load chunk'), { name: 'ChunkLoadError' })
    const failing = withChunkFallback<object>(() => Promise.reject(chunkError), Fallback, 'Test')
    await expect(failing()).resolves.toBe(Fallback)
    // Önceden isteme (`void load()`) reddedilmez: işlenmemiş ret kalmaz.
    await expect(failing()).resolves.toBe(Fallback)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith('Test could not be loaded', chunkError)

    const working = withChunkFallback<object>(
      () => Promise.resolve(Real as ComponentType<object>),
      Fallback,
      'Test',
    )
    await expect(working()).resolves.toBe(Real)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('pencere ve panel yükleyicileri yedekle sarılı; ikisinin de kendi Suspense sınırı var', () => {
    const liveMap = source('./live-map.tsx')
    expect(liveMap).toMatch(
      /const loadAirportPopup = withChunkFallback\(\s*\(\) => import\('\.\/airport-lazy'\)\.then\(\(module\) => module\.AirportPopup\),\s*AirportPopupUnavailable,/,
    )
    // `loading` olmadan next/dynamic Suspense sınırı kurmaz (ssr açıkken): ilk seçim kök kabukta
    // askıya alınır ve parça gelene kadar bütün ağaç donardı.
    expect(liveMap).toContain(
      'const AirportPopup = dynamic(() => loadAirportPopup(), { loading: () => null })',
    )
    const control = source('./panels/airport-list-control.tsx')
    expect(control).toMatch(
      /const loadPanel = withChunkFallback\(\s*\(\) => import\('\.\.\/airport-lazy'\)\.then\(\(module\) => module\.AirportListPanel\),\s*AirportListPanelUnavailable,/,
    )
    expect(control).toContain(
      'const AirportListPanel = dynamic(() => loadPanel(), { loading: () => null })',
    )
    // Önceden isteme yalnız yedekli yükleyiciyle (düğmede ve harita hazır olunca boşta).
    expect(control).not.toMatch(/void import\(/)
    expect(control).toContain('onPointerEnter={preloadAirportListPanel}')
    expect(control).toContain('onFocus={preloadAirportListPanel}')
    expect(liveMap).toMatch(
      /return whenIdle\(\(\) => \{\s*void loadAirportPopup\(\)\s*preloadAirportListPanel\(\)\s*preloadAirportSearch\(\)\s*\}\)/,
    )
    // Havalimanı aramasının ad dizini (D-108): yedeği yalnız kodla arama; kutu odaklanınca ya da
    // üstüne gelinince de istenir.
    const box = source('./panels/search-box.tsx')
    expect(box).toMatch(
      /const loadAirportSearch = withImportFallback<AirportSearchBuilder>\(\s*\(\) => import\('\.\.\/airport-lazy'\)\.then\(\(module\) => module\.buildAirportSearch\),\s*codeOnlyAirportSearch,/,
    )
    expect(box).not.toMatch(/void import\(/)
    expect(box).toContain('onFocus={warmAirportSearch}')
    expect(box).toContain('onPointerEnter={warmAirportSearch}')
    // Dizin harita hazır olduktan ve liste geldikten sonra boşta kurulur (ilk odak beklemez).
    expect(liveMap).toMatch(
      /if \(!mapSettled \|\| airports\.length === 0\) return\s*return prebuildAirportSearch\(airports, locale\)\s*\}, \[mapSettled, airports, locale\]\)/,
    )
  })

  it('dizinin boşta kurulumu: parça bir boşta işte, kurulum ayrı bir boşta işte; iptal kurmaz', async () => {
    const queue = new Map<number, () => void>()
    let next = 0
    const scheduler: IdleScheduler = {
      requestIdleCallback: (callback) => {
        next += 1
        queue.set(next, callback)
        return next
      },
      cancelIdleCallback: (handle) => {
        queue.delete(handle)
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    }
    const runIdle = async () => {
      const tasks = [...queue.values()]
      queue.clear()
      for (const task of tasks) task()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const airports = [{ icao: 'LTFM', iata: 'IST' } as MapAirport]
    const build = vi.fn<AirportSearchBuilder>(() => () => NO_AIRPORT_RESULTS)
    const load = vi.fn(() => Promise.resolve<AirportSearchBuilder>(build))

    prebuildAirportSearch(airports, 'tr', load, scheduler)
    expect(load).not.toHaveBeenCalled()
    await runIdle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(build).not.toHaveBeenCalled()
    await runIdle()
    expect(build).toHaveBeenCalledTimes(1)
    expect(build).toHaveBeenCalledWith(airports, 'tr')

    // Parça gelmeden ya da kurulum sırası gelmeden iptal edilirse kurulmaz.
    build.mockClear()
    const cancelEarly = prebuildAirportSearch(airports, 'en', load, scheduler)
    cancelEarly()
    await runIdle()
    await runIdle()
    const cancelLate = prebuildAirportSearch(airports, 'en', load, scheduler)
    await runIdle()
    cancelLate()
    await runIdle()
    expect(build).not.toHaveBeenCalled()
  })

  it('dilimli kurulum (M6j.3): her boşta iş bir dilim; bitmeyen kurulum sonraki boşta işte sürer; iptal durdurur', async () => {
    const queue = new Map<number, (deadline?: IdleDeadlineLike) => void>()
    let next = 0
    const scheduler: IdleScheduler = {
      requestIdleCallback: (callback) => {
        next += 1
        queue.set(next, callback)
        return next
      },
      cancelIdleCallback: (handle) => {
        queue.delete(handle)
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    }
    const deadline: IdleDeadlineLike = { didTimeout: false, timeRemaining: () => 5 }
    const runIdle = async () => {
      const tasks = [...queue.values()]
      queue.clear()
      for (const task of tasks) task(deadline)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const airports = [{ icao: 'LTFM', iata: 'IST' } as MapAirport]
    let slicesLeft = 3
    const prepare = vi.fn(
      (_airports: readonly MapAirport[], _locale: string, left: () => number) => {
        expect(left()).toBe(5)
        slicesLeft -= 1
        return slicesLeft === 0
      },
    )
    const build = Object.assign(
      vi.fn(() => () => NO_AIRPORT_RESULTS),
      { prepare },
    ) as AirportSearchBuilder
    const load = vi.fn(() => Promise.resolve(build))

    prebuildAirportSearch(airports, 'tr', load, scheduler)
    await runIdle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(prepare).not.toHaveBeenCalled()
    for (const expected of [1, 2, 3]) {
      await runIdle()
      expect(prepare).toHaveBeenCalledTimes(expected)
    }
    // Kurulum bitti: yeni dilim istenmez; tek seferlik kurucu çağrılmaz.
    expect(queue.size).toBe(0)
    expect(build).not.toHaveBeenCalled()
    expect(prepare).toHaveBeenCalledWith(airports, 'tr', expect.any(Function))

    // İptal edilen kurulum sonraki dilimi çalıştırmaz.
    prepare.mockClear()
    slicesLeft = 10
    const cancel = prebuildAirportSearch(airports, 'en', load, scheduler)
    await runIdle()
    await runIdle()
    expect(prepare).toHaveBeenCalledTimes(1)
    cancel()
    await runIdle()
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(queue.size).toBe(0)
  })

  it('requestIdleCallback yoksa (Safari, iOS; D-118): yükleme ve ilk dilim 1 sn sonra, sonraki dilimler bir sonraki görevde; iptal bekleyeni siler', async () => {
    const timers = new Map<number, { task: () => void; ms: number }>()
    const delays: number[] = []
    let next = 0
    const scheduler: IdleScheduler = {
      setTimeout: (task, ms) => {
        next += 1
        timers.set(next, { task, ms })
        delays.push(ms)
        return next
      },
      clearTimeout: (handle) => {
        timers.delete(handle)
      },
    }
    const runTimers = async () => {
      const due = [...timers.values()]
      timers.clear()
      for (const { task } of due) task()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const airports = [{ icao: 'LTFM', iata: 'IST' } as MapAirport]
    let slicesLeft = 3
    const prepare = vi.fn(
      (_airports: readonly MapAirport[], _locale: string, left: () => number) => {
        // Boşta süre yok: dilim en çok `IDLE_FORCED_SLICE_MS` (10 ms) kullanır.
        expect(left()).toBeLessThanOrEqual(IDLE_FORCED_SLICE_MS)
        slicesLeft -= 1
        return slicesLeft === 0
      },
    )
    const build = Object.assign(
      vi.fn(() => () => NO_AIRPORT_RESULTS),
      { prepare },
    ) as AirportSearchBuilder
    const load = vi.fn(() => Promise.resolve(build))

    prebuildAirportSearch(airports, 'tr', load, scheduler)
    await runTimers()
    expect(load).toHaveBeenCalledTimes(1)
    for (const expected of [1, 2, 3]) {
      await runTimers()
      expect(prepare).toHaveBeenCalledTimes(expected)
    }
    expect(timers.size).toBe(0)
    // Yükleme ve ilk dilim yedeğin gecikmesiyle; sonraki iki dilim 0 ms ile.
    expect(delays).toEqual([IDLE_FALLBACK_DELAY_MS, IDLE_FALLBACK_DELAY_MS, 0, 0])

    // İptal, bekleyen sonraki dilimi siler.
    prepare.mockClear()
    slicesLeft = 10
    const cancel = prebuildAirportSearch(airports, 'en', load, scheduler)
    await runTimers()
    await runTimers()
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(timers.size).toBe(1)
    cancel()
    expect(timers.size).toBe(0)
    await runTimers()
    expect(prepare).toHaveBeenCalledTimes(1)
  })

  it('yedekler ilk pakettedir: tembel modülleri yalnız tür olarak import eder', () => {
    const fallback = source('./chunk-fallback.tsx')
    const lazyImports = [...fallback.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gms)].filter(
      (match) => /airport-popup|airport-list-panel/.test(match[1] ?? ''),
    )
    expect(lazyImports).toHaveLength(2)
    for (const match of lazyImports) expect(match[0]).toMatch(/^import type /)
    expect(fallback).not.toContain('airportDisplayName')
    expect(fallback).not.toMatch(/^import '[^']*\.css'/m)
    // Stilleri globals.css'tedir (parçanın CSS'i de gelmemiş olabilir).
    const css = source('../../app/globals.css')
    for (const name of [
      '.live-map__chunk-error {',
      '.map-chunk-error__codes {',
      '.map-chunk-error__text {',
      '.map-chunk-error__actions {',
    ]) {
      expect(css).toContain(name)
    }
    expect(css).toMatch(/\.live-map__chunk-error \{[^}]*pointer-events: auto;/)
  })

  const IST = { icao: 'LTFM', iata: 'IST' } as MapAirport

  it.each(['tr', 'en'] as const)(
    'yedek pencere ve panel metinleri i18n kataloğundan (%s)',
    (locale) => {
      const t = getMessages(locale).map
      const popup = renderToStaticMarkup(
        createElement(AirportPopupUnavailable, {
          airport: IST,
          onClose: () => undefined,
          messages: t.airportPopup,
        }),
      )
      expect(popup).toMatch(/^<section class="map-panel live-map__chunk-error" data-icao="LTFM">/)
      expect(popup).toContain('<p class="map-chunk-error__codes">IST · LTFM</p>')
      expect(popup).toContain(
        `<p class="map-chunk-error__text" role="alert">${t.airportPopup.loadFailed}</p>`,
      )
      expect(popup).toContain(
        `<button type="button" class="map-button">${t.airportPopup.reload}</button>`,
      )
      expect(popup).toContain(
        `<button type="button" class="map-button">${t.airportPopup.close}</button>`,
      )

      const panel = renderToStaticMarkup(
        createElement(AirportListPanelUnavailable, {
          id: 'panel',
          titleId: 'title',
          messages: t.airportList,
        }),
      )
      expect(panel).toMatch(
        /^<div id="panel" class="map-panel map-labels__panel map-airports__panel" role="group" aria-labelledby="title"><p id="title" class="map-labels__title">/,
      )
      expect(panel).toContain(
        `<p class="map-chunk-error__text" role="alert">${t.airportList.loadFailed}</p>`,
      )
      expect(panel).toContain(
        `<button type="button" class="map-button">${t.airportList.reload}</button>`,
      )
      expect(t.airportList.reload).toBe(t.airportPopup.reload)
    },
  )
})
