import type { LocalizedText } from './locale'

export type MilestoneStatus = 'done' | 'in_progress' | 'planned'

export interface Milestone {
  id: string
  part: string
  title: LocalizedText
  status: MilestoneStatus
}

/**
 * Kullanıcıya dönük yol haritası (Durum sayfasında gösterilir).
 * Her kilometre taşı bittiğinde durumu burada güncellenir; ayrıntılı plan docs/plans/ altındadır.
 */
export const ROADMAP: readonly Milestone[] = [
  {
    id: 'p0',
    part: '0',
    status: 'done',
    title: { tr: 'Proje kuruluşu ve yol haritası', en: 'Project setup and roadmap' },
  },
  {
    id: 'p1-m0',
    part: '1',
    status: 'done',
    title: {
      tr: 'Yerel test ortamı, Durum ve Yenilikler sayfaları',
      en: 'Local test environment, Status and What’s new pages',
    },
  },
  {
    id: 'p1-m1a',
    part: '1',
    status: 'done',
    title: {
      tr: 'Bütün servisler, yönetici girişi ve Servisler paneli',
      en: 'All services, admin sign-in and Services panel',
    },
  },
  {
    id: 'p1-m1b',
    part: '1',
    status: 'in_progress',
    title: { tr: 'Otomatik yayın: GitHub → Dokploy', en: 'Automatic release: GitHub → Dokploy' },
  },
  {
    id: 'p1-m2',
    part: '1',
    status: 'planned',
    title: { tr: 'Veritabanı, havalimanı ve pist verisi', en: 'Database, airport and runway data' },
  },
  {
    id: 'p1-m3',
    part: '1',
    status: 'planned',
    title: { tr: 'Canlı uçuş verisi bağlantısı', en: 'Live flight data connection' },
  },
  {
    id: 'p1-m4',
    part: '1',
    status: 'planned',
    title: {
      tr: 'Türkiye üzerindeki uçakların sürekli takibi',
      en: 'Continuous tracking of aircraft over Türkiye',
    },
  },
  {
    id: 'p1-m5',
    part: '1',
    status: 'planned',
    title: { tr: 'Canlı veri akışı (WebSocket)', en: 'Live data stream (WebSocket)' },
  },
  {
    id: 'p1-m6',
    part: '1',
    status: 'planned',
    title: { tr: 'Canlı harita ve arama', en: 'Live map and search' },
  },
  {
    id: 'p1-m7',
    part: '1',
    status: 'planned',
    title: { tr: 'Kapsama ölçümü ve test araçları', en: 'Coverage measurement and test tools' },
  },
  {
    id: 'p2a',
    part: '2A',
    status: 'planned',
    title: {
      tr: '10 km ve iniş bildirimi telefonuna',
      en: '10 km and landing alerts on your phone',
    },
  },
  {
    id: 'p2b',
    part: '2B',
    status: 'planned',
    title: { tr: 'Hesaplar, takip listesi, yedekleme', en: 'Accounts, watchlist, backups' },
  },
  {
    id: 'p3',
    part: '3',
    status: 'planned',
    title: {
      tr: 'Web ürününün tamamı ve operasyon panosu',
      en: 'Full web product and operations board',
    },
  },
  {
    id: 'p4a',
    part: '4A',
    status: 'planned',
    title: { tr: 'Android uygulaması (kapalı test)', en: 'Android app (closed testing)' },
  },
  {
    id: 'p4b',
    part: '4B',
    status: 'planned',
    title: {
      tr: 'iOS, mağazalar ve üretim sertleştirme',
      en: 'iOS, app stores and production hardening',
    },
  },
]

export function roadmapProgress(items: readonly Milestone[] = ROADMAP): {
  done: number
  total: number
} {
  return { done: items.filter((m) => m.status === 'done').length, total: items.length }
}
