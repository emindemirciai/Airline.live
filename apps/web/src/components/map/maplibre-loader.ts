/**
 * MapLibre GL JS v6'nın tarayıcıya yüklenmesi (ana modül ve çizim işçisi).
 *
 * v6 üç ESM dosyasıdır: ana modül (`maplibre-gl.mjs`), çizim işçisi (`maplibre-gl-worker.mjs`) ve
 * ikisinin içe aktardığı ortak modül (`maplibre-gl-shared.mjs`, ~516 KB). Kütüphane sayfa paketine
 * alınmaz: üç dosya `new URL(…, import.meta.url)` ile statik varlık olarak yayınlanır (Turbopack
 * dosyaları `/_next/static/media/` altına adı özetli kopyalar) ve harita kurulurken yüklenir.
 * Böylece:
 * - Sayfa (arama, tablo, paneller) MapLibre'yi beklemeden çizilir; WebGL2 olmayan tarayıcı onu
 *   hiç indirmez.
 * - Ortak modül bir kez iner: ana modül ve işçi aynı adresi içe aktarır, işçi HTTP önbelleğinden
 *   alır. (Paketlenmiş ana modül ortak kodu kendi içine alır, işçi aynı kodu ikinci kez indirirdi.)
 *
 * Özetli adlar yüzünden dosyaların göreli `./maplibre-gl-shared.mjs` içe aktarımı çözülemez:
 * ana modül ve işçi kaynağı indirilir, bu içe aktarım mutlak adrese çevrilir ve ikisi blob adresi
 * olarak açılır (ana modül `import()`, işçi `setWorkerUrl`). Ad alanı nesnesi, statik
 * `import * as maplibregl from 'maplibre-gl'` ile aynıdır. Blob aynı kökendendir; ileride bir CSP
 * eklenirse `script-src blob:` ve `worker-src blob:` gerekir.
 *
 * Dosyalar her zaman kurulu `maplibre-gl` paketinden gelir; ana modülle işçi arasında sürüm farkı
 * olamaz.
 */
import type * as Maplibre from 'maplibre-gl'

export type MaplibreModule = typeof Maplibre

/** Ana modülün ve işçinin içe aktardığı ortak modül (her dosyada tam olarak bir kez geçer). */
export const SHARED_MODULE_SPECIFIER = '"./maplibre-gl-shared.mjs"'

export interface MaplibreAssetUrls {
  main: string
  worker: string
  shared: string
}

/**
 * Paket dosyalarının yayınlanan adresleri. `new URL` ifadeleri sabit dizeli kalmalıdır (Turbopack
 * yalnızca bu biçimi statik varlık sayar). Turbopack göreli bir adres (`/_next/static/…`) döndürür;
 * blob içindeki içe aktarım için sayfa adresine göre mutlaklaştırılır.
 */
export function maplibreAssetUrls(baseHref: string): MaplibreAssetUrls {
  const main = new URL('../../../node_modules/maplibre-gl/dist/maplibre-gl.mjs', import.meta.url)
  const worker = new URL(
    '../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
    import.meta.url,
  )
  const shared = new URL(
    '../../../node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
    import.meta.url,
  )
  return {
    main: new URL(main.href, baseHref).href,
    worker: new URL(worker.href, baseHref).href,
    shared: new URL(shared.href, baseHref).href,
  }
}

/** Modül kaynağındaki ortak modül içe aktarımını mutlak adrese çevirir. */
export function patchSharedImport(source: string, sharedUrl: string, name: string): string {
  const occurrences = source.split(SHARED_MODULE_SPECIFIER).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `MapLibre ${name}: expected one import of the shared module, found ${occurrences}`,
    )
  }
  return source.replace(SHARED_MODULE_SPECIFIER, JSON.stringify(sharedUrl))
}

/** Yükleyicinin dış dünyası; testte değiştirilir. */
export interface MaplibreLoaderDeps {
  baseHref: () => string
  fetchText: (url: string) => Promise<string>
  /** Blob adresi (`text/javascript`). */
  createModuleUrl: (source: string) => string
  importModule: (url: string) => Promise<MaplibreModule>
  /** Ortak modülü erkenden istemeye başlar (`<link rel="modulepreload">`). */
  preload: (url: string) => void
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`MapLibre: HTTP ${response.status} for ${url}`)
  return response.text()
}

function preloadModule(url: string): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`link[rel="modulepreload"][href="${CSS.escape(url)}"]`)) return
  const link = document.createElement('link')
  link.rel = 'modulepreload'
  link.href = url
  document.head.append(link)
}

const browserDeps: MaplibreLoaderDeps = {
  baseHref: () => window.location.href,
  fetchText,
  createModuleUrl: (source) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' })),
  // Paketleyici bu içe aktarımı çözmeye çalışmaz: adres çalışma zamanında kurulan blob'dur.
  importModule: (url) =>
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<MaplibreModule>,
  preload: preloadModule,
}

/**
 * MapLibre'yi yükler ve işçi adresini ayarlar. Blob adresleri sayfa açık kaldıkça geçerlidir
 * (MapLibre yeni işçileri aynı adresten açar).
 */
export async function importMaplibre(
  deps: MaplibreLoaderDeps = browserDeps,
): Promise<MaplibreModule> {
  const urls = maplibreAssetUrls(deps.baseHref())
  deps.preload(urls.shared)
  const [mainSource, workerSource] = await Promise.all([
    deps.fetchText(urls.main),
    deps.fetchText(urls.worker),
  ])
  const workerUrl = deps.createModuleUrl(patchSharedImport(workerSource, urls.shared, 'worker'))
  const maplibregl = await deps.importModule(
    deps.createModuleUrl(patchSharedImport(mainSource, urls.shared, 'main module')),
  )
  maplibregl.setWorkerUrl(workerUrl)
  return maplibregl
}

let loaded: Promise<MaplibreModule> | null = null

/** Sayfa başına bir kez yükler; başarısız olursa sonraki çağrı yeniden dener. */
export function loadMaplibre(): Promise<MaplibreModule> {
  loaded ??= importMaplibre().catch((error: unknown) => {
    loaded = null
    throw error
  })
  return loaded
}
