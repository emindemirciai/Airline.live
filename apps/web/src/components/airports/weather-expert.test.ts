import { getMessages, type WeatherTextOptions } from '@havayolu/i18n'
import { describe, expect, it } from 'vitest'
import { metarFromRaw } from '../../lib/test/weather-fixture'
import { metarCodeRows } from './weather-expert'

const tr: WeatherTextOptions = { locale: 'tr', t: getMessages('tr').weather }
const en: WeatherTextOptions = { locale: 'en', t: getMessages('en').weather }
const OBSERVED = '2026-01-15T12:50:00.000Z'

const meanings = (raw: string, options: WeatherTextOptions = tr) =>
  Object.fromEntries(
    metarCodeRows(metarFromRaw(raw, OBSERVED), options).map((row) => [row.code, row.meaning]),
  )

describe('metarCodeRows: çözücünün tanıdığı, hava olayı olmayan gruplar', () => {
  it('pist yüzeyi durumu RVR sayılmaz; renk durumu "Belirlenemedi" yazmaz', () => {
    const rows = meanings('LTCG 151250Z 22010KT 9999 FEW030 10/05 Q1015 R11/290195 NOSIG BLU')
    const t = tr.t
    expect(rows['R11/290195']).toBe(t.expert.runwayState)
    expect(rows['R11/290195']).not.toContain(t.expert.rvr)
    expect(rows.BLU).toBe(t.expert.colourState)
    expect(Object.values(rows)).not.toContain(t.value.undetermined)
  })

  it('pist kapalı (R/SNOCLO), temizlenmiş pist (R88/CLRD//), deniz durumu, RE//, WS RWY', () => {
    const t = tr.t
    const rows = meanings(
      'LTFH 151250Z AUTO 04008KT 9999 // NCD 10/05 Q1015 RE// WS RWY35 W15/S2 R88/CLRD// R/SNOCLO',
    )
    expect(rows['RE//']).toBe(t.expert.recentNotObserved)
    expect(rows['WS RWY35']).toContain(t.expert.windShear)
    expect(rows['WS RWY35']).toContain('35')
    expect(rows['W15/S2']).toBe(t.expert.seaState)
    expect(rows['R88/CLRD//']).toBe(t.expert.runwayState)
    expect(rows['R/SNOCLO']).toBe(t.expert.runwayState)
    expect(Object.values(rows)).not.toContain(t.value.undetermined)
  })

  it('gerçek RVR grubu yine RVR satırıdır; İngilizcede de aynı', () => {
    const rows = meanings('LTFM 151250Z 27010KT 0600 R35/0450N FG VV002 05/05 Q1015', en)
    expect(rows['R35/0450N']).toContain(en.t.expert.rvr)
    expect(Object.values(rows)).not.toContain(en.t.value.undetermined)
  })
})
