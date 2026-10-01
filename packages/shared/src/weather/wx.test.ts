import { describe, expect, it } from 'vitest'
import type { WeatherGroup } from './schema'
import {
  compareWeatherSeverity,
  mostSevereGroup,
  parseWeatherGroup,
  weatherPhraseId,
  weatherRank,
  WX_PHRASE_IDS,
} from './wx'

const group = (token: string): WeatherGroup => {
  const parsed = parseWeatherGroup(token)
  if (!parsed) throw new Error(`çözülemedi: ${token}`)
  return parsed
}

describe('parseWeatherGroup', () => {
  // [metin, şiddet, VC, tanımlayıcı, olaylar, RE]
  const cases: [string, string, boolean, string | null, string[], boolean][] = [
    ['-RA', 'light', false, null, ['RA'], false],
    ['RA', 'moderate', false, null, ['RA'], false],
    ['+RA', 'heavy', false, null, ['RA'], false],
    ['-SHRA', 'light', false, 'SH', ['RA'], false],
    ['+TSRA', 'heavy', false, 'TS', ['RA'], false],
    // MGM: şiddet yağışı niteler (-TSRA: oraj ve hafif yağmur).
    ['-TSRA', 'light', false, 'TS', ['RA'], false],
    ['TS', 'moderate', false, 'TS', [], false],
    ['+TSRAGR', 'heavy', false, 'TS', ['RA', 'GR'], false],
    ['TSGRRA', 'moderate', false, 'TS', ['GR', 'RA'], false],
    ['+SNRA', 'heavy', false, null, ['SN', 'RA'], false],
    ['-RASN', 'light', false, null, ['RA', 'SN'], false],
    ['FZRA', 'moderate', false, 'FZ', ['RA'], false],
    ['FZFG', 'moderate', false, 'FZ', ['FG'], false],
    ['BCFG', 'moderate', false, 'BC', ['FG'], false],
    ['MIFG', 'moderate', false, 'MI', ['FG'], false],
    ['PRFG', 'moderate', false, 'PR', ['FG'], false],
    ['BLSN', 'moderate', false, 'BL', ['SN'], false],
    ['DRSA', 'moderate', false, 'DR', ['SA'], false],
    ['VCSH', 'moderate', true, 'SH', [], false],
    ['VCTS', 'moderate', true, 'TS', [], false],
    ['VCFG', 'moderate', true, null, ['FG'], false],
    ['VCBLDU', 'moderate', true, 'BL', ['DU'], false],
    ['+FC', 'heavy', false, null, ['FC'], false],
    ['SS', 'moderate', false, null, ['SS'], false],
    ['UP', 'moderate', false, null, ['UP'], false],
    ['SHPL', 'moderate', false, 'SH', ['PL'], false],
    ['RERA', 'moderate', false, null, ['RA'], true],
    ['RESHRA', 'moderate', false, 'SH', ['RA'], true],
    ['RETSGRRA', 'moderate', false, 'TS', ['GR', 'RA'], true],
    ['REFZRA', 'moderate', false, 'FZ', ['RA'], true],
    ['REBLSN', 'moderate', false, 'BL', ['SN'], true],
  ]
  it.each(cases)('%s', (token, intensity, vicinity, descriptor, phenomena, recent) => {
    expect(parseWeatherGroup(token)).toEqual({
      raw: token,
      intensity,
      vicinity,
      descriptor,
      phenomena,
      recent,
    })
  })

  it.each([
    'SH',
    'BL',
    'FZ',
    '-',
    'RE',
    'XX',
    'RAXX',
    'CAVOK',
    'NOSIG',
    'NSC',
    'AUTO',
    'RARA',
    'SNRAGRDZ',
    '//',
  ])('%s hava grubu değildir', (token) => {
    expect(parseWeatherGroup(token)).toBeNull()
  })
})

