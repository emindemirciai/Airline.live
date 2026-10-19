import { findAirportInRows } from '@havayolu/db'
import { ENABLED_AIRPORT_RING, type AirportDetail } from '@havayolu/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { apiFixture } from '../test/ourairports-fixture'

/**
 * Adres takma adı (D-109): kodu değişen havalimanının OurAirports kimliğindeki eski kod
 * (`identAlias`). `GET /v1/airports/:code` kodu ICAO, IATA ve takma adla çözer
 * (`@havayolu/db` `findAirportDetail`; burada aynı kural fixture satırlarıyla, `findAirportInRows`).
 * Uç halka süzgeci uygulamaz (M6j.1'de 5. halka kapalıyken de Lima SPIM → SPJC bulunuyordu); sayfalar
 * listelenen havalimanlarıyla sınırlıdır (web yalnız listedeki takma adı yönlendirir; M6j.3'ten beri
 * bütün halkalar açık).
 */
const apps: { close(): Promise<unknown> }[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function get(code: string) {
  const { airportRows, runwayRows, context } = apiFixture()
  const { app } = await testApp({
    deps: {
      airports: {
        list: null,
        find: async (wanted: string) =>
          findAirportInRows(airportRows, runwayRows, [], wanted, context),
      },
    },
  })
  apps.push(app)
  return app.inject({ method: 'GET', url: `/v1/airports/${code}` })
}

describe('GET /v1/airports/:code ve adres takma adı (D-109)', () => {
  // Fixture'ı bu dosyada ilk ayrıştıran test: yerelde ~1,2 sn. Süre sınırı yalnız 1 sn'yi aşan
  // fixture testlerinde açıkça yazılır (D-105, D-109).
  it('Semerkant’ın eski kodu UTSS kanonik kaydı (UZSS) verir; kayıt takma adı taşır (bütün halkalar açık, D-109)', async () => {
    expect(ENABLED_AIRPORT_RING).toBe(5)
    for (const code of ['UTSS', 'utss', 'UZSS', 'SKD']) {
      const res = await get(code)
      expect(res.statusCode, code).toBe(200)
      expect(res.json<AirportDetail>(), code).toMatchObject({
        icao: 'UZSS',
        iata: 'SKD',
        identAlias: 'UTSS',
      })
    }
    // Takma adı olmayan kayıtta alan yazılmaz.
    const ist = await get('LTFM')
    expect(Object.hasOwn(ist.json<AirportDetail>(), 'identAlias')).toBe(false)
  }, 30_000)

  it('5. halka: SPIM → SPJC, KPBI → KDJT, FVHA → FVRG; WABP takma ad değildir', async () => {
    const lima = await get('SPIM')
    expect(lima.statusCode).toBe(200)
    expect(lima.json<AirportDetail>()).toMatchObject({ icao: 'SPJC', iata: 'LIM', ring: 5 })
    expect((await get('KPBI')).json<AirportDetail>()).toMatchObject({ icao: 'KDJT', iata: 'DJT' })
    expect((await get('FVHA')).json<AirportDetail>()).toMatchObject({ icao: 'FVRG', iata: 'HRE' })
    // WABP Timika'nın (WAYY) OurAirports kimliğidir ama Burumeso pistinin ICAO'sudur: 404.
    const wabp = await get('WABP')
    expect(wabp.statusCode).toBe(404)
    expect(wabp.json()).toMatchObject({ error: 'airport_not_found' })
    // Askerî liste (D-109) hiçbir kodla bulunmaz.
    for (const code of ['PWAK', 'AWK', 'YBOK', 'PKWA']) {
      expect((await get(code)).statusCode, code).toBe(404)
    }
  })

  it('OpenAPI: takma ad isteğe bağlı alan, kod parametresi takma adı da anlatır', async () => {
    const { app } = await testApp({ deps: { airports: { list: null } } })
    apps.push(app)
    const res = await app.inject({ method: 'GET', url: '/openapi.json' })
    expect(res.statusCode).toBe(200)
    const text = res.body
    expect(text).toContain('identAlias')
    expect(text).toContain('UTSS → UZSS')
  })
})
