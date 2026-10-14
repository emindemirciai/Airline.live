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
 * halkanın bütün listesini (4. halkada 1.240 havalimanı, D-110) üretimdeki gibi kurar (içe aktarım
 * çözümleyicisi, liste kuralı, ayrıntı kaydı, API'nin serileştiricisi) ve kaydın sınırın %85'inin
 * altında kaldığını denetler. 5. halkada (3.266 havalimanı) bu sınır kırılır (D-101); 5. halkanın ölçek işi
 * M6j.2'dedir (D-109).
 */
const NEXT_FETCH_CACHE_LIMIT = 2 * 1024 * 1024
/** Güvenlik payı: kayıt sınırın en çok %85'i. */
const BUDGET = 0.85 * NEXT_FETCH_CACHE_LIMIT

function fixtureDetails(stationsForAll: boolean): AirportDetail[] {
  const { airportRows, runwayRows, context: rings } = apiFixture()
  const context = { ...rings, enabledRing: AIRPORT_RING_CONFIG.enabledRing }
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
  it('açık halkanın bütün listesi (4. halka, 1.240 havalimanı) kaydı 2 MiB sınırının %85’inin altında', async () => {
    expect(ENABLED_AIRPORT_RING).toBe(4)
    const { bytes, airports, item } = await cacheEntry(fixtureDetails(false))
    expect(airports).toBe(1240)
    // Ölçüm (2026-10-15, fixture; savaş nedeniyle kapalı 23 havalimanıyla, D-110): gövde
    // 1.072.446 B, kayıt ~1.431.041 karakter (sınırın %68,2'si). Önce (2026-10-07; askerî üssüz,
    // D-107; 29 adres takma adıyla, D-109; 1.217 havalimanı) 1.053.068 B ve 1.405.205 (%67,0;
    // takma adsız 1.052.488 B ve 1.404.433; üslerle 1.222 havalimanında 1.056.369 B ve 1.409.605;
    // 3. halkada 498 havalimanıyla gövde ~0,45 MB).
    expect(item).toBeGreaterThan((bytes * 4) / 3)
    expect(item).toBeLessThan(BUDGET)
    expect(bytes / airports).toBeLessThan(1000)
  })

  it('en kötü durum: her havalimanı istasyon kaydı taşısa da kayıt sınırın %85’inin altında', async () => {
    const real = await cacheEntry(fixtureDetails(false))
    const worst = await cacheEntry(fixtureDetails(true))
    expect(worst.airports).toBe(1240)
    expect(worst.bytes).toBeGreaterThan(real.bytes)
    // Ölçüm (D-110): gövde 1.129.256 B, kayıt ~1.506.789 karakter (%71,8). Önce 1.108.820 B ve
    // ~1.479.540 (%70,5; takma adsız 1.108.240 B; üslerle 1.112.351 B, %70,8).
    expect(worst.item).toBeLessThan(BUDGET)
  })
})
