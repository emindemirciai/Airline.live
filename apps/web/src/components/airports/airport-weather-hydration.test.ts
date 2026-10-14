import { getMessages } from '@havayolu/i18n'
import { utcOffsetTable, type UtcOffsetTable } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIXTURE_NOW, fixtureHistory, fixtureWeather } from '../../lib/test/weather-fixture'

/**
 * Sunucunun fark tablosu (D-109): havalimanı sayfasının adası yerel saatleri sunucunun hesapladığı
 * farklardan yazar. Tarayıcının tz verisi sunucununkinden eskiyse (Britanya Kolumbiyası 2026'dan
 * beri bütün yıl UTC−7, tzdata 2026b; Kazakistan 2024'ten beri tek dilim UTC+5, 2024a) ilk istemci
 * çizimi yine sunucu çizimiyle aynıdır: hidrasyon farkı yoktur.
 *
 * "Eski tarayıcı" `Intl.DateTimeFormat`'ın sarmalanmasıyla taklit edilir: o dilim, sunucunun
 * farkından bir saat farklı sabit bir dilimle (`Etc/GMT±n`) biçimlendirilir. Modüller (biçimlendirici
 * önbellekleri ve kayıtlı tablolar) her "istemci" için yeniden yüklenir (`vi.resetModules`).
 */
const API = 'http://localhost:4100'
const HOUR_MS = 3_600_000

/** Fixture'ın raporları başka bir güne kaydırılır (ISO zamanlar; ham metin değişmez). */
function shift<T>(value: T, ms: number): T {
  return JSON.parse(JSON.stringify(value), (_key, field: unknown) =>
    typeof field === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(field)
      ? new Date(Date.parse(field) + ms).toISOString()
      : field,
  ) as T
}

/** `Etc/GMT` adı ters işaretlidir: UTC−8 = Etc/GMT+8. */
const fixedZone = (offsetMinutes: number) =>
  `Etc/GMT${offsetMinutes <= 0 ? '+' : '-'}${Math.abs(offsetMinutes) / 60}`

const RealDateTimeFormat = Intl.DateTimeFormat

afterEach(() => {
  Intl.DateTimeFormat = RealDateTimeFormat
  vi.resetModules()
})

/** "Eski tarayıcı": `zone` her yerde `offsetMinutes` sabit farkıyla biçimlenir. */
function stubOldRules(zone: string, offsetMinutes: number) {
  const fixed = fixedZone(offsetMinutes)
  Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
    construct(target, args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      const [locales, options] = args
      return new target(
        locales,
        options?.timeZone === zone ? { ...options, timeZone: fixed } : options,
      )
    },
  })
}

async function renderIsland(
  timeZone: string,
  renderedAt: number,
  utcOffsets: UtcOffsetTable | null,
): Promise<string> {
  // Yeni modüller: önceki çizimin biçimlendiricileri ve kayıtlı tablosu taşınmaz.
  vi.resetModules()
  const { AirportWeatherLive } = await import('./airport-weather-live')
  const days = renderedAt - FIXTURE_NOW
  return renderToStaticMarkup(
    createElement(AirportWeatherLive, {
      locale: 'tr',
      t: getMessages('tr').weather,
      icao: 'LGAV',
      name: 'Test',
      lat: 49.19,
      lon: -123.18,
      apiBaseUrl: API,
      initialWeather: shift(fixtureWeather('LGAV'), days),
      initialHistory: shift(fixtureHistory('LGAV'), days),
      renderedAt,
      timeZone,
      utcOffsets,
    }),
  )
}

describe('sunucunun fark tablosu: hidrasyon aynı (D-109)', () => {
  it.each([
    // Vancouver, Aralık 2026 (tzdata 2026b: kalıcı UTC−7; eski veri UTC−8 der).
    ['America/Vancouver', Date.parse('2026-12-15T20:00:00Z')],
    // Almatı (tzdata 2024a: UTC+5; eski veri UTC+6 der).
    ['Asia/Almaty', Date.parse('2026-01-15T13:00:00Z')],
  ])('%s', async (zone, renderedAt) => {
    const table = utcOffsetTable(zone, renderedAt)
    const serverOffset = table.segments.at(-1)?.offsetMinutes ?? 0
    const server = await renderIsland(zone, renderedAt, table)
    // Eski tarayıcı bu dilime bir saat farklı der.
    stubOldRules(zone, serverOffset + (zone === 'Asia/Almaty' ? 60 : -60))
    const client = await renderIsland(zone, renderedAt, table)
    expect(client).toBe(server)
    // Tablo olmasaydı istemci farklı yazardı (taklidin çalıştığının kanıtı).
    const withoutTable = await renderIsland(zone, renderedAt, null)
    expect(withoutTable).not.toBe(server)
  })

  it('tarayıcının hiç tanımadığı dilim (eski tarayıcıda America/Ciudad_Juarez) tabloyla yerel saatte yazılır', async () => {
    const zone = 'America/Ciudad_Juarez'
    const renderedAt = Date.parse('2026-07-15T18:00:00Z')
    const table = utcOffsetTable(zone, renderedAt)
    const server = await renderIsland(zone, renderedAt, table)
    expect(server).toContain('Yerel saat 12:00 (UTC−6)')
    // Eski tarayıcı dilimi tanımaz: `Intl.DateTimeFormat` RangeError atar.
    Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
      construct(target, args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
        const [locales, options] = args
        if (options?.timeZone === zone) throw new RangeError(`Invalid time zone: ${zone}`)
        return new target(locales, options)
      },
    })
    expect(await renderIsland(zone, renderedAt, table)).toBe(server)
    // Tablo yoksa saatler UTC'dir (D-106 (c)).
    const fallback = await renderIsland(zone, renderedAt, null)
    expect(fallback).toContain('Saatler UTC’dir')
    expect(fallback).not.toContain('Yerel saat')
  })

  it('tablo çizim anının ±48 saatini kapsar; geçişi dakikasıyla bulur', () => {
    // Atina yaz saatinden 25 Ekim 2026 01:00 UTC'de çıkar.
    const table = utcOffsetTable('Europe/Athens', Date.parse('2026-10-24T12:30:00Z'))
    expect(table.toMs - table.fromMs).toBe(96 * HOUR_MS)
    expect(table.segments).toEqual([
      { fromMs: table.fromMs, offsetMinutes: 180 },
      { fromMs: Date.parse('2026-10-25T01:00:00Z'), offsetMinutes: 120 },
    ])
    // Geçişsiz dilim tek parçadır.
    expect(utcOffsetTable('Europe/Istanbul', FIXTURE_NOW).segments).toHaveLength(1)
  })
})
