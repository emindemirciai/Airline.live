import zlib from 'node:zlib'
import {
  SEED_STATIONS,
  selectListedAirports,
  toAirportDetails,
  type StationSourceRow,
} from '@havayolu/db'
import { AIRPORT_RING_CONFIG, ENABLED_AIRPORT_RING, type AirportDetail } from '@havayolu/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { apiFixture } from '../test/ourairports-fixture'
import { compressBody, type BodyEncoding } from './body-cache'

/**
 * Listelenen havalimanlarının gövde bütçeleri (D-111; önce Next veri önbelleğinin 2 MiB öğe sınırı,
 * D-101, D-102). Web listeyi artık kendi belleğinde tutar (`apps/web/src/lib/airports.ts`, D-111):
 * Next'in öğe sınırı (5. halkada kayıt ~3,99 M karakter, sınırın %190'ı) yoktur. Bu yüzden
 * bütçe gövdenin kendisidir: web her saat ve her açılışta pistli listeyi bir kez indirip ayrıştırır;
 * harita her açılışta `include=map` gövdesini indirir.
 *
 * Test, commit'li OurAirports fixture'ından (2026-10-01 kopyası) listeyi üretimdeki gibi kurar (içe
 * aktarım çözümleyicisi, liste kuralı, ayrıntı kaydı, API'nin serileştiricisi ve gövde önbelleği)
 * ve açık halkada (4; 1.240 havalimanı, savaş kapanışlarıyla, D-110) ve 5. halka açık bağlamla
 * (3.266 havalimanı) ölçer. Brotli boyutları önbellekli gövdenindir
 * (kalite 11, D-111); istek anındaki brotli 4 daha büyüktür.
 */

/** Pistli listenin (sayfalar) gövde bütçesi: 5. halkada ölçülen 2.987.429 B'a pay. */
const RUNWAYS_BODY_BUDGET = 3_500_000
/** Haritanın listesi (`include=map`): 5. halkada ölçülen 1.172.725 B ham, 187.790 B brotli. */
const MAP_BODY_BUDGET_RING5 = 1_200_000
const MAP_BROTLI_BUDGET_RING5 = 190_000
/** 4. halkada ölçülen 91.886 B brotli (önceki harita isteği, pistli liste brotli 4 ile ~183 KB). */
const MAP_BROTLI_BUDGET_RING4 = 95_000

