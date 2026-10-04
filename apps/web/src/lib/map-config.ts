/**
 * Canlı haritanın çalışma zamanı yapılandırması (D-075). Sunucu bileşeni env'den `MapConfig`
 * kurar ve istemci bileşenine prop olarak verir; bu modül `server-only` değildir, çünkü istemci
 * tipleri buradan alır. Sır içermez: Esri anahtarı zaten tarayıcıya giden karo adresindedir
 * (anahtar referrer ve yalnızca "Basemaps" yetkisiyle sınırlanır, ACTIVATION).
 */

/** Harita altlığı zinciri; hata yönetimi (3 hata → yedek → düz arka plan) istemcidedir. */
export type Basemap =
  | {
      kind: 'satellite'
      /** Esri World Imagery raster karo şablonu (`{z}/{y}/{x}`, anahtar kodlanmış). */
      tilesUrl: string
      attribution: string
      /** Uydu yüklenemezse geçilecek koyu vektör stil (OpenFreeMap); https değilse null. */
      fallbackStyleUrl: string | null
      /**
       * Koyu vektör stil de yüklenemezse geçilecek yedek (`MAP_STYLE_FALLBACK_URL`, ör. kendi
       * barındırdığımız Protomaps); vektör zincirindeki yedekle aynıdır. Yoksa null.
       */
      vectorFallbackStyleUrl: string | null
      /** Yedek vektör stile geçilirse yollar gizlenir. */
      hideRoads: true
      /** Uydunun üstündeki kesikli ülke sınırlarının kaynağı (OpenFreeMap, D-092). */
      countryBorders: CountryBorders
    }
  | {
      kind: 'vector'
      styleUrl: string
      fallbackStyleUrl: string | null
      /** Yükledikten sonra `transportation` ve `transportation_name` katmanları gizlenir. */
      hideRoads: boolean
      attribution: string
    }
  | { kind: 'local'; styleUrl: string; attribution: string }

/**
 * Uydu altlığının üstünde çizilen ülke sınırlarının vektör kaynağı (D-092). Karoları tarayıcı
 * doğrudan çeker; worker, API ya da CDN aracılık etmez ve önbelleğe almaz. Atıf, sınır katmanları
 * görünürken haritanın atıf şeridine girer.
 */
export interface CountryBorders {
  /** OpenMapTiles şemalı TileJSON adresi. */
  url: string
  attribution: string
}

export interface DataAttribution {
  label: string
  href: string
  license: string
  licenseHref: string
}

export interface MapConfig {
  /** REST kökü (`https://api.havayolu.live`); tarayıcı API'ye doğrudan bağlanır. */
  apiBaseUrl: string
  /** Canlı veri WebSocket'i (`wss://api.havayolu.live/v1/ws`). */
  wsUrl: string
  basemap: Basemap
  /** Canlı veri atfı: haritada her zaman görünür (data-sources.md §1). */
  dataAttribution: DataAttribution
}

/** `getServerEnv()` sonucunun haritayı ilgilendiren alanları. */
export interface MapEnvInput {
  API_HOST: string
  MAP_STYLE_URL: string
  MAP_STYLE_URL_DARK?: string
  MAP_STYLE_FALLBACK_URL?: string
  EXTERNAL_PROVIDERS_DISABLED: boolean
  ESRI_API_KEY?: string
}

/** Dış sağlayıcı kapalıyken (geliştirme, test, CI) kullanılan yerel stil (`apps/web/public`). */
export const LOCAL_STYLE_URL = '/test-style.json'

/**
 * ArcGIS Location Platform üzerinden Esri World Imagery (D-075). Anahtarsız
 * `server.arcgisonline.com` adresi lisanslı değildir; kullanılmaz.
 */
export const ESRI_IMAGERY_TILES =
  'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/**
 * Altlık atıfları sağlayıcının istediği İngilizce metinlerdir. Türkçe sayfada ekran okuyucu bunları
 * İngilizce seslendirsin diye `lang="en"` taşırlar (WCAG 3.1.2); MapLibre'nin atıf temizleyicisi
 * `span` ve `lang`'a izin verir.
 */
export const ESRI_ATTRIBUTION =
  '<span lang="en">Powered by <a href="https://www.esri.com/">Esri</a> | Esri, Vantor, Earthstar Geographics, and the GIS User Community</span>'

export const OPENFREEMAP_ATTRIBUTION =
  '<span lang="en"><a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></span>'

