import { destinationPoint, distanceKm, initialBearing, type LatLon } from '@havayolu/geo'
import { formatDistance, getMessages, NBSP } from '@havayolu/i18n'
import { COMPASS_POINTS_8, type Locale, type PublicAircraft } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import type { TrackedAircraft } from '../../../lib/live/store'
import {
  FlightPhaseTracker,
  type PhaseAirportInput,
  type PhaseInfo,
} from '../../../lib/map/flight-phase'
import { aircraftPlace } from './aircraft-place'
import { formatPosition } from './panel-format'

// LTFM: tools/src/scenarios/airports.ts (OurAirports): merkez, rakım, 35L eşiği ve karşı ucu.
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
  runways: [{ ends: [{ ident: '35L', trueBearingDeg: B35L, ...T35L }] }],
}

const SAMPLED_AT = 100_000
const tr = getMessages('tr').map.table
const en = getMessages('en').map.table

function aircraft(at: LatLon, over: Partial<PublicAircraft> = {}): TrackedAircraft {
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
    receivedAt: SAMPLED_AT,
    sampledAt: SAMPLED_AT,
    ...over,
  }
}

function infoOf(ac: TrackedAircraft, airports: readonly PhaseAirportInput[] = [LTFM]): PhaseInfo {
  const phases = new FlightPhaseTracker()
  phases.setAirports(airports)
  phases.observe([ac])
  const info = phases.get(ac.hex)
  if (info === undefined) throw new Error('aircraft was not classified')
  return info
}

/** Hücre: Türkçe ve İngilizce, metrik; `now` örnekten 1 sn sonra. */
function cell(ac: TrackedAircraft, locale: Locale = 'tr', now = SAMPLED_AT + 1_000) {
  const messages = locale === 'tr' ? tr : en
  return aircraftPlace(ac, infoOf(ac), now, messages, { locale, units: 'metric' })
}

const km = (value: number) => `${value}${NBSP}km`

