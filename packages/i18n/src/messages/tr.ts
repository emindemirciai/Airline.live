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
        'Türkiye’deki {count} havalimanının IATA ve ICAO kodları, illeri ve en uzun pistleri; her biri için canlı harita bağlantısı. Kaynak: OurAirports.',
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
      'Listede {count} havalimanı var; her havalimanının sayfasında pistleri, hava durumu ve canlı harita bağlantısı bulunur.',
    scope: 'Listede IATA kodu olan havalimanları yer alır; bazı küçük havalimanları listelenmez.',
    names:
      'Resmî Türkçe adlar DHMİ’den ve havalimanı işletmecilerinden derlenmiştir; resmî adı doğrulanamayan havalimanları OurAirports’taki adıyla gösterilir.',
    caption: 'Havalimanları, ile göre sıralı',
    columns: {
      name: 'Havalimanı',
      province: 'İl',
      iata: 'IATA',
      icao: 'ICAO',
      longestRunway: 'En uzun pist',
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
      runways: 'Pist sayısı',
    },
    types: {
      large_airport: 'Büyük havalimanı',
      medium_airport: 'Orta boy havalimanı',
      small_airport: 'Küçük havalimanı',
    },
    yes: 'Var',
    /** Kaynakta "evet" işaretli değil: "yok" anlamına gelmez (OurAirports pist ışıklandırması, D-076). */
    notRecorded: 'Kayıtlı değil',
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
    /**
     * Canlı hava trafiği bölümü. İzlenen istasyon ve yarıçap bilgisi gösterilmez (M6c, D-078); kapsama
     * cümlesi kalır: canlı haritada uçak vaat eden metin kapsama planına bakar (D-076).
     */
    live: {
      heading: 'Canlı hava trafiği',
      open: 'Canlı haritada aç',
      covered:
        'Havalimanı canlı veri çekim alanının içinde; çevredeki uçaklar canlı haritada görünür (kapsama ADS-B alıcılarına bağlıdır).',
      outside:
        'Havalimanı canlı veri çekim alanının dışında: çevresindeki uçaklar için veri çekilmez, bu yüzden canlı haritada görünmeyebilirler.',
    },
    /**
     * Sefer sayısı, rötar ve iptal (M6c brief §10). Tarife verisi yoktur; gözlenen hareketler Parça 2
     * motoruyla gelir. Bu kelimeler üst veri açıklamasına girmez (airport-text.test.ts).
     */
    schedule: {
      heading: 'Sefer sayısı, rötar ve iptal',
      body: 'Bu bilgiler henüz yok. Günlük kalkış ve varış sayısı, rötar ve iptal bilgisi havayolu tarifesi gerektirir; {app} şu an tarife verisi kullanmıyor. ADS-B yalnızca uçağın nerede olduğunu gösterir: bir seferin planlanan saatini, rötarını ya da iptal edildiğini bilemez. Bu yüzden bu sayfada bu bilgiler gösterilmez ve tahmin de edilmez. Uçuşunun durumu için havayoluna ya da havalimanı işletmecisine başvur.',
      observed:
        'ADS-B ile gözlenen iniş ve kalkış sayıları ile kullanılan pistler sonraki bir sürümde eklenecek; tarife olarak değil, “gözlenen” hareketler olarak gösterilecek. ADS-B’nin sınırları için {about}.',
      aboutLink: 'Hakkında sayfasına bak',
    },
    nearby: {
      heading: 'En yakın havalimanları',
      item: '{airport}, {province}: {distance}',
      note: 'Mesafeler havalimanı merkezleri arasındaki kuş uçuşu mesafedir.',
    },
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
   * Havalimanı hava durumu (Parça 1 M6c, D-078). METAR ve TAF ham metinden çözülür
   * (`@havayolu/shared` → weather); cümleler `packages/i18n/src/weather.ts`'te bu metinlerden kurulur.
   * Sade görünümde kod ve kısaltma yoktur, birimler metriktir (D-072); uzman ayrıntıları kodları ve
   * havacılık birimlerini de yazar. MGM'nin kamuya açık sözcükleri kullanılır: TS "gök gürültülü"dür,
   * hiçbir zaman "fırtına" değildir; HZ "kuru pus", OVC "kapalı"dır. Olasılıklı tahminde "bekleniyor"
   * yazılmaz.
   */
  weather: {
    heading: 'Hava durumu',
    loading: 'Hava durumu yükleniyor…',
    observed: 'Gözlem {time}',
    lastObserved: 'Son gözlem {time}',
    ago: '{duration} önce',
    justNow: 'az önce',
    duration: {
      minutes: '{m} dakika',
      hours: '{h} saat',
      hoursMinutes: '{h} saat {m} dakika',
      days: '{d} gün',
    },
    /** Rapor notları (`summarizeMetar` → `weather.note.*`). */
    note: {
      auto: 'Otomatik gözlem; bazı hava olayları algılanmayabilir.',
      undetermined: 'Raporun bir bölümü çözümlenemedi; ham metin ayrıntılarda.',
      nil: 'Bu gözlem saati için rapor yayımlanmadı.',
      corrected: 'Düzeltilmiş rapor.',
      speci: 'Özel rapor: hava önemli ölçüde değiştiği için yayımlandı.',
    },
    /** Gözlemin yaşı: ≤ 90 dk normal, 90 dk – 3 sa gecikmiş, 3–12 sa eski, üstü yok sayılır. */
    age: {
      delayedBadge: 'Gecikmiş gözlem',
      delayed: 'Yeni rapor gelmedi; değerler güncel olmayabilir.',
      staleBadge: 'Eski gözlem',
      stale: 'Şu an güncel gözlem yok.',
      staleValues: 'Son gözlemin değerleri',
      none: 'Şu an bu havalimanı için güncel bir havacılık hava raporu yok. Bazı havalimanlarında meteoroloji birimi yalnızca belirli saatlerde çalışır.',
      unavailable: 'Hava durumu şu an alınamıyor.',
    },
    rows: {
      wind: 'Rüzgâr',
      rain: 'Yağmur',
      snow: 'Kar',
      thunder: 'Gök gürültüsü',
      fog: 'Sis ve pus',
      hail: 'Dolu',
      other: 'Diğer hava olayları',
      visibility: 'Görüş',
      clouds: 'Bulut',
      temperature: 'Sıcaklık',
      humidity: 'Nem',
      pressure: 'Basınç',
      next2h: 'Önümüzdeki 2 saat',
      /** Gözlem 30 dakikadan eskiyken eğilim satırının adı (pencere gözlemden başlar). */
      trendAfterObservation: 'Gözlemden sonraki 2 saat',
      forecast: 'Tahmin',
    },
    /** "Yok" yalnızca rapor temiz çözüldüyse yazılır; değilse "Belirlenemedi" (D-078). */
    value: {
      none: 'Yok',
      undetermined: 'Belirlenemedi',
      vicinity: 'Havalimanında yok; çevresinde {phrase}',
      recent: 'Şu an yok; kısa süre önce {phrase}',
      noneWithCb: 'Yok (kümülonimbüs bulutu var)',
      notStated: 'Raporda belirtilmemiş',
    },
    /**
     * Hava olayları, çözücünün metin kimlikleriyle (`weatherPhraseId`, `WX_PHRASE_IDS`): `_light`
     * hafif (-), eksiz orta, `_heavy` kuvvetli/yoğun (+). Şiddet yağışı niteler.
     */
    wx: {
      vicinity: 'Havalimanı çevresinde {phrase}',
      DZ_light: 'Hafif çisenti',
      DZ: 'Çisenti',
      DZ_heavy: 'Yoğun çisenti',
      RA_light: 'Hafif yağmur',
      RA: 'Yağmur',
      RA_heavy: 'Kuvvetli yağmur',
      DZRA_light: 'Hafif çisenti ve yağmur',
      DZRA: 'Çisenti ve yağmur',
      DZRA_heavy: 'Yoğun çisenti ve yağmur',
      SN_light: 'Hafif kar',
      SN: 'Kar',
      SN_heavy: 'Yoğun kar',
      RASN_light: 'Hafif karla karışık yağmur',
      RASN: 'Karla karışık yağmur',
      RASN_heavy: 'Kuvvetli karla karışık yağmur',
      SNRA_light: 'Hafif yağmurla karışık kar',
      SNRA: 'Yağmurla karışık kar',
      SNRA_heavy: 'Yoğun yağmurla karışık kar',
      SG_light: 'Hafif kar taneleri',
      SG: 'Kar taneleri',
      SG_heavy: 'Yoğun kar taneleri',
      PL_light: 'Hafif buz taneleri',
      PL: 'Buz taneleri',
      PL_heavy: 'Yoğun buz taneleri',
      GR_light: 'Hafif dolu',
      GR: 'Dolu',
      GR_heavy: 'Kuvvetli dolu',
      GS_light: 'Hafif küçük dolu',
      GS: 'Küçük dolu',
      GS_heavy: 'Kuvvetli küçük dolu',
      UP_light: 'Hafif, türü belirlenemeyen yağış',
      UP: 'Türü belirlenemeyen yağış',
      UP_heavy: 'Kuvvetli, türü belirlenemeyen yağış',
      SHRA_light: 'Hafif sağanak yağmur',
      SHRA: 'Sağanak yağmur',
      SHRA_heavy: 'Kuvvetli sağanak yağmur',
      SHSN_light: 'Hafif kar sağanağı',
      SHSN: 'Kar sağanağı',
      SHSN_heavy: 'Kuvvetli kar sağanağı',
      SHRASN_light: 'Hafif karla karışık sağanak',
      SHRASN: 'Karla karışık sağanak',
      SHRASN_heavy: 'Kuvvetli karla karışık sağanak',
      SHSNRA_light: 'Hafif yağmurla karışık kar sağanağı',
      SHSNRA: 'Yağmurla karışık kar sağanağı',
      SHSNRA_heavy: 'Kuvvetli yağmurla karışık kar sağanağı',
      SHGR_light: 'Hafif dolu sağanağı',
      SHGR: 'Dolu sağanağı',
      SHGR_heavy: 'Kuvvetli dolu sağanağı',
      SHGS_light: 'Hafif küçük dolu sağanağı',
      SHGS: 'Küçük dolu sağanağı',
      SHGS_heavy: 'Kuvvetli küçük dolu sağanağı',
      SHPL_light: 'Hafif buz taneli sağanak',
      SHPL: 'Buz taneli sağanak',
      SHPL_heavy: 'Kuvvetli buz taneli sağanak',
      SHUP_light: 'Hafif, türü belirlenemeyen sağanak',
      SHUP: 'Türü belirlenemeyen sağanak',
      SHUP_heavy: 'Kuvvetli, türü belirlenemeyen sağanak',
      TSRA_light: 'Gök gürültülü hafif sağanak',
      TSRA: 'Gök gürültülü sağanak',
      TSRA_heavy: 'Kuvvetli gök gürültülü sağanak',
      TSSN_light: 'Gök gürültülü hafif kar',
      TSSN: 'Gök gürültülü kar',
      TSSN_heavy: 'Gök gürültülü yoğun kar',
      TSRASN_light: 'Gök gürültülü, hafif karla karışık yağmur',
      TSRASN: 'Gök gürültülü, karla karışık yağmur',
      TSRASN_heavy: 'Gök gürültülü, kuvvetli karla karışık yağmur',
      TSSNRA_light: 'Gök gürültülü, hafif yağmurla karışık kar',
      TSSNRA: 'Gök gürültülü, yağmurla karışık kar',
      TSSNRA_heavy: 'Gök gürültülü, yoğun yağmurla karışık kar',
      TSGR_light: 'Dolulu, gök gürültülü hafif sağanak',
      TSGR: 'Dolulu, gök gürültülü sağanak',
      TSGR_heavy: 'Dolulu, kuvvetli gök gürültülü sağanak',
      TSGS_light: 'Gök gürültülü, küçük dolulu hafif sağanak',
      TSGS: 'Gök gürültülü, küçük dolulu sağanak',
      TSGS_heavy: 'Gök gürültülü, küçük dolulu kuvvetli sağanak',
      TSPL_light: 'Gök gürültülü, hafif buz taneleri',
      TSPL: 'Gök gürültülü, buz taneleri',
      TSPL_heavy: 'Gök gürültülü, yoğun buz taneleri',
      TSUP_light: 'Gök gürültülü, hafif ve türü belirlenemeyen yağış',
      TSUP: 'Gök gürültülü, türü belirlenemeyen yağış',
      TSUP_heavy: 'Gök gürültülü, kuvvetli ve türü belirlenemeyen yağış',
      FZRA_light: 'Hafif donan yağmur (buzlanma yapar)',
      FZRA: 'Donan yağmur (buzlanma yapar)',
      FZRA_heavy: 'Kuvvetli donan yağmur (buzlanma yapar)',
      FZDZ_light: 'Hafif donan çisenti (buzlanma yapar)',
      FZDZ: 'Donan çisenti (buzlanma yapar)',
      FZDZ_heavy: 'Yoğun donan çisenti (buzlanma yapar)',
      FZUP_light: 'Hafif, türü belirlenemeyen donan yağış (buzlanma yapar)',
      FZUP: 'Türü belirlenemeyen donan yağış (buzlanma yapar)',
      FZUP_heavy: 'Kuvvetli, türü belirlenemeyen donan yağış (buzlanma yapar)',
      IC: 'Buz kristalleri',
      TS: 'Gök gürültüsü ve şimşek, yağış yok',
      /** Çevredeki sağanak ve oraj: ad olarak (`wx.vicinity` ve `value.vicinity` kalıplarına girer). */
      VCSH: 'Sağanak',
      VCTS: 'Gök gürültüsü',
      BR: 'Pus',
      FG: 'Sis',
      FZFG: 'Donan sis',
      MIFG: 'Sığ sis',
      BCFG: 'Yer yer sis',
      PRFG: 'Havalimanının bir bölümünde sis',
      HZ: 'Kuru pus',
      FU: 'Duman',
      VA: 'Volkanik kül',
      DU: 'Toz',
      SA: 'Kum',
      PY: 'Su serpintisi',
      BLSN: 'Savrulan kar',
      BLDU: 'Savrulan toz',
      BLSA: 'Savrulan kum',
      DRSN: 'Yerde sürüklenen kar',
      DRDU: 'Yerde sürüklenen toz',
      DRSA: 'Yerde sürüklenen kum',
      PO: 'Toz ya da kum hortumu',
      SQ: 'Ani ve sert rüzgâr',
      FC: 'Hortum bulutu',
      FC_heavy: 'Hortum',
      SS: 'Kum fırtınası',
      SS_heavy: 'Kuvvetli kum fırtınası',
      DS: 'Toz fırtınası',
      DS_heavy: 'Kuvvetli toz fırtınası',
    },
    cavok: 'Görüş 10 km ve üzeri, alçak bulut ve önemli hava olayı yok',
    nsw: 'Önemli hava olayı sona eriyor',
    headline: {
      cavok: 'Görüş iyi, alçak bulut yok',
      nsc: 'Alçak bulut yok',
      noReport: 'Rapor yok',
      undetermined: 'Hava olayı belirlenemedi',
      unknown: 'Hava durumu belirlenemedi',
    },
    wind: {
      calm: 'Sakin',
      lightVariable: 'Hafif ve değişken yönlü',
      variable: 'Değişken yönlü, {speed}',
      /** `{direction}`: `compass.from` ("Kuzeydoğudan"). */
      from: '{direction} {speed}',
      speedOnly: 'Yönü bilinmiyor, {speed}',
      gust: 'hamle {speed}',
      varying: 'yönü {from} ile {to} arasında değişiyor',
      above: '{speed} üzeri',
      strong: 'Kuvvetli rüzgâr',
    },
    /** Sade görünümde 8 yön; uzman ayrıntılarında derece de yazılır. */
    compass: {
      from: {
        N: 'Kuzeyden',
        NE: 'Kuzeydoğudan',
        E: 'Doğudan',
        SE: 'Güneydoğudan',
        S: 'Güneyden',
        SW: 'Güneybatıdan',
        W: 'Batıdan',
        NW: 'Kuzeybatıdan',
      },
      name: {
        N: 'kuzey',
        NE: 'kuzeydoğu',
        E: 'doğu',
        SE: 'güneydoğu',
        S: 'güney',
        SW: 'güneybatı',
        W: 'batı',
        NW: 'kuzeybatı',
      },
    },
    visibility: {
      tenKmPlus: '10 km ve üzeri',
      lessThan50: '50 m’den az',
      above: '{visibility} üzeri',
      below: '{visibility} altı',
      minimum: 'en düşük {visibility}, {direction} yönünde',
    },
    clouds: {
      FEW: 'Az bulutlu',
      SCT: 'Parçalı bulutlu',
      BKN: 'Çok bulutlu',
      OVC: 'Kapalı',
      lowest: 'en alçak bulut {height}',
      nsc: 'Alçak bulut yok',
      cavok: 'Alçak bulut yok',
      ncd: 'Bulut algılanmadı (otomatik)',
      skc: 'Açık',
      vv: 'Gökyüzü görünmüyor (dikey görüş {height})',
      vvUnknown: 'Gökyüzü görünmüyor',
      cb: 'kümülonimbüs',
      tcu: 'kule biçimli kümülüs',
    },
    humidity: 'Yaklaşık %{percent}',
    /** METAR'ın sonundaki 2 saatlik eğilim (NOSIG, BECMG, TEMPO). */
    trend: {
      nosig: 'Önümüzdeki 2 saatte önemli değişiklik beklenmiyor',
      becmg: 'Önümüzdeki 2 saatte giderek: {change}',
      tempo: 'Önümüzdeki 2 saatte ara ara: {change}',
      nosigUntil: '{to} saatine kadar önemli değişiklik beklenmiyor',
      becmgUntil: '{to} saatine kadar giderek: {change}',
      tempoUntil: '{to} saatine kadar ara ara: {change}',
    },
    /** Eğilim ve tahmindeki değişiklik parçaları (küçük harfle, virgülle birleşir). */
    change: {
      visibility: 'görüş {visibility}',
      wind: 'rüzgâr {wind}',
      cavok: 'görüş 10 km ve üzeri, alçak bulut ve önemli hava olayı yok',
      nsw: 'önemli hava olayı sona eriyor',
    },
    /**
     * Havalimanı tahmini (TAF), sade özet. `…Until` kalıpları başlamış dönemler içindir. Olasılıklı
     * dönemde "bekleniyor" yazılmaz.
     */
    taf: {
      base: '{from}–{to} arası {phrase}',
      until: '{to} saatine kadar {phrase}',
      fm: '{from} itibarıyla {phrase}',
      becmg: '{from}–{to} arasında giderek {phrase}',
      tempo: '{from}–{to} arası ara ara {phrase}',
      tempoUntil: '{to} saatine kadar ara ara {phrase}',
      prob: '{from}–{to} arası %{probability} olasılıkla {phrase}',
      probUntil: '{to} saatine kadar %{probability} olasılıkla {phrase}',
      probTempo: '{from}–{to} arası %{probability} olasılıkla ara ara {phrase}',
      probTempoUntil: '{to} saatine kadar %{probability} olasılıkla ara ara {phrase}',
      strongWind: 'kuvvetli rüzgâr, {wind}',
      validUntil: 'Tahminin geçerlilik sonu: {time}.',
      validPeriod: 'Tahmin {from} – {to} arası için.',
      issued: 'Tahmin {time} yayımlandı.',
      amended: 'Güncellenmiş tahmin.',
      corrected: 'Düzeltilmiş tahmin.',
      cancelled: 'Tahmin iptal edildi.',
      nil: 'Tahmin yok.',
      none: 'Bu havalimanı için geçerli bir tahmin (TAF) yok.',
      nothingSignificant: 'Tahminde önemli hava olayı yok.',
      more: 'Bütün tahmin dönemleri uzman ayrıntılarındadır.',
    },
    time: {
      tomorrow: 'yarın {time}',
      onDate: '{date} {time}',
    },
    localTime: 'Yerel saat {time} ({offset})',
    sunrise: 'Gün doğumu {time}',
    sunset: 'Gün batımı {time}',
    sunNote:
      'Gün doğumu ve batımı deniz seviyesi ve düz ufuk için hesaplanmıştır; dağlık arazide birkaç dakika farklı olabilir.',
    /** `{source}`: aviationweather.gov bağlantısı. NOAA/NWS logosu ya da onay imajı kullanılmaz. */
    source:
      'Hava durumu: {source} (NOAA Aviation Weather Center). Raporları havalimanlarının meteoroloji birimleri hazırlar. Otomatik çözümlenmiştir; resmî brifing yerine geçmez, uçuş planlamasında kullanılmaz.',
    /** Uzman ayrıntıları (`<details>`, varsayılan kapalı): kodlar ve havacılık birimleri. */
    expert: {
      heading: 'Ayrıntılar (uzman)',
      caption: 'Gözlemin kod kod çözümü',
      columns: {
        code: 'Kod',
        meaning: 'Anlamı',
      },
      metar: 'METAR (rutin gözlem)',
      speci: 'SPECI (özel gözlem)',
      station: 'Havalimanının ICAO kodu',
      observedUtc: 'Gözlem zamanı: {utc} UTC (yerel saat {local})',
      wind: 'Rüzgâr',
      windValue: '{direction} {speed}',
      variableDirection: 'değişken yönlü',
      varying: 'yön {from}–{to} arası',
      gust: 'hamle {speed}',
      calm: 'sakin',
      visibility: 'Görüş',
      rvr: 'Pist görüş mesafesi (RVR)',
      rvrItem: 'Pist {runway}: {value}',
      rvrAbove: '{value} üzeri',
      rvrBelow: '{value}’den az',
      rvrVarying: '{from} ile {to} arası',
      rvrTendency: {
        up: 'artıyor',
        down: 'azalıyor',
        none: 'değişmiyor',
      },
      weather: 'Hava olayı',
      recent: 'Son saatteki hava olayı',
      clouds: 'Bulut',
      layer: '{cover} {ft} ({m})',
      layerType: '{layer}, {type}',
      tempDew: 'Sıcaklık {temperature}, çiy noktası {dewPoint}',
      pressure: 'Basınç (QNH)',
      windShear: 'Rüzgâr kesmesi',
      windShearAll: 'bütün pistlerde',
      windShearRunway: 'pist {runway}',
      notObserved: 'Hava olayı gözlenemedi (otomatik istasyon)',
      recentNotObserved: 'Son saatteki hava olayı gözlenemedi (otomatik istasyon)',
      runwayState: 'Pist yüzeyi durumu (ayrıntısı burada çözümlenmez)',
      seaState: 'Deniz yüzeyi sıcaklığı ve durumu (burada çözümlenmez)',
      colourState: 'Askerî renk durumu: görüş ve bulut tabanı sınıfı (burada çözümlenmez)',
      unparsed: 'Çözümlenemeyen kısımlar',
      remarks: 'Ek açıklamalar (çözümlenmez)',
      trendNosig: 'Gözlemden sonraki 2 saatte önemli değişiklik beklenmiyor (NOSIG)',
      trendBecmg: 'Gözlemden sonraki 2 saatte giderek: {change}',
      trendTempo: 'Gözlemden sonraki 2 saatte ara ara: {change}',
      flightCategory: 'Uçuş kategorisi (ABD sınıflandırması, aviationweather.gov)',
      flightCategoryNote: 'Bu sınıflandırma uçuşların yapılıp yapılmadığı hakkında bilgi vermez.',
      rawMetar: 'Ham METAR',
      rawTaf: 'Ham TAF',
      copy: 'Kopyala',
      copied: 'Kopyalandı',
      tafCaption: 'Tahmin dönemleri ({issued} yayımlanan TAF)',
      tafColumns: {
        period: 'Dönem',
        change: 'Değişim',
        wind: 'Rüzgâr',
        visibility: 'Görüş',
        weather: 'Hava olayı',
        clouds: 'Bulut',
      },
      tafChange: {
        base: 'Ana tahmin',
        fm: 'İtibarıyla (FM)',
        becmg: 'Giderek (BECMG)',
        tempo: 'Ara ara (TEMPO)',
        prob: '%{p} olasılık (PROB{p})',
        probTempo: '%{p} olasılıkla ara ara (PROB{p} TEMPO)',
      },
      noTemperature: 'Havalimanı tahmini sıcaklık içermez.',
    },
    /** METAR/TAF kaydı: son 24 saatte saklanan bütün raporlar, en yenisi üstte (D-078). */
    log: {
      heading: 'METAR/TAF kaydı',
      intro:
        'Son 24 saatte yayımlanan havacılık hava raporları, en yenisi üstte. Saatler yerel saattir; UTC yanında yazılır. METAR rutin gözlem, SPECI hava önemli ölçüde değişince yayımlanan özel gözlem, TAF havalimanı tahminidir.',
      caption: '{name}: son 24 saatin raporları',
      columns: {
        time: 'Saat',
        type: 'Tür',
        summary: 'Özet',
        raw: 'Ham rapor',
      },
      utc: '{time} UTC',
      tafSummary: '{from}–{to} arası için tahmin',
      amended: 'güncellenmiş',
      corrected: 'düzeltilmiş',
      cancelled: 'iptal edildi',
      /** Tekil ve çoğul (İngilizcede ayrı; Türkçede aynı). */
      countOne: '{count} rapor',
      countMany: '{count} rapor',
      empty: 'Son 24 saatte kayıtlı rapor yok.',
      unavailable: 'Rapor kaydı şu an alınamıyor.',
      /** `{link}`: API adresi (son 7 gün, JSON). */
      older: 'Raporlar 30 gün saklanır; son 7 günün kaydı {link}.',
      olderLink: 'API’den alınabilir',
    },
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
      weather:
        'Hava durumu: her havalimanı sayfasında son havacılık hava raporu (METAR), havalimanı tahmini (TAF) ve son 24 saatin rapor kaydı; haritada havalimanına tıklayınca kısa özeti.',
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
      weather:
        'Hava durumu: {source} (NOAA Aviation Weather Center); raporları havalimanlarının meteoroloji birimleri hazırlar. Otomatik çözümlenir; resmî brifing yerine geçmez.',
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
    /** Havalimanı penceresinin klavye yolu: görünümdeki havalimanları listesi (D-078). */
    airportList: {
      button: 'Havalimanları',
      title: 'Görünümdeki havalimanları',
      empty: 'Görünümde havalimanı yok; haritayı kaydır ya da uzaklaştır.',
      hint: 'Seçtiğin havalimanının bilgi ve hava durumu penceresi açılır.',
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
    /**
     * Haritada havalimanına tıklanınca açılan küçük pencere (M6c). Hava durumu cümleleri üst düzey
     * `weather` metinlerinden kurulur (packages/i18n/src/weather.ts).
     */
    airportPopup: {
      /** Pencerenin erişilebilir adı; `{name}`: havalimanının adı. */
      label: '{name} bilgileri',
      elevation: 'Rakım',
      runways: 'Pistler',
      runwaysOne: 'Tek pist, {length}',
      runwaysMany: '{count} pist, en uzunu {length}',
      localTime: 'Yerel saat',
      sunrise: 'Gün doğumu',
      sunset: 'Gün batımı',
      weather: 'Hava durumu',
      noReport: 'Hava durumu raporu yok',
      observed: 'Gözlem {time}',
      loading: 'Hava durumu yükleniyor…',
      unavailable: 'Hava durumu şu an alınamıyor.',
      openAirportPage: 'Havalimanı sayfası →',
      close: 'Kapat',
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
      weather: 'Hava durumu · aviationweather.gov',
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
      stationsWithMetar: 'Güncel gözlemi olan havalimanı (son 3 sa)',
      newestObs: 'En yeni gözlem',
      metarCheck: 'Son METAR kontrolü',
      tafCheck: 'Son TAF kontrolü',
      validTafs: 'Geçerli TAF',
      blockedUntil: 'İstek engeli bitişi',
      originDisabled: 'Kapalı',
      /** Hava durumu satırı (D-078): kaynak ve kapalıysa nedeni. */
      weatherOriginRemote: 'aviationweather.gov (METAR 5 dk, TAF 15 dk)',
      weatherOriginFixture: 'Elle yazılmış örnek raporlar (yerel geliştirme)',
      reason: 'Neden',
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
      /** `{source}`: aviationweather.gov, `{disclaimer}`: NWS kullanım şartları (D-078). */
      weather:
        'Havalimanı hava durumu raporları (METAR ve TAF) {source} kaynağından (NOAA Aviation Weather Center) gelir; raporları havalimanlarının meteoroloji birimleri hazırlar. Raporlar otomatik çözümlenir ve yalnızca bilgi amaçlıdır: resmî brifing yerine geçmez, uçuş planlamasında kullanılamaz. NOAA ve NWS bu hizmeti onaylamış değildir ({disclaimer}).',
      weatherDisclaimer: 'NWS kullanım şartları',
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
