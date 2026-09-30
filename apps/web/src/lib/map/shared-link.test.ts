import { describe, expect, it } from 'vitest'
import {
  SHARED_LINK_DONE,
  SHARED_LINK_SEARCHES,
  afterSearch,
  afterStore,
  initialSharedLink,
  pendingHex,
} from './shared-link'

describe('paylaşılan bağlantı (/?hex=)', () => {
  it('hex yoksa süreç yoktur; varsa önce aranır', () => {
    expect(initialSharedLink(null)).toBe(SHARED_LINK_DONE)
    expect(initialSharedLink('ff0001')).toEqual({ phase: 'search', hex: 'ff0001', attempt: 1 })
    expect(pendingHex(initialSharedLink('ff0001'))).toBe('ff0001')
    expect(pendingHex(SHARED_LINK_DONE)).toBeNull()
  })

  it('arama bulursa biter', () => {
    expect(afterSearch(initialSharedLink('ff0001'), true)).toBe(SHARED_LINK_DONE)
  })

  it('arama hata verir ya da bulamazsa ilk tam görüntü beklenir; uçak oradaysa seçilir', () => {
    const waiting = afterSearch(initialSharedLink('ff0001'), false)
    expect(waiting).toEqual({ phase: 'wait', hex: 'ff0001', attempt: 1 })
    // Görüntü henüz gelmedi: beklemeye devam.
    expect(afterStore(waiting, false, false)).toBe(waiting)
    // Uçak görüntüyle depoya geldi.
    expect(afterStore(waiting, true, true)).toBe(SHARED_LINK_DONE)
  })

  it(`ilk görüntüde de yoksa bir kez daha aranır; toplam ${SHARED_LINK_SEARCHES} aramadan sonra "bulunamadı"`, () => {
    const waiting = afterSearch(initialSharedLink('ff0001'), false)
    const retry = afterStore(waiting, false, true)
    expect(retry).toEqual({ phase: 'search', hex: 'ff0001', attempt: 2 })
    // Arama sürerken depo değişse de ikinci kez aranmaz.
    expect(afterStore(retry, false, true)).toBe(retry)
    const missing = afterStore(afterSearch(retry, false), false, true)
    expect(missing).toEqual({ phase: 'missing', hex: 'ff0001' })
    expect(afterStore(missing, false, true)).toBe(missing)
    // Uçak sonra görünüme girerse yine seçilir.
    expect(afterStore(missing, true, true)).toBe(SHARED_LINK_DONE)
  })

  it('arama sürerken uçak canlı akışla gelirse seçilir; geç gelen arama sonucu etkisizdir', () => {
    const searching = initialSharedLink('ff0001')
    const done = afterStore(searching, true, true)
    expect(done).toBe(SHARED_LINK_DONE)
    expect(afterSearch(done, false)).toBe(SHARED_LINK_DONE)
  })
})
