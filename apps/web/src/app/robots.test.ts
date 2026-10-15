// Next'in robots.txt'yi yazan işlevi (üretimdeki rota kodu da bunu çağırır: next-metadata-route-loader).
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import robots from './robots'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }))
vi.mock('next/server', () => ({ connection }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.current }))

function request(headers: Record<string, string>) {
  requestHeaders.current = new Headers(headers)
}

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('WEB_HOST', 'airline.live')
  vi.stubEnv('ADMIN_HOST', 'admin.airline.live')
  request({ host: 'airline.live' })
})

afterEach(() => {
  vi.unstubAllEnvs()
  connection.mockClear()
})

describe('robots.txt', () => {
  it('web host: tek * grubu, Yandex Clean-param, Bytespider engeli ve mutlak site haritası', async () => {
    expect(resolveRobots(await robots())).toBe(
      [
        'User-Agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /dil',
        'Clean-param: hex&havalimani /',
        'Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content',
        '',
        'User-Agent: Bytespider',
        'Disallow: /',
        '',
        'Sitemap: https://airline.live/sitemap.xml',
        '',
      ].join('\n'),
    )
  })

  it('önce connection() çağrılır (build sırasında üretilip WEB_HOST gömülmez)', async () => {
    await robots()
    expect(connection).toHaveBeenCalledTimes(1)
  })

  it('arama, yanıt ve eğitim tarayıcıları için ayrı grup yok (hepsi * grubundaki kurallara uyar)', async () => {
    const text = resolveRobots(await robots())
    for (const agent of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot']) {
      expect(text).not.toContain(agent)
    }
    expect(text.match(/^User-Agent:/gm)).toHaveLength(2)
  })

  it('admin host: tüm site kapalı, site haritası yok (X-Forwarded-Host öncelikli)', async () => {
    request({ host: 'hy-web:3000', 'x-forwarded-host': 'Admin.Airline.Live' })
    expect(resolveRobots(await robots())).toBe('User-Agent: *\nDisallow: /\n\n')
  })

  it('WEB_HOST yoksa Sitemap satırı yazılmaz; ADMIN_HOST yoksa admin ayrımı yapılmaz', async () => {
    vi.stubEnv('WEB_HOST', '')
    vi.stubEnv('ADMIN_HOST', '')
    request({ host: 'admin.airline.live' })
    const text = resolveRobots(await robots())
    expect(text).toContain('Disallow: /admin\n')
    expect(text).not.toContain('Sitemap:')
  })

  it('yerel WEB_HOST http site haritası adresi verir (e2e)', async () => {
    vi.stubEnv('WEB_HOST', 'localhost:3100')
    request({ host: 'localhost:3100' })
    expect(resolveRobots(await robots())).toContain('Sitemap: http://localhost:3100/sitemap.xml\n')
  })
})
