import { readFileSync } from 'node:fs'
import { getMessages } from '@havayolu/i18n'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapAirport } from './airport-data'
import {
  AirportListPanelUnavailable,
  AirportPopupUnavailable,
  withChunkFallback,
  withImportFallback,
} from './chunk-fallback'

/**
 * Havalimanı adları haritanın ilk paketine girmez (D-101): ad tablolarını (`airportDisplayName`)
 * kullanan havalimanı penceresi ve "Havalimanları" paneli yalnız dinamik importla yüklenir; paylaşılan
 * tablolar `#__PURE__` işaretli kurulur (yardımcı çağrıları paketleyiciye yan etkili görünürdü).
 * `/` için First Load JS ölçümü önce/sonra plandadır (M6i.1). Havalimanı aramasının ad dizini de
 * (D-108) yalnız dinamik importla yüklenir; arama motoru (`@havayolu/shared` `airport-search.ts`)
 * hiçbir şey içe aktarmaz.
 */
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const staticImports = (text: string) =>
  [...text.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gms)].map((match) => match[1])

describe('ilk paket: havalimanı adları dinamik parçalarda (D-101)', () => {
  it('canlı harita pencereyi ve paneli statik import etmez', () => {
    const liveMap = source('./live-map.tsx')
    expect(staticImports(liveMap)).not.toContain('./airport-popup')
    expect(liveMap).toContain("import('./airport-popup')")
    const control = source('./panels/airport-list-control.tsx')
    expect(staticImports(control)).not.toContain('./airport-list-panel')
    expect(control).toContain("import('./airport-list-panel')")
    expect(control).not.toContain('airportDisplayName')
    expect(source('./panels/index.ts')).not.toContain('airport-list-panel')
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
    expect(box).toContain("import('./airport-search-index')")
    for (const text of [box, model]) {
      for (const name of [
        'airportDisplayName',
        'airportLocality',
        'provinceName',
        'airportCountryName',
      ]) {
        expect(text).not.toContain(name)
      }
    }
    expect(source('./panels/index.ts')).not.toContain('airport-search-index')
    const reference = '../../../../../packages/shared/src/reference/'
    expect(staticImports(source(`${reference}airport-search.ts`))).toEqual([])
  })

  it('paylaşılan ad tabloları PURE işaretli fonksiyonda kurulur', () => {
    const reference = '../../../../../packages/shared/src/reference/'
    const tr = source(`${reference}airport-names.ts`)
    const foreign = source(`${reference}foreign-airport-names.ts`)
    expect(tr).toMatch(/export const AIRPORT_NAMES: [^=]+= \/\*#__PURE__\*\/ \(\(\) => \(\{/)
    expect(foreign).toMatch(
      /export const FOREIGN_AIRPORT_CITIES: [^=]+= \/\*#__PURE__\*\/ \(\(\) => \(\{/,
    )
    // Öbür tablolar düz nesnedir (çağrı yok): paketleyici kullanılmayınca atar.
    expect(foreign).toMatch(/export const FOREIGN_AIRPORT_NAMES: [^=]+= \{\n {2}[A-Z0-9]{4}: \{/)
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
      /const loadAirportPopup = withChunkFallback\(\s*\(\) => import\('\.\/airport-popup'\)\.then\(\(module\) => module\.AirportPopup\),\s*AirportPopupUnavailable,/,
    )
    // `loading` olmadan next/dynamic Suspense sınırı kurmaz (ssr açıkken): ilk seçim kök kabukta
    // askıya alınır ve parça gelene kadar bütün ağaç donardı.
    expect(liveMap).toContain(
      'const AirportPopup = dynamic(() => loadAirportPopup(), { loading: () => null })',
    )
    const control = source('./panels/airport-list-control.tsx')
    expect(control).toMatch(
      /const loadPanel = withChunkFallback\(\s*\(\) => import\('\.\/airport-list-panel'\)\.then\(\(module\) => module\.AirportListPanel\),\s*AirportListPanelUnavailable,/,
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
      /const loadAirportSearch = withImportFallback<AirportSearchBuilder>\(\s*\(\) => import\('\.\/airport-search-index'\)\.then\(\(module\) => module\.buildAirportSearch\),\s*codeOnlyAirportSearch,/,
    )
    expect(box).not.toMatch(/void import\(/)
    expect(box).toContain('onFocus={warmAirportSearch}')
    expect(box).toContain('onPointerEnter={warmAirportSearch}')
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
