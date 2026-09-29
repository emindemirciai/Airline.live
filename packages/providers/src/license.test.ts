import { describe, expect, it } from 'vitest'
import {
  assertProvidersAllowed,
  PROVIDER_LICENSES,
  ProviderLicenseError,
  type ProviderLicense,
} from './license'

const nonCommercial: ProviderLicense = {
  ...PROVIDER_LICENSES.adsbLol,
  id: 'example',
  name: 'Ticari olmayan örnek kaynak',
  commercialUse: false,
}

describe('lisans kaydı', () => {
  it('kayıttaki tüm sağlayıcılar ticari modda başlatılabilir', () => {
    expect(() =>
      assertProvidersAllowed('commercial', Object.values(PROVIDER_LICENSES)),
    ).not.toThrow()
  })

  it('ticari modda ticari olmayan sağlayıcı reddedilir', () => {
    expect(() => assertProvidersAllowed('commercial', [nonCommercial])).toThrow(
      ProviderLicenseError,
    )
  })

  it('ticari olmayan modda denetim uygulanmaz', () => {
    expect(() => assertProvidersAllowed('noncommercial', [nonCommercial])).not.toThrow()
  })

  it('adsb.lol atfı ODbL bağlantısı taşır ve türetilmiş veritabanı paylaşım şartı işaretlidir', () => {
    expect(PROVIDER_LICENSES.adsbLol.attribution.licenseUrl).toContain('odbl')
    expect(PROVIDER_LICENSES.adsbLol.shareAlike).toBe('derivative-database')
  })

  it('Esri uydu altlığı karo saklamaz ve "Powered by Esri" atfını taşır (data-sources.md §6a)', () => {
    const esri = PROVIDER_LICENSES.esriWorldImagery
    expect(esri.maxRawStorageDays).toBe(0)
    expect(esri.attribution.text).toMatch(/^Powered by Esri \| Esri, Vantor, Earthstar Geographics/)
    expect(esri.commercialUse).toBe(true)
  })

  it('adsb.lol hız sınırı notu D-073 kova değerlerini yazar', () => {
    expect(PROVIDER_LICENSES.adsbLol.rateLimit).toBe(
      'dinamik; 429 Retry-After taşımaz; başlangıç 0,1 istek/sn (alt 0,05, üst 0,2) + AIMD',
    )
  })
})