function fixtureDetails(enabledRing: number, stationsForAll = false): AirportDetail[] {
  const { airportRows, runwayRows, context: rings } = apiFixture()
  const context = { ...rings, enabledRing }
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

/**
 * Gövdenin sıkıştırılmamış uzunluğu ve (istenirse) önbellekli brotli uzunluğu. Testin sıkıştırıcısı
 * yalnız istenen brotli'yi gerçekten kurar, öbür gövdeleri olduğu gibi döndürür (5. halkanın pistli
 * listesinin brotli 11'i ~5 sn sürerdi).
 */
async function measure(details: AirportDetail[], include: 'runways' | 'map', brotli: boolean) {
  const builds: Promise<Buffer>[] = []
  const compress = (encoding: BodyEncoding, body: Buffer) => {
    const built = brotli && encoding === 'br' ? compressBody(encoding, body) : Promise.resolve(body)
    builds.push(built)
    return built
  }
  const { app } = await testApp({
    deps: {
      airports: { list: null, listedDetails: async () => details, compressBody: compress },
    },
  })
  apps.push(app)
  const url = `/v1/airports?scope=listed&include=${include}`
  const res = await app.inject({ method: 'GET', url })
  expect(res.statusCode).toBe(200)
  const body = Buffer.from(res.rawPayload)
  let brotliBytes: number | null = null
  if (brotli) {
    await Promise.all(builds)
    await new Promise((resolve) => setImmediate(resolve))
    const encoded = await app.inject({ method: 'GET', url, headers: { 'accept-encoding': 'br' } })
    expect(encoded.headers['content-encoding']).toBe('br')
    expect(zlib.brotliDecompressSync(encoded.rawPayload).equals(body)).toBe(true)
    brotliBytes = encoded.rawPayload.length
  }
  return {
    bytes: body.length,
    airports: res.json<{ airports: unknown[] }>().airports.length,
    brotliBytes,
  }
}

describe('gövde bütçeleri: listelenen havalimanları (D-111)', () => {
  // Fixture'ı bu dosyada ilk ayrıştıran test (yerelde ~1 sn): açık süre sınırı (D-105, D-109).
  it('pistli liste: 4. halkada 1.240 havalimanı; 5. halka açık bağlamla 3.266 havalimanı ≤ 3,5 MB', async () => {
    expect(ENABLED_AIRPORT_RING).toBe(4)
    expect(AIRPORT_RING_CONFIG.enabledRing).toBe(4)
    const ring4 = await measure(fixtureDetails(4), 'runways', false)
    expect(ring4.airports).toBe(1240)
    // Ölçüm (2026-10-16, fixture; savaş kapanışlarıyla, D-110): 1.072.446 B. Önce (2026-10-08;
    // 1.217 havalimanı, D-109'un takma adlarıyla) 1.053.068 B; 3. halkada ~0,45 MB.
    expect(ring4.bytes / ring4.airports).toBeLessThan(1000)
    const ring5 = await measure(fixtureDetails(5), 'runways', false)
    expect(ring5.airports).toBe(3266)
    // Ölçüm: 2.987.429 B (3.243 havalimanıyla 2.968.051 B; ABD ve Kanada havalimanlarının pistleri
    // çok; KORD kaydı 3,3 KB).
    expect(ring5.bytes).toBeLessThanOrEqual(RUNWAYS_BODY_BUDGET)
    expect(ring5.bytes).toBeGreaterThan(ring4.bytes * 2)
  }, 30_000)

  it('en kötü durum: her havalimanı istasyon kaydı taşısa da 5. halkada pistli liste ≤ 3,5 MB', async () => {
    const worst = await measure(fixtureDetails(5, true), 'runways', false)
    // Ölçüm: 3.137.435 B (3.243 havalimanıyla 3.116.999 B).
    expect(worst.airports).toBe(3266)
    expect(worst.bytes).toBeLessThanOrEqual(RUNWAYS_BODY_BUDGET)
  })

  // Brotli 11 (iş parçacığında) 1,17 MB'ta yerelde ~2 sn: açık süre sınırı (D-105).
  it('haritanın listesi (include=map): 5. halkada ≤ 1,2 MB ham ve ≤ 190 KB brotli; 4. halkada ≤ 95 KB brotli', async () => {
    const ring4 = await measure(fixtureDetails(4), 'map', true)
    expect(ring4.airports).toBe(1240)
    // Ölçüm (2026-10-16, D-110'la): 539.115 B ham, 91.886 B brotli 11; 5. halkada 1.172.725 ve
    // 187.790 B. Önce (2026-10-08; 1.217 ve 3.243 havalimanı) 525.947 ve 89.683 B; 1.159.557 ve
    // 185.611 B.
    expect(ring4.brotliBytes).toBeLessThanOrEqual(MAP_BROTLI_BUDGET_RING4)
    const ring5 = await measure(fixtureDetails(5), 'map', true)
    expect(ring5.airports).toBe(3266)
    expect(ring5.bytes).toBeLessThanOrEqual(MAP_BODY_BUDGET_RING5)
    expect(ring5.brotliBytes).toBeLessThanOrEqual(MAP_BROTLI_BUDGET_RING5)
    // Pistli listenin yarısından küçük (uçlar yalnız 1.–3. halkada; sayfaların alanları yok).
    const runways = await measure(fixtureDetails(5), 'runways', false)
    expect(ring5.bytes).toBeLessThan(runways.bytes / 2)
  }, 60_000)
})
