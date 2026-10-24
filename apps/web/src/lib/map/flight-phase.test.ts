import {
  bearingDifference,
  destinationPoint,
  distanceKm,
  initialBearing,
  type LatLon,
} from '@havayolu/geo'
import type { PublicAircraft } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  CONFIRM_MS,
  displayPhase,
  FlightPhaseTracker,
  type PhaseAirportInput,
  type PhaseInfo,
} from './flight-phase'

// LTFM geometrisi tools/src/scenarios/airports.ts'ten kopyalandı (OurAirports, commit'li alt küme):
// ARP, alan yüksekliği 325 ft; 35L eşiği ve pistin karşı ucu (17R). Pist yönü uçlardan (≈ 359,1°).
const IST_ARP: LatLon = { lat: 41.274874, lon: 28.732136 }
const T35L: LatLon = { lat: 41.26190185546875, lon: 28.725299835205078 }
const T17R: LatLon = { lat: 41.29880142211914, lon: 28.72450065612793 }
const B35L = initialBearing(T35L, T17R)

const LTFM: PhaseAirportInput = {
  icao: 'LTFM',
  iata: 'IST',
  ...IST_ARP,
  elevationFt: 325,
  scheduled: true,
  runways: [
    {
      ends: [
        { ident: '35L', trueBearingDeg: B35L, ...T35L },
        { ident: '17R', trueBearingDeg: initialBearing(T17R, T35L), ...T17R },
      ],
    },
  ],
}
// SAW ve Atatürk (ISL): OurAirports merkezleri, rakımları ve tarifeli sefer bilgisi (Atatürk'te
// tarifeli sefer yoktur, `scheduled_service` "no"); pist uçları gerekmez.
const SAW_ARP: LatLon = { lat: 40.898602, lon: 29.3092 }
const LTFJ: PhaseAirportInput = {
  icao: 'LTFJ',
  iata: 'SAW',
  ...SAW_ARP,
  elevationFt: 312,
  scheduled: true,
  runways: [],
}
const LTBA: PhaseAirportInput = {
  icao: 'LTBA',
  iata: 'ISL',
  lat: 40.976898,
  lon: 28.8146,
  elevationFt: 163,
  scheduled: false,
  runways: [],
}
// Van: merkez ve rakım OurAirports'tan (5.480 ft); pist ucu yapaydır (eşik merkezin 1,5 km
// güneybatısında, yön 030), testte yalnızca rakımın kullanıldığı gösterilir.
const VAN_ARP: LatLon = { lat: 38.46820068359375, lon: 43.332298278808594 }
const VAN_THRESHOLD = destinationPoint(VAN_ARP, 210, 1.5)
const LTCI: PhaseAirportInput = {
  icao: 'LTCI',
  iata: 'VAN',
  ...VAN_ARP,
  elevationFt: 5480,
  scheduled: true,
  runways: [{ ends: [{ ident: '03', trueBearingDeg: 30, ...VAN_THRESHOLD }] }],
}

const AIRPORTS = [LTFM, LTFJ, LTBA, LTCI]

/** 35L son yaklaşmasında, pist eşiğine `km` uzaklıkta (merkez hattında). */
const onFinal = (km: number) => destinationPoint(T35L, B35L + 180, km)
/** IST merkezinden `bearing` yönünde `km` uzaklıkta. */
const fromIst = (bearing: number, km: number) => destinationPoint(IST_ARP, bearing, km)
/** SAW merkezinden `bearing` yönünde `km` uzaklıkta. */
const fromSaw = (bearing: number, km: number) => destinationPoint(SAW_ARP, bearing, km)

function sample(at: LatLon, over: Partial<PublicAircraft> = {}): PublicAircraft {
  return {
    hex: '4bb26c',
    lat: at.lat,
    lon: at.lon,
    alt: null,
    gnd: false,
    gs: 140,
    trk: null,
    vr: null,
    cs: 'THY974',
    fn: { airline: 'TK', number: '974' },
    reg: 'TC-LSA',
    type: 'A21N',
    cat: 'A3',
    sq: null,
    src: 'adsbLol',
    psrc: 'adsb_icao',
    t: 1_000,
    ...over,
  }
}

function tracker(airports: readonly PhaseAirportInput[] = AIRPORTS): FlightPhaseTracker {
  const result = new FlightPhaseTracker()
  result.setAirports(airports)
  return result
}

/** Yeni görülen uçağın ilk durumu (beklemeden gösterilir). */
function classifyOnce(
  ac: PublicAircraft,
  airports: readonly PhaseAirportInput[] = AIRPORTS,
): PhaseInfo {
  const phases = tracker(airports)
  phases.observe([ac])
  const info = phases.get(ac.hex)
  if (info === undefined) throw new Error('aircraft was not classified')
  return info
}