/**
 * OpenFreeMap'in OpenMapTiles vektör karolarının TileJSON adresi: OpenFreeMap stillerinin
 * (`/styles/dark`, `/styles/liberty`) kullandığı adresle aynıdır (openfreemap-styles deposu; README
 * `/planet/latest`'ı da belgeler). TileJSON sürümlü karo adreslerini verir; koyu stile geçilince
 * tarayıcı aynı karoları yeniden kullanabilir.
 */
export const OPENFREEMAP_TILEJSON_URL = 'https://tiles.openfreemap.org/planet'

/** "Canlı uçuş verisi: ADSB.lol — ODbL 1.0"; bağlantılar zorunludur (data-sources.md §1). */
export const DATA_ATTRIBUTION: DataAttribution = {
  label: 'ADSB.lol',
  href: 'https://adsb.lol',
  license: 'ODbL 1.0',
  licenseHref: 'https://opendatacommons.org/licenses/odbl/1-0/',
}

const LOCAL_HOST_PREFIXES = ['localhost', '127.0.0.1', '[::1]']

function isLocalHost(host: string): boolean {
  return LOCAL_HOST_PREFIXES.some((prefix) => host.startsWith(prefix))
}

/** Aynı sitedeki yol mu (`/…`, `//…` değil)? */
function isSitePath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

/** Yerel host'ta http, diğerlerinde https (API'nin CORS ve WS Origin kuralıyla aynı ayrım). */
export function apiBaseUrl(apiHost: string): string {
  return `${isLocalHost(apiHost) ? 'http' : 'https'}://${apiHost}`
}

export function liveWsUrl(apiHost: string): string {
  return `${isLocalHost(apiHost) ? 'ws' : 'wss'}://${apiHost}/v1/ws`
}

function resolveBasemap(env: MapEnvInput): Basemap {
  if (isSitePath(env.MAP_STYLE_URL) || env.EXTERNAL_PROVIDERS_DISABLED) {
    return {
      kind: 'local',
      styleUrl: isSitePath(env.MAP_STYLE_URL) ? env.MAP_STYLE_URL : LOCAL_STYLE_URL,
      attribution: '',
    }
  }
  const darkStyle = env.MAP_STYLE_URL_DARK ?? env.MAP_STYLE_URL
  if (env.ESRI_API_KEY) {
    const fallbackStyleUrl = isHttpsUrl(darkStyle) ? darkStyle : null
    const vectorFallback = env.MAP_STYLE_FALLBACK_URL ?? null
    return {
      kind: 'satellite',
      tilesUrl: `${ESRI_IMAGERY_TILES}?token=${encodeURIComponent(env.ESRI_API_KEY)}`,
      attribution: ESRI_ATTRIBUTION,
      fallbackStyleUrl,
      vectorFallbackStyleUrl: vectorFallback === fallbackStyleUrl ? null : vectorFallback,
      hideRoads: true,
      countryBorders: { url: OPENFREEMAP_TILEJSON_URL, attribution: OPENFREEMAP_ATTRIBUTION },
    }
  }
  return {
    kind: 'vector',
    styleUrl: darkStyle,
    fallbackStyleUrl: env.MAP_STYLE_FALLBACK_URL ?? null,
    hideRoads: true,
    attribution: OPENFREEMAP_ATTRIBUTION,
  }
}

/**
 * Altlık zinciri (D-075):
 * 1. `MAP_STYLE_URL` bir site yoluysa ya da dış sağlayıcılar kapalıysa yerel stil
 * 2. `ESRI_API_KEY` varsa uydu (üstünde OpenFreeMap'ten kesikli ülke sınırları, D-092); yedeği
 *    koyu vektör stil, onun yedeği `MAP_STYLE_FALLBACK_URL`
 * 3. yoksa koyu vektör stil (OpenFreeMap), yollar gizli; yedeği `MAP_STYLE_FALLBACK_URL`
 *
 * Vektör stillerde ülke sınırları indirilen stilde kesikli çizgiye çevrilir (basemap.ts); yerel
 * stilde (1) sınır yoktur ve dış istek gitmez.
 */
export function resolveMapConfig(env: MapEnvInput): MapConfig {
  return {
    apiBaseUrl: apiBaseUrl(env.API_HOST),
    wsUrl: liveWsUrl(env.API_HOST),
    basemap: resolveBasemap(env),
    dataAttribution: { ...DATA_ATTRIBUTION },
  }
}
