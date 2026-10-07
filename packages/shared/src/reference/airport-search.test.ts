import { describe, expect, it } from 'vitest'
import {
  AIRPORT_SEARCH_LIMIT,
  AIRPORT_SEARCH_MIN_LENGTH,
  AIRPORT_SEARCH_STOP_WORDS,
  airportQueryKind,
  createAirportSearchIndex,
  foldSearchText,
  searchAirportIndex,
  type AirportSearchEntry,
} from './airport-search'

function entry(
  icao: string,
  iata: string,
  names: string[],
  places: string[] = [],
  countries: string[] = [],
): AirportSearchEntry<string> {
  return { value: icao, icao, iata, names, places, countries }
}

const TR = ['Türkiye']

/** Elle yazılmış kayıtlar: dizinin sırası çağıranındır (LTFM önce, Türkiye önce). */
const ENTRIES: AirportSearchEntry<string>[] = [
  entry('LTFM', 'IST', ['İstanbul Havalimanı', 'Istanbul Airport'], ['İstanbul', 'Istanbul'], TR),
  entry(
    'LTFJ',
    'SAW',
    [
      'İstanbul Sabiha Gökçen Uluslararası Havalimanı',
      'Istanbul Sabiha Gökçen International Airport',
    ],
    ['İstanbul', 'Istanbul', 'Pendik'],
    TR,
  ),
  entry(
    'LTBA',
    'ISL',
    ['İstanbul Atatürk Havalimanı', 'Istanbul Atatürk Airport'],
    ['İstanbul'],
    TR,
  ),
  entry(
    'LTBJ',
    'ADB',
    ['İzmir Adnan Menderes Havalimanı', 'Izmir Adnan Menderes Airport'],
    ['İzmir', 'Izmir', 'Gaziemir'],
    TR,
  ),
  entry('LTAI', 'AYT', ['Antalya Havalimanı', 'Antalya Airport'], ['Antalya'], TR),
  entry('LTCT', 'IGD', ['Iğdır Şehit Bülent Aydın Havalimanı', 'Iğdır Airport'], ['Iğdır'], TR),
  entry(
    'LGAV',
    'ATH',
    [
      'Atina Eleftherios Venizelos Havalimanı',
      'Athens Eleftherios Venizelos International Airport',
    ],
    ['Atina', 'Athens'],
    ['Yunanistan', 'Greece'],
  ),
  entry(
    'LGTS',
    'SKG',
    ['Selanik Makedonya Havalimanı', 'Thessaloniki Macedonia International Airport'],
    ['Selanik', 'Thessaloniki'],
    ['Yunanistan', 'Greece'],
  ),
  entry(
    'BKPR',
    'PRN',
    ['Priştine Adem Jashari Havalimanı', 'Pristina International Airport'],
    ['Priştine', 'Pristina'],
    ['Kosova', 'Kosovo'],
  ),
  entry(
    'EPLL',
    'LCJ',
    ['Łódź Władysław Reymont Havalimanı', 'Łódź Władysław Reymont Airport'],
    ['Łódź'],
    ['Polonya', 'Poland'],
  ),
  entry(
    'EKCH',
    'CPH',
    ['Kopenhag Kastrup Havalimanı', 'Copenhagen Airport'],
    ['Kopenhag', 'København', 'Copenhagen'],
    ['Danimarka', 'Denmark'],
  ),
  entry(
    'KDVN',
    'DVN',
    ['Davenport Municipal Airport'],
    ['Davenport'],
    ['Amerika Birleşik Devletleri', 'United States'],
  ),
]

const INDEX = createAirportSearchIndex(ENTRIES)

/** Sonuçların değerleri (ICAO). */
const codes = (query: string, limit?: number) =>
  searchAirportIndex(INDEX, query, limit).hits.map((hit) => hit.value)

