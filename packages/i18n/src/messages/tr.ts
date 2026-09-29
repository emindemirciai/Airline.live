/** Türkçe arayüz metinleri (varsayılan dil). Anahtar yapısı tüm diller için buradan türetilir. */
export const tr = {
  meta: {
    description: 'Türkiye odaklı canlı uçuş takibi, istasyona yaklaşma ve iniş bildirimleri.',
  },
  nav: {
    map: 'Harita',
    status: 'Durum',
    changelog: 'Yenilikler',
    language: 'Dil',
    switchTo: 'English',
    mainLabel: 'Ana menü',
  },
  /** Canlı harita (kök sayfa). "Takip" kelimesi yalnızca bildirim aboneliğidir; kamera "Uçağı ortala"dır. */
  map: {
    title: 'Canlı harita',
    mapLabel: 'Canlı uçuş haritası',
    webglUnavailable:
      'Bu tarayıcı haritayı çizemiyor (WebGL2 desteklenmiyor ya da kapalı). Uçakları arama kutusundan ve uçak listesinden görebilirsin.',
    loading: 'Harita yükleniyor…',
    nav: 'Harita',
    /** Harita atfındaki canlı veri bağlantısının ön eki (data-sources.md §1). */
    dataAttributionPrefix: 'Canlı uçuş verisi:',
    /** Atıf satırındaki kullanım koşulları bağlantısı (E204 §3.1c.5, D-075). */
    termsLink: 'Koşullar',
    search: {
      label: 'Uçak ara',
      placeholder: 'Sefer no, çağrı kodu, tescil ya da hex',
      submit: 'Ara',
      searching: 'Aranıyor…',
      notFound:
        'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.',
      error: 'Arama şu an yapılamıyor. Biraz sonra yeniden dene.',
      rateLimited: 'Kısa sürede çok fazla arama yapıldı. Bir dakika sonra yeniden dene.',
      pick: 'Birden fazla uçak bulundu; birini seç.',
      flightNumberNote:
        'Sefer no, uçağın yayınladığı çağrı kodundan çıkarılır. Harfli çağrı kodu kullanan seferler (ör. THY4KN) sefer no ile bulunamaz; çağrı kodu ya da tescille ara.',
      results: 'Arama sonuçları',
    },
    card: {
      close: 'Kapat',
      follow: 'Uçağı ortala',
      following: 'Harita uçağı ortada tutuyor.',
      flight: 'Sefer no',
      callsign: 'Çağrı kodu',
      registration: 'Tescil',
      type: 'Uçak tipi',
      altitude: 'Yükseklik',
      speed: 'Yer hızı',
      verticalRate: 'Dikey hız',
      track: 'Yön',
      squawk: 'Transponder kodu',
      lastSeen: 'Son görülme',
      secondsAgo: '{s} sn önce',
      minutesAgo: '{m} dk önce',
      source: 'Veri kaynağı',
      positionSource: 'Konum kaynağı',
      hex: 'Hex kodu',
      sources: {
        adsbLol: 'ADSB.lol',
        localReceiver: 'Yerel alıcı',
      },
    },
    table: {
      caption: 'Haritada görünen uçaklar',
      captionLimited: 'Haritada görünen uçaklar (ilk {shown} / {total})',
      flight: 'Sefer',
      type: 'Tip',
      altitude: 'Yükseklik',
      speed: 'Hız',
      position: 'Konum',
      empty: 'Bu alanda şu an uçak görünmüyor.',
      show: 'Uçak listesini göster',
      hide: 'Uçak listesini gizle',
      select: '{flight} uçağını seç',
    },
    labels: {
      button: 'Etiketler',
      title: 'Etiket ayarları',
      selected: 'Seçili uçak',
      others: 'Diğer uçaklar',
      hidden: 'Gizle',
      short: 'Kısa',
      full: 'Tam',
      hint: 'Kısa: yalnızca sefer no. Tam: sefer no, hız ve yükseklik.',
    },
    status: {
      freshness: 'Veri yaşı {s} sn',
      connecting: 'Canlı veriye bağlanılıyor…',
      reconnecting: 'Bağlantı koptu; yeniden bağlanılıyor…',
      offline:
        'Canlı veri sunucusuna ulaşılamıyor. İnternet bağlantını kontrol et; yeniden denemeye devam ediyoruz.',
      noProvider: 'Canlı veri kaynağı şu an kapalı; haritada uçak görünmüyor.',
      providerDegraded: 'Canlı veri kaynağında yavaşlama var; konumlar gecikmeli gelebilir.',
      providerDown:
        'Canlı veri kaynağından yanıt alınamıyor; haritadaki konumlar güncel olmayabilir.',
      coverageNone: 'Bu bölge kapsama alanının dışında; burada uçak görünmez.',
      coveragePartial:
        'Bu bölgenin bir kısmı kapsama alanının dışında; bazı uçaklar görünmeyebilir.',
      basemapFailed: 'Harita altlığı yüklenemedi.',
    },
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
      providerAdsbLol: 'Canlı veri · adsb.lol',
      providerLocalReceiver: 'Canlı veri · yerel alıcı',
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
      minutesAgo: '{n} dk önce',
      daysAgo: '{n} gün önce',
      rps: 'Hız (istek/sn)',
      freshnessP95: 'Tazelik p95',
      errorRatio: 'Hata oranı (60 sn)',
      rateLimited1h: '429 oranı (1 sa)',
      rateLimited24h: '429 oranı (24 sa)',
      circuit: 'Devre',
      lastSuccess: 'Son başarılı yanıt',
      never: 'yok',
      healthRecord: 'Son sağlık kaydı',
      circuitStates: {
        closed: 'kapalı (normal)',
        open: 'açık',
        half_open: 'yarı açık',
        config: 'yapılandırma hatası',
      },
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
    notFoundBody: 'Aradığın sayfa yok ya da taşınmış. Canlı haritadan devam edebilirsin.',
    goToMap: 'Haritaya dön',
  },
  /**
   * Geçici kullanım koşulları (`/kullanim-kosullari`, D-075). Esri sözleşmesi (E204 §3.1c.5) uygulama
   * kullanıcılarının Esri şartlarına uymasını isteyen bir madde ister. Kapsamlı metin Parça 3 M6a'da
   * gelir; hukukçu incelemesi ACTIVATION'dadır. `{ad}` yer tutucuları bağlantılarla doldurulur.
   */
  terms: {
    title: 'Kullanım koşulları',
    effective: 'Yürürlük tarihi: {date}',
    interim:
      'Bu metin geçicidir; kapsamlı kullanım koşulları ve gizlilik politikası yakında yayımlanacak.',
    service: {
      heading: 'Hizmet',
      about:
        '{app}, Türkiye odaklı, herkese açık ve ücretsiz bir uçuş takip hizmetidir. Uçak konumları uçakların yayınladığı ADS-B sinyallerinden, bazı uçaklarda çok noktalı konumlandırmadan (MLAT) gelir ve yalnızca bilgi amaçlıdır.',
      notOperational:
        'Hizmet operasyonel, seyrüsefer ya da uçuş emniyetiyle ilgili kararlar için kullanılamaz.',
      noWarranty:
        'Verilerin doğru, eksiksiz ya da kesintisiz olacağı garanti edilmez; hizmet “olduğu gibi” sunulur.',
    },
    data: {
      heading: 'Veriler',
      live: 'Canlı uçak konumları {source} kaynağından gelir ve {license} ile lisanslıdır.',
      odbl: 'Bu koşullar, ADS-B’den türetilen veriler üzerinde ODbL’nin sana tanıdığı hakları kısıtlamaz.',
      airports: 'Havalimanı bilgileri {source} kaynağından gelir ve kamu malıdır.',
    },
    map: {
      heading: 'Harita görüntüleri',
      esri: 'Uydu haritası gösterildiğinde görüntüleri Esri sağlar. Haritayı kullanarak Esri’nin geçerli koşullarına uymayı kabul edersin: {platform} ve {productTerms}.',
      esriPlatform: 'ArcGIS Location Platform sözleşmesi (E204)',
      esriProductTerms: 'ürüne özgü kullanım koşulları (E300)',
      tiles:
        'Uydu harita karoları (Esri) yalnızca bu sitede görüntülenmek içindir: indirilemez, kazınamaz, tarayıcının standart önbelleği dışında önbelleğe alınamaz ya da saklanamaz ve yeniden dağıtılamaz.',
      vector:
        'Vektör harita gösterildiğinde altlığı {openFreeMap} ya da yedek vektör harita sağlar. Harita verisi: © {openMapTiles}, © {openStreetMap} katkıcıları (ODbL).',
    },
    use: {
      heading: 'Kullanım kuralları',
      bulk: 'Siteden ya da API’den otomatik araçlarla, API’nin bildirdiği istek sınırlarını aşacak biçimde toplu veri toplanamaz.',
      disrupt: 'Hizmeti aksatmaya yönelik girişimde bulunulamaz.',
    },
    privacy: {
      heading: 'Uçak gizliliği',
      military: 'Askeri uçaklar haritada, aramada ve API’de gösterilmez.',
      registration: 'PIA ya da LADD programındaki uçakların tescili gösterilmez.',
    },
    code: {
      heading: 'Kaynak kodu ve ad',
      license: 'Uygulamanın kaynak kodu MIT lisanslıdır.',
    },
    changes: {
      heading: 'Değişiklikler',
      body: 'Bu koşullar güncellenebilir; güncellenince yukarıdaki yürürlük tarihi değişir.',
    },
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
