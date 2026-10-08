import { getMessages, NO_VALUE } from '@havayolu/i18n'
import { decodeMetar, type AirportMetar, type AirportWeather } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { fixtureListedAirports } from '../../lib/test/ourairports-fixture'
import { toMapAirport, type MapAirport } from './airport-data'
import {
  airportFacts,
  airportPlace,
  escapeClosesPopup,
  formatClock,
  formatElevation,
  formatRunways,
  popupStatusText,
  popupTimeZone,
  popupWeatherView,
  returnFocusTarget,
  type PopupWeatherReport,
} from './airport-popup-model'
import type { AirportWeatherState } from './use-airport-weather'

const tr = getMessages('tr')
const en = getMessages('en')

const IST: MapAirport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2753,
  lon: 28.7519,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
  country: 'TR',
  ring: 0,
  distanceToTrKm: null,
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  runways: [{ lengthFt: 12303 }, { lengthFt: 13451 }, { lengthFt: 12303 }],
}

/** Yakın ülkedeki listelenen havalimanı (1. halka, D-080). */
const ATH: MapAirport = {
  icao: 'LGAV',
  iata: 'ATH',
  name: 'Athens Eleftherios Venizelos International Airport',
  city: 'Spata-Artemida',
  lat: 37.936401,
  lon: 23.9445,
  elevationFt: 308,
  type: 'large_airport',
  scheduled: true,
  country: 'GR',
  ring: 1,
  distanceToTrKm: 275,
  isoRegion: 'GR-I',
  municipality: 'Spata-Artemida',
  runways: [{ lengthFt: 13123 }, { lengthFt: 12467 }],
}

/** Ercan: OurAirports'ta CY; KKTC olarak gösterilir (kullanıcı kararı 2026-10-02, D-080). */
const ECN: MapAirport = {
  ...ATH,
  icao: 'LCEN',
  iata: 'ECN',
  name: 'Ercan International Airport',
  city: 'Tymbou (Kirklar)',
  lat: 35.153064,
  lon: 33.507352,
  country: 'CY',
  distanceToTrKm: 168,
  isoRegion: 'CY-02',
  municipality: 'Tymbou (Kirklar)',
}

/** Tiflis (UTC+4), Sohum (Gürcistan; Moskova saati), Tahran (UTC+3:30), New York (kuralı yok). */
const TBS: MapAirport = { ...ATH, icao: 'UGTB', iata: 'TBS', country: 'GE', isoRegion: 'GE-TB' }
const SUI: MapAirport = { ...ATH, icao: 'UGSS', iata: 'SUI', country: 'GE', isoRegion: 'GE-AB' }
const THR: MapAirport = { ...ATH, icao: 'OIII', iata: 'THR', country: 'IR', isoRegion: 'IR-23' }
const JFK: MapAirport = { ...ATH, icao: 'KJFK', iata: 'JFK', country: 'US', isoRegion: 'US-NY' }

