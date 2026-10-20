import { PROVIDER_LICENSES } from '@havayolu/providers'
import { LIVE_DATA_LICENSE } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'

describe('LIVE_DATA_LICENSE (D-115)', () => {
  it('sağlayıcı lisans kaydındaki adsb.lol satırıyla aynıdır', () => {
    const adsbLol = PROVIDER_LICENSES.adsbLol
    expect(LIVE_DATA_LICENSE.license).toBe(adsbLol.license)
    expect(LIVE_DATA_LICENSE.attribution).toBe(adsbLol.attribution.text)
    expect(LIVE_DATA_LICENSE.licenseUrl).toBe(adsbLol.attribution.licenseUrl)
  })
})
