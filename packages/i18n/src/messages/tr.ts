/** Türkçe arayüz metinleri (varsayılan dil). Anahtar yapısı tüm diller için buradan türetilir. */
export const tr = {
  meta: {
    description:
      'Türkiye odaklı, herkese açık canlı uçuş takibi: uçak konumları, havalimanları ve pistler.',
  },
  nav: {
    map: 'Harita',
    airports: 'Havalimanları',
    status: 'Durum',
    changelog: 'Yenilikler',
    about: 'Hakkında',
    language: 'Dil',
    switchTo: 'English',
    mainLabel: 'Ana menü',
  },
  /**
   * Arama motoru ve paylaşım önizlemesi metinleri (Parça 1 M6b). Layout şablonu başlığa " · {app}"
   * ekler; kök sayfanın başlığı tamdır (şablon uygulanmaz). Havalimanı açıklamaları veriden kurulur ve
   * rötar, kalkış saati ya da hava durumu vaat etmez (şablon sayfa riski, M6b brief §b ve §i).
   */
  seo: {
    home: {
      title: 'Türkiye canlı uçak haritası ve uçuş takibi',
      description:
        'Türkiye semalarındaki uçakların canlı konumu, yüksekliği ve hızı; veriler ADS-B’den gelir. Tarife, rötar ve kapı bilgisi içermez. Canlı uçuş verisi: ADSB.lol (ODbL).',
    },
    airports: {
      title: 'Türkiye’deki havalimanları: IATA ve ICAO kodları',
      description:
        'Türkiye’deki {count} havalimanının IATA ve ICAO kodları, illeri, en uzun pistleri ve tarifeli sefer bilgisi; her biri için canlı harita bağlantısı. Kaynak: OurAirports.',
    },
    airport: {
      title: '{name} ({iata}/{icao}) canlı hava trafiği ve pistler',
      /** `{facts}`: aşağıdaki parçalardan veriye göre seçilenler, "; " ile birleşik. */
      description: '{name}, {province}: {facts}. {live}',
      descriptionNoFacts: '{name}, {province}. {live}',
      /** `{live}`: havalimanı canlı veri çekim alanındaysa (packages/geo/src/coverage.ts). */
      liveCovered: 'Çevredeki uçaklar canlı haritada görünür; tarife bilgisi içermez.',
      /** `{live}`: havalimanı çekim alanının dışındaysa; çevredeki uçak vaat edilmez. */
      liveOutside: 'Canlı veri çekim alanının dışında; tarife bilgisi içermez.',
      runwaysOne: 'tek pist, {length}',
      runwaysMany: '{count} pist, en uzunu {length}',
      runwaysCount: '{count} pist',
      elevation: 'rakım {elevation}',
    },
    about: {
      title: 'Hakkında: veri kaynakları ve yöntem',
      description:
        '{app} nasıl çalışır: canlı konumların ADS-B kaynağı, veri kaynakları ve lisansları, uçak gizliliği kuralları ve ADS-B’nin sınırları.',
    },
    changelog: {
      description: 'Her sürümde gelen yenilikler ve o sürümde eklenen sayfaların bağlantıları.',
    },
    status: {
      description: 'Uygulamanın sürümü, sunucu bağlantısı ve yol haritasındaki ilerleme.',
    },
    terms: {
      description:
        'Kullanım koşulları: veri lisansları (ODbL), harita görüntüleri (Esri), kullanım kuralları ve uçak gizliliği.',
    },
    /** Varsayılan paylaşım görselindeki alt başlık. */
    ogTagline: 'Türkiye canlı uçuş takibi',
  },
  /** Havalimanı listesi (`/havalimanlari`). */
  airports: {
    title: 'Türkiye’deki havalimanları',
    summary:
      'Listede {count} havalimanı var: OurAirports kaydına göre {scheduled} tanesinde tarifeli sefer yapılıyor; {stations} tanesi izlenen istasyon.',
    scope:
      'Listede IATA kodu olan büyük ve orta boy havalimanları ile OurAirports’ta tarifeli seferi kayıtlı küçük havalimanları yer alır; diğer küçük havalimanları listelenmez.',
    names:
      'Resmî Türkçe adlar DHMİ’den ve havalimanı işletmecilerinden derlenmiştir; resmî adı doğrulanamayan havalimanları OurAirports’taki adıyla gösterilir.',
    caption: 'Havalimanları, ile göre sıralı',
    columns: {
      name: 'Havalimanı',
      province: 'İl',
      iata: 'IATA',
      icao: 'ICAO',
      longestRunway: 'En uzun pist',
      /** OurAirports `scheduled_service` bayrağı; doğrulanmış bilgi gibi sunulmaz (D-076). */
      scheduled: 'Tarifeli sefer (OurAirports)',
      station: 'İzlenen istasyon',
    },
    empty: 'Havalimanı verisi henüz yüklenmedi. Biraz sonra yeniden dene.',
  },
  /** Havalimanı sayfası (`/istasyon/<ICAO>`). Sade görünümde kısaltma yoktur (web-ui kuralları). */
  airport: {
    breadcrumbLabel: 'Sayfa konumu',
    country: 'Türkiye',
    location: '{province}, Türkiye',
    lead: {
      runwaysOne: 'Havalimanında tek pist var: {length} uzunluğundaki {designator}.',
      runwaysMany: 'Havalimanında {count} pist var; en uzunu {length} ile {designator}.',
      runwaysCount: 'Havalimanında {count} pist var.',
      elevation: 'Havalimanının rakımı {elevation}.',
      scheduled: 'OurAirports kaydına göre tarifeli havayolu seferi yapılıyor.',
      unscheduled:
        'OurAirports kaydında tarifeli havayolu seferi görünmüyor; bu bilgi güncel olmayabilir.',
      otherOne: '{province} ilindeki diğer havalimanı: {airports}.',
      otherMany: '{province} ilindeki diğer havalimanları: {airports}.',
    },
    facts: {
      heading: 'Temel bilgiler',
      iata: 'IATA kodu',
      icao: 'ICAO kodu',
      type: 'Tür',
      province: 'İl',
      municipality: 'Hizmet verdiği yerleşim',
      sourceName: 'OurAirports’taki adı',
      reference: 'Havalimanı merkezi',
      elevation: 'Rakım',
      scheduled: 'Tarifeli sefer (OurAirports)',
      station: 'İzlenen istasyon',
      runways: 'Pist sayısı',
    },
    types: {
      large_airport: 'Büyük havalimanı',
      medium_airport: 'Orta boy havalimanı',
      small_airport: 'Küçük havalimanı',
    },
    yes: 'Var',
    /** Kaynakta "evet" işaretli değil: "yok" anlamına gelmez (OurAirports bayrakları, D-076). */
    notRecorded: 'Kayıtlı değil',
    stationYes: 'Evet',
    stationPrimary: 'Evet, birincil istasyon',
    stationNo: 'Hayır',
    /** Koordinat yön harfleri: kuzey, güney, doğu, batı. */
    hemisphere: {
      n: 'K',
      s: 'G',
      e: 'D',
      w: 'B',
    },
    runways: {
      heading: 'Pistler',
      caption: '{name} pistleri',
      designator: 'Pist',
      length: 'Uzunluk',
      width: 'Genişlik',
      surface: 'Yüzey',
      lighting: 'Işıklandırma',
      bearing: 'Gerçek yön',
      displaced: 'Kaydırılmış pist eşiği',
      bearingNote: 'Yönler gerçek kuzeye göredir; pist adları manyetik yönden gelir.',
      displacedNote:
        'Kaydırılmış pist eşiği, inişin pistin başından değil bu mesafe kadar ileriden başladığını gösterir.',
    },
    live: {
      heading: 'Canlı hava trafiği',
      open: 'Canlı haritada aç',
      station:
        '{app} bu havalimanını izliyor: havalimanı merkezinin {radius} çevresindeki uçaklar öncelikli güncellenir.',
      /** `{radius}`: birincil istasyonun en sık çekilen çemberi (PRIMARY_EXTRA_RADIUS_NM, D-073). */
      stationPrimary:
        'Birincil istasyondur: havalimanı merkezinin {radius} çevresinin verisi en sık güncellenir.',
      notStation:
        'Bu havalimanında varış izleme henüz açık değil. Havalimanı canlı veri çekim alanının içinde; çevredeki uçaklar canlı haritada görünür (kapsama ADS-B alıcılarına bağlıdır).',
      outside:
        'Bu havalimanında varış izleme açık değil ve havalimanı canlı veri çekim alanının dışında: çevresindeki uçaklar için veri çekilmez, bu yüzden canlı haritada görünmeyebilirler.',
    },
    nearby: {
      heading: 'En yakın havalimanları',
      item: '{airport}, {province}: {distance}',
      note: 'Mesafeler havalimanı merkezleri arasındaki kuş uçuşu mesafedir.',
    },
    limits:
      'Bu sayfa tarife, rötar, kapı ve iptal bilgisi içermez. ADS-B’nin sınırları ve veri kaynakları için {about}.',
    limitsLink: 'Hakkında sayfasına bak',
    source: 'Havalimanı ve pist verisi: {source} (kamu malı) · son değişiklik {date}',
    /** `{name}`: resmî Türkçe ad (airport-names.ts). */
    nameSource: {
      dhmi: 'Resmî Türkçe ad: {name} (DHMİ)',
      operator: 'Resmî Türkçe ad: {name} (havalimanı işletmecisi)',
      ourairports: 'Ad: OurAirports',
    },
  },
  /** Pist yüzeyi; ham OurAirports kodları `packages/shared` → `runway-surface.ts`'te eşlenir. */
  surface: {
    asphalt: 'Asfalt',
    concrete: 'Beton',
    /** PEM: kısmen beton, asfalt ya da bitümlü makadam. */
    mixed: 'Karışık kaplama',
    /** PER: kalıcı kaplama, türü bilinmiyor. */
    paved: 'Kaplamalı',
    grass: 'Çim',
    dirt: 'Toprak',
    gravel: 'Çakıl',
    water: 'Su',
    unknown: 'Bilinmiyor',
  },
  /**
   * Hakkında ve yöntem (`/hakkinda`). Kaynaklar: docs/spec/domain.md ("v1 sınırları"),
   * docs/spec/data-sources.md (§1 tazelik hedefleri, §3, §4, §6, §6a), D-066, D-071, D-073, ATTRIBUTION.md.
   */
  about: {
    title: 'Hakkında',
    intro:
      '{app}, Türkiye odaklı, herkese açık ve ücretsiz bir canlı uçuş takip sitesidir. Siteyi {owner} geliştirir ve işletir.',
    shows: {
      heading: 'Neler gösterilir',
      map: 'Canlı harita: uçakların konumu, yüksekliği, yer hızı, dikey hızı ve kimlik bilgileri (sefer no, çağrı kodu, tescil, uçak tipi).',
      search: 'Arama: havadaki uçağı sefer no, çağrı kodu, tescil ya da hex koduyla bulma.',
      airports:
        'Havalimanları: Türkiye’deki havalimanlarının kodları, pistleri ve en yakın havalimanları.',
    },
    limits: {
      heading: 'Neler gösterilmez',
      intro:
        'ADS-B yalnızca konum, yükseklik, hız ve kimlik verir. Tarife verisi olmadığından şunlar yoktur:',
      times: 'tarifeli kalkış ve varış saatleri',
      delays: 'rötar, kapı, terminal, bagaj, kod paylaşımı ve iptal bilgisi',
      board: 'kalkıştan önce kalkış panosu',
      search: 'harfli çağrı kodu kullanan seferlerde kalkıştan önce sefer no ile arama',
    },
    method: {
      heading: 'Yöntem',
      adsb: 'Uçak konumları uçakların yayınladığı ADS-B sinyallerinden, bazı uçaklarda birden çok alıcının ölçümüyle hesaplanan çok noktalı konumlandırmadan (MLAT) gelir. Sinyalleri yerdeki alıcılardan toplayan {source} ağı tek canlı veri kaynağıdır.',
      coverage:
        'Kapsama alıcılara bağlıdır: alçak irtifadaki ve yerdeki uçaklar bazı bölgelerde görünmeyebilir.',
      /** `{radius}`: birincil istasyonun en sık çekilen çemberi (PRIMARY_EXTRA_RADIUS_NM, D-073). */
      freshness:
        'Hedeflenen veri yaşı: birincil istasyonun {radius} çevresinde yaklaşık 20 sn, diğer izlenen havalimanlarının çevresinde yaklaşık 30 sn, Doğu Türkiye’yi kapsayan veri çekim alanında yaklaşık 90 sn. Haritadaki durum satırı birincil istasyonun çevresindeki gerçekleşen veri yaşını gösterir (bu bilgi yoksa en yeni verinin yaşını); haritada bakılan bölgenin veri yaşı bundan farklı olabilir.',
      stations: 'İzlenen havalimanları:',
      /** Kapsama planının (packages/geo/src/coverage.ts) dışında kalan havalimanları, veriden. */
      outside:
        'Canlı veri çekim alanının dışında kalan havalimanları; çevrelerindeki uçaklar haritada görünmeyebilir:',
      primary: 'birincil istasyon',
      reference:
        'Havalimanı ve pist bilgisi her gün OurAirports’tan güncellenir. Pist yönleri, mümkün olduğunda pist uçlarının koordinatlarından hesaplanan gerçek yönlerdir.',
    },
    sources: {
      heading: 'Veri kaynakları ve lisanslar',
      live: 'Canlı uçak konumları: {source}, {license} lisansıyla.',
      derived:
        'Saklanan konum ve iz verisi bu veriden türetilmiş bir veritabanıdır ve ODbL altında kalır.',
      reference: 'Havalimanı ve pist verisi: {source}, kamu malı.',
      names:
        'Resmî Türkçe havalimanı adları: DHMİ ve havalimanı işletmecilerinin siteleri; doğrulanamayan adlarda OurAirports.',
      airlines: 'Havayolu kodları: {source}, CC0 (atıf zorunlu değildir, nezaketen anılır).',
      vector:
        'Vektör harita: {openFreeMap} © {openMapTiles}, harita verisi © {openStreetMap} katkıcıları (ODbL).',
      satellite: 'Uydu görüntüsü (gösterildiğinde): {esri}.',
    },
    privacy: {
      heading: 'Uçak gizliliği',
      military: 'Askeri uçaklar haritada, aramada ve API’de gösterilmez.',
      registration: 'PIA ya da LADD programındaki uçakların tescili gösterilmez.',
      blocklist:
        'Yöneticinin engel listesine eklediği uçaklar haritada, aramada ve API’de gösterilmez.',
    },
    more: {
      heading: 'Daha fazla bilgi',
      terms: '{link}: veri lisansları, harita görüntüleri ve kullanım kuralları.',
      changelog: '{link}: her sürümde gelen yenilikler.',
    },
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
