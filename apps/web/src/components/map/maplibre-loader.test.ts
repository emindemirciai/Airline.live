import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  SHARED_MODULE_SPECIFIER,
  importMaplibre,
  maplibreAssetUrls,
  patchSharedImport,
  type MaplibreLoaderDeps,
  type MaplibreModule,
} from './maplibre-loader'

describe('maplibre dosyaları', () => {
  const urls = maplibreAssetUrls('http://localhost:3100/')

  it('statik varlık adresleri kurulu maplibre-gl paketindeki dosyaları gösterir', () => {
    // Testte `import.meta.url` dosya adresidir; Turbopack aynı göreli yolu varlık olarak yayınlar.
    for (const [url, name] of [
      [urls.main, 'maplibre-gl.mjs'],
      [urls.worker, 'maplibre-gl-worker.mjs'],
      [urls.shared, 'maplibre-gl-shared.mjs'],
    ] as const) {
      const path = fileURLToPath(url)
      expect(path.replaceAll('\\', '/').endsWith(`node_modules/maplibre-gl/dist/${name}`)).toBe(
        true,
      )
      expect(existsSync(path)).toBe(true)
    }
  })

  it('ana modül ve işçi ortak modülü tam bir kez içe aktarır; içe aktarım mutlak adrese çevrilir', () => {
    const target = 'http://localhost:3100/_next/static/media/maplibre-gl-shared.abc.mjs'
    for (const url of [urls.main, urls.worker]) {
      const source = readFileSync(fileURLToPath(url), 'utf8')
      const patched = patchSharedImport(source, target, 'test')
      expect(patched).not.toContain(SHARED_MODULE_SPECIFIER)
      expect(patched).toContain(`from${JSON.stringify(target)}`)
      expect(patched.length).toBe(
        source.length - SHARED_MODULE_SPECIFIER.length + target.length + 2,
      )
    }
  })

  it('beklenmeyen biçimde açık hata verir', () => {
    expect(() => patchSharedImport('import "./other.mjs"', 'http://x/y.mjs', 'worker')).toThrow(
      /worker: .*found 0/,
    )
    const twice = `${SHARED_MODULE_SPECIFIER};${SHARED_MODULE_SPECIFIER}`
    expect(() => patchSharedImport(twice, 'http://x/y.mjs', 'main')).toThrow(/found 2/)
  })
})

describe('importMaplibre', () => {
  it('ana modülü ve işçiyi aynı ortak modül adresiyle blob olarak açar; işçi adresini ayarlar', async () => {
    const urls = maplibreAssetUrls('http://localhost:3100/')
    const sources: Record<string, string> = {
      [urls.main]: `import{a}from${SHARED_MODULE_SPECIFIER};export const main=1`,
      [urls.worker]: `import{b}from${SHARED_MODULE_SPECIFIER};self.worker=1`,
    }
    const blobs: string[] = []
    const setWorkerUrl = vi.fn()
    const lib = { setWorkerUrl } as unknown as MaplibreModule
    const deps: MaplibreLoaderDeps = {
      baseHref: () => 'http://localhost:3100/',
      fetchText: vi.fn(async (url: string) => {
        const source = sources[url]
        if (source === undefined) throw new Error(`unexpected fetch ${url}`)
        return source
      }),
      createModuleUrl: (source) => {
        blobs.push(source)
        return `blob:http://localhost:3100/${blobs.length}`
      },
      importModule: vi.fn(async () => lib),
      preload: vi.fn(),
    }

    await expect(importMaplibre(deps)).resolves.toBe(lib)

    const shared = JSON.stringify(urls.shared)
    expect(deps.preload).toHaveBeenCalledWith(urls.shared)
    expect(blobs).toEqual([
      `import{b}from${shared};self.worker=1`,
      `import{a}from${shared};export const main=1`,
    ])
    expect(deps.importModule).toHaveBeenCalledWith('blob:http://localhost:3100/2')
    expect(setWorkerUrl).toHaveBeenCalledWith('blob:http://localhost:3100/1')
  })

  it('dosya indirilemezse hata verir', async () => {
    const deps: MaplibreLoaderDeps = {
      baseHref: () => 'http://localhost:3100/',
      fetchText: () => Promise.reject(new Error('HTTP 404')),
      createModuleUrl: () => 'blob:x',
      importModule: vi.fn(),
      preload: () => undefined,
    }
    await expect(importMaplibre(deps)).rejects.toThrow(/404/)
    expect(deps.importModule).not.toHaveBeenCalled()
  })
})