describe('aircraftPlace: "Konum ve durum" hücresi (D-085)', () => {
  it('yaklaşmada: rozet ve havalimanı merkezine uzaklık', () => {
    const ac = aircraft(destinationPoint(IST_ARP, 180, 18), { alt: 4000, vr: -900, trk: 0 })
    const expected = formatDistance(distanceKm(ac, IST_ARP), { nowrap: true })
    expect(cell(ac)).toEqual({
      phase: 'approaching',
      badge: 'Yaklaşmada',
      text: `IST, ${expected}`,
      airport: 'LTFM',
    })
    expect(cell(ac, 'en')).toMatchObject({ badge: 'Approaching', text: `IST, ${expected}` })
    expect(expected).toBe(km(18))
  })

  it('inişte, 35L hizasında: "İnişte IST, pist 35L" / "Landing IST, runway 35L"', () => {
    const ac = aircraft(destinationPoint(T35L, B35L + 180, 5), { alt: 1218, vr: -700, trk: B35L })
    expect(cell(ac)).toEqual({
      phase: 'landing',
      badge: 'İnişte',
      text: 'IST, pist 35L',
      airport: 'LTFM',
    })
    expect(cell(ac, 'en')).toMatchObject({ badge: 'Landing', text: 'IST, runway 35L' })
  })

  it('havalimanında yerde: "Yerde IST"; uzakta yerde: rozet ve yönlü konum', () => {
    const taxi = aircraft(destinationPoint(IST_ARP, 90, 1), { gnd: true })
    expect(cell(taxi)).toEqual({ phase: 'onGround', badge: 'Yerde', text: 'IST', airport: 'LTFM' })
    expect(cell(taxi, 'en')).toMatchObject({ badge: 'On ground', text: 'IST' })
    const field = aircraft(destinationPoint(IST_ARP, 270, 20), { gnd: true })
    expect(cell(field)).toMatchObject({ badge: 'Yerde', text: `IST, ${km(20)} batısında` })
    expect(cell(field, 'en')).toMatchObject({ text: `${km(20)} west of IST` })
  })

  it('yolda: rozet yok; "IST, 45 km kuzeyinde" / "45 km north of IST"; 3 km içinde "üzerinde"', () => {
    const cruise = aircraft(destinationPoint(IST_ARP, 0, 45), { alt: 35000, vr: 0, trk: 90 })
    expect(cell(cruise)).toEqual({
      phase: 'enRoute',
      badge: null,
      text: `IST, ${km(45)} kuzeyinde`,
      airport: 'LTFM',
    })
    expect(cell(cruise, 'en').text).toBe(`${km(45)} north of IST`)
    const over = aircraft(destinationPoint(IST_ARP, 90, 2), { alt: 35000, vr: 0, trk: 270 })
    expect(cell(over).text).toBe('IST üzerinde')
    expect(cell(over, 'en').text).toBe('over IST')
  })

  it('sekiz yön, iki dilde', () => {
    const expected: Record<Locale, string[]> = {
      tr: [
        'kuzeyinde',
        'kuzeydoğusunda',
        'doğusunda',
        'güneydoğusunda',
        'güneyinde',
        'güneybatısında',
        'batısında',
        'kuzeybatısında',
      ],
      en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    }
    for (const locale of ['tr', 'en'] as const) {
      const texts = COMPASS_POINTS_8.map((_, i) => {
        const ac = aircraft(destinationPoint(IST_ARP, i * 45, 60), { alt: 35000, vr: 0, trk: 0 })
        return cell(ac, locale).text
      })
      expect(texts).toEqual(
        expected[locale].map((direction) =>
          locale === 'tr' ? `IST, ${km(60)} ${direction}` : `${km(60)} ${direction} of IST`,
        ),
      )
    }
  })

  it('seyrek veride (D-122) eskiyen alçaktaki uçak "Alçakta sinyal kaybı" olmaz', () => {
    const ac = aircraft(destinationPoint(T35L, B35L + 180, 5), { alt: 1218, vr: -700, trk: B35L })
    const late = SAMPLED_AT + 300_000
    expect(cell(ac, 'tr', late).phase).toBe('lowAltLost')
    const sparse = aircraftPlace(ac, infoOf(ac), late, tr, {
      locale: 'tr',
      units: 'metric',
      lowAltLostAfterMs: Infinity,
    })
    expect(sparse).toMatchObject({ phase: 'landing', badge: 'İnişte', text: 'IST, pist 35L' })
  })

  it('havacılık birimleri: uzaklık NM ile', () => {
    const ac = aircraft(destinationPoint(IST_ARP, 0, 18), { alt: 35000, vr: 0, trk: 90 })
    const view = aircraftPlace(ac, infoOf(ac), SAMPLED_AT, en, { locale: 'en', units: 'aviation' })
    expect(view.text).toBe(`9.7${NBSP}NM north of IST`)
  })

  it('alçakta sinyal kaybı: 30 sn’den eski örnekte rozet ve son bilinen uzaklık', () => {
    const ac = aircraft(destinationPoint(T35L, B35L + 180, 3), { alt: 900, vr: -700, trk: B35L })
    const expected = formatDistance(distanceKm(ac, IST_ARP), { nowrap: true })
    expect(cell(ac, 'tr', SAMPLED_AT + 31_000)).toEqual({
      phase: 'lowAltLost',
      badge: 'Alçakta sinyal kaybı',
      text: `IST, ${expected}`,
      airport: 'LTFM',
    })
    expect(cell(ac, 'en', SAMPLED_AT + 31_000)).toMatchObject({
      badge: 'Signal lost at low altitude',
      text: `IST, ${expected.replace(',', '.')}`,
    })
    expect(cell(ac, 'tr', SAMPLED_AT + 29_000)).toMatchObject({ phase: 'landing', badge: 'İnişte' })
  })

  it('havalimanı yokken ya da uçak henüz izlenmediyse konum koordinattır', () => {
    const ac = aircraft({ lat: 41.2753, lon: 28.7519 }, { alt: 5000 })
    const noAirports = aircraftPlace(ac, infoOf(ac, []), SAMPLED_AT, tr, {
      locale: 'tr',
      units: 'metric',
    })
    expect(noAirports).toEqual({
      phase: 'enRoute',
      badge: null,
      text: formatPosition(ac.lat, ac.lon),
      airport: null,
    })
    expect(noAirports.text).toBe('41.275, 28.752')
    const taxi = aircraft({ lat: 41.2753, lon: 28.7519 }, { gnd: true })
    expect(
      aircraftPlace(taxi, undefined, SAMPLED_AT, tr, { locale: 'tr', units: 'metric' }),
    ).toEqual({ phase: 'onGround', badge: 'Yerde', text: '41.275, 28.752', airport: null })
  })

  it('IATA kodu boşsa ICAO yazılır', () => {
    const ac = aircraft(destinationPoint(IST_ARP, 0, 45), { alt: 35000, vr: 0, trk: 90 })
    const info = infoOf(ac, [{ ...LTFM, iata: '' }])
    const view = aircraftPlace(ac, info, SAMPLED_AT, tr, { locale: 'tr', units: 'metric' })
    expect(view.text).toBe(`LTFM, ${km(45)} kuzeyinde`)
  })

  it('sayıdan önce "·" ya da "–" yok (D-081)', () => {
    const ac = aircraft(destinationPoint(IST_ARP, 0, 45), { alt: 35000, vr: 0, trk: 90 })
    for (const locale of ['tr', 'en'] as const) {
      expect(cell(ac, locale).text).not.toMatch(/[·–—]\s*\d/)
    }
  })
})
