import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AwcFormatError,
  MAX_METAR_RAW_LENGTH,
  parseAwcTime,
  parseMetarResponse,
  parseTafResponse,
} from './awc-schema'

// Elle yazılmış, sentetik fixture'lar (tools/fixtures/weather); canlı istek yok.
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../../tools/fixtures/weather/${name}`, import.meta.url), 'utf8'),
  )
const index = fixture('index.json') as { fixtureNow: string }
const FIXTURE_NOW = Date.parse(index.fixtureNow)

interface FixtureMetar {
  icaoId: string
  obsTime: number
  rawOb: string
  metarType: string
  temp: number | null
  dewp: number | null
  wdir: number | string | null
  wspd: number | null
  wgst?: number
  visib: number | string | null
  altim: number | null
}

describe('parseAwcTime', () => {
  it('AWC metin biçimini ve ISO 8601 biçimini okur', () => {
    expect(parseAwcTime('2026-01-15 10:40:00.000Z')?.toISOString()).toBe('2026-01-15T10:40:00.000Z')
    expect(parseAwcTime('2026-01-15T10:40:00Z')?.toISOString()).toBe('2026-01-15T10:40:00.000Z')
    expect(parseAwcTime('2026-01-15T10:40Z')?.toISOString()).toBe('2026-01-15T10:40:00.000Z')
    expect(parseAwcTime('2026-01-15T13:40:00+03:00')?.toISOString()).toBe(
      '2026-01-15T10:40:00.000Z',
    )
    // Saat dilimi yoksa UTC (AWC yalnızca UTC verir).
    expect(parseAwcTime('2026-01-15 10:40:00')?.toISOString()).toBe('2026-01-15T10:40:00.000Z')
  })

  it('geçersiz ya da boş metin null döner', () => {
    for (const value of [
      '',
      '   ',
      null,
      undefined,
      '15/01/2026',
      '2026-13-01 00:00',
      '2026-01-15 25:00',
    ]) {
      expect(parseAwcTime(value)).toBeNull()
    }
  })
})

describe('parseMetarResponse', () => {
  it("fixture'daki bütün METAR/SPECI kayıtları geçer; tür, istasyon ve zaman doğru", () => {
    const { items, skipped } = parseMetarResponse(fixture('metar.json'), { now: FIXTURE_NOW })
    expect(skipped).toEqual([])
    // 14 Türkiye istasyonu ve 1. halkadan 6 istasyon (LGAV, LGTS, LCLK, LCEN, LBSF, UGTB; D-080).
    expect(items).toHaveLength(165)
    expect(new Set(items.map((m) => m.station)).size).toBe(20)
    expect(items.some((m) => m.station === 'LTBQ')).toBe(false)
    const ltbs = items.find((m) => m.station === 'LTBS')
    expect(ltbs).toMatchObject({ type: 'SPECI', flightCategory: 'IFR' })
    expect(ltbs?.observedAt.toISOString()).toBe('2026-01-15T12:42:00.000Z')
    const ltfm = items.filter((m) => m.station === 'LTFM')
    expect(ltfm).toHaveLength(146)
    expect(ltfm.filter((m) => m.type === 'SPECI')).toHaveLength(1)
    expect(ltfm.filter((m) => m.raw.startsWith('METAR COR '))).toHaveLength(1)
    // En eski LTFM gözlemi fixtureNow'dan en az 3 gün önce (geçmiş listesi).
    const oldest = Math.min(...ltfm.map((m) => m.observedAt.getTime()))
    expect(FIXTURE_NOW - oldest).toBeGreaterThanOrEqual(3 * 86_400_000 - 3_600_000)
  })

  it('fixture\'daki AWC alanları ham metinle tutarlı (Q = altim, sıcaklık, rüzgâr, 9999 → "6+")', () => {
    // AWC rüzgâr hızını knot verir; MPS raporunda (UGTB) ham değer knota çevrilip karşılaştırılır.
    const KT_PER_MPS = 1.943844
    for (const m of fixture('metar.json') as FixtureMetar[]) {
      const raw = m.rawOb.split(/ (?:NOSIG|BECMG|TEMPO) /)[0] ?? ''
      expect(raw).toContain(m.icaoId)
      expect(raw).toContain(`Q${m.altim}`)
      const t = (v: number | null) =>
        v === null ? '' : v < 0 ? `M${String(-v).padStart(2, '0')}` : String(v).padStart(2, '0')
      expect(raw).toContain(` ${t(m.temp)}/${t(m.dewp)} `)
      const direction = m.wdir === 'VRB' ? 'VRB' : String(m.wdir).padStart(3, '0')
      const mps = new RegExp(` ${direction}(\\d{2})MPS `).exec(raw)
      if (mps) {
        expect(Math.round(Number(mps[1]) * KT_PER_MPS)).toBe(m.wspd)
      } else {
        const wind = `${direction}${String(m.wspd).padStart(2, '0')}`
        expect(raw).toContain(`${wind}${m.wgst ? `G${m.wgst}` : ''}KT`)
      }
      if (/ (9999|CAVOK) /.test(raw)) expect(m.visib).toBe('6+')
      else expect(typeof m.visib).toBe('number')
    }
  })

  it('toleranslı: boş ve yanlış tipli alanlar yok sayılır, "VRB" ve "6+" kabul edilir', () => {
    const { items, skipped } = parseMetarResponse(
      [
        {
          icaoId: 'ltbj',
          obsTime: 1768481400,
          rawOb: '  LTBJ 151250Z   VRB02KT 9999 FEW040 14/06 Q1012 NOSIG ',
          metarType: null,
          wdir: 'VRB',
          visib: '6+',
          temp: 'sıcak',
          clouds: [{ cover: 'FEW', base: '4000' }, 5],
          fltCat: 'vfr',
          extra: { unknown: true },
        },
      ],
      { now: FIXTURE_NOW },
    )
    expect(skipped).toEqual([])
    expect(items).toEqual([
      {
        station: 'LTBJ',
        type: 'METAR',
        observedAt: new Date('2026-01-15T12:50:00Z'),
        raw: 'LTBJ 151250Z VRB02KT 9999 FEW040 14/06 Q1012 NOSIG',
        flightCategory: 'VFR',
      },
    ])
  })

  it('rapor türü ham önekten, yoksa metarType alanından gelir; METAR dışı türler atlanır', () => {
    const base = { icaoId: 'LTFM', obsTime: 1768481400 }
    const { items, skipped } = parseMetarResponse(
      [
        {
          ...base,
          rawOb: 'SPECI LTFM 151250Z 03018KT 9999 BKN035 09/05 Q1009',
          metarType: 'METAR',
        },
        { ...base, rawOb: 'LTFM 151250Z 03018KT 9999 BKN035 09/05 Q1009', metarType: 'SPECI' },
        {
          ...base,
          rawOb: 'METAR LTFM 151250Z 03018KT 9999 BKN035 09/05 Q1009',
          metarType: 'SPECI',
        },
        { ...base, rawOb: 'LTFM 151250Z 03018KT 9999 BKN035 09/05 Q1009', metarType: 'SYNOP' },
      ],
      { now: FIXTURE_NOW },
    )
    expect(items.map((m) => m.type)).toEqual(['SPECI', 'SPECI', 'METAR'])
    expect(skipped).toEqual([{ station: 'LTFM', reason: 'malformed' }])
  })

  it('bozuk kayıtlar nedeniyle atlanır, diğerleri işlenir', () => {
    const ok = { icaoId: 'LTFM', obsTime: 1768481400, rawOb: 'LTFM 151250Z 03018KT 9999 Q1009' }
    const { items, skipped } = parseMetarResponse(
      [
        ok,
        5,
        null,
        ['LTFM'],
        { ...ok, icaoId: 'IST' },
        { ...ok, icaoId: 'LTBA', rawOb: 'LTBA 151250Z 04008KT CAVOK 10/03 Q1010' },
        { ...ok, rawOb: '' },
        { ...ok, rawOb: 'LTFM 151250Z\u0000 03018KT' },
        { ...ok, rawOb: `LTFM 151250Z ${'9'.repeat(MAX_METAR_RAW_LENGTH)}` },
        { ...ok, rawOb: 'LTBA 151250Z 04008KT CAVOK 10/03 Q1010' },
        { ...ok, obsTime: null },
        { ...ok, obsTime: 0 },
        { ...ok, obsTime: FIXTURE_NOW / 1000 + 2 * 3600 },
      ],
      { now: FIXTURE_NOW, stations: new Set(['LTFM']) },
    )
    expect(items).toHaveLength(1)
    expect(skipped.map((s) => s.reason)).toEqual([
      'malformed',
      'malformed',
      'malformed',
      'station',
      'unlisted_station',
      'raw_missing',
      'raw_invalid',
      'raw_invalid',
      'raw_station_mismatch',
      'time',
      'time',
      'time',
    ])
  })

  it('dizi olmayan gövde biçim hatasıdır', () => {
    expect(() => parseMetarResponse({ status: 'error' })).toThrow(AwcFormatError)
  })
})

describe('parseTafResponse', () => {
  it("fixture'daki bütün TAF'lar geçer; yayın ve geçerlilik zamanları doğru", () => {
    const { items, skipped } = parseTafResponse(fixture('taf.json'), { now: FIXTURE_NOW })
    expect(skipped).toEqual([])
    // 7 Türkiye istasyonu (LTFM 13 TAF) ve 1. halkadan 4 istasyon (LGAV, LCLK, LBSF, UGTB).
    expect(items).toHaveLength(23)
    expect(items.filter((t) => t.station === 'LTFM')).toHaveLength(13)
    const ltfm = items.find((t) => t.station === 'LTFM' && t.mostRecent)
    expect(ltfm).toMatchObject({
      issuedAt: new Date('2026-01-15T10:40:00Z'),
      validFrom: new Date('2026-01-15T12:00:00Z'),
      validTo: new Date('2026-01-16T18:00:00Z'),
    })
    expect(ltfm?.raw.startsWith('TAF LTFM 151040Z 1512/1618')).toBe(true)
    const amd = items.find((t) => t.station === 'LTAI')
    expect(amd?.raw.startsWith('TAF AMD LTAI 151215Z')).toBe(true)
  })

  it('issueTime yoksa bulletinTime; ISO biçimi; geçersiz aralık atlanır', () => {
    const base = {
      icaoId: 'LTBA',
      rawTAF: 'TAF LTBA 151040Z 1512/1612 04010KT CAVOK',
      validTimeFrom: 1768478400,
      validTimeTo: 1768564800,
    }
    const { items, skipped } = parseTafResponse(
      [
        { ...base, issueTime: null, bulletinTime: '2026-01-15 10:40:00.000Z', mostRecent: 1 },
        { ...base, issueTime: '2026-01-15T10:40:00Z', mostRecent: 0 },
        { ...base, issueTime: '2026-01-15T10:40:00Z', validTimeTo: base.validTimeFrom },
        { ...base, issueTime: 'dün', bulletinTime: '' },
        { ...base, issueTime: '2026-01-15T10:40:00Z', rawTAF: 'TAF LTFM 151040Z 1512/1612 CAVOK' },
      ],
      { now: FIXTURE_NOW },
    )
    expect(items.map((t) => [t.issuedAt.toISOString(), t.mostRecent])).toEqual([
      ['2026-01-15T10:40:00.000Z', true],
      ['2026-01-15T10:40:00.000Z', false],
    ])
    expect(skipped.map((s) => s.reason)).toEqual(['time', 'time', 'raw_station_mismatch'])
  })
})