describe('foldSearchText', () => {
  it('büyük-küçük harf, Türkçe harfler ve aksanlar yok sayılır', () => {
    for (const value of ['İSTANBUL', 'Istanbul', 'ıstanbul', 'istanbul', 'İstanbul']) {
      expect(foldSearchText(value), value).toBe('istanbul')
    }
    expect(foldSearchText('İST')).toBe('ist')
    expect(foldSearchText('IĞDIR')).toBe('igdir')
    expect(foldSearchText('Iğdır')).toBe('igdir')
    expect(foldSearchText('Gökçen')).toBe('gokcen')
    expect(foldSearchText('Esenboğa')).toBe('esenboga')
    expect(foldSearchText('Łódź')).toBe('lodz')
    expect(foldSearchText('København')).toBe('kobenhavn')
    expect(foldSearchText('Þórshöfn')).toBe('thorshofn')
    expect(foldSearchText('Straße')).toBe('strasse')
  })

  it('harf ve rakam dışındaki her dizi tek boşluktur; baştaki ve sondaki boşluk atılır', () => {
    expect(foldSearchText('Selçuk-Efes')).toBe('selcuk efes')
    expect(foldSearchText("Côte d'Ivoire")).toBe('cote d ivoire')
    expect(foldSearchText('Saint John’s')).toBe('saint john s')
    expect(foldSearchText('  TK – 1985 ')).toBe('tk 1985')
    expect(foldSearchText('(.)')).toBe('')
    // Yalnız ASCII metin kısa yoldan aynı biçime iner.
    expect(foldSearchText("  O'Hare Intl./JFK-1 ")).toBe('o hare intl jfk 1')
    expect(foldSearchText('ISTANBUL')).toBe(foldSearchText('İstanbul'))
  })

  it('dolgu sözcükleri katlanmış biçimde yazılıdır', () => {
    for (const word of AIRPORT_SEARCH_STOP_WORDS) expect(foldSearchText(word)).toBe(word)
  })
})

describe('airportQueryKind', () => {
  it('2 karakterden kısa ya da yalnız dolgu sözcüğü: aranmaz', () => {
    expect(AIRPORT_SEARCH_MIN_LENGTH).toBe(2)
    for (const query of ['', ' ', 'i', 'İ', '-', 'a .', 'havalimanı', 'Airport', 'Havaalanı']) {
      expect(airportQueryKind(query), query).toBe('none')
    }
    expect(airportQueryKind('es')).toBe('text')
  })

  it('rakamlı ya da hex sorgu yalnız kod arar', () => {
    for (const query of ['TK1985', 'TK 1985', '4bb26c', '~4BB26C', 'abcdef', '~facade', 'TC-JJ1']) {
      expect(airportQueryKind(query), query).toBe('code')
    }
    for (const query of ['esenboğa', 'TC-JIA', 'facad', 'ist']) {
      expect(airportQueryKind(query), query).toBe('text')
    }
  })
})