/** Örnek dizisini sırayla verir; her örnekten sonraki durumu döndürür. */
function run(phases: FlightPhaseTracker, samples: readonly PublicAircraft[]): PhaseInfo[] {
  return samples.map((ac) => {
    phases.observe([ac])
    const info = phases.get(ac.hex)
    if (info === undefined) throw new Error('aircraft was not classified')
    return info
  })
}

/** Uçuş bacağı: sabit iz yönü (derece), süre (sn) ve dikey hız (ft/dk). */
interface Leg {
  trk: number
  secs: number
  vr: number
}

/**
 * Sabit yer hızıyla uçulan bacaklar, 2 sn arayla örneklenir (ADS-B akışına yakın). Örnek başına
 * konum, irtifa (dikey hızdan) ve iz yönü; dönüşte gösterilen durumların dizisi.
 */
function fly(start: LatLon, alt0: number, gsKt: number, legs: readonly Leg[]): PhaseInfo[] {
  const phases = tracker()
  const samples: PublicAircraft[] = []
  const kmPerSample = (gsKt * 1.852 * 2) / 3600
  let at = start
  let alt = alt0
  let t = 0
  for (const leg of legs) {
    for (let s = 0; s < leg.secs; s += 2) {
      samples.push(sample(at, { alt: Math.round(alt), vr: leg.vr, trk: leg.trk, gs: gsKt, t }))
      at = destinationPoint(at, leg.trk, kmPerSample)
      alt += (leg.vr * 2) / 60
      t += 2000
    }
  }
  return run(phases, samples)
}

/** Yaklaşmada ya da inişte gösterilen havalimanlarının ICAO kodları (sırasız, tekil). */
function arrivalAirports(infos: readonly PhaseInfo[]): string[] {
  const codes = new Set<string>()
  for (const info of infos) {
    if ((info.phase === 'approaching' || info.phase === 'landing') && info.airport) {
      codes.add(info.airport.icao)
    }
  }
  return [...codes].sort()
}

