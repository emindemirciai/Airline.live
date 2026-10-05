import {
  arrivalCoverageWindow,
  type ArrivalCoverageAggregateInput,
  type ArrivalCoverageProviderInput,
  type ArrivalCoverageRecord,
  type ArrivalCoverageResult,
  type ArrivalGeomOnlyObservation,
  type ArrivalObservation,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { summarizeArrivalCoverage } from './aggregate'
import { classifyArrivalRecord } from './classify'
import {
  ARRIVAL_COVERAGE_REPORT_HEADING,
  durationText,
  renderArrivalCoverageMarkdown,
  trNumber,
  trPercent,
  utcText,
  type ArrivalCoverageRenderMeta,
} from './render'
import {
  airborneAt,
  approach,
  ESB,
  IST,
  pointAtKm,
  record,
  rollout,
  SAMANDIRA,
  sample,
  SAW,
  T0,
} from './test/synthetic'

const S = 1000
const MIN = 60 * S
const HOUR = 60 * MIN

/** Pencere [T0 − 1 sa, T0 + 23 sa); kayıt kapanma sınırı T0 + 23 sa 15 dk. */
const JOB_START = T0 + 23 * HOUR + 45 * MIN
const WINDOW = arrivalCoverageWindow(JOB_START, 24)
const META: ArrivalCoverageRenderMeta = {
  source: { kind: 'admin', reportId: 7 },
  appVersion: '0.21.0',
}

/** IST'e inen kayıt: geoid'li yaklaşma ve pist üstünde yer örnekleri. */
function landedAtIst(start: number): ArrivalCoverageRecord {
  const air = approach({
    station: IST,
    bearingDeg: 180,
    startKm: 14,
    endKm: 3,
    startAglFt: 2500,
    endAglFt: 150,
    startTs: start,
    count: 30,
    withGeom: true,
  })
  const ground = rollout(IST, {
    startTs: start + 30 * 5 * S,
    count: 5,
    bearingDeg: 180,
    fromKm: 2,
    toKm: 1,
  })
  return record([...air, ...ground])
}

/** IST'te alçakta kaybolan kayıt: son örnek `endAglFt`, `endKm`. */
function lostAtIst(start: number, endAglFt: number, endKm: number, lastSeen?: number) {
  return record(
    approach({
      station: IST,
      bearingDeg: 180,
      startKm: 14,
      endKm,
      startAglFt: 2500,
      endAglFt,
      startTs: start,
      count: 20,
      withGeom: true,
    }),
    lastSeen,
  )
}

/** ESB'de yüksekte kaybolan kayıtlar (baro yöntemi, kural 2). */
function highAtEsb(start: number, endAglFt: number, endKm: number) {
  return record(
    approach({
      station: ESB,
      bearingDeg: 30,
      startKm: 14,
      endKm,
      startAglFt: 2900,
      endAglFt,
      startTs: start,
      count: 10,
      seenPosS: -0.2,
    }),
  )
}

/** SAW: Samandıra yönünde biten kayıt (other_field) ve inen kayıt. */
function towardsSamandira(start: number) {
  const p = pointAtKm(SAMANDIRA, 0, 0.5)
  return record([
    airborneAt(SAW, { ts: start, bearingDeg: 315, km: 10, aglFt: 1500, withGeom: true }),
    sample({ ts: start + 30 * S, lat: p.lat, lon: p.lon, altBaroFt: 900, altGeomFt: 1020 }),
  ])
}

function landedAtSaw(start: number) {
  const air = approach({
    station: SAW,
    bearingDeg: 60,
    startKm: 12,
    endKm: 2,
    startAglFt: 2000,
    endAglFt: 100,
    startTs: start,
    count: 12,
    withGeom: true,
    seenPosS: null,
  })
  return record([
    ...air,
    ...rollout(SAW, {
      startTs: start + 12 * 5 * S,
      count: 3,
      bearingDeg: 60,
      fromKm: 1.5,
      toKm: 1,
    }),
  ])
}

const PROVIDER: ArrivalCoverageProviderInput = {
  provider: 'adsbLol',
  hours: Array.from({ length: 24 }, (_, i) => ({
    hour: WINDOW.start + i * HOUR,
    present: i !== 5,
    requests: i === 5 ? 0 : 360,
    successes: i === 5 ? 0 : i === 6 ? 0 : 355,
    rateLimited: i === 5 ? 0 : 3,
    serverErrors: i === 7 ? 2 : 0,
    networkErrors: i === 6 ? 360 : 0,
    otherErrors: 0,
    freshnessP95MaxS: i === 5 ? null : 2 + (i % 4),
  })),
  spans: [
    { status: 'ok', from: WINDOW.start, to: T0 + 4 * HOUR },
    { status: 'down', from: T0 + 4 * HOUR, to: T0 + 6 * HOUR },
    { status: 'ok', from: T0 + 6 * HOUR, to: WINDOW.end },
  ],
}

function fixtureInput(): ArrivalCoverageAggregateInput {
  const records = [
    landedAtIst(T0),
    lostAtIst(T0 + HOUR, 200, 2.5),
    lostAtIst(T0 + 2 * HOUR, 600, 4),
    // Pencerede ama kaydı açık: sayılmaz, ayrıca bildirilir.
    lostAtIst(T0 + 22 * HOUR + 50 * MIN, 300, 3, JOB_START - 10 * MIN),
    towardsSamandira(T0 + 3 * HOUR),
    landedAtSaw(T0 + 4 * HOUR),
    highAtEsb(T0 + 5 * HOUR, 1800, 9),
    highAtEsb(T0 + 6 * HOUR, 1400, 10),
    highAtEsb(T0 + 7 * HOUR, 1200, 11),
  ]
  const observations: ArrivalObservation[] = []
  const geomOnly: ArrivalGeomOnlyObservation[] = []
  for (const r of records) {
    const c = classifyArrivalRecord(r, [IST, SAW, ESB], { closedCutoffTs: WINDOW.closedCutoff })
    observations.push(...c.arrivals)
    geomOnly.push(...c.geomOnly)
  }
  return {
    window: WINDOW,
    hours: 24,
    stations: [IST, SAW, ESB],
    observations,
    geomOnly,
    windowStats: [
      {
        icao: 'LTFM',
        airborneSamples: 4000,
        baroRateNull: 40,
        seenPosNull: 20,
        firstBaroRateTs: WINDOW.start + 5 * S,
      },
      {
        icao: 'LTFJ',
        airborneSamples: 1000,
        baroRateNull: 30,
        seenPosNull: 120,
        firstBaroRateTs: WINDOW.start + 30 * S,
      },
      {
        icao: 'LTAC',
        airborneSamples: 500,
        baroRateNull: 5,
        seenPosNull: 0,
        firstBaroRateTs: WINDOW.start + 3 * HOUR,
      },
    ],
    provider: PROVIDER,
    qnh: [
      { icao: 'LTAC', observedAt: T0 + 4 * HOUR + 30 * MIN, qnhHpa: 1003 },
      { icao: 'LTAC', observedAt: T0 + 6 * HOUR + 30 * MIN, qnhHpa: 1025 },
      { icao: 'LTFM', observedAt: T0 - 20 * MIN, qnhHpa: 1015 },
    ],
  }
}

function fixtureResult(): ArrivalCoverageResult {
  return summarizeArrivalCoverage(fixtureInput())
}

/** Başlıktan bir sonraki `##` ya da `###` başlığına kadar (`####` alt başlıkları içeride). */
function section(markdown: string, heading: string, after = ''): string {
  const from = markdown.indexOf(after)
  const start = markdown.indexOf(heading, from < 0 ? 0 : from)
  if (start < 0) throw new Error(`no heading ${heading}`)
  const rest = markdown.slice(start + heading.length)
  const end = rest.search(/\n#{2,3} /)
  return end < 0 ? rest : rest.slice(0, end)
}

describe('biçim yardımcıları', () => {
  it('Türkçe sayı: binlik nokta, ondalık virgül, U+2212 eksi; eksi sıfır yazılmaz', () => {
    expect(trNumber(1234.5, 1)).toBe('1.234,5')
    expect(trNumber(1_000_000)).toBe('1.000.000')
    expect(trNumber(999)).toBe('999')
    expect(trNumber(-300)).toBe('−300')
    expect(trNumber(-0.04, 1)).toBe('0,0')
    expect(trNumber(Number.NaN)).toBe('—')
  })

  it('yüzde %33,3 biçiminde; boşsa uzun çizgi', () => {
    expect(trPercent(1 / 3)).toBe('%33,3')
    expect(trPercent(0.0014, 2)).toBe('%0,14')
    expect(trPercent(null)).toBe('—')
  })

  it('UTC zaman Z ile; saniye yalnızca varsa', () => {
    expect(utcText('2026-10-05T09:15:00.000Z')).toBe('2026-10-05 09:15Z')
    expect(utcText('2026-10-05T09:15:27.500Z')).toBe('2026-10-05 09:15:27Z')
    expect(utcText(null)).toBe('—')
  })

  it('süre sa ve dk ile', () => {
    expect(durationText(45 * MIN)).toBe('45 dk')
    expect(durationText(24 * HOUR)).toBe('24 sa')
    expect(durationText(23 * HOUR + 40 * MIN)).toBe('23 sa 40 dk')
  })
})

describe('kapsama raporu Markdown', () => {
  const result = fixtureResult()
  const markdown = renderArrivalCoverageMarkdown(result, META)

  it('başlık: kaynak, pencere, iş başlangıcı, etkin pencere, tanım sürümü, toplamlar', () => {
    expect(markdown.startsWith(`${ARRIVAL_COVERAGE_REPORT_HEADING}\n\n`)).toBe(true)
    expect(markdown).toContain(
      '- **Kaynak:** üretim veritabanı, admin raporu #7; uygulama sürümü v0.21.0',
    )
    expect(markdown).toContain('- **Pencere (UTC):** 2026-10-05 09:00Z – 2026-10-06 09:00Z (24 sa)')
    expect(markdown).toContain(
      '- **İş başlangıcı:** 2026-10-06 09:45Z; kapanma payı 45 dk, kayıt kapanma sınırı 30 dk, geriye bakış 24 sa',
    )
    expect(markdown).toContain('- **Etkin pencere başlangıcı:** 2026-10-05 09:00:05Z')
    expect(markdown).toContain('- **Tanım sürümü:** 1')
    expect(markdown).toContain(
      '- **Sayılan varış:** 8; yerde örneği görülen: 2; kaydı açık olduğu için sayılmayan: 1',
    )
  })

  it('uyarılar: geç etkin pencere, veri boşluğu, açık kayıt, satırsız saat, DUR-SOR', () => {
    const warnings = section(markdown, '**Uyarılar:**')
    expect(warnings).toContain(
      '- LTAC (ESB): etkin pencere başlangıcı 2026-10-05 12:00Z (pencere başından 3 sa sonra; öncesinde `baro_rate` yok).',
    )
    expect(warnings).toContain(
      '- LTFJ (SAW): havadaki ince örneklerde `baro_rate` boş %3,0, `seen_pos` boş %12,0 (uyarı eşiği %5).',
    )
    expect(warnings).not.toContain('LTFM (IST): havadaki')
    expect(warnings).toContain('- Kaydı hâlâ açık olduğu için sayılmayan varış: 1 ')
    expect(warnings).toContain(
      '- Sağlayıcı satırı olmayan saat: 1/24 (pencereye değen UTC saatleri; ingest çalışmıyordu).',
    )
    expect(warnings).toContain('- DUR-SOR: kural 2 uygulanıyor: LTFJ (SAW), LTAC (ESB).')
  })

  it('özet tablosu: istasyon başına satır, yüzde, Wilson, medyanlar, yöntem, 429 oranı, kurallar', () => {
    const summary = section(markdown, '## Özet')
    const rows = summary.split('\n').filter((l) => l.startsWith('| LT'))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toBe(
      '| LTFM (IST) | 3 | %33,3 (1/3) | %6,1–%79,2 | 200 ft | 0,5 km | 3 / 0 | %0,83 | ' +
        'uygulanır, sınırda, az örnek | uygulanmaz, az örnek |',
    )
    // Diğer alan (other_field) eşikten uzakta: eşiğe medyan > 8 km, kural 2.
    expect(rows[1]).toBe(
      '| LTFJ (SAW) | 2 | %50,0 (1/2) | %9,5–%90,5 | 342 ft | 8,5 km | 2 / 0 | %0,83 | ' +
        'uygulanır, sınırda, az örnek | uygulanır (DUR-SOR), az örnek |',
    )
    // Baro yöntemi: medyan AGL'nin baro aralığı parantezde (QNH sapmasıyla +317 ft'e genişler).
    expect(rows[2]).toBe(
      '| LTAC (ESB) | 3 | %0,0 (0/3) | %0,0–%56,1 | 1.400 ft (1.100–1.717) | 10,0 km | ' +
        '0 / 3 | %0,83 | uygulanır, az örnek | uygulanır (DUR-SOR), az örnek |',
    )
    expect(summary).toContain(
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    )
  })

  it('karar kuralları: Wilson aralığı, duyarlılık, sınıflar, geometrik hız satırı, DUR-SOR önerileri', () => {
    const ist = section(markdown, '### LTFM (IST)', '## Karar kuralları')
    expect(ist).toContain(
      '- **Kural 1 (yerde örneği payı < %70): uygulanır, sınırda, az örnek.** Pay %33,3 (1/3), ' +
        'Wilson %95 aralığı %6,1–%79,2. Bu istasyonda inişler varsayılan olarak "muhtemel" sunulur.',
    )
    expect(ist).toContain('`lost_low` 2, `left_zone` 0, `other_field` 0.')
    expect(ist).toContain('#### Alçakta kaybolan varışlar (`lost_low`, n = 2)')
    expect(ist).toContain('| p50 | 500 ft | 1,0 km | %50,0 (1/2) |')
    expect(ist).toContain('| p50 | 500 ft | 3,5 km | %50,0 (1/2) |')
    expect(ist).toContain('| `high` | AGL ≤ 300 ft, eşiğe ≤ 3 km | %50,0 (1/2) | %66,7 (2/3) |')
    expect(ist).not.toContain('**DUR-SOR:**')

    // Kural 2 uygulanır ama `lost_low` yok: DUR-SOR bütün varışların önerilerine yönlendirir ve
    // o öneriler basılır.
    const saw = section(markdown, '### LTFJ (SAW)', '## Karar kuralları')
    expect(saw).toContain('`lost_low` 0, `left_zone` 0, `other_field` 1.')
    expect(saw).toContain('Duyarlılık (`left_zone` ve `other_field` hariç): %100,0 (1/1).')
    expect(saw).toContain('`lost_low` varış yok; eşik önerisi çıkarılmadı.')
    expect(saw).toContain(
      '  - **DUR-SOR:** bugünkü `high` ve `medium` kuralları bu istasyonda inişlerin çoğunu ' +
        'kaçırır. Aşağıdaki bütün varış önerilerinden birini seç ya da yeni eşik söyle ' +
        '(`lost_low` önerisi yok).',
    )
    const sawAll = saw.slice(saw.indexOf('#### Bütün varışlar (n = 2)'))
    expect(sawAll).toContain("AGL'si bilinen: 2; medyanlar kural 2 satırında.")
    expect(sawAll).toMatch(/\| p50 \| [\d.]+ ft \| [\d,]+ km \| %[\d,]+ \(\d\/2\)/)
    expect(sawAll).toContain("| Yüzdelik | AGL ≤ | ARP'a ≤ | Birlikte yakalanan |")
    expect(sawAll).toMatch(/\| p90 \| [\d.]+ ft \| [\d,]+ km \| %[\d,]+ \(\d\/2\)/)

    const esb = section(markdown, '### LTAC (ESB)', '## Karar kuralları')
    expect(esb).toContain(
      '- **Kural 2 (medyan AGL > 1.000 ft ya da eşiğe medyan mesafe > 8 km): uygulanır (DUR-SOR), az örnek.**',
    )
    expect(esb).toContain(
      '  - **DUR-SOR:** bugünkü `high` ve `medium` kuralları bu istasyonda inişlerin çoğunu ' +
        'kaçırır. Aşağıdaki `lost_low` ya da bütün varış önerilerinden birini seç ya da yeni eşik söyle.',
    )
    expect(esb).toContain('#### Bütün varışlar (n = 3)')
    expect(esb).toContain('| Yüzdelik | AGL ≤ | Eşiğe ≤ | Birlikte yakalanan |')
    expect(esb).toContain("| Yüzdelik | AGL ≤ | ARP'a ≤ | Birlikte yakalanan |")
    // Baro yöntemi: paylar baro aralığıyla yazılır.
    expect(esb).toContain('| p50 | 1.400 ft | 10,0 km | %33,3 (1/3); baro aralığı %0,0–%33,3 |')
    expect(esb).toContain("| `low` | AGL < 3.000 ft, ARP'a ≤ 20 km | %100,0 (3/3) | %100,0 (3/3) |")
    expect(esb).toContain('| `high` ∪ `medium` | ikisinden biri |')
  })

  it('istasyon ayrıntıları: dağılım tabloları, kovalar, seen_pos, QNH, ±300 notu yalnızca baroda', () => {
    const ist = section(markdown, '### LTFM (IST)', '## İstasyon ayrıntıları')
    expect(ist).toContain('geoid N 37,05 m (istasyon kaydı)')
    expect(ist).toContain('- AGL yöntemi: geoid 3, baro 0, bilinmiyor 0.')
    expect(ist).not.toContain('belirsizlik taşır')
    expect(ist).toContain('- Pist eşiği: 2; pist ucu yükseklikleri alana göre −25…+5 ft.')
    expect(ist).toContain(
      '- QNH (METAR, pencerede 1 gözlem): 1.015 hPa; baro sapması +47 ft. QNH düzeltmeli medyan AGL 222 ft (n = 2; yalnızca duyarlılık).',
    )
    expect(ist).toContain(
      '| AGL (ft) | < 0 | 0–300 | 300–1.000 | 1.000–2.000 | 2.000–3.000 | ≥ 3.000 | bilinmiyor |',
    )
    expect(ist).toContain('| Mesafe (km) | 0–3 | 3–8 | 8–15 | 15–30 | ≥ 30 |')
    expect(ist).toContain(
      '| `seen_pos` (sn) | < 0 | 0–1 | 1–2 | 2–5 | 5–10 | 10–30 | 30–60 | ≥ 60 | bilinmiyor |',
    )
    expect(ist).toMatch(/\| Örnek \| 0 \| \d+ \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \|/)

    const saw = section(markdown, '### LTFJ (SAW)', '## İstasyon ayrıntıları')
    expect(saw).toContain('geoid N 37,61 m (araştırma tablosu')
    expect(saw).toContain('- QNH (METAR): pencerede gözlem yok; duyarlılık hesaplanmadı.')
    expect(saw).toContain(
      '  - Geoid ondülasyonu istasyon kaydında yok; araştırma tablosundaki değer kullanıldı.',
    )
    // seen_pos'u olmayan örnekler "bilinmiyor" kovasında.
    expect(saw).toMatch(/\| Örnek \| 0 \| \d+ \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| [1-9]\d* \|/)

    const esb = section(markdown, '### LTAC (ESB)', '## İstasyon ayrıntıları')
    expect(esb).toContain('geoid N yok (AGL baro yöntemiyle)')
    expect(esb).toContain("Baro yöntemindeki AGL'ler ±300 ft belirsizlik taşır.")
    expect(esb).toContain(
      '- Pist eşiği: 1 (yalnızca ARP yedeği); pist ucu yükseklikleri bilinmiyor.',
    )
    expect(esb).toContain(
      '- QNH (METAR, pencerede 2 gözlem): 1.003…1.025 hPa; baro sapması −277…+317 ft.',
    )
    expect(esb).toContain('- Baro aralığı: −300…+317 ft.')
    expect(esb).toContain('METAR QNH sapması ±300 ft aralığını aşıyor')
    // Negatif seen_pos "< 0" kovasında.
    expect(esb).toMatch(/\| Örnek \| [1-9]\d* \| 0 \|/)
  })

  it('sağlayıcı bölümü: satırsız ve başarısız saat, 429 ve 5xx payı, tazelik, durum süreleri', () => {
    const provider = section(markdown, '## 429 ve veri sürekliliği (ADSB.lol)')
    expect(provider).toContain('Sayaçlar pencereye değen UTC saatlerinin satırlarıdır.')
    expect(provider).toContain(
      '| Pencereye değen UTC saatleri | 24 (2026-10-05 09:00Z – 2026-10-06 09:00Z) |',
    )
    expect(provider).toContain('| Satırı olmayan saat (ingest çalışmıyor) | 1 |')
    expect(provider).toContain('| Satırı olup başarısı 0 olan saat | 1 |')
    expect(provider).toContain('| İstek | 8.280 |')
    expect(provider).toContain('| 429/420 (hız sınırı) | 69 (%0,83) |')
    expect(provider).toContain('| 5xx | 2 (%0,02) |')
    expect(provider).toContain("| Saatlik tazelik p95'inin en yükseği | 5,0 sn |")
    expect(provider).toContain('| Durum `down` | 2 sa |')
    expect(provider).toContain('| Durum `ok` | 22 sa |')
  })

  it('yöntem ve atıf: tanım sayıları sonuçtan, fine yakalama kuralı, ODbL bağlantıları', () => {
    const method = section(markdown, '## Yöntem ve tanımlar')
    expect(method).toContain(
      "ARP'ına ≤ 30 km ve yerde ya da `alt_baro − alan yüksekliği < 10.000 ft`",
    )
    expect(method).toContain('ham `baro_rate < −300 fpm`')
    expect(method).toContain('LTAI 27,36 m, LTFJ 37,61 m, LTFM 37,05 m')
    expect(method).toContain('`max(120 sn, 3 × medyan örnek aralığı)`')
    // Aday kutusu: 15,5 km yarı genişliktir; geometrik hız satırları da döner.
    expect(method).toContain(
      'ARP çevresinde yarı genişliği 15,5 km (kenarı ≈ 31 km) olan enlem/boylam kutusu',
    )
    expect(method).toContain("15 km'lik çemberi tümüyle kapsar")
    expect(method).toContain(
      "`baro_rate` boşken görünen dikey hızı −300 fpm'in altında olan satırlar",
    )
    expect(method).toContain('geçişler pencere sonundan 10 dk sonrasına kadar okunur')
    expect(method).toContain('`lost_low` varışlarında ve bütün varışlarda ayrı ayrı')
    expect(markdown).toContain(
      '- Canlı uçuş verisi: [ADSB.lol](https://adsb.lol) — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Bu rapor, ODbL 1.0 md. 4.3',
    )
    expect(markdown).toContain('[OurAirports](https://ourairports.com/data/)')
    expect(markdown).toContain('[NOAA Aviation Weather Center](https://aviationweather.gov/)')
  })

  it('LF satır sonları, tek bitiş satır sonu, üç boş satır yok; aynı girdi aynı metin', () => {
    expect(markdown).not.toContain('\r')
    expect(markdown.endsWith('\n')).toBe(true)
    expect(markdown.endsWith('\n\n')).toBe(false)
    expect(markdown).not.toMatch(/\n{3,}/)
    expect(renderArrivalCoverageMarkdown(fixtureResult(), META)).toBe(markdown)
    // Sonuç JSON'dan geri okunduğunda (rapor satırı) metin değişmez.
    const roundTrip = JSON.parse(JSON.stringify(result)) as ArrivalCoverageResult
    expect(renderArrivalCoverageMarkdown(roundTrip, META)).toBe(markdown)
  })

  it('tablo hücrelerinde dikey çizgi kaçışlanır; her tablo satırının sütun sayısı başlıkla aynı', () => {
    const lines = markdown.split('\n')
    let columns = 0
    for (const line of lines) {
      if (!line.startsWith('|')) {
        columns = 0
        continue
      }
      const count = line.replaceAll('\\|', '').split('|').length - 2
      if (columns === 0) columns = count
      expect(count).toBe(columns)
    }
  })
})

describe('kenar durumları', () => {
  it('varışsız istasyon, sağlayıcı sayacı yok, yerel kaynak', () => {
    const input = fixtureInput()
    const result = summarizeArrivalCoverage({
      ...input,
      observations: input.observations.filter((o) => o.icao !== 'LTFJ'),
      geomOnly: [],
      provider: null,
      qnh: [],
    })
    const markdown = renderArrivalCoverageMarkdown(result, {
      source: { kind: 'local' },
      appVersion: 'v0.21.0',
    })
    expect(markdown).toContain(
      '- **Kaynak:** yerel veritabanı (`pnpm coverage:report`); uygulama sürümü v0.21.0',
    )
    expect(section(markdown, '### LTFJ (SAW)', '## Karar kuralları')).toContain(
      'Sayılan varış yok; kurallar değerlendirilemedi',
    )
    expect(markdown).toMatch(
      /\| LTFJ \(SAW\) \| 0 \| — \| — \| — \| — \| 0 \/ 0 \| — \| varış yok \| varış yok \|/,
    )
    expect(markdown).toContain('Sağlayıcı sayaçları bu raporda yok (yerel ölçüm).')
    expect(markdown).not.toContain('NOAA Aviation Weather Center')
  })

  it('kural 2 uygulanır, AGL bilinmiyor: DUR-SOR öneri olmadığını söyler, boş tablo basılmaz', () => {
    const result = JSON.parse(JSON.stringify(fixtureResult())) as ArrivalCoverageResult
    const saw = result.stations.find((s) => s.icao === 'LTFJ')
    if (saw === undefined) throw new Error('no LTFJ')
    saw.all.withAgl = 0
    saw.all.proposals = { threshold: [], arp: [] }
    const block = section(
      renderArrivalCoverageMarkdown(result, META),
      '### LTFJ (SAW)',
      '## Karar kuralları',
    )
    expect(block).toContain(
      "kaçırır. AGL'si bilinen varış olmadığı için eşik önerisi çıkarılamadı; yeni eşik söyle.",
    )
    expect(block).toContain("AGL'si bilinen varış yok; eşik önerisi çıkarılmadı.")
    expect(block).not.toContain('| Yüzdelik |')
  })

  it("baro_rate'i olmayan istasyon uyarıda ve notta; uyarı yoksa 'yok' yazılır", () => {
    const input = fixtureInput()
    const noBaro = summarizeArrivalCoverage({
      ...input,
      stations: [ESB],
      observations: [],
      geomOnly: [],
      windowStats: [
        {
          icao: 'LTAC',
          airborneSamples: 50,
          baroRateNull: 50,
          seenPosNull: 50,
          firstBaroRateTs: null,
        },
      ],
      provider: null,
    })
    const markdown = renderArrivalCoverageMarkdown(noBaro, META)
    expect(markdown).toContain(
      "- LTAC (ESB): pencerede `baro_rate`'i dolu örnek yok; varış sayılamadı.",
    )
    expect(markdown).toContain('- **Etkin pencere başlangıcı:** yok')
    expect(markdown).toContain(
      "Pencerede `baro_rate`'i dolu örnek yok; bu istasyonda varış sayılamadı.",
    )

    const clean = summarizeArrivalCoverage({
      ...input,
      stations: [IST],
      observations: input.observations.filter((o) => o.icao === 'LTFM' && o.recordClosed),
      windowStats: [
        {
          icao: 'LTFM',
          airborneSamples: 100,
          baroRateNull: 0,
          seenPosNull: 0,
          firstBaroRateTs: WINDOW.start,
        },
      ],
      provider: null,
    })
    expect(
      renderArrivalCoverageMarkdown(clean, { source: { kind: 'probe' }, appVersion: '1.0.0' }),
    ).toContain('**Uyarılar:** yok.')
  })
})