/** 1 Ekim 2026 13:00 UTC = 16:00 İstanbul. */
const NOW = Date.parse('2026-10-01T13:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

function metar(raw: string, observedAt: string): AirportMetar {
  return { ...decodeMetar(raw, { observedAt }), observedAt }
}

/** Pencerenin tek havalimanı yanıtı (`useAirportWeather`, D-090). */
function state(weather: AirportWeather, failed = false): AirportWeatherState {
  return { data: weather, failed }
}

const station = (icao: string, m: AirportMetar | null): AirportWeather => ({
  icao,
  generatedAt: new Date(NOW).toISOString(),
  metar: m,
  tafs: [],
})

function report(view: ReturnType<typeof popupWeatherView>): PopupWeatherReport {
  if (view.kind !== 'report') throw new Error(`expected a report, got ${view.kind}`)
  return view
}

const value = (view: PopupWeatherReport, key: string) =>
  view.rows.find((row) => row.key === key)?.value

const tone = (view: PopupWeatherReport, key: string) =>
  view.rows.find((row) => row.key === key)?.tone

/** Sayıdan (ya da eksi işaretinden) hemen önce "·" ya da "–" (eksi gibi okunur; 2026-10-02). */
const DASH_BEFORE_NUMBER = /[·–]\s*[−-]?\d/

describe('havalimanı bilgileri', () => {
  it('rakım metrik önce, ft ikinci', () => {
    // Sayı ile birim arasında bölünmez boşluk: dar değer sütununda "99" / "m" kırılmaz (D-083).
    expect(formatElevation(325, 'tr')).toBe('99\u00a0m (325\u00a0ft)')
    expect(formatElevation(3281, 'en')).toBe('1,000\u00a0m (3,281\u00a0ft)')
    expect(formatElevation(null, 'tr')).toBe(NO_VALUE)
  })

  it('pist özeti: sayı ve en uzun pist (m)', () => {
    // Uzunluk tek parça: 1280 px'te "3 pist, en uzunu 3.400" / "m" kırılıyordu (AYT, SKG; D-083).
    expect(formatRunways(IST, 'tr', tr.map.airportPopup)).toBe('3 pist, en uzunu 4.100\u00a0m')
    expect(formatRunways(IST, 'en', en.map.airportPopup)).toBe('3 runways, longest 4,100\u00a0m')
    const one = { ...IST, runways: [{ lengthFt: 9843 }] }
    expect(formatRunways(one, 'tr', tr.map.airportPopup)).toBe('Tek pist, 3.000\u00a0m')
    const unknown = { ...IST, runways: [{ lengthFt: null }, { lengthFt: null }] }
    expect(formatRunways(unknown, 'tr', tr.map.airportPopup)).toBe('2')
    expect(formatRunways({ ...IST, runways: [] }, 'tr', tr.map.airportPopup)).toBe(NO_VALUE)
  })

  it('il adı; tanınmayan bölgede temiz yerleşim adı; o da yoksa null', () => {
    expect(airportPlace(IST, 'tr')).toBe('İstanbul')
    expect(airportPlace(IST, 'en')).toBe('Istanbul')
    expect(airportPlace({ ...IST, isoRegion: 'XX-1', municipality: 'Ercan' }, 'tr')).toBe('Ercan')
    expect(airportPlace({ ...IST, isoRegion: 'XX-1', municipality: null }, 'tr')).toBeNull()
  })

  it('yakın ülkelerde il yerine ülke adı; Ercan KKTC (D-080)', () => {
    expect(airportPlace(ATH, 'tr')).toBe('Yunanistan')
    expect(airportPlace(ATH, 'en')).toBe('Greece')
    // Bölge kodu Türkiye'ninkine benzese de ülke belirleyicidir.
    expect(airportPlace({ ...ATH, isoRegion: 'TR-34' }, 'tr')).toBe('Yunanistan')
    expect(airportPlace(ECN, 'tr')).toMatch(/KKTC|Kuzey Kıbrıs Türk Cumhuriyeti/)
    expect(airportPlace(ECN, 'en')).toMatch(/TRNC|Turkish Republic of Northern Cyprus/)
  })

  it('saat dilimi havalimanınındır (tzdb tablosu, D-084); kuralı olmayan çok dilimli ülkede null', () => {
    expect(popupTimeZone(IST)).toBe('Europe/Istanbul')
    expect(popupTimeZone(ATH)).toBe('Europe/Athens')
    expect(popupTimeZone(ECN)).toBe('Asia/Famagusta')
    expect(popupTimeZone(TBS)).toBe('Asia/Tbilisi')
    // Sohum: fiilen kullanılan Moskova saati (kullanıcı kararı 2026-10-03).
    expect(popupTimeZone(SUI)).toBe('Europe/Moscow')
    expect(popupTimeZone(THR)).toBe('Asia/Tehran')
    expect(popupTimeZone(JFK)).toBeNull()
  })

  it('listelenen her havalimanının penceresinde yer ve saat dilimi vardır (4. halka dahil, D-090, D-102)', () => {
    // API kaydı haritanın okuyucusundan geçer (`toMapAirport`): sayfadaki listeyle aynı 1.217 kayıt
    // (askerî üsler yok, D-107).
    const listed = fixtureListedAirports().map((airport) => toMapAirport(airport))
    expect(listed.filter((airport) => airport === null)).toEqual([])
    const map = new Map(listed.flatMap((airport) => (airport ? [[airport.icao, airport]] : [])))
    expect(map.size).toBe(1217)
    for (const airport of map.values()) {
      expect(airportPlace(airport, 'tr'), airport.icao).not.toBeNull()
      expect(airportPlace(airport, 'en'), airport.icao).not.toBeNull()
      expect(popupTimeZone(airport), airport.icao).not.toBeNull()
    }
    const of = (icao: string) => {
      const airport = map.get(icao)
      if (!airport) throw new Error(`fixture has no ${icao}`)
      return airport
    }
    expect(airportPlace(of('HECA'), 'tr')).toBe('Mısır')
    expect(airportPlace(of('HECA'), 'en')).toBe('Egypt')
    expect(airportPlace(of('LIRN'), 'tr')).toBe('İtalya')
    expect(airportPlace(of('OKKK'), 'en')).toBe('Kuwait')
    for (const [icao, zone] of [
      ['HECA', 'Africa/Cairo'],
      ['LLBG', 'Asia/Jerusalem'],
      ['LIRN', 'Europe/Rome'],
      ['LHBP', 'Europe/Budapest'],
      ['HLLB', 'Africa/Tripoli'],
      ['OKKK', 'Asia/Kuwait'],
      ['OIIE', 'Asia/Tehran'],
      // Rusya ve Kazakistan bölge kuralıyla (D-084): Astrahan UTC+4, Volgograd ve Elista UTC+3.
      ['URWA', 'Europe/Astrakhan'],
      ['URWW', 'Europe/Volgograd'],
      ['URWI', 'Europe/Moscow'],
      ['UATE', 'Asia/Aqtau'],
      ['UTAK', 'Asia/Ashgabat'],
      // 3. halka (D-090): Almanya, Rusya, Kazakistan, Özbekistan ve İspanya bölge kuralıyla.
      ['LOWW', 'Europe/Vienna'],
      ['EDDF', 'Europe/Berlin'],
      ['EDDB', 'Europe/Berlin'],
      ['UUEE', 'Europe/Moscow'],
      ['UWWW', 'Europe/Samara'],
      ['UMKK', 'Europe/Kaliningrad'],
      ['UWUU', 'Asia/Yekaterinburg'],
      ['UAOO', 'Asia/Qyzylorda'],
      ['UZSS', 'Asia/Samarkand'],
      ['LEPA', 'Europe/Madrid'],
      ['OAHR', 'Asia/Kabul'],
      ['OMDB', 'Asia/Dubai'],
      // 4. halka (D-101, D-102): Londra, Delhi, Ulan Batur, Novosibirsk, Urumçi (Pekin saati).
      ['EGLL', 'Europe/London'],
      ['VIDP', 'Asia/Calcutta'],
      ['ZMCK', 'Asia/Ulaanbaatar'],
      ['UNNT', 'Asia/Novosibirsk'],
      ['ZWWW', 'Asia/Shanghai'],
    ] as const) {
      expect(popupTimeZone(of(icao)), icao).toBe(zone)
    }
    expect(airportPlace(of('LOWW'), 'tr')).toBe('Avusturya')
    expect(airportPlace(of('LOWW'), 'en')).toBe('Austria')
    expect(airportPlace(of('EGLL'), 'tr')).toBe('Birleşik Krallık')
  })

  it('sivil uçuşlara kapalı olabilecek havalimanında not; diğerlerinde yok (D-090)', () => {
    const listed = new Map(
      fixtureListedAirports().flatMap((airport) => {
        const map = toMapAirport(airport)
        return map ? [[map.icao, map] as const] : []
      }),
    )
    const closed = [...listed.values()].filter(
      (airport) => airportFacts(airport, NOW, 'tr', tr.map.airportPopup).closure !== null,
    )
    // Listelenenler: Krasnodar, Gelencik (1. halka), Elista (2. halka), Voronej (3. halka).
    expect(closed.map((airport) => airport.icao).sort()).toEqual(['URKG', 'URKK', 'URWI', 'UUOO'])
    const voronezh = listed.get('UUOO')
    if (!voronezh) throw new Error('fixture has no UUOO')
    expect(airportFacts(voronezh, NOW, 'tr', tr.map.airportPopup).closure).toBe(
      'Sivil uçuşlara kapalı olabilir (2022’den beri)',
    )
    expect(airportFacts(voronezh, NOW, 'en', en.map.airportPopup).closure).toBe(
      'May be closed to civil flights (since 2022)',
    )
    expect(airportFacts(IST, NOW, 'tr', tr.map.airportPopup).closure).toBeNull()
  })

  it('saat havalimanının yerel saatiyle; saat yoksa "—"', () => {
    expect(formatClock(NOW)).toBe('16:00')
    expect(formatClock(NOW, 'Europe/Istanbul')).toBe('16:00')
    // Ofset koda gömülmez: başka bir dilim kendi saatini verir (Tiflis UTC+4, Atina yazın UTC+3).
    expect(formatClock(NOW, 'Asia/Tbilisi')).toBe('17:00')
    expect(formatClock(Date.parse('2026-12-01T13:00:00Z'), 'Europe/Athens')).toBe('15:00')
    expect(formatClock(0)).toBe(NO_VALUE)
    expect(formatClock(Number.NaN)).toBe(NO_VALUE)
  })

  it('başlık, erişilebilir ad ve satırlar (TR ve EN); gün doğumu ve batımı pencerede yok', () => {
    const facts = airportFacts(IST, NOW, 'tr', tr.map.airportPopup)
    expect(facts.name).toBe('İstanbul Havalimanı')
    expect(facts.label).toBe('İstanbul Havalimanı bilgileri')
    // Gün doğumu ve batımı yalnız havalimanı sayfasındadır (kullanıcı kararı 2026-10-02).
    expect(facts.rows.map((row) => row.key)).toEqual(['elevation', 'runways', 'localTime'])
    // Yerel saat her havalimanında aynı biçimde, UTC farkıyla (D-084).
    expect(facts.rows.find((row) => row.key === 'localTime')?.value).toBe('16:00 (UTC+3)')
    const english = airportFacts(IST, NOW, 'en', en.map.airportPopup)
    expect(english.name).toBe('Istanbul Airport')
    expect(english.rows.map((row) => row.label)).toEqual(['Elevation', 'Runways', 'Local time'])
  })

  it('yurt dışında yerel saat ve UTC farkı: yaz saati, yarım saat, Moskova saati (D-084)', () => {
    const local = (airport: MapAirport, at = NOW, locale: 'tr' | 'en' = 'tr') =>
      airportFacts(airport, at, locale, getMessages(locale).map.airportPopup).rows.find(
        (row) => row.key === 'localTime',
      )
    const facts = airportFacts(ATH, NOW, 'tr', tr.map.airportPopup)
    expect(facts.rows.map((row) => row.key)).toEqual(['elevation', 'runways', 'localTime'])
    expect(facts.rows.find((row) => row.key === 'runways')?.value).toBe(
      '2 pist, en uzunu 4.000\u00a0m',
    )
    // 1 Ekim 13:00Z: Atina yaz saatinde (UTC+3); 1 Aralık 13:00Z kışın (UTC+2).
    expect(local(ATH)?.value).toBe('16:00 (UTC+3)')
    expect(local(ATH, Date.parse('2026-12-01T13:00:00Z'))?.value).toBe('15:00 (UTC+2)')
    // Bilgi satırı vurgusuz (M6e.1): hava satırlarıyla aynı liste, tonu ve etiketi yok.
    expect(local(ATH, NOW, 'en')).toEqual({
      key: 'localTime',
      label: 'Local time',
      value: '16:00 (UTC+3)',
      tone: null,
      strong: null,
    })
    expect(local(THR)?.value).toBe('16:30 (UTC+3:30)')
    expect(local(TBS)?.value).toBe('17:00 (UTC+4)')
    expect(local(SUI)?.value).toBe('16:00 (UTC+3)')
    expect(local(ECN)?.value).toBe('16:00 (UTC+3)')
    // Saat henüz yoksa "—" (fark yazılmaz).
    expect(local(ATH, 0)?.value).toBe(NO_VALUE)
  })

  it('saat dilimi bilinmeyen havalimanında yerel saat satırı yok', () => {
    const facts = airportFacts(JFK, NOW, 'tr', tr.map.airportPopup)
    expect(facts.rows.map((row) => row.key)).toEqual(['elevation', 'runways'])
    // Dilim açıkça null verilirse de yazılmaz.
    expect(
      airportFacts(ATH, NOW, 'tr', tr.map.airportPopup, null).rows.map((row) => row.key),
    ).toEqual(['elevation', 'runways'])
  })
})

describe('popupWeatherView', () => {
  const t = tr.map.airportPopup
  const w = tr.weather

  it('veri gelmeden yükleniyor; istek başarısızsa alınamıyor', () => {
    expect(popupWeatherView({ data: null, failed: false }, 'LTFM', NOW, 'tr', w, t)).toEqual({
      kind: 'loading',
      text: t.loading,
    })
    expect(popupWeatherView({ data: null, failed: true }, 'LTFM', NOW, 'tr', w, t)).toEqual({
      kind: 'unavailable',
      text: t.unavailable,
    })
  })

  it('raporu yoksa ya da 12 saatten eskiyse "Hava durumu raporu yok"; başka havalimanının yanıtı sayılmaz', () => {
    const none = { kind: 'none', text: 'Hava durumu raporu yok' }
    // Pencere başka havalimanına geçerken önceki havalimanının yanıtı gösterilmez: yükleniyor.
    expect(popupWeatherView(state(station('LTFM', null)), 'LTBQ', NOW, 'tr', w, t)).toEqual({
      kind: 'loading',
      text: t.loading,
    })
    expect(popupWeatherView(state(station('LTBQ', null)), 'LTBQ', NOW, 'tr', w, t)).toEqual(none)
    const old = metar('LTCW 010050Z 36004KT 9999 FEW050 M05/M09 Q1024', minutesAgo(13 * 60))
    expect(popupWeatherView(state(station('LTCW', old)), 'LTCW', NOW, 'tr', w, t)).toEqual(none)
  })

  it('yağmur, kar, gök gürültüsü ve sis her zaman yazılır; hamle, rüzgâr şiddeti, yıldırım', () => {
    const m = metar(
      'LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      minutesAgo(10),
    )
    const view = report(popupWeatherView(state(station('LTFM', m)), 'LTFM', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('fresh')
    expect(view.note).toBeNull()
    // Sıcaklık başlığa eklenmez, ayrı kutucuktur.
    expect(view.headline).toBe('Hafif sağanak yağmur')
    expect(view.temperature).toBe('9 °C')
    expect(view.rows.map((row) => row.key)).toEqual([
      'wind',
      'rain',
      'snow',
      'thunder',
      'fog',
      'visibility',
    ])
    // Sayı ile birim, km/sa ile knot arasında bölünmez boşluk (D-083).
    expect(value(view, 'wind')).toBe(
      'Kuzeydoğudan 33\u00a0km/sa\u00a0(18\u00a0kt), hamle 59\u00a0km/sa\u00a0(32\u00a0kt)',
    )
    // Ortalama 18 kt eşiğin altında, hamle 32 kt üstünde: "Kuvvetli hamle" (D-083).
    expect(view.rows[0]?.strong).toBe('Kuvvetli hamle')
    expect(value(view, 'rain')).toBe('Hafif sağanak yağmur')
    expect(value(view, 'snow')).toBe('Yok')
    expect(value(view, 'thunder')).toBe(
      'Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi',
    )
    expect(value(view, 'fog')).toBe('Yok')
    expect(value(view, 'visibility')).toBe('10 km ve üzeri')
    expect(view.observed).toBe('Gözlem 15:50, 10 dakika önce')
    // Var olan olay (yağmur), rüzgâr (hamle 32 kt: meydan uyarısı, turuncu; M6e.3) ve yıldırım
    // tehlikesi (CB ve yağış) vurgulanır; "Yok" sade.
    expect(view.rows.map((row) => [row.key, row.tone])).toEqual([
      ['wind', 'strong'],
      ['rain', 'rain'],
      ['snow', null],
      ['thunder', 'thunder'],
      ['fog', null],
      ['visibility', null],
    ])
  })

  it('gözlem saati havalimanının yerel saatiyle; dilim bilinmiyorsa UTC ile yazılır', () => {
    const m = metar('LGAV 011250Z 36012KT CAVOK 22/10 Q1015 NOSIG', minutesAgo(10))
    const data = state(station('LGAV', m))
    const athens = report(popupWeatherView(data, 'LGAV', NOW, 'tr', w, t, popupTimeZone(ATH)))
    expect(athens.observed).toBe('Gözlem 15:50, 10 dakika önce')
    const view = report(popupWeatherView(data, 'LGAV', NOW, 'tr', w, t, null))
    expect(view.observed).toBe('Gözlem 12:50 UTC, 10 dakika önce')
    expect(value(view, 'visibility')).toBe('10 km ve üzeri')
  })

  it('kar, sis ve dolu satırları; sakin rüzgârda kuvvetli işareti yok (EN)', () => {
    const snow = metar(
      'LTAC 011250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018',
      minutesAgo(20),
    )
    const fog = metar('LTCG 011250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015', minutesAgo(20))
    const hail = metar(
      'SPECI LTBS 011242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007',
      minutesAgo(20),
    )
    const s = report(
      popupWeatherView(
        state(station('LTAC', snow)),
        'LTAC',
        NOW,
        'en',
        en.weather,
        en.map.airportPopup,
      ),
    )
    expect(value(s, 'snow')).toBe('Snow')
    expect(value(s, 'fog')).toBe('Mist')
    // Sıfırın altı: gerçek eksi işareti (U+2212) ayrı kutucukta; başlıkta sayı yok.
    expect(s.headline).toBe('Snow')
    expect(s.temperature).toBe('\u22121 °C')
    expect([tone(s, 'rain'), tone(s, 'snow'), tone(s, 'fog')]).toEqual([null, 'snow', 'fog'])
    // 12 kt (22 km/sa): sarı "Orta rüzgâr" (M6e.3; eskiden sade).
    expect([tone(s, 'wind'), s.rows[0]?.strong]).toEqual(['moderate', 'Moderate wind'])
    const f = report(popupWeatherView(state(station('LTCG', fog)), 'LTCG', NOW, 'tr', w, t))
    expect(value(f, 'fog')).toBe('Sis')
    expect(tone(f, 'fog')).toBe('fog')
    expect(value(f, 'wind')).toBe('Sakin')
    expect(f.rows[0]?.strong).toBeNull()
    expect(tone(f, 'wind')).toBe('calm')
    expect(value(f, 'visibility')).toBe('200 m')
    const h = report(popupWeatherView(state(station('LTBS', hail)), 'LTBS', NOW, 'tr', w, t))
    // Sözcük seçimi havalimanı sayfasıyla ortaktır (summarizeMetar); TS için "fırtına" denmez.
    expect(value(h, 'rain')).toMatch(/^Dolulu, .*gök gürültülü sağanak$/)
    expect(value(h, 'thunder')).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
    expect(value(h, 'thunder')).not.toMatch(/fırtına/i)
    expect(h.rows.some((row) => row.key === 'hail')).toBe(true)
    expect([tone(h, 'rain'), tone(h, 'thunder'), tone(h, 'hail')]).toEqual([
      'rain',
      'thunder',
      'hail',
    ])
    // 15G27: kehribar "Hamleli rüzgâr".
    expect([tone(h, 'wind'), h.rows[0]?.strong]).toEqual(['fresh', 'Hamleli rüzgâr'])
  })

  it('çevredeki oraj yıldırım uyarısıyla vurgulanır; "Belirlenemedi" vurgulanmaz', () => {
    const near = metar('LTAU 011250Z 23008KT 9999 VCTS SCT040CB 07/M01 Q1013 NOSIG', minutesAgo(5))
    const auto = metar('LTXX 011250Z AUTO 03010KT 9999 // NCD 10/05 Q1010', minutesAgo(5))
    const v = report(popupWeatherView(state(station('LTAU', near)), 'LTAU', NOW, 'tr', w, t))
    expect(value(v, 'thunder')).toBe(
      'Havalimanı çevresinde gök gürültüsü var; yıldırım havalimanına da düşebilir',
    )
    expect(tone(v, 'thunder')).toBe('thunder')
    const a = report(popupWeatherView(state(station('LTXX', auto)), 'LTXX', NOW, 'tr', w, t))
    for (const key of ['rain', 'snow', 'thunder', 'fog']) {
      expect(value(a, key), key).toBe('Belirlenemedi')
      expect(tone(a, key), key).toBeNull()
    }
  })

  it('sayıdan önce "·" ya da "–" yok: başlık, rüzgâr, görüş, gözlem yaşı (TR ve EN)', () => {
    const raws = [
      'LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      'LTAI 011250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006',
      'LTCE 011250Z 27022G35KT 0800 +SHSN BLSN VV004 M08/M10 Q1021',
      'LTXX 011250Z 22012KT 6000 1400SW BR BKN008 M03/M04 Q1018',
    ]
    for (const raw of raws) {
      const icao = raw.slice(0, 4)
      const data = state(station(icao, metar(raw, minutesAgo(130))))
      for (const [locale, messages] of [
        ['tr', tr],
        ['en', en],
      ] as const) {
        const view = report(
          popupWeatherView(data, icao, NOW, locale, messages.weather, messages.map.airportPopup),
        )
        const texts = [
          view.headline,
          view.temperature,
          view.note,
          view.observed,
          popupStatusText(view),
          ...view.rows.map((row) => row.value),
        ]
        for (const text of texts)
          expect(text ?? '', `${icao} ${locale}`).not.toMatch(DASH_BEFORE_NUMBER)
      }
    }
  })

  it('90 dakika–3 saat: gecikmiş gözlem notu, değerler gösterilir', () => {
    const m = metar('LTAJ 011120Z 09005KT 9999 SCT030 11/02 Q1016 NOSIG', minutesAgo(130))
    const view = report(popupWeatherView(state(station('LTAJ', m)), 'LTAJ', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('delayed')
    expect(view.note).toContain('Gecikmiş gözlem')
    expect(view.rows.length).toBeGreaterThan(0)
    expect(view.temperature).toBe('11 °C')
    expect(view.observed).toBe('Son gözlem 13:50, 2 saat 10 dakika önce')
  })

  it('3–12 saat: eski gözlemin değerleri güncel gibi gösterilmez', () => {
    const m = metar('LTCW 010450Z 36004KT 9999 FEW050 M05/M09 Q1024', minutesAgo(8 * 60 + 10))
    const view = report(popupWeatherView(state(station('LTCW', m)), 'LTCW', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('stale')
    expect(view.headline).toBeNull()
    expect(view.temperature).toBeNull()
    expect(view.rows).toEqual([])
    expect(view.note).toBe(w.age.stale)
    expect(view.observed).toBe('Son gözlem 07:50, 8 saat önce')
  })

  it('son istek başarısız olsa da eldeki veri gösterilir', () => {
    const m = metar('LTBA 011250Z 04008KT CAVOK 10/03 Q1010 NOSIG', minutesAgo(5))
    const view = report(popupWeatherView(state(station('LTBA', m), true), 'LTBA', NOW, 'tr', w, t))
    expect(value(view, 'visibility')).toBe('10 km ve üzeri')
  })

  it('metin kurulamazsa harita düşmez: "alınamıyor"', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const m = metar('LTBA 011250Z 04008KT CAVOK 10/03 Q1010 NOSIG', minutesAgo(5))
    const broken = { ...m, weather: null } as unknown as AirportMetar
    expect(popupWeatherView(state(station('LTBA', broken)), 'LTBA', NOW, 'tr', w, t)).toEqual({
      kind: 'unavailable',
      text: t.unavailable,
    })
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('Escape ve ekran okuyucu bildirimi', () => {
  const escape = { key: 'Escape', defaultPrevented: false }

  it('Escape yalnızca odak pencerede, haritada ya da hiçbir yerdeyken kapatır', () => {
    expect(escapeClosesPopup(escape, 'popup')).toBe(true)
    expect(escapeClosesPopup(escape, 'map')).toBe(true)
    expect(escapeClosesPopup(escape, 'page')).toBe(true)
    // Arama kutusu, etiket ayarları ya da havalimanı listesinde odak: o denetimin Escape'i.
    expect(escapeClosesPopup(escape, 'other')).toBe(false)
  })

  it('kapanışta odak pencereyi açan denetime döner; açan öğe kalktıysa önceki öğe kalır, body değil', () => {
    const map = { name: 'harita tuvali' }
    const listButton = { name: 'Havalimanları düğmesi' }
    const body = { name: 'body' }
    // Haritadan açılış: tuval saklanır.
    expect(returnFocusTarget(null, map, 'map')).toBe(map)
    // Listeden açılış: odak açan düğmede (liste öğesi DOM'dan kalkmadan önce oraya alınır).
    expect(returnFocusTarget(null, listButton, 'other')).toBe(listButton)
    // Haritadan açıkken listeden başka havalimanı: yeni açan denetim saklanır.
    expect(returnFocusTarget(map, listButton, 'other')).toBe(listButton)
    // Odak sayfaya düşmüşse (açan öğe DOM'dan kalktı) body saklanmaz: önceki öğe ya da hiç
    // (kapanışta harita tuvali).
    expect(returnFocusTarget(null, body, 'page')).toBeNull()
    expect(returnFocusTarget(map, body, 'page')).toBe(map)
    // Odak pencerenin içindeyse önceki öğe kalır.
    expect(returnFocusTarget(listButton, { name: 'Kapat' }, 'popup')).toBe(listButton)
  })

  it('başka bir katmanın tükettiği Escape ve başka tuşlar kapatmaz', () => {
    expect(escapeClosesPopup({ key: 'Escape', defaultPrevented: true }, 'popup')).toBe(false)
    expect(escapeClosesPopup({ key: 'Enter', defaultPrevented: false }, 'popup')).toBe(false)
  })

  it('bildirim: yükleniyor, alınamıyor, rapor yok ya da raporun başlığı ve sıcaklığı', () => {
    const t = tr.map.airportPopup
    const w = tr.weather
    const loading = popupWeatherView({ data: null, failed: false }, 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(loading)).toBe(t.loading)
    const failed = popupWeatherView({ data: null, failed: true }, 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(failed)).toBe(t.unavailable)
    const none = popupWeatherView(state(station('LTFM', null)), 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(none)).toBe(t.noReport)
    const loaded = popupWeatherView(
      state(
        station(
          'LTFM',
          metar('LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB 09/05 Q1009', minutesAgo(10)),
        ),
      ),
      'LTFM',
      NOW,
      'tr',
      w,
      t,
    )
    expect(popupStatusText(loaded)).toBe('Hafif sağanak yağmur, 9 °C')
  })
})
