import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { decodeMetar } from './metar'
import {
  AirportWeatherSchema,
  WeatherBulkResponseSchema,
  WeatherHistoryResponseSchema,
  type AirportWeather,
  type WeatherHistoryResponse,
} from './schema'
import { decodeTaf } from './taf'

const metarRaw = 'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA'
const tafRaw =
  'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT'

/** API'nin yaptığı gibi: okurken çöz, kayıttaki zamanlarla birleştir. */
function airportWeather(): AirportWeather {
  return {
    icao: 'LTFM',
    generatedAt: '2026-01-15T13:00:00.000Z',
    metar: {
      ...decodeMetar(metarRaw, { observedAt: '2026-01-15T12:50:00Z' }),
      observedAt: '2026-01-15T12:50:00.000Z',
      flightCategory: 'VFR',
    },
    tafs: [
      {
        ...decodeTaf(tafRaw, {
          issuedAt: '2026-01-15T10:40:00Z',
          validFrom: '2026-01-15T12:00:00Z',
          validTo: '2026-01-16T18:00:00Z',
        }),
        issuedAt: '2026-01-15T10:40:00.000Z',
        validFrom: '2026-01-15T12:00:00.000Z',
        validTo: '2026-01-16T18:00:00.000Z',
      },
    ],
  }
}

describe('API sözleşmesi', () => {
  it('güncel hava: çözülmüş rapor şemaya uyar; rapor yoksa metar null, TAF boş', () => {
    const weather = airportWeather()
    expect(AirportWeatherSchema.parse(weather)).toEqual(weather)
    const empty = { icao: 'LTBQ', generatedAt: weather.generatedAt, metar: null, tafs: [] }
    expect(AirportWeatherSchema.parse(empty)).toEqual(empty)
  })

  it('API’deki METAR ve TAF zamanları zorunludur; ICAO dört büyük harf/rakam', () => {
    const weather = airportWeather()
    const metar = weather.metar
    if (!metar) throw new Error('metar yok')
    expect(() =>
      AirportWeatherSchema.parse({ ...weather, metar: { ...metar, observedAt: null } }),
    ).toThrow()
    expect(() => AirportWeatherSchema.parse({ ...weather, icao: 'ltfm' })).toThrow()
    expect(() => AirportWeatherSchema.parse({ ...weather, generatedAt: 'dün' })).toThrow()
  })

  it('toplu yanıt ve kayıt (geçmiş) yanıtı', () => {
    const weather = airportWeather()
    const bulk = {
      generatedAt: weather.generatedAt,
      attribution: { text: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov/' },
      stations: [weather],
    }
    expect(WeatherBulkResponseSchema.parse(bulk)).toEqual(bulk)
    const metar = weather.metar
    if (!metar) throw new Error('metar yok')
    const history: WeatherHistoryResponse = {
      icao: 'LTFM',
      from: '2026-01-14T13:00:00.000Z',
      to: '2026-01-15T13:00:00.000Z',
      generatedAt: '2026-01-15T13:00:00.000Z',
      entries: [
        { kind: 'METAR', time: metar.observedAt, raw: metar.raw, metar },
        {
          kind: 'TAF',
          time: '2026-01-15T10:40:00.000Z',
          raw: tafRaw,
          taf: {
            validFrom: '2026-01-15T12:00:00.000Z',
            validTo: '2026-01-16T18:00:00.000Z',
            amended: false,
            corrected: false,
            cancelled: false,
          },
        },
        // Çözülemeyen rapor ham metniyle kalır.
        { kind: 'SPECI', time: '2026-01-15T12:42:00.000Z', raw: 'SPECI LTFM 151242Z ...' },
      ],
    }
    expect(WeatherHistoryResponseSchema.parse(history)).toEqual(history)
  })

  it('bilinmeyen alanlar atılır (ileri uyumluluk)', () => {
    const weather = { ...airportWeather(), extra: 1 }
    expect(AirportWeatherSchema.parse(weather)).not.toHaveProperty('extra')
  })

  it('OpenAPI için JSON şeması (draft-7) üretilebilir', () => {
    for (const schema of [
      AirportWeatherSchema,
      WeatherBulkResponseSchema,
      WeatherHistoryResponseSchema,
    ]) {
      const json = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>
      expect(json.type).toBe('object')
      expect(JSON.stringify(json).length).toBeGreaterThan(1000)
    }
  })

  it('61 havalimanının toplu yanıtı 1 MB’ın çok altında kalır', () => {
    const weather = airportWeather()
    const body = JSON.stringify({
      generatedAt: weather.generatedAt,
      attribution: { text: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov/' },
      stations: Array.from({ length: 61 }, () => ({
        ...weather,
        tafs: [...weather.tafs, ...weather.tafs],
      })),
    })
    expect(body.length).toBeLessThan(1_000_000)
  })
})
