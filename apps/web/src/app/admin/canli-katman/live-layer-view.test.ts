import { getMessages } from '@havayolu/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  parseLiveLayerReason,
  parseLiveLayerResult,
  type LiveLayerState,
} from '../../../lib/live-layer'
import { LiveLayerForm } from './layer-form'
import { LiveLayerLog, LiveLayerStatus } from './live-layer-view'

// Form bileşeni server action'ı içe aktarır; görünüm testinde eylem çağrılmaz.
vi.mock('./actions', () => ({ setLiveLayerAction: async () => ({ error: null }) }))

const t = getMessages('tr').admin.liveLayer

/** Görünen metin: etiketler atılır, HTML varlıkları çözülür. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const ON_NEVER: LiveLayerState = { enabled: true, updatedAt: null, updatedBy: null, actions: [] }
const OFF: LiveLayerState = {
  enabled: false,
  updatedAt: '2026-10-15T09:01:00.000Z',
  updatedBy: 'yonetici@example.com',
  actions: [
    {
      at: '2026-10-15T09:01:00.000Z',
      actor: 'yonetici@example.com',
      action: 'off',
      reason: 'Karar 2026/123',
    },
    { at: '2026-10-15T08:00:00.000Z', actor: 'yonetici@example.com', action: 'on', reason: null },
  ],
}

const labels = {
  reason: t.reason,
  reasonHint: t.reasonHint,
  turnOff: t.turnOff,
  turnOn: t.turnOn,
  pending: t.pending,
  errors: t.errors,
}

describe('LiveLayerStatus', () => {
  it('durum metinle yazılır; hiç değiştirilmemişse varsayılan açık', () => {
    const html = renderToStaticMarkup(
      createElement(LiveLayerStatus, { layer: ON_NEVER, result: null, t }),
    )
    expect(text(html)).toBe('Durum: Açık Hiç değiştirilmedi (varsayılan: açık)')
    expect(html).toContain('data-state="on"')
  })

  it('son değişiklik Türkiye saatiyle ve kimle; sonuç satırı yalnız durumla uyuşursa', () => {
    const html = renderToStaticMarkup(
      createElement(LiveLayerStatus, { layer: OFF, result: 'off', t }),
    )
    expect(text(html)).toBe(
      'Durum: Kapalı Son değişiklik: 15.10.2026 12:01:00, yonetici@example.com Kapatıldı. Harita, arama ve API birkaç saniye içinde boşalır.',
    )
    expect(html).toContain('data-state="off"')
    const stale = renderToStaticMarkup(
      createElement(LiveLayerStatus, { layer: OFF, result: 'on', t }),
    )
    expect(text(stale)).not.toContain(t.switchedOn)
  })
})

describe('LiveLayerForm', () => {
  it('açıkken "Canlı katmanı kapat" (tehlike), gizli alan false', () => {
    const html = renderToStaticMarkup(createElement(LiveLayerForm, { enabled: true, labels }))
    expect(html).toContain('name="enabled" value="false"')
    expect(html).toContain('button-danger')
    expect(text(html)).toContain('Canlı katmanı kapat')
    expect(html).toContain('maxLength="500"')
  })

  it('kapalıyken "Canlı katmanı aç", gizli alan true', () => {
    const html = renderToStaticMarkup(createElement(LiveLayerForm, { enabled: false, labels }))
    expect(html).toContain('name="enabled" value="true"')
    expect(html).not.toContain('button-danger')
    expect(text(html)).toContain('Canlı katmanı aç')
  })
})

describe('LiveLayerLog', () => {
  it('işlem satırları: zaman, kim, işlem ve neden (yoksa tire)', () => {
    const html = renderToStaticMarkup(createElement(LiveLayerLog, { actions: OFF.actions, t }))
    expect(html).toContain('class="table-wrap"')
    const rows = html.split('<tr>').slice(2).map(text)
    expect(rows).toEqual([
      '15.10.2026 12:01:00 yonetici@example.com Kapatıldı Karar 2026/123',
      '15.10.2026 11:00:00 yonetici@example.com Açıldı —',
    ])
  })

  it('kayıt yoksa boş metni', () => {
    const html = renderToStaticMarkup(createElement(LiveLayerLog, { actions: [], t }))
    expect(text(html)).toBe(t.log.empty)
  })
})

describe('form ve sorgu yardımcıları', () => {
  it('neden kırpılır, boşsa null; 500 karakterden uzunsa geçersiz', () => {
    expect(parseLiveLayerReason(null)).toEqual({ ok: true, reason: null })
    expect(parseLiveLayerReason('  a  ')).toEqual({ ok: true, reason: 'a' })
    expect(parseLiveLayerReason('   ')).toEqual({ ok: true, reason: null })
    expect(parseLiveLayerReason('ş'.repeat(500))).toMatchObject({ ok: true })
    expect(parseLiveLayerReason('x'.repeat(501))).toEqual({ ok: false })
  })

  it('sonuç sorgusu: acildi, kapatildi; başka değer null', () => {
    expect(parseLiveLayerResult('acildi')).toBe('on')
    expect(parseLiveLayerResult(['kapatildi'])).toBe('off')
    expect(parseLiveLayerResult('evet')).toBeNull()
    expect(parseLiveLayerResult(undefined)).toBeNull()
  })
})