describe('searchAirportIndex', () => {
  it('İSTANBUL, Istanbul, ıstanbul aynı sonucu verir; İST tam koddur', () => {
    const expected = ['LTFM', 'LTFJ', 'LTBA']
    for (const query of ['İSTANBUL', 'Istanbul', 'ıstanbul', 'istanbul']) {
      expect(codes(query), query).toEqual(expected)
    }
    expect(searchAirportIndex(INDEX, 'İST').hits).toEqual([
      { value: 'LTFM', match: 'code' },
      { value: 'LTFJ', match: 'start' },
      { value: 'LTBA', match: 'start' },
    ])
    expect(codes('ist')).toEqual(codes('İST'))
    expect(codes('IĞDIR')).toEqual(['LTCT'])
    expect(codes('igdir')).toEqual(['LTCT'])
    expect(codes('lodz')).toEqual(['EPLL'])
    expect(codes('kobenhavn')).toEqual(['EKCH'])
  })

  it('dolgu sözcükleri sayılmaz', () => {
    expect(codes('havalimanı')).toEqual([])
    expect(codes('airport')).toEqual([])
    expect(codes('antalya havalimanı')).toEqual(codes('antalya'))
    expect(codes('Antalya Airport')).toEqual(['LTAI'])
  })

  it('her basamak ve eşleşme türü', () => {
    // Tam kod: IATA ya da ICAO (3–4 karakter).
    expect(searchAirportIndex(INDEX, 'esb').hits).toEqual([])
    expect(searchAirportIndex(INDEX, 'adb').hits).toEqual([{ value: 'LTBJ', match: 'code' }])
    expect(searchAirportIndex(INDEX, 'ltbj').hits).toEqual([{ value: 'LTBJ', match: 'code' }])
    // Başlangıç: sorgu bir adın ya da yerin başı.
    expect(searchAirportIndex(INDEX, 'izmir adnan').hits).toEqual([
      { value: 'LTBJ', match: 'start' },
    ])
    expect(searchAirportIndex(INDEX, 'pendik').hits).toEqual([{ value: 'LTFJ', match: 'start' }])
    // Sözcükler: her sözcük bir ad, yer ya da kod sözcüğünün başı; kod önekleri dahil.
    expect(searchAirportIndex(INDEX, 'sabiha').hits).toEqual([{ value: 'LTFJ', match: 'words' }])
    expect(searchAirportIndex(INDEX, 'LTF').hits).toEqual([
      { value: 'LTFM', match: 'words' },
      { value: 'LTFJ', match: 'words' },
    ])
    // Ülke: sözcükler ülke adlarında da aranır.
    expect(searchAirportIndex(INDEX, 'Yunanistan').hits).toEqual([
      { value: 'LGAV', match: 'country' },
      { value: 'LGTS', match: 'country' },
    ])
    expect(searchAirportIndex(INDEX, 'greece').hits.map((hit) => hit.match)).toEqual([
      'country',
      'country',
    ])
  })

  it('basamak sırası: kod > başlangıç > sözcükler > ülke; basamakta çağıranın sırası', () => {
    const index = createAirportSearchIndex([
      entry('XC01', 'XCA', ['Bar Field'], [], ['Greece']),
      entry('XW01', 'XWA', ['North Greenhill'], []),
      entry('XS02', 'XSB', ['Greenway'], []),
      entry('XS01', 'XSA', ['Greenfield'], []),
      entry('GREE', '', ['Foo'], []),
    ])
    expect(searchAirportIndex(index, 'gree').hits).toEqual([
      { value: 'GREE', match: 'code' },
      { value: 'XS02', match: 'start' },
      { value: 'XS01', match: 'start' },
      { value: 'XW01', match: 'words' },
      { value: 'XC01', match: 'country' },
    ])
    // Ters sırayla kurulan dizinde basamağın içi de ters.
    expect(codes('istanbul')).toEqual(['LTFM', 'LTFJ', 'LTBA'])
    const reversed = createAirportSearchIndex([...ENTRIES].reverse())
    expect(searchAirportIndex(reversed, 'istanbul').hits.map((hit) => hit.value)).toEqual([
      'LTBA',
      'LTFJ',
      'LTFM',
    ])
  })

  it('yalnız sözcük başı: sözcük ortası eşleşmez', () => {
    expect(codes('port')).toEqual([])
    expect(codes('davenport')).toEqual(['KDVN'])
    expect(codes('ist')).not.toContain('BKPR')
    expect(codes('stanbul')).toEqual([])
    expect(codes('gökçen')).toEqual(['LTFJ'])
    expect(codes('okcen')).toEqual([])
  })

  it('çok sözcüklü sorgu: her sözcük bir alanda (ad, yer, kod, ülke)', () => {
    expect(searchAirportIndex(INDEX, 'adnan gaziemir').hits).toEqual([
      { value: 'LTBJ', match: 'words' },
    ])
    expect(searchAirportIndex(INDEX, 'gaziemir adb').hits).toEqual([
      { value: 'LTBJ', match: 'words' },
    ])
    // Ülke adıyla karışık: ülke basamağı.
    expect(searchAirportIndex(INDEX, 'atina yunanistan').hits).toEqual([
      { value: 'LGAV', match: 'country' },
    ])
    expect(codes('adnan antalya')).toEqual([])
  })

  it('ülke basamağı en az 3 harf ister (boşluk sayılmaz)', () => {
    expect(codes('yu')).toEqual([])
    expect(codes('yuna')).toEqual(['LGAV', 'LGTS'])
    expect(codes('koso')).toEqual(['BKPR'])
    expect(codes('kosovo')).toEqual(['BKPR'])
    // İki harf ve boşluk: ad ya da yer sözcüğü yoksa ülke basamağına inmez.
    expect(searchAirportIndex(INDEX, 'y g').hits).toEqual([])
    expect(searchAirportIndex(INDEX, 'g y').hits).toEqual([])
  })

  it('3 harfli sorgu: tam kod önce, sonra adın başı ve sözcük başı (yazarken öneri)', () => {
    const index = createAirportSearchIndex([
      entry(
        'LTFJ',
        'SAW',
        ['İstanbul Sabiha Gökçen Uluslararası Havalimanı'],
        ['İstanbul', 'Pendik'],
        TR,
      ),
      entry(
        'LTFK',
        'GKD',
        ['Gökçeada Havalimanı', 'Gökçeada Airport'],
        ['Gökçeada', 'Çanakkale'],
        TR,
      ),
      entry('LTAI', 'AYT', ['Antalya Havalimanı', 'Antalya Airport'], ['Antalya'], TR),
      entry(
        'LTAJ',
        'GZT',
        ['Gaziantep Havalimanı', 'Gaziantep Airport'],
        ['Gaziantep', 'Antep'],
        TR,
      ),
      entry(
        'DTTX',
        'SFA',
        ['Sfaks Thyna Havalimanı', 'Sfax Thyna International Airport'],
        ['Sfaks', 'Sfax'],
        ['Tunus', 'Tunisia'],
      ),
      entry(
        'FATH',
        'THY',
        ['Thohoyandou Airport'],
        ['Thohoyandou'],
        ['Güney Afrika', 'South Africa'],
      ),
      entry('LTCS', 'GNY', ['Şanlıurfa GAP Havalimanı'], ['Şanlıurfa'], TR),
      entry(
        'ORER',
        'EBL',
        ['Erbil Havalimanı', 'Erbil International Airport'],
        ['Erbil'],
        ['Irak', 'Iraq'],
      ),
    ])
    const found = (query: string) => searchAirportIndex(index, query).hits
    const values = (query: string) => found(query).map((hit) => hit.value)
    // Adın içindeki bir sözcüğün başı ilk üç harfte bulunur (Türkçe harfli ya da harfsiz).
    expect(found('sab')).toEqual([{ value: 'LTFJ', match: 'words' }])
    expect(found('SAB')).toEqual([{ value: 'LTFJ', match: 'words' }])
    expect(found('gok')).toEqual([
      { value: 'LTFK', match: 'start' },
      { value: 'LTFJ', match: 'words' },
    ])
    expect(found('gök')).toEqual(found('gok'))
    // "ant": Antalya adın başı; "Antep" Gaziantep'in yeri.
    expect(values('ant')).toEqual(['LTAI', 'LTAJ'])
    expect(found('ant').map((hit) => hit.match)).toEqual(['start', 'start'])
    // Havayolu kodu biçimi ("THY"): tam kod önce, sözcük başı (Sfaks Thyna) altında. Öneri listesi
    // içindir; Enter'da Sfaks Thyna açılmaz (search-box-model.ts `submitOutcome`).
    expect(found('THY')).toEqual([
      { value: 'FATH', match: 'code' },
      { value: 'DTTX', match: 'words' },
    ])
    expect(found('thy')).toEqual(found('THY'))
    expect(found('GAP')).toEqual([{ value: 'LTCS', match: 'words' }])
    expect(found('ira')).toEqual([{ value: 'ORER', match: 'country' }])
    // Kod öneki, başlangıç ve tam kod basamağı.
    expect(found('LTF')).toEqual([
      { value: 'LTFJ', match: 'words' },
      { value: 'LTFK', match: 'words' },
    ])
    expect(found('sfa')).toEqual([{ value: 'DTTX', match: 'code' }])
    expect(found('erb')).toEqual([{ value: 'ORER', match: 'start' }])
    // Ana dizinde de: "sab" Sabiha Gökçen'i, "ist" önce tam kodla IST'yi bulur.
    expect(codes('sab')).toEqual(['LTFJ'])
    expect(codes('gok')).toEqual(['LTFJ'])
    expect(searchAirportIndex(INDEX, 'ist').hits[0]).toEqual({ value: 'LTFM', match: 'code' })
  })

  it('yarım yazılmış dolgu sözcüğü hiçbir şey bulmazsa sayılmaz', () => {
    for (const query of ['antalya h', 'antalya hava', 'antalya havali', 'Antalya Airp']) {
      expect(codes(query), query).toEqual(['LTAI'])
    }
    expect(searchAirportIndex(INDEX, 'antalya havali').hits).toEqual(
      searchAirportIndex(INDEX, 'antalya havalimanı').hits,
    )
    expect(codes('istanbul airp')).toEqual(codes('istanbul airport'))
    expect(codes('istanbul airp')).toEqual(['LTFM', 'LTFJ', 'LTBA'])
    expect(codes('athens inter')).toEqual(['LGAV'])
    expect(codes('sabiha gokcen ulu')).toEqual(['LTFJ'])
    // Ad giriş sınırında (32 karakter) kesilmiş: kendi havalimanını bulur.
    expect(codes('Athens Eleftherios Venizelos Int')).toEqual(['LGAV'])
    expect(codes('Istanbul Sabiha Gökçen Internati')).toEqual(['LTFJ'])
    expect(codes('İzmir Adnan Menderes Havaliman')).toEqual(['LTBJ'])
    // Tek sözcük kısalmaz; tam dolgu sözcüğü zaten sayılmaz.
    expect(codes('hava')).toEqual([])
    expect(codes('inter')).toEqual([])
    expect(codes('xyz havalimanı h')).toEqual([])
    // Sorgu bir şey bulduysa yarım sözcük sayılır: "istanbul a" yalnız Atatürk'tür.
    expect(codes('istanbul a')).toEqual(['LTBA'])
    // Kod ve yarım dolgu sözcüğü: kod basamağı.
    expect(searchAirportIndex(INDEX, 'ADB h').hits).toEqual([{ value: 'LTBJ', match: 'code' }])
  })

  it('tam kod yalnız İngilizce harf ve rakamdır: "küt" Kutaisi’nin KUT kodu değil (Türkçe İ/ı olur)', () => {
    const index = createAirportSearchIndex([
      entry('LTBZ', 'KZR', ['Zafer Havalimanı', 'Zafer Airport'], ['Kütahya', 'Altıntaş'], TR),
      entry('LTBU', 'TEQ', ['Tekirdağ Çorlu Havalimanı'], ['Tekirdağ', 'Çorlu'], TR),
      entry(
        'UGKO',
        'KUT',
        ['Kutaisi Havalimanı', 'Kutaisi International Airport'],
        ['Kutaisi'],
        ['Gürcistan', 'Georgia'],
      ),
      entry(
        'UGSB',
        'BUS',
        ['Batum Havalimanı', 'Batumi International Airport'],
        ['Batum'],
        ['Gürcistan', 'Georgia'],
      ),
    ])
    const found = (query: string) => searchAirportIndex(index, query).hits
    // Ü ve ş kod olamaz: ikisi de adın başıyla (Türkiye önce), kod basamağı yok.
    expect(found('küt')).toEqual([
      { value: 'LTBZ', match: 'start' },
      { value: 'UGKO', match: 'start' },
    ])
    expect(found('KÜT')).toEqual(found('küt'))
    // "buş" Batum'un BUS kodunu tam kod olarak bulmaz; kod sözcüğünün başı olarak sözcük basamağında.
    expect(found('buş')).toEqual([{ value: 'UGSB', match: 'words' }])
    expect(found('bus')).toEqual([{ value: 'UGSB', match: 'code' }])
    // İngilizce harflerle yazılan kod tam koddur; Türkçe klavyenin İ ve ı harfleri I ve i olur.
    expect(found('kut')[0]).toEqual({ value: 'UGKO', match: 'code' })
    expect(found('KUT')[0]).toEqual({ value: 'UGKO', match: 'code' })
    expect(found('teq')).toEqual([{ value: 'LTBU', match: 'code' }])
    expect(searchAirportIndex(INDEX, 'İST').hits[0]).toEqual({ value: 'LTFM', match: 'code' })
    expect(searchAirportIndex(INDEX, 'ıst').hits[0]).toEqual({ value: 'LTFM', match: 'code' })
    expect(searchAirportIndex(INDEX, ' ltbj ').hits).toEqual([{ value: 'LTBJ', match: 'code' }])
  })

  it('queryLetters: aranan sorgunun harfleri; dolgu sözcükleri ve yedekteki yarım sözcük sayılmaz', () => {
    const index = createAirportSearchIndex([
      entry(
        'DTTX',
        'SFA',
        ['Sfaks Thyna Havalimanı', 'Sfax Thyna International Airport'],
        ['Sfaks', 'Sfax'],
        ['Tunus', 'Tunisia'],
      ),
      entry(
        'LTAC',
        'ESB',
        ['Ankara Esenboğa Havalimanı', 'Ankara Esenboğa Airport'],
        ['Ankara'],
        TR,
      ),
    ])
    const letters = (query: string) => searchAirportIndex(index, query).queryLetters
    const values = (query: string) => searchAirportIndex(index, query).hits.map((hit) => hit.value)
    // Havayolu kodu ve dolgu sözcüğü: yalnız "thy" aranır, 3 harf.
    for (const query of ['THY', 'THY airport', 'thy havalimanı', 'THY intl', 'THY h', 'THY hava']) {
      expect(values(query), query).toEqual(['DTTX'])
      expect(letters(query), query).toBe(3)
    }
    // Yarım dolgu sözcüğü yedekte atılır: aranan sorgu "esenboğa".
    expect(values('esenboğa hav')).toEqual(['LTAC'])
    expect(letters('esenboğa hav')).toBe(8)
    expect(letters('esenboğa')).toBe(8)
    // Boşluk, tire, noktalama ve rakam sayılmaz; katlama harf atmaz.
    expect(letters('s-a.f')).toBe(3)
    expect(letters('Ağrı')).toBe(4)
    expect(letters('TK1985')).toBe(2)
    // Hiçbir şey aranmayan sorgu.
    expect(letters('havalimanı')).toBe(0)
    expect(letters('')).toBe(0)
  })

  it('yarım dolgu sözcüğü: gerçek sözcük daralttıysa bütün ülke gelmez ("italy bol")', () => {
    const index = createAirportSearchIndex([
      entry('LIRF', 'FCO', ['Rome Fiumicino Airport'], ['Rome'], ['İtalya', 'Italy']),
      entry('LIPE', 'BLQ', ['Bologna Guglielmo Marconi Airport'], ['Bologna'], ['İtalya', 'Italy']),
      entry('LIMC', 'MXP', ['Milan Malpensa Airport'], ['Milan'], ['İtalya', 'Italy']),
    ])
    expect(searchAirportIndex(index, 'italy bol').hits).toEqual([
      { value: 'LIPE', match: 'country' },
    ])
  })

  it('rakamlı ve hex sorgu yalnız tam kod bulur; 1 karakter hiçbir şey', () => {
    const index = createAirportSearchIndex([
      entry('XFAC', 'FAC', ['Facade Field'], ['Facade']),
      entry('XK12', 'K12', ['Twelve Field']),
    ])
    expect(searchAirportIndex(index, 'facad').hits).toEqual([{ value: 'XFAC', match: 'start' }])
    expect(searchAirportIndex(index, 'facade').hits).toEqual([])
    expect(searchAirportIndex(index, 'k12').hits).toEqual([{ value: 'XK12', match: 'code' }])
    expect(searchAirportIndex(index, 'xk12').hits).toEqual([{ value: 'XK12', match: 'code' }])
    expect(searchAirportIndex(index, 'k1').hits).toEqual([])
    expect(codes('TK1985')).toEqual([])
    expect(codes('4bb26c')).toEqual([])
    expect(codes('a')).toEqual([])
    expect(codes('İ')).toEqual([])
  })

  it(`en fazla ${AIRPORT_SEARCH_LIMIT} sonuç; total bütün eşleşmeler`, () => {
    const many = createAirportSearchIndex(
      Array.from({ length: 12 }, (_, i) =>
        entry(`XT${String(i).padStart(2, '0')}`, '', [`Field ${i}`], [], TR),
      ),
    )
    const result = searchAirportIndex(many, 'türkiye')
    expect(result.total).toBe(12)
    expect(result.hits).toHaveLength(AIRPORT_SEARCH_LIMIT)
    expect(result.hits[0]).toEqual({ value: 'XT00', match: 'country' })
    expect(searchAirportIndex(INDEX, 'istanbul', 2)).toEqual({
      hits: [
        { value: 'LTFM', match: 'start' },
        { value: 'LTFJ', match: 'start' },
      ],
      total: 3,
      queryLetters: 8,
    })
    expect(many.size).toBe(12)
  })

  it('IATA kodu boş kayıt boş sorguyla ya da kodla eşleşmez', () => {
    const index = createAirportSearchIndex([entry('XNOI', '', ['Lonely Field'])])
    expect(searchAirportIndex(index, 'xnoi').hits).toEqual([{ value: 'XNOI', match: 'code' }])
    expect(searchAirportIndex(index, '  ').hits).toEqual([])
  })

  it('3.500 sentetik havalimanı: dizin kurulur, sonuçlar doğru', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const code = (i: number, length: number) =>
      Array.from(
        { length },
        (_, k) => letters[Math.floor(i / 26 ** (length - 1 - k)) % 26] ?? 'A',
      ).join('')
    const synthetic = Array.from({ length: 3_500 }, (_, i) =>
      entry(
        `Z${code(i, 3)}`,
        code(i, 3),
        [`Testkent ${code(i, 3).toLowerCase()}ville Havalimanı`, `Testkent Airport ${i}`],
        [`${code(i, 3).toLowerCase()}ville`],
        [i % 2 === 0 ? 'Çiftland' : 'Tekland'],
      ),
    )
    const index = createAirportSearchIndex(synthetic)
    expect(index.size).toBe(3_500)
    expect(searchAirportIndex(index, 'ABC').hits[0]).toEqual({ value: 'ZABC', match: 'code' })
    expect(searchAirportIndex(index, 'abcville').hits).toEqual([{ value: 'ZABC', match: 'start' }])
    const testkent = searchAirportIndex(index, 'testkent')
    expect(testkent.total).toBe(3_500)
    expect(testkent.hits.map((hit) => hit.value)).toEqual(
      synthetic.slice(0, AIRPORT_SEARCH_LIMIT).map((item) => item.value),
    )
    expect(searchAirportIndex(index, 'ciftland').total).toBe(1_750)
    expect(searchAirportIndex(index, 'nowhere').total).toBe(0)
  })
})
