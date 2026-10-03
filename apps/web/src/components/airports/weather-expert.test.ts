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

  it('rüzgâr kesmesi (üretim LGMK `WS R34`, `WS ALL RWY`): kod satırı ve anlamı iki dilde', () => {
    const lgmk = meanings('LGMK 031520Z 35019KT 9999 FEW018 20/15 Q1020 WS R34')
    expect(lgmk['WS R34']).toBe('Rüzgâr kesmesi: pist 34')
    const all = meanings('LTXX 031250Z 00000KT 9999 FEW030 10/05 Q1010 WS ALL RWY', en)
    expect(all['WS ALL RWY']).toBe('Wind shear: all runways')
  })

  it('tekrarlanan rüzgâr kesmesi grubu (WMO-306 FM 15): her kod satırı yalnız kendi pistini söyler', () => {
    const two = meanings('LTXX 031520Z 36005KT 9999 FEW030 20/10 Q1015 WS R16 WS R34')
    expect(two['WS R16']).toBe('Rüzgâr kesmesi: pist 16')
    expect(two['WS R34']).toBe('Rüzgâr kesmesi: pist 34')
    const mixed = meanings('LTXX 031520Z 36005KT 9999 FEW030 20/10 Q1015 WS R16 WS ALL RWY', en)
    expect(mixed['WS R16']).toBe('Wind shear: runway 16')
    expect(mixed['WS ALL RWY']).toBe('Wind shear: all runways')
    const landing = meanings(
      'LTXX 031520Z 36005KT 9999 FEW030 20/10 Q1015 WS LDG RWY05L WS TKOF R23R',
    )
    expect(landing['WS LDG RWY05L']).toBe('Rüzgâr kesmesi: pist 05L')
    expect(landing['WS TKOF R23R']).toBe('Rüzgâr kesmesi: pist 23R')
  })

  it('gerçek RVR grubu yine RVR satırıdır; İngilizcede de aynı', () => {
    const rows = meanings('LTFM 151250Z 27010KT 0600 R35/0450N FG VV002 05/05 Q1015', en)
    expect(rows['R35/0450N']).toContain(en.t.expert.rvr)
    expect(Object.values(rows)).not.toContain(en.t.value.undetermined)
  })
})
