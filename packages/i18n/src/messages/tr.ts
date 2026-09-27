/** Türkçe arayüz metinleri (varsayılan dil). Anahtar yapısı tüm diller için buradan türetilir. */
export const tr = {
  meta: {
    description: 'Türkiye odaklı canlı uçuş takibi, istasyona yaklaşma ve iniş bildirimleri.',
  },
  nav: {
    status: 'Durum',
    changelog: 'Yenilikler',
    language: 'Dil',
    switchTo: 'English',
    mainLabel: 'Ana menü',
  },
  status: {
    title: 'Sistem durumu',
    intro: 'Uygulamanın sürümü, sunucu bağlantısı ve yol haritasındaki ilerleme.',
    appVersion: 'Uygulama sürümü',
    build: 'Derleme',
    environment: 'Ortam',
    api: 'Sunucu (API)',
    apiOk: 'Çalışıyor',
    apiDown: 'Sunucuya ulaşılamıyor',
    apiDownHint: 'Yerelde başlatmak için proje klasöründe “pnpm dev” komutunu çalıştır.',
    apiVersion: 'Sunucu sürümü',
    checkedAt: 'Kontrol zamanı',
    roadmap: 'Yol haritası',
    progress: '{done} / {total} kilometre taşı tamamlandı',
    milestoneStatus: {
      done: 'Tamamlandı',
      in_progress: 'Sürüyor',
      planned: 'Planlandı',
    },
    part: 'Parça',
  },
  changelog: {
    title: 'Yenilikler',
    intro:
      'Her sürümde uygulamaya neler geldiğini buradan takip edebilirsin. Bağlantılarla o sürümde eklenen sayfaları hemen deneyebilirsin.',
    current: 'Güncel sürüm',
    tryIt: 'Dene',
    released: 'Yayın tarihi',
  },
  footer: {
    dataAttributionPrefix: 'Canlı uçuş verisi:',
    license: 'lisansıyla',
  },
  admin: {
    title: 'Yönetim',
    loginTitle: 'Yönetici girişi',
    loginIntro: 'Yönetim paneline ve analiz paneline aynı yönetici hesabıyla girilir.',
    email: 'E-posta',
    password: 'Kurulum anahtarı',
    submit: 'Giriş yap',
    logout: 'Çıkış yap',
    loginFailed: 'E-posta ya da kurulum anahtarı hatalı.',
    loginRateLimited: 'Çok fazla deneme yapıldı. Bir dakika sonra yeniden dene.',
    loginDisabled:
      'Yönetici girişi bu sunucuda kapalı. ADMIN_EMAIL ve ADMIN_SETUP_TOKEN (en az 12 karakter) birlikte tanımlı olmalı, REDIS_QUEUE_URL erişilebilir olmalı. Nedeni API loglarında yazar.',
    loginUnavailable: 'Sunucuya ulaşılamadı. API’nin çalıştığını kontrol et.',
    servicesTitle: 'Servisler',
    servicesIntro: 'Bütün servislerin anlık durumu. Sayfa her açılışta yeniden kontrol eder.',
    overall: 'Genel durum',
    refresh: 'Yeniden kontrol et',
    openAnalytics: 'Analiz panelini aç',
    columns: {
      service: 'Servis',
      state: 'Durum',
      version: 'Sürüm',
      latency: 'Gecikme',
      detail: 'Ayrıntı',
    },
    states: {
      ok: 'Çalışıyor',
      degraded: 'Sorunlu',
      down: 'Çalışmıyor',
      not_configured: 'Yapılandırılmadı',
    },
    services: {
      web: 'Web',
      api: 'API',
      workerRt: 'Worker (gerçek zamanlı)',
      workerBg: 'Worker (arka plan)',
      workerOther: 'Worker',
      postgres: 'PostgreSQL',
      redisQueue: 'Redis (kuyruk)',
      redisLive: 'Redis (canlı durum)',
      analytics: 'Analiz (Siteni Analiz Et)',
      referenceData: 'Referans verisi (havalimanı, pist, havayolu)',
      trackPartitions: 'İz tabloları (günlük bölümler)',
    },
    detail: {
      memory: 'Bellek',
      heartbeatAge: 'Son sinyal',
      roles: 'Roller',
      gitSha: 'Derleme',
      uptime: 'Çalışma süresi',
      httpStatus: 'HTTP',
      error: 'Hata',
      secondsAgo: '{n} sn önce',
      seconds: '{n} sn',
      megabytes: '{used} / {max} MB',
      counts: '{airports} havalimanı · {runways} pist · {airlines} havayolu',
      lastCheck: 'Son kontrol',
      hoursAgo: '{n} sa önce',
      origin: 'Kaynak',
      originRemote: 'OurAirports ve VRS (günlük)',
      originFixture: "Commit'li alt küme (yerel geliştirme)",
      daysAhead: 'Önceden açık gün',
      oldestDay: 'En eski gün',
      defaultRows: 'DEFAULT bölümündeki satır (0 olmalı)',
    },
    fetchFailed: 'Servis raporu alınamadı. API’ye ulaşılamıyor olabilir.',
  },
  consent: {
    title: 'Analiz için onay',
    body: 'Siteyi geliştirmek için ziyaret istatistiklerini kendi analiz uygulamamızla ölçüyoruz. Bunun için tarayıcında rastgele bir ziyaretçi kimliği saklanır. Onay vermezsen ölçüm yapılmaz.',
    accept: 'Kabul et',
    reject: 'Reddet',
    settings: 'Analiz tercihleri',
  },
  errors: {
    notFoundTitle: 'Sayfa bulunamadı',
    notFoundBody: 'Aradığın sayfa yok ya da taşınmış. Durum sayfasından devam edebilirsin.',
    goToStatus: 'Durum sayfasına git',
  },
  /** Sayfa kaynağında (Sayfa kaynağını görüntüle) görünen bildirim; ekranda gösterilmez. */
  legal: {
    owner: '{app} · © {year} {owner} ({ownerUrl}) · Kaynak kodu: {repoUrl}',
    license:
      'Bu yazılımın kodu MIT lisansıyla lisanslanmıştır. Kodun tüm kopyaları ya da önemli bölümleri telif bildirimini ve MIT lisans metnini (LICENSE) içermek zorundadır.',
    violation:
      'Bu bildirim ve lisans metni olmadan kopyalamak ya da dağıtmak lisans ve telif hakkı ihlalidir; hak sahibi 5846 sayılı Fikir ve Sanat Eserleri Kanunu ve uluslararası telif hukuku kapsamında hukuki yola başvurabilir.',
    brand:
      '“{app}” adı ve logosu MIT lisansı kapsamında değildir, hakları saklıdır. Üçüncü taraf verileri kendi lisanslarına tabidir.',
  },
}

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }

/** Tüm dillerin uyması gereken metin şekli. */
export type Messages = Widen<typeof tr>
