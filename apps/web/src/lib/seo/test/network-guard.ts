import { vi } from 'vitest'

/**
 * Testte `fetch`'i ağa kapatır ve denenen adresleri kaydeder. `next/og` (Satori) bir harfi verilen
 * yazı tiplerinde bulamazsa Google Fonts'a istek atar; paylaşım görseli testleri bunun hiç
 * olmadığını `networkCalls()` boş mu diye bakarak doğrular. Yoga'nın gömülü WebAssembly modülü
 * `data:` adresinden yüklenir; bu ağ isteği değildir ve gerçek `fetch`'e geçer.
 */
export function guardNetwork(): { networkCalls: () => string[]; restore: () => void } {
  const realFetch = globalThis.fetch
  const calls: string[] = []
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('data:')) return realFetch(input, init)
      calls.push(url)
      throw new Error(`network disabled in tests: ${url}`)
    })
  return { networkCalls: () => [...calls], restore: () => spy.mockRestore() }
}
