import { describe, expect, it } from 'vitest'
import { isDaytime, sunTimes } from './sun'
import { localTime } from './time'

/**
 * Beklenen değerler brief §5'ten (iki bağımsız hesap: NOAA prototipi ve USNO almanak denetimi,
 * 1 dk içinde uyumlu). Gösterim tam dakikadır; ±1 dk tolerans.
 */
const LTFM = { lat: 41.2753, lon: 28.7519 }

const minutesOfDay = (date: Date | null) => {
  if (!date) throw new Error('beklenmeyen null')
  const local = localTime(date)
  return local.hour * 60 + local.minute + local.second / 60
}
const hm = (text: string) => {
  const [h = 0, m = 0] = text.split(':').map(Number)
  return h * 60 + m
}

describe('sunTimes (NOAA)', () => {
  it.each([
    ['2026-10-01', '07:01', '18:47'],
    ['2026-06-21', '05:32', '20:41'],
    ['2026-12-21', '08:27', '17:39'],
  ])('LTFM %s: doğuş %s, batış %s (±1 dk)', (iso, rise, set) => {
    const [year = 0, month = 0, day = 0] = iso.split('-').map(Number)
    const sun = sunTimes(LTFM.lat, LTFM.lon, { year, month, day })
    expect(sun.polar).toBeNull()
    // Beklenen dakikanın ortası (ss:30) etrafında ±1 dk.
    expect(Math.abs(minutesOfDay(sun.sunrise) - (hm(rise) + 0.5))).toBeLessThanOrEqual(1)
    expect(Math.abs(minutesOfDay(sun.sunset) - (hm(set) + 0.5))).toBeLessThanOrEqual(1)
    expect(sun.civilDawn && sun.sunrise && sun.civilDawn < sun.sunrise).toBe(true)
    expect(sun.civilDusk && sun.sunset && sun.civilDusk > sun.sunset).toBe(true)
  })

  it('an verilirse Europe/Istanbul yerel günü hesaplanır', () => {
    // 2026-09-30 22:30 UTC = 1 Ekim 01:30 yerel.
    const sun = sunTimes(LTFM.lat, LTFM.lon, new Date('2026-09-30T22:30:00Z'))
    expect(sun.date).toEqual({ year: 2026, month: 10, day: 1 })
    expect(localTime(sun.sunrise ?? new Date(0)).hhmm).toMatch(/^07:0[012]$/)
  })

  it('kutup günü ve gecesi', () => {
    const summer = sunTimes(78.2, 15.6, { year: 2026, month: 6, day: 21 })
    expect(summer).toMatchObject({ polar: 'day', sunrise: null, sunset: null })
    const winter = sunTimes(78.2, 15.6, { year: 2026, month: 12, day: 21 })
    expect(winter).toMatchObject({ polar: 'night', sunrise: null, sunset: null })
    expect(isDaytime('2026-06-21T00:00:00Z', summer)).toBe(true)
    expect(isDaytime('2026-12-21T12:00:00Z', winter)).toBe(false)
  })

  it('isDaytime: doğuş dahil, batış hariç', () => {
    const sun = sunTimes(LTFM.lat, LTFM.lon, { year: 2026, month: 10, day: 1 })
    const rise = sun.sunrise ?? new Date(0)
    const set = sun.sunset ?? new Date(0)
    expect(isDaytime(rise, sun)).toBe(true)
    expect(isDaytime(new Date(rise.getTime() - 1), sun)).toBe(false)
    expect(isDaytime(new Date(set.getTime() - 1), sun)).toBe(true)
    expect(isDaytime(set, sun)).toBe(false)
  })
})