describe('weatherPhraseId', () => {
  const cases: [string, string][] = [
    ['-RA', 'RA_light'],
    ['RA', 'RA'],
    ['+RA', 'RA_heavy'],
    ['-DZ', 'DZ_light'],
    ['+DZ', 'DZ_heavy'],
    ['RADZ', 'DZRA'],
    ['-DZRA', 'DZRA_light'],
    ['-SHRA', 'SHRA_light'],
    ['SHRA', 'SHRA'],
    ['+SHRA', 'SHRA_heavy'],
    ['-TSRA', 'TSRA_light'],
    ['TSRA', 'TSRA'],
    ['+TSRA', 'TSRA_heavy'],
    ['TS', 'TS'],
    ['TSGR', 'TSGR'],
    ['+TSRAGR', 'TSGR_heavy'],
    ['TSGRRA', 'TSGR'],
    ['TSGS', 'TSGS'],
    ['-TSSN', 'TSSN_light'],
    ['TSRASN', 'TSRASN'],
    ['-SN', 'SN_light'],
    ['+SN', 'SN_heavy'],
    ['SHSN', 'SHSN'],
    ['+SHSN', 'SHSN_heavy'],
    ['-RASN', 'RASN_light'],
    ['+SNRA', 'SNRA_heavy'],
    ['-SHRASN', 'SHRASN_light'],
    ['SHSNRA', 'SHSNRA'],
    ['FZRA', 'FZRA'],
    ['-FZDZ', 'FZDZ_light'],
    ['FZFG', 'FZFG'],
    ['GR', 'GR'],
    ['-SHGS', 'SHGS_light'],
    ['+SHGR', 'SHGR_heavy'],
    ['SG', 'SG'],
    ['PL', 'PL'],
    ['IC', 'IC'],
    ['UP', 'UP'],
    ['FG', 'FG'],
    ['BCFG', 'BCFG'],
    ['MIFG', 'MIFG'],
    ['PRFG', 'PRFG'],
    ['BR', 'BR'],
    ['HZ', 'HZ'],
    ['FU', 'FU'],
    ['VA', 'VA'],
    ['DU', 'DU'],
    ['SA', 'SA'],
    ['PO', 'PO'],
    ['SQ', 'SQ'],
    ['FC', 'FC'],
    ['+FC', 'FC_heavy'],
    ['SS', 'SS'],
    ['+DS', 'DS_heavy'],
    ['BLSN', 'BLSN'],
    ['DRSN', 'DRSN'],
    ['BLDU', 'BLDU'],
    ['VCSH', 'VCSH'],
    ['VCTS', 'VCTS'],
    ['VCFG', 'FG'],
    ['VCBLSA', 'BLSA'],
    ['VCPO', 'PO'],
    ['RERA', 'RA'],
  ]
  it.each(cases)('%s → %s', (token, id) => {
    expect(weatherPhraseId(group(token))).toBe(id)
    expect(WX_PHRASE_IDS).toContain(id)
  })

  it('kimlik listesi tekrarsızdır ve her yazılabilir grup kapalı listeye düşer', () => {
    expect(new Set(WX_PHRASE_IDS).size).toBe(WX_PHRASE_IDS.length)
    const signs = ['', '-', '+', 'VC']
    const descriptors = ['', 'MI', 'BC', 'PR', 'DR', 'BL', 'SH', 'TS', 'FZ']
    const codes = ['DZ', 'RA', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP', 'BR', 'FG', 'FU', 'VA']
    const more = ['DU', 'SA', 'HZ', 'PY', 'PO', 'SQ', 'FC', 'SS', 'DS']
    for (const sign of signs) {
      for (const d of descriptors) {
        for (const a of [...codes, ...more, '']) {
          for (const b of ['', 'RA', 'SN', 'GR']) {
            const parsed = parseWeatherGroup(`${sign}${d}${a}${b}`)
            if (parsed) expect(WX_PHRASE_IDS).toContain(weatherPhraseId(parsed))
          }
        }
      }
    }
  })
})

describe('önem sırası (MGM meydan uyarı listesi)', () => {
  it('sıra: FC/SQ/SS/DS/VA > TS > FZ > dolu > kar > sis > yağmur > kısmi sis > pus', () => {
    const order = ['+FC', 'TS', 'FZRA', 'GR', 'SN', 'FG', 'RA', 'BCFG', 'BR']
    expect(order.map((t) => weatherRank(group(t)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('"-DZ FG" sistir; şiddet eşitliği bozar; çevredeki grup en sona kalır', () => {
    expect(mostSevereGroup([group('-DZ'), group('FG')])?.raw).toBe('FG')
    expect(mostSevereGroup([group('-SHRA'), group('+RA')])?.raw).toBe('+RA')
    expect(mostSevereGroup([group('VCTS'), group('BR')])?.raw).toBe('BR')
    expect(compareWeatherSeverity(group('+TSRA'), group('-TSRA'))).toBeLessThan(0)
    expect(mostSevereGroup([])).toBeNull()
  })
})
