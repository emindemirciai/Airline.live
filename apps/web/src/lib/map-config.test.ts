import { describe, expect, it } from 'vitest'
import {
  DATA_ATTRIBUTION,
  ESRI_ATTRIBUTION,
  LOCAL_STYLE_URL,
  OPENFREEMAP_ATTRIBUTION,
  resolveMapConfig,
  type MapEnvInput,
} from './map-config'

const production: MapEnvInput = {
  API_HOST: 'api.havayolu.live',
  MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
  MAP_STYLE_URL_DARK: 'https://tiles.openfreemap.org/styles/dark',
  EXTERNAL_PROVIDERS_DISABLED: false,
}

describe('resolveMapConfig — API adresleri', () => {
  it('üretim host’unda https ve wss kullanır', () => {
    const config = resolveMapConfig(production)
    expect(config.apiBaseUrl).toBe('https://api.havayolu.live')
    expect(config.wsUrl).toBe('wss://api.havayolu.live/v1/ws')
  })

  it('yerel host’larda http ve ws kullanır', () => {
    for (const host of ['localhost:4100', '127.0.0.1:4100', '[::1]:4100']) {
      const config = resolveMapConfig({ ...production, API_HOST: host })
      expect(config.apiBaseUrl).toBe(`http://${host}`)
      expect(config.wsUrl).toBe(`ws://${host}/v1/ws`)
    }
  })

  it('canlı veri atfını bağlantılarıyla verir', () => {
    expect(resolveMapConfig(production).dataAttribution).toEqual({
      label: 'ADSB.lol',
      href: 'https://adsb.lol',
      license: 'ODbL 1.0',
      licenseHref: 'https://opendatacommons.org/licenses/odbl/1-0/',
    })
    expect(resolveMapConfig(production).dataAttribution).not.toBe(DATA_ATTRIBUTION)
  })
})

describe('resolveMapConfig — altlık zinciri', () => {
  it('stil bir site yoluysa yerel stili kullanır (anahtar olsa da)', () => {
    const config = resolveMapConfig({
      ...production,
      MAP_STYLE_URL: '/custom-style.json',
      ESRI_API_KEY: 'key',
    })
    expect(config.basemap).toEqual({
      kind: 'local',
      styleUrl: '/custom-style.json',
      attribution: '',
    })
  })

  it('dış sağlayıcılar kapalıyken (geliştirme, test) yerel test stilini kullanır', () => {
    const config = resolveMapConfig({
      ...production,
      EXTERNAL_PROVIDERS_DISABLED: true,
      ESRI_API_KEY: 'key',
    })
    expect(config.basemap).toEqual({ kind: 'local', styleUrl: LOCAL_STYLE_URL, attribution: '' })
    expect(LOCAL_STYLE_URL).toBe('/test-style.json')
  })

  it('Esri anahtarı varsa uyduyu seçer; anahtar kodlanır, yedek koyu vektör stildir', () => {
    const config = resolveMapConfig({ ...production, ESRI_API_KEY: 'AAPT+a/b=c' })
    expect(config.basemap).toEqual({
      kind: 'satellite',
      tilesUrl:
        'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=AAPT%2Ba%2Fb%3Dc',
      attribution: ESRI_ATTRIBUTION,
      fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/dark',
      vectorFallbackStyleUrl: null,
      hideRoads: true,
    })
    expect(ESRI_ATTRIBUTION).toContain('Powered by <a href="https://www.esri.com/">Esri</a>')
    expect(ESRI_ATTRIBUTION).toContain('Esri, Vantor, Earthstar Geographics, and the GIS User')
  })

  it('uydu zinciri de MAP_STYLE_FALLBACK_URL yedeğini taşır (koyu stille aynıysa bir kez)', () => {
    const config = resolveMapConfig({
      ...production,
      ESRI_API_KEY: 'key',
      MAP_STYLE_FALLBACK_URL: 'https://maps.example/protomaps.json',
    })
    expect(config.basemap).toMatchObject({
      kind: 'satellite',
      fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/dark',
      vectorFallbackStyleUrl: 'https://maps.example/protomaps.json',
    })
    const same = resolveMapConfig({
      ...production,
      ESRI_API_KEY: 'key',
      MAP_STYLE_FALLBACK_URL: 'https://tiles.openfreemap.org/styles/dark',
    })
    expect(same.basemap).toMatchObject({ kind: 'satellite', vectorFallbackStyleUrl: null })
  })

  it('İngilizce altlık atıfları lang="en" taşır (WCAG 3.1.2); bağlantılar korunur', () => {
    for (const attribution of [ESRI_ATTRIBUTION, OPENFREEMAP_ATTRIBUTION]) {
      expect(attribution).toMatch(/^<span lang="en">.*<\/span>$/)
      expect(attribution.match(/<span/g)).toHaveLength(1)
    }
  })

  it('uydu yedeği: koyu stil yoksa ana stil, https değilse yedek yok', () => {
    const withoutDark = resolveMapConfig({
      ...production,
      MAP_STYLE_URL_DARK: undefined,
      ESRI_API_KEY: 'key',
    })
    expect(withoutDark.basemap).toMatchObject({
      kind: 'satellite',
      fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    })
    const httpStyle = resolveMapConfig({
      ...production,
      MAP_STYLE_URL: 'http://tiles.example/style.json',
      MAP_STYLE_URL_DARK: undefined,
      ESRI_API_KEY: 'key',
    })
    expect(httpStyle.basemap).toMatchObject({ kind: 'satellite', fallbackStyleUrl: null })
  })

  it('anahtar yoksa koyu vektör stil; yollar gizli, yedek MAP_STYLE_FALLBACK_URL', () => {
    expect(resolveMapConfig(production).basemap).toEqual({
      kind: 'vector',
      styleUrl: 'https://tiles.openfreemap.org/styles/dark',
      fallbackStyleUrl: null,
      hideRoads: true,
      attribution: OPENFREEMAP_ATTRIBUTION,
    })
    const withFallback = resolveMapConfig({
      ...production,
      MAP_STYLE_URL_DARK: undefined,
      MAP_STYLE_FALLBACK_URL: 'https://maps.example/style.json',
    })
    expect(withFallback.basemap).toMatchObject({
      kind: 'vector',
      styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      fallbackStyleUrl: 'https://maps.example/style.json',
    })
    expect(OPENFREEMAP_ATTRIBUTION).toContain('© <a href="https://www.openmaptiles.org/">')
    expect(OPENFREEMAP_ATTRIBUTION).toContain('Data from <a href="https://www.openstreetmap.org/')
  })
})
