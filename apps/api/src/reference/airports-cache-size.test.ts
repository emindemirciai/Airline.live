import { readFileSync } from 'node:fs'
import {
  SEED_STATIONS,
  selectListedAirports,
  toAirportDetails,
  turkishReferencePoints,
  type AirportDetailSourceRow,
  type RunwaySourceRow,
  type StationSourceRow,
} from '@havayolu/db'
import { parseAirports, parseRunways } from '@havayolu/providers'
import { AIRPORT_RING_CONFIG, ENABLED_AIRPORT_RING, type AirportDetail } from '@havayolu/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'

/**
 * Next veri önbelleğinin sınırı (D-101, D-102): web havalimanı sayfaları listeyi
 * `GET /v1/airports?scope=listed&include=runways` ile ister ve yanıtı Next'in veri önbelleğinde
 * 1 saat tutar (`apps/web/src/lib/airports.ts`, `next: { revalidate }`). Next 16.3 önbellek kaydını
 * `{ kind, data: { headers, body: <gövdenin base64'ü>, status, url }, revalidate }` olarak
 * JSON'a yazar ve `JSON.stringify(kayıt).length` 2 MiB'ı aşarsa kaydı yazmaz (üretimde uyarı,
 * geliştirmede hata: `next/dist/server/lib/incremental-cache/index.js`). Gövde sıkıştırılmamış
 * hâliyle saklanır (fetch br/gzip'i açar); base64 onu 4/3 büyütür.
 *
 * Halkaya göre büyüyen tek önbellekli yanıt budur: toplu hava web belleğindedir (`no-store`), METAR/TAF
 * kaydı tek istasyonluktur. Test, commit'li OurAirports fixture'ından (2026-10-01 kopyası) açık
 * halkanın bütün listesini (4. halkada 1.222 havalimanı) üretimdeki gibi kurar (içe aktarım
 * çözümleyicisi, liste kuralı, ayrıntı kaydı, API'nin serileştiricisi) ve kaydın sınırın %85'inin
 * altında kaldığını denetler. 5. halkada (~3.250 havalimanı) bu sınır kırılır (D-101).
 */
const NEXT_FETCH_CACHE_LIMIT = 2 * 1024 * 1024
/** Güvenlik payı: kayıt sınırın en çok %85'i. */
const BUDGET = 0.85 * NEXT_FETCH_CACHE_LIMIT

const fixture = (file: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/ourairports/${file}`, import.meta.url), 'utf8')

/** Fixture'ın içe aktarılmış satırları, veritabanındaki gibi (kimlik sırası). */
function fixtureDetails(stationsForAll: boolean): AirportDetail[] {
  const airports = parseAirports(fixture('airports.csv'))
  const runways = parseRunways(
    fixture('runways.csv'),
    new Map(airports.rows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }])),
  )
  expect(airports.skipped).toEqual([])
  expect(runways.skipped).toEqual([])
  const updatedAt = new Date('2026-10-01T23:03:49Z')
  const airportRows: AirportDetailSourceRow[] = airports.rows
    .toSorted((a, b) => a.id - b.id)
    .map(({ rowHash: _hash, ...row }) => ({ ...row, updatedAt }))
  const runwayRows: RunwaySourceRow[] = runways.rows.map((r) => ({
    id: r.id,
    airportId: r.airportId,
    lengthFt: r.lengthFt,
    widthFt: r.widthFt,
    surface: r.surface,
    lighted: r.lighted,
    leIdent: r.le.ident,
    leTrueBearingDeg: r.le.trueBearingDeg,
    leDisplacedThresholdFt: r.le.displacedThresholdFt,
    leThresholdLat: r.le.thresholdLat,
    leThresholdLon: r.le.thresholdLon,
    heIdent: r.he.ident,
    heTrueBearingDeg: r.he.trueBearingDeg,
    heDisplacedThresholdFt: r.he.displacedThresholdFt,
    heThresholdLat: r.he.thresholdLat,
    heThresholdLon: r.he.thresholdLon,
    updatedAt,
    overrideUpdatedAt: null,
  }))
  const context = { turkey: turkishReferencePoints(airportRows), ...AIRPORT_RING_CONFIG }
  const listed = new Set(selectListedAirports(airportRows, context).map((a) => a.icao))
  const icaos = stationsForAll ? [...listed] : SEED_STATIONS.map((s) => s.icao)
  const stations: StationSourceRow[] = icaos.map((icao) => ({
    icao,
    isActive: true,
    isPrimary: icao === 'LTFM',
    fetchRadiusNm: 60,
  }))
  return toAirportDetails(airportRows, runwayRows, stations, context).filter((a) =>
    listed.has(a.icao),
  )
}

const apps: { close(): Promise<unknown> }[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

/** API'nin gerçek yanıtı ve Next'in yazacağı önbellek kaydının uzunluğu. */
async function cacheEntry(details: AirportDetail[]) {
  const { app } = await testApp({
    deps: { airports: { list: null, listedDetails: async () => details } },
  })
  apps.push(app)
  const url = 'http://api:4000/v1/airports?scope=listed&include=runways'
  const res = await app.inject({ method: 'GET', url: '/v1/airports?scope=listed&include=runways' })
  expect(res.statusCode).toBe(200)
  const body = Buffer.from(res.rawPayload)
  const entry = {
    kind: 'FETCH',
    data: {
      headers: Object.fromEntries(
        Object.entries(res.headers).map(([name, value]) => [name, String(value)]),
      ),
      body: body.toString('base64'),
      status: res.statusCode,
      url,
    },
    revalidate: 3600,
  }
  return {
    bytes: body.length,
    airports: res.json().airports.length,
    item: JSON.stringify(entry).length,
  }
}

describe('Next veri önbelleği sınırı: havalimanı listesi (D-102)', () => {
  it('açık halkanın bütün listesi (4. halka, 1.222 havalimanı) kaydı 2 MiB sınırının %85’inin altında', async () => {
    expect(ENABLED_AIRPORT_RING).toBe(4)
    const { bytes, airports, item } = await cacheEntry(fixtureDetails(false))
    expect(airports).toBe(1222)
    // Ölçüm (2026-10-06, fixture): gövde 1.056.369 B, kayıt 1.409.605 karakter (sınırın %67,2'si;
    // 3. halkada 503 havalimanıyla gövde ~0,45 MB).
    expect(item).toBeGreaterThan((bytes * 4) / 3)
    expect(item).toBeLessThan(BUDGET)
    expect(bytes / airports).toBeLessThan(1000)
  })

  it('en kötü durum: her havalimanı istasyon kaydı taşısa da kayıt sınırın %85’inin altında', async () => {
    const real = await cacheEntry(fixtureDetails(false))
    const worst = await cacheEntry(fixtureDetails(true))
    expect(worst.airports).toBe(1222)
    expect(worst.bytes).toBeGreaterThan(real.bytes)
    // Ölçüm: gövde 1.112.351 B, kayıt 1.484.249 karakter (%70,8).
    expect(worst.item).toBeLessThan(BUDGET)
  })
})