describe('FlightPhaseTracker: durum kuralları (D-085)', () => {
  it('1. havalimanında taksi: Yerde, IST', () => {
    const info = classifyOnce(sample(fromIst(90, 1), { gnd: true, gs: 15 }))
    expect(info).toMatchObject({ phase: 'onGround', airport: { icao: 'LTFM', iata: 'IST' } })
    expect(info.distanceKm).toBeCloseTo(1, 6)
    expect(info.aglFt).toBeNull()
  })

  it('2. havalimanından 20 km uzakta yerde: Yerde; konum en yakın havalimanına göre', () => {
    const info = classifyOnce(sample(fromIst(270, 20), { gnd: true }))
    expect(info.phase).toBe('onGround')
    expect(info.airport?.icao).toBe('LTFM')
    expect(info.distanceKm).toBeCloseTo(20, 6)
    expect(info.bearingDeg).toBeCloseTo(270, 0)
  })

  it('3. 35L son yaklaşmasında, eşiğe 5 km, yerden 893 ft, alçalıyor: İnişte, pist 35L', () => {
    const info = classifyOnce(sample(onFinal(5), { alt: 1218, vr: -700, trk: B35L }))
    expect(info).toMatchObject({ phase: 'landing', runway: '35L', aglFt: 893 })
    expect(info.airport?.icao).toBe('LTFM')
    expect(info.distanceKm).toBeCloseTo(distanceKm(onFinal(5), IST_ARP), 9)
  })

  it('4. 35L son yaklaşmasında 18 km: Yaklaşmada (hizalı kural 15 km’de biter, merkez kuralı tutar)', () => {
    const info = classifyOnce(sample(onFinal(18), { alt: 3451, vr: -900, trk: B35L }))
    expect(info).toMatchObject({ phase: 'approaching', runway: null })
    expect(info.airport?.icao).toBe('LTFM')
    // Hizalı yaklaşma (15 km içinde, < 4.000 ft) pist adını verir.
    const aligned = classifyOnce(sample(onFinal(12), { alt: 3200, vr: -900, trk: B35L }))
    expect(aligned).toMatchObject({ phase: 'approaching', runway: '35L' })
  })

  it('5. 9.000 ft, 25 km güneyde, havalimanına doğru alçalıyor: Yaklaşmada', () => {
    const info = classifyOnce(sample(fromIst(180, 25), { alt: 9000, vr: -1500, trk: 0 }))
    expect(info.phase).toBe('approaching')
    expect(info.airport?.icao).toBe('LTFM')
  })

  it('6. aynı uçak havalimanından uzaklaşıyor (ilk örnek): yalnızca konum', () => {
    const info = classifyOnce(sample(fromIst(180, 25), { alt: 9000, vr: -1500, trk: 180 }))
    expect(info.phase).toBe('enRoute')
    // Konum en yakın havalimanına göredir, tarifesi olmasa da: Atatürk (~11 km). Uçak 5. durumda da
    // Atatürk'ün üstünden geçer; ona "yaklaşmada" sayılmaz (tarifesiz; ayrıca süzülüş zarfının üstü).
    expect(info.airport?.icao).toBe('LTBA')
  })

  it('7. kalkış: 3.000 ft, 5 km, tırmanıyor: yalnızca konum', () => {
    const info = classifyOnce(sample(fromIst(0, 5), { alt: 3000, vr: 2000, trk: 0 }))
    expect(info.phase).toBe('enRoute')
  })

  it('8. seyir: 35.000 ft, 45 km kuzeyde: yalnızca konum, yön kuzey', () => {
    const info = classifyOnce(sample(fromIst(0, 45), { alt: 35000, vr: 0, trk: 90 }))
    expect(info).toMatchObject({ phase: 'enRoute', airport: { icao: 'LTFM' }, runway: null })
    expect(info.distanceKm).toBeCloseTo(45, 6)
    expect(bearingDifference(info.bearingDeg ?? Number.NaN, 0)).toBeLessThan(1e-6)
  })

  it('9. 35.000 ft, merkeze 2 km: yalnızca konum (metin "IST üzerinde")', () => {
    const info = classifyOnce(sample(fromIst(90, 2), { alt: 35000, vr: 0, trk: 270 }))
    expect(info.phase).toBe('enRoute')
    expect(info.distanceKm).toBeCloseTo(2, 6)
  })

  it('10. süzülüş zarfı: 12 km’de 9.500 ft alçalıp yaklaşan uçak yaklaşmada sayılmaz', () => {
    // 12 km ≈ 6,5 NM: 2 × 318 ft/NM × 6,5 ≈ 4.120 ft (+300 tolerans).
    const high = classifyOnce(sample(fromIst(90, 12), { alt: 9500, vr: -1500, trk: 270 }))
    expect(high.phase).toBe('enRoute')
    const onProfile = classifyOnce(sample(fromIst(90, 12), { alt: 3800, vr: -1500, trk: 270 }))
    expect(onProfile.phase).toBe('approaching')
  })

  it('11. iki havalimanı: yönelinen seçilir; hizalı pist yakındaki havalimanından önce gelir', () => {
    // IST ile Atatürk arasında, IST'ye 20 km (Atatürk ~14 km, daha yakın ama arkada).
    const between = destinationPoint(IST_ARP, initialBearing(IST_ARP, LTBA), 20)
    const towardsIst = classifyOnce(
      sample(between, { alt: 5000, vr: -1000, trk: initialBearing(between, IST_ARP) }),
    )
    expect(towardsIst).toMatchObject({ phase: 'approaching', airport: { icao: 'LTFM' } })
    expect(distanceKm(between, LTBA)).toBeLessThan(distanceKm(between, IST_ARP))

    // 35L'ye hizalı uçağın 5 km önünde (merkez hattında) pist ucu bilinmeyen başka bir tarifeli
    // havalimanı: merkez kuralı tam önündekini seçerdi, hizalı pist IST'yi seçer.
    const final12 = onFinal(12)
    const nearby: PhaseAirportInput = {
      icao: 'LTXA',
      iata: 'XAA',
      ...destinationPoint(final12, B35L, 5),
      elevationFt: 0,
      scheduled: true,
      runways: [],
    }
    const ac = sample(final12, { alt: 3000, vr: -800, trk: B35L })
    expect(classifyOnce(ac, [LTFM, nearby])).toMatchObject({
      phase: 'approaching',
      airport: { icao: 'LTFM' },
      runway: '35L',
    })
    const istWithoutEnds = { ...LTFM, runways: [] }
    expect(classifyOnce(ac, [istWithoutEnds, nearby])).toMatchObject({
      phase: 'approaching',
      airport: { icao: 'LTXA' },
    })
  })

  it('12. çıkış eşikleri: yatay uçuşta yaklaşmada kalır; tırmanış 5 sn sürünce biter', () => {
    const phases = tracker()
    const at15 = fromIst(90, 15)
    const level = (t: number, vr: number) => sample(at15, { alt: 5000, vr, trk: 270, t })
    expect(run(phases, [level(0, -1000)])[0]?.phase).toBe('approaching')
    // 60 sn yatay uçuş (dikey hız 0): alçalmıyor ama tırmanmıyor da.
    const levelled = run(
      phases,
      Array.from({ length: 60 }, (_, i) => level((i + 1) * 1000, 0)),
    )
    expect(levelled.every((info) => info.phase === 'approaching')).toBe(true)
    // +500 ft/dk: yumuşatılmış değer 2. örnekte +300'ü aşar (t = 62 sn), 5 sn sonra biter.
    const climb = run(
      phases,
      Array.from({ length: 7 }, (_, i) => level((61 + i) * 1000, 500)),
    )
    expect(climb.map((info) => info.phase)).toEqual([
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'enRoute',
    ])
  })

  it('12b. inişte çıkış eşikleri daha geniştir; eşiği geçen uçak pist adını korur; pas geçen düşer', () => {
    // Yerden 1.475 ft ve yatay: girişte (< 1.300 ft, alçalıyor) olmazdı; çıkışta (< 1.800 ft,
    // tırmanmıyor) 7 sn boyunca inişte kalır.
    const levelled = run(tracker(), [
      sample(onFinal(5), { alt: 1218, vr: -700, trk: B35L, t: 0 }),
      ...Array.from({ length: 7 }, (_, i) =>
        sample(onFinal(4.8 - i * 0.07), { alt: 1800, vr: 0, trk: B35L, t: (i + 1) * 1000 }),
      ),
    ])
    expect(levelled.every((info) => info.phase === 'landing')).toBe(true)

    // Eşiği 0,5 km geçen uçak hizadan çıkar (merkez kuralıyla inişte kalır); pist adı korunur.
    const past = run(tracker(), [
      sample(onFinal(0.2), { alt: 380, vr: -700, trk: B35L, t: 0 }),
      sample(onFinal(-0.5), { alt: 340, vr: -700, trk: B35L, t: 1000 }),
    ])
    expect(past.map((info) => [info.phase, info.runway])).toEqual([
      ['landing', '35L'],
      ['landing', '35L'],
    ])

    const goAround = classifyOnce(sample(onFinal(3), { alt: 1500, vr: 1500, trk: B35L }))
    expect(goAround.phase).toBe('enRoute')
  })

  it('13. onay: yeni aday 5 sn sürünce gösterilir; gösterilene dönen örnek bekleyeni siler', () => {
    const near = (t: number) => sample(fromIst(90, 15), { alt: 5000, vr: -1000, trk: 270, t })
    const far = (t: number) => sample(fromIst(90, 40), { alt: 5000, vr: -1000, trk: 270, t })

    const held = run(tracker(), [near(0), far(1000), far(3000), far(5000), far(6000)])
    expect(held.map((info) => info.phase)).toEqual([
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'enRoute',
    ])
    // Beklerken gösterilen durumun uzaklığı yeni örnekle güncellenir.
    expect(held[1]?.distanceKm).toBeCloseTo(40, 6)
    expect(CONFIRM_MS).toBe(5000)

    const flipped = run(tracker(), [
      near(0),
      far(1000),
      near(3000),
      far(4000),
      far(6000),
      far(8000),
      far(9000),
    ])
    expect(flipped.map((info) => info.phase)).toEqual([
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'enRoute',
    ])
  })

  it('14. alçakta sinyal kaybı: inişteki uçağın son örneği 30 sn’den eskiyse', () => {
    const landing = classifyOnce(sample(onFinal(5), { alt: 1218, vr: -700, trk: B35L }))
    const sampledAt = 50_000
    expect(displayPhase(landing, sampledAt, sampledAt + 31_000)).toBe('lowAltLost')
    expect(displayPhase(landing, sampledAt, sampledAt + 29_000)).toBe('landing')
    // Yolda (ya da yüksekte yaklaşmada) eskiyen uçak durumunu korur.
    const cruise = classifyOnce(sample(fromIst(0, 45), { alt: 35000, vr: 0, trk: 90 }))
    expect(displayPhase(cruise, sampledAt, sampledAt + 90_000)).toBe('enRoute')
    const highApproach = classifyOnce(sample(fromIst(180, 25), { alt: 9000, vr: -1500, trk: 0 }))
    expect(displayPhase(highApproach, sampledAt, sampledAt + 90_000)).toBe('approaching')
    // Seyrek veride (D-122) çağıran Infinity verir: örnek dakikalarca eski olsa da sinyal kaybı yok.
    expect(displayPhase(landing, sampledAt, sampledAt + 600_000, Infinity)).toBe('landing')
    expect(displayPhase(landing, sampledAt, sampledAt + 31_000, 60_000)).toBe('landing')
    expect(displayPhase(landing, sampledAt, sampledAt + 61_000, 60_000)).toBe('lowAltLost')
  })

  it('15. irtifası bilinmeyen havadaki uçak: yalnızca konum', () => {
    const info = classifyOnce(sample(onFinal(5), { alt: null, vr: -700, trk: B35L }))
    expect(info).toMatchObject({ phase: 'enRoute', aglFt: null, runway: null })
  })

  it('16. havalimanı yüklenmemişken havalimanı ve uzaklık yoktur', () => {
    expect(classifyOnce(sample(onFinal(5), { alt: 1218, vr: -700, trk: B35L }), [])).toEqual({
      phase: 'enRoute',
      airport: null,
      distanceKm: null,
      bearingDeg: null,
      runway: null,
      aglFt: null,
    })
    expect(classifyOnce(sample(fromIst(90, 1), { gnd: true }), []).phase).toBe('onGround')
  })

  it('17. Van (5.480 ft): pist hizasında 6.500 ft, alçalıyor, 6 km: İnişte (rakım kullanılır)', () => {
    const ac = sample(destinationPoint(VAN_THRESHOLD, 210, 6), { alt: 6500, vr: -700, trk: 30 })
    expect(classifyOnce(ac)).toMatchObject({
      phase: 'landing',
      airport: { icao: 'LTCI', iata: 'VAN' },
      runway: '03',
      aglFt: 1020,
    })
    // Rakım bilinmeseydi (0 sayılır) aynı uçak yerden 6.500 ft'te olurdu.
    expect(classifyOnce(ac, [{ ...LTCI, elevationFt: null }]).phase).toBe('enRoute')
  })

  it('18. dikey hız yoksa en az 2 sn arayla irtifa değişiminden türetilir', () => {
    const at20 = fromIst(90, 20)
    const step = (t: number, alt: number) => sample(at20, { alt, vr: null, trk: 270, t })
    const infos = run(tracker(), [
      step(0, 6000),
      step(1000, 5950),
      step(2000, 5900),
      step(3000, 5850),
      step(4000, 5800),
      step(5000, 5750),
      step(6000, 5700),
      step(7000, 5650),
    ])
    // Türetilen ilk değer 2. sn'de (−3.000 ft/dk); yaklaşma 5 sn sonra gösterilir.
    expect(infos.map((info) => info.phase)).toEqual([
      'enRoute',
      'enRoute',
      'enRoute',
      'enRoute',
      'enRoute',
      'enRoute',
      'enRoute',
      'approaching',
    ])
    // Tırmanan uçak (türetilmiş +3.000 ft/dk) yaklaşmada sayılmaz.
    const climbing = run(
      tracker(),
      Array.from({ length: 10 }, (_, i) => step(i * 1000, 3000 + i * 50)),
    )
    expect(climbing.every((info) => info.phase === 'enRoute')).toBe(true)
  })

  it('19. tekrar döngüsü: eşikteki inişten 22 km ve 3.800 ft’e sıçrama 5 sn sonra Yaklaşmada', () => {
    const final = (t: number, km: number, alt: number) =>
      sample(onFinal(km), { alt, vr: -955, trk: B35L, t })
    const infos = run(tracker(), [
      sample(onFinal(0.05), { alt: 360, vr: -743, trk: B35L, t: 0 }),
      final(1000, 22, 3800),
      final(2000, 21.93, 3785),
      final(3000, 21.86, 3770),
      final(4000, 21.79, 3755),
      final(5000, 21.72, 3740),
      final(6000, 21.65, 3725),
    ])
    expect(infos[0]).toMatchObject({ phase: 'landing', runway: '35L', aglFt: 35 })
    expect(infos.slice(1, 6).every((info) => info.phase === 'landing')).toBe(true)
    // Beklerken pist adı korunur, uzaklık güncellenir.
    expect(infos[1]?.runway).toBe('35L')
    expect(infos[1]?.distanceKm).toBeCloseTo(distanceKm(onFinal(22), IST_ARP), 9)
    expect(infos[6]).toMatchObject({ phase: 'approaching', runway: null })
  })

  it('20. aynı örnek dizisi aynı sonucu verir; listede olmayan uçağın durumu silinir', () => {
    const sequence = [
      sample(onFinal(14), { alt: 3300, vr: -800, trk: B35L, t: 0 }),
      sample(onFinal(10), { alt: 2500, vr: -800, trk: B35L, t: 4000 }),
      sample(onFinal(5), { alt: 1218, vr: -700, trk: B35L, t: 8000 }),
      sample(onFinal(1), { alt: 500, vr: -700, trk: B35L, t: 12_000 }),
    ]
    expect(run(tracker(), sequence)).toEqual(run(tracker(), sequence))

    const phases = tracker()
    const other = sample(fromIst(0, 45), { hex: '4ba9c1', alt: 35000, vr: 0, trk: 90 })
    phases.observe([sequence[0] ?? other, other])
    expect(phases.size).toBe(2)
    // Aynı örnek zamanı yeniden gelirse yeniden hesaplanmaz.
    phases.observe([{ ...other, alt: 1000 }, sequence[0] ?? other])
    expect(phases.get('4ba9c1')?.aglFt).toBe(35000 - 325)
    phases.observe([other])
    expect(phases.get('4bb26c')).toBeUndefined()
    expect(phases.size).toBe(1)
    phases.observe([])
    expect(phases.size).toBe(0)
  })

  it('21. havalimanları gelince depodaki uçaklar yeniden sınıflandırılır ve abone uyarılır', () => {
    const phases = new FlightPhaseTracker()
    const taxiing = sample(fromIst(90, 1), { gnd: true })
    phases.observe([taxiing])
    expect(phases.get(taxiing.hex)).toMatchObject({ phase: 'onGround', airport: null })

    const listener = vi.fn()
    const unsubscribe = phases.subscribeAirports(listener)
    const revision = phases.airportsRevision
    phases.setAirports(AIRPORTS)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(phases.airportsRevision).toBe(revision + 1)
    // Aynı örnek (aynı `t`) de yeniden sınıflandırılır: durumlar silinmiştir.
    phases.observe([taxiing])
    expect(phases.get(taxiing.hex)).toMatchObject({ phase: 'onGround', airport: { icao: 'LTFM' } })
    // Aynı liste yeniden verilirse etkisizdir.
    phases.setAirports(AIRPORTS)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    phases.setAirports([LTFM])
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

// Yanlış havalimanı (gözden geçirme, 2026-10-04): IST ve SAW varışları 1–3 dk "Yaklaşmada ISL"
// görünüyordu. Merkez kuralları artık yalnızca tarifeli havalimanlarında, girişte 45° (çıkışta 90°)
// koniyle ve kendi başına uyan aday önce gelecek biçimde uygulanır (D-085).
describe('FlightPhaseTracker: havalimanı seçimi (D-085)', () => {
  it('22. tarifesiz havalimanı (Atatürk) merkez kuralına girmez; pist hizasında yine görünür', () => {
    // SAW'a inen uçağın Marmara üstünde batıya giden kolu: Atatürk önde (iz farkı < 45°), ~27 km,
    // uçak alçalıyor ve süzülüş zarfında. Atatürk tarifeli olsaydı "Yaklaşmada ISL" yazılırdı.
    const at = { lat: 40.86, lon: 29.1 }
    expect(bearingDifference(270, initialBearing(at, LTBA))).toBeLessThan(45)
    expect(distanceKm(at, LTBA)).toBeLessThan(30)
    const downwind = sample(at, { alt: 6300, vr: -500, trk: 270 })
    expect(classifyOnce(downwind)).toMatchObject({ phase: 'enRoute', airport: { icao: 'LTFJ' } })
    expect(classifyOnce(downwind, [LTFM, LTFJ, { ...LTBA, scheduled: true }])).toMatchObject({
      phase: 'approaching',
      airport: { icao: 'LTBA' },
    })

    // Merkeze göre inişte de yoktur: merkezine 5 km'de, 900 ft, alçalıyor ama hizasız.
    const offAxis = sample(destinationPoint(LTBA, 90, 5), { alt: 900, vr: -700, trk: 200 })
    expect(classifyOnce(offAxis)).toMatchObject({ phase: 'enRoute', airport: { icao: 'LTBA' } })

    // Atatürk'e inen uçak (kargo, iş jeti) pist hizasından yine görünür: 05 eşiğine 4 km'de İnişte,
    // 10 km'de Yaklaşmada (eşik ve karşı uç OurAirports'tan).
    const t05: LatLon = { lat: 40.96630096435547, lon: 28.811399459838867 }
    const b05 = initialBearing(t05, { lat: 40.97779846191406, lon: 28.836200714111328 })
    const withRunway: PhaseAirportInput = {
      ...LTBA,
      runways: [{ ends: [{ ident: '05', trueBearingDeg: b05, ...t05 }] }],
    }
    const airports = [LTFM, LTFJ, withRunway]
    const short = sample(destinationPoint(t05, b05 + 180, 4), { alt: 1063, vr: -700, trk: b05 })
    expect(classifyOnce(short, airports)).toMatchObject({
      phase: 'landing',
      airport: { icao: 'LTBA' },
      runway: '05',
    })
    const final10 = sample(destinationPoint(t05, b05 + 180, 10), { alt: 2900, vr: -800, trk: b05 })
    expect(classifyOnce(final10, airports)).toMatchObject({
      phase: 'approaching',
      airport: { icao: 'LTBA' },
      runway: '05',
    })
  })

  it('23. yandaki havalimanı yaklaşmada sayılmaz: iz ile havalimanı yönü farkı girişte en çok 45°', () => {
    // IST'ye güneydoğudan gelen uçak (iz 330): SAW 20 km'de ve 70° yanda; alçalıyor, süzülüş zarfında.
    const abeamAt = fromSaw(80, 20)
    expect(bearingDifference(330, initialBearing(abeamAt, SAW_ARP))).toBeCloseTo(70, 0)
    const abeam = classifyOnce(sample(abeamAt, { alt: 7000, vr: -1000, trk: 330 }))
    expect(abeam).toMatchObject({ phase: 'enRoute', airport: { icao: 'LTFJ' } })
    // SAW 40° önde: yaklaşmada.
    const aheadAt = fromSaw(110, 20)
    expect(bearingDifference(330, initialBearing(aheadAt, SAW_ARP))).toBeCloseTo(40, 0)
    const ahead = classifyOnce(sample(aheadAt, { alt: 7000, vr: -1000, trk: 330 }))
    expect(ahead).toMatchObject({ phase: 'approaching', airport: { icao: 'LTFJ' } })
  })

  it('24. gösterilen havalimanı arkada kalınca yaklaşma 5 sn sonra biter (tırmanmasa da)', () => {
    const toward = sample(fromIst(90, 15), { alt: 4000, vr: -800, trk: 270, t: 0 })
    // Uçak geri döner (iz 090) ve yatay uçar: IST arkasındadır. Eskiden 35 km'ye kadar kalırdı.
    const away = Array.from({ length: 6 }, (_, i) =>
      sample(fromIst(90, 15.1 + i * 0.1), { alt: 4000, vr: 0, trk: 90, t: (i + 1) * 1000 }),
    )
    expect(run(tracker(), [toward, ...away]).map((info) => info.phase)).toEqual([
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'approaching',
      'enRoute',
    ])
  })

  it('25. iki tarifeli havalimanı: kendi başına uyan tutulandan, iz yönüne yakın olan en yakından önce', () => {
    // Yapay iki havalimanı, deniz düzeyinde: A 10 km ve 30° yönde, B 20 km ve 5° yönde.
    const at: LatLon = { lat: 38, lon: 26 }
    const a: PhaseAirportInput = {
      icao: 'LTXA',
      iata: 'XAA',
      ...destinationPoint(at, 30, 10),
      elevationFt: 0,
      scheduled: true,
      runways: [],
    }
    const b: PhaseAirportInput = { ...a, icao: 'LTXB', iata: 'XBB', ...destinationPoint(at, 5, 20) }
    const airports = [a, b]
    const step = (t: number, trk: number) => sample(at, { alt: 3500, vr: -800, trk, t })

    // İkisi de önde ve süzülüş zarfında: iz yönüne yakın olan seçilir (en yakın A değil).
    expect(classifyOnce(step(0, 0), airports).airport?.icao).toBe('LTXB')

    // A'ya dönük uçak A'da; sağdan sola döner (iz 330): A 60° yanda (yalnızca tutulur), B 35° önde
    // (kendi başına uyar). B 5 sn sonra gösterilir. Geri dönünce (iz 030) ikisi de uyar; gösterilen
    // B kalır, etiket iki havalimanı arasında gidip gelmez.
    const phases = new FlightPhaseTracker()
    phases.setAirports(airports)
    const turned = Array.from({ length: 6 }, (_, i) => step((i + 1) * 1000, 330))
    const back = Array.from({ length: 7 }, (_, i) => step((i + 7) * 1000, 30))
    const infos = run(phases, [step(0, 30), ...turned, ...back])
    expect(infos.map((info) => info.airport?.icao)).toEqual([
      ...Array<string>(6).fill('LTXA'),
      ...Array<string>(8).fill('LTXB'),
    ])
    expect(infos.every((info) => info.phase === 'approaching')).toBe(true)
  })

  it('26. İstanbul trafiği: SAW ve IST varışlarında Atatürk görünmez (2 sn örneklerle uçuş)', () => {
    // SAW 06 varışı, batıdan Marmara üstünden düz alçalma (iz 066): Atatürk'ün güneyinden geçer.
    const sawFromWest = fly({ lat: 40.72, lon: 28.75 }, 9000, 240, [
      { trk: 66, secs: 450, vr: -750 },
    ])
    expect(arrivalAirports(sawFromWest)).toEqual(['LTFJ'])
    // SAW 06 rüzgâr altı kolu: SAW'ın güneyinde batıya, kuzeye dönüş, son yaklaşma (iz 064).
    const sawDownwind = fly({ lat: 40.86, lon: 29.3 }, 7000, 220, [
      { trk: 270, secs: 200, vr: -500 },
      { trk: 0, secs: 40, vr: -500 },
      { trk: 64, secs: 300, vr: -700 },
    ])
    expect(arrivalAirports(sawDownwind)).toEqual(['LTFJ'])
    // IST kuzey akışı: alanın doğusunda güneye giden kol, batıya dönüş, kuzeye son yaklaşma.
    const istDownwind = fly({ lat: 41.3, lon: 28.86 }, 5300, 210, [
      { trk: 180, secs: 180, vr: -300 },
      { trk: 270, secs: 90, vr: -500 },
      { trk: 359, secs: 200, vr: -700 },
    ])
    expect(arrivalAirports(istDownwind)).toEqual(['LTFM'])
  })
})

describe('FlightPhaseTracker: istek üzerine pist uçları (D-111)', () => {
  // Haritanın listesi (`include=map`) uçları yalnız 1.–3. halkada taşır: 4. halkadan itibaren
  // pistlerin `ends` alanı yoktur. LTFM'yi uçsuz bir havalimanı gibi kullanır (JFK yerine).
  const withoutEnds: PhaseAirportInput = { ...LTFM, runways: [{}, {}] }
  const final = (t: number, km: number) =>
    sample(onFinal(km), { alt: 325 + km * 180, vr: -700, trk: B35L, t })

  it('uçsuz havalimanının 35 km’sindeki uçak bildirilir; uçlar gelince pist etiketi çıkar', () => {
    const phases = tracker([withoutEnds, LTFJ])
    const missing = vi.fn()
    phases.setMissingEndsHandler(missing)
    // Uçlar yokken durum merkeze göre tahmin edilir: İnişte, pist adı yok.
    const before = run(phases, [final(1_000, 5)])
    expect(before[0]).toMatchObject({ phase: 'landing', runway: null })
    expect(missing).toHaveBeenCalledWith('LTFM')
    // Uçlar tek havalimanı ucundan gelir: sonraki örnekte pist 35L.
    phases.setRunwayEnds('LTFM', LTFM.runways)
    const after = run(phases, [final(2_000, 4)])
    expect(after[0]).toMatchObject({ phase: 'landing', runway: '35L' })
    // Uçları gelen havalimanı bir daha bildirilmez.
    missing.mockClear()
    run(phases, [final(3_000, 3)])
    expect(missing).not.toHaveBeenCalled()
  })

  it('yalnız havadaki ve 35 km içindeki uçak; uçları listede olan havalimanı hiç bildirilmez', () => {
    const phases = tracker([withoutEnds, LTFJ])
    const missing = vi.fn()
    phases.setMissingEndsHandler(missing)
    // Yerdeki uçak ve 40 km'deki uçak bildirmez (SAW'ın pistleri boş dizi: uçsuz değil, uçları yok).
    phases.observe([
      sample(fromIst(90, 1), { hex: 'aaa001', gnd: true, t: 1_000 }),
      sample(fromIst(0, 40), { hex: 'aaa002', alt: 9_000, t: 1_000 }),
      sample(fromSaw(0, 5), { hex: 'aaa003', alt: 2_000, t: 1_000 }),
    ])
    expect(missing).not.toHaveBeenCalled()
    phases.observe([sample(fromIst(0, 30), { hex: 'aaa002', alt: 9_000, t: 2_000 })])
    expect(missing.mock.calls).toEqual([['LTFM']])
    // Uçları listede olan havalimanı (1.–3. halka) için bildirim hiç gitmez.
    const listed = tracker()
    const none = vi.fn()
    listed.setMissingEndsHandler(none)
    run(listed, [final(1_000, 5)])
    expect(none).not.toHaveBeenCalled()
  })

  it('getirilen uçlar liste yeniden verilince korunur; bildirim kaldırılınca gitmez', () => {
    const phases = tracker([withoutEnds])
    phases.setRunwayEnds('LTFM', LTFM.runways)
    phases.setAirports([{ ...withoutEnds }])
    expect(run(phases, [final(1_000, 5)])[0]).toMatchObject({ phase: 'landing', runway: '35L' })
    const other = tracker([withoutEnds])
    const missing = vi.fn()
    other.setMissingEndsHandler(missing)
    other.setMissingEndsHandler(null)
    run(other, [final(1_000, 5)])
    expect(missing).not.toHaveBeenCalled()
  })
})
