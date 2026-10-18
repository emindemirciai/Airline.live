'use client'

import type { Messages } from '@havayolu/i18n'
import type { Locale, PublicAircraft } from '@havayolu/shared'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez (panel testleri bu dosyayı yükler).
import {
  nextTask,
  sliceTimeRemaining,
  whenIdle,
  type IdleDeadlineLike,
  type IdleScheduler,
} from '../../../lib/idle'
import { ApiError, fetchSearch } from '../../../lib/live/api'
import type { MapAirport } from '../airport-data'
import { withImportFallback } from '../chunk-fallback'
import { searchResultText } from './panel-format'
import {
  aircraftQuery,
  codeOnlyAirportSearch,
  moveActive,
  NO_AIRPORT_RESULTS,
  searchOptions,
  searchStatusText,
  submitOutcome,
  typingStatus,
  type AircraftLookup,
  type AirportSearchBuilder,
  type AirportSearchResult,
  type AirportSearchRow,
  type SearchOption,
  type SearchState,
  type SearchStatus,
} from './search-box-model'

/** API'nin kabul ettiği en uzun sorgu (apps/api/src/live/routes.ts → SEARCH_QUERY_MAX_LENGTH). */
const QUERY_MAX_LENGTH = 32

/** Yazarken öneri sayısı son değişiklikten bu kadar sonra okunur (her tuşta duyuru olmaz). */
const STATUS_DELAY_MS = 600

/**
 * Havalimanı aramasının ad dizini ayrı parçadadır (D-101, D-108): ad tabloları haritanın ilk
 * paketine girmez. Parça pencere ve panelle ortak girişten gelir (`airport-lazy.ts`; tablolar bir
 * kez); harita hazır olunca boşta (`preloadAirportSearch`, live-map.tsx), kutu odaklanınca ya da
 * üstüne gelinince ve ilk gönderimde istenir. Yüklenemezse arama yalnız tam kodla çalışır
 * (`codeOnlyAirportSearch`); durum satırı adların yüklenemediğini söyler.
 */
const loadAirportSearch = withImportFallback<AirportSearchBuilder>(
  () => import('../airport-lazy').then((module) => module.buildAirportSearch),
  codeOnlyAirportSearch,
  'Airport search',
)

/** Havalimanı aramasının parçasını önceden ister (canlı harita hazır olunca boşta; D-101). */
export function preloadAirportSearch(): void {
  void loadAirportSearch()
}

/**
 * Dizini boşta kurar (D-108): parça geldikten sonra ayrı boşta işlerde, liste ve dil başına bir kez
 * (`buildAirportSearch` saklar; kutunun kurulumu yalnız saklananı bulur). Kurulum dilimlidir (M6j.3):
 * her boşta iş tarayıcının verdiği süre kadar ilerler (`builder.prepare`, `sliceTimeRemaining`),
 * bitmediyse sonraki boşta işe kalır (`requestIdleCallback` olmayan tarayıcıda, Safari ve iOS, ilk
 * dilim `IDLE_FALLBACK_DELAY_MS` sonra, sonrakiler 10 ms'lik dilimlerle bir sonraki görevde,
 * `nextTask`; D-118); 5. halkanın 3.266 havalimanında masaüstünde hiçbir dilim uzun görev olmaz.
 * Kutunun ilk odağı ya da dokunması (telefonda klavye açılırken) kurulumu beklemez; yarım kurulumu
 * kutu kendisi bitirir. Dilimli kurulumu olmayan yükleyici (kodla arama yedeği) tek boşta işte kurar.
 * Dönen fonksiyon iptal eder (efektin temizliği). `load` ve `scheduler` testte değiştirilir.
 */
export function prebuildAirportSearch(
  airports: readonly MapAirport[],
  locale: Locale,
  load: () => Promise<AirportSearchBuilder> = loadAirportSearch,
  scheduler?: IdleScheduler,
): () => void {
  let active = true
  let cancelBuild: (() => void) | null = null
  const cancelLoad = whenIdle(() => {
    void load().then((build) => {
      if (!active) return
      const prepare = build.prepare
      if (prepare === undefined) {
        cancelBuild = whenIdle(() => void build(airports, locale), scheduler)
        return
      }
      const slice = (deadline?: IdleDeadlineLike) => {
        if (!active) return
        if (prepare(airports, locale, sliceTimeRemaining(deadline))) return
        // Tarayıcı boşta süre vermediyse (yedek zamanlayıcı: Safari, iOS) sonraki dilim bir sonraki
        // görevdedir, 1 sn sonra değil; `requestIdleCallback` her zaman `IdleDeadline` verir.
        cancelBuild =
          deadline === undefined ? nextTask(() => slice(), scheduler) : whenIdle(slice, scheduler)
      }
      cancelBuild = whenIdle(slice, scheduler)
    })
  }, scheduler)
  return () => {
    active = false
    cancelLoad()
    cancelBuild?.()
  }
}

type SearchMessages = Messages['map']['search']

export interface SearchBoxProps {
  apiBaseUrl: string
  locale: Locale
  /** Haritanın listelenen havalimanları (askerî üs yok; arama yine de süzer). */
  airports: readonly MapAirport[]
  messages: SearchMessages
  onFound: (ac: PublicAircraft) => void
  /** Seçilen havalimanı: pine tıklamakla aynı (pencere açılır, harita oraya gider). */
  onAirportFound: (airport: MapAirport) => void
  /**
   * Arama yapılmamışken durum satırında gösterilen metin: paylaşılan bağlantıdaki (`/?hex=`) uçak
   * bulunamadıysa "bulunamadı" metni. Kullanıcı arama yapınca aramanın durumu gösterilir.
   */
  notice?: string | null
}

export interface SearchResultsListProps {
  /** Listenin kimliği; seçeneklerin kimlikleri bundan türer (`searchOptions`). */
  id: string
  options: readonly SearchOption[]
  /** Etkin seçeneğin kimliği (`aria-activedescendant`); yoksa null. */
  activeId: string | null
  messages: SearchMessages
  /** Seçim; `pointerType` tıklamanın aygıtıdır (fare, dokunma, kalem; bilinmiyorsa boş). */
  onChoose: (option: SearchOption, pointerType: string) => void
}

/** Odak arama kutusunda kalsın: seçeneğe basmak kutunun odağını almaz (liste kapanmaz). */
const keepFocus = (event: SyntheticEvent) => event.preventDefault()

function pointerTypeOf(event: MouseEvent): string {
  const native = event.nativeEvent
  return 'pointerType' in native && typeof native.pointerType === 'string' ? native.pointerType : ''
}

/** Havalimanı satırının yer satırı: "yer · ICAO"; yer bilinmiyorsa ICAO. */
function airportOptionPlace(row: AirportSearchRow): string {
  return row.place === '' ? row.airport.icao : `${row.place} · ${row.airport.icao}`
}

/**
 * Havalimanı seçeneğinin erişilebilir adı: "IST, İstanbul Havalimanı, İstanbul · LTFM" (yalnız
 * kodla aramada "ATH, LGAV"). İçerikten türeyen ad blok öğelerin çevresine boşluk koyardı
 * ("IST , …"); ad görünen metnin sözcüklerini aynı sırayla taşır (WCAG 2.5.3).
 */
export function airportOptionLabel(row: AirportSearchRow): string {
  return [row.code, row.name, airportOptionPlace(row)].filter((part) => part !== '').join(', ')
}

/** Havalimanı satırı: IATA kodu, görünen ad ve "yer · ICAO". */
function AirportOptionText({ row }: { row: AirportSearchRow }) {
  return (
    <>
      <span className="map-search__code">{row.code}</span>
      {row.name === '' ? null : <span className="map-search__name">{row.name}</span>}
      <span className="map-search__place">{airportOptionPlace(row)}</span>
    </>
  )
}

/**
 * Etkin seçeneği listenin görünen alanına getirir; yalnız liste kaydırılır (sayfa ve haritanın
 * kapları değil). Listenin ilk seçeneğinde liste başa döner; bir grubun ilk seçeneğinde grubun adı da
 * görünür.
 */
function revealOption(list: HTMLElement, option: HTMLElement): void {
  if (list.querySelector('[role="option"]') === option) {
    list.scrollTop = 0
    return
  }
  const group = option.parentElement
  const firstInGroup = group?.querySelector('[role="option"]') === option
  const top = (firstInGroup && group ? group : option).getBoundingClientRect().top
  const { bottom } = option.getBoundingClientRect()
  const viewTop = list.getBoundingClientRect().top + list.clientTop
  const viewBottom = viewTop + list.clientHeight
  if (top < viewTop) list.scrollTop -= viewTop - top
  else if (bottom > viewBottom) list.scrollTop += bottom - viewBottom
}

/**
 * Sonuç listesi (ARIA 1.2 combobox'ın `listbox`'ı): önce "Havalimanları", sonra "Uçaklar" grubu; boş
 * grup çizilmez. Seçenekler odak almaz; klavyede etkin seçenek `aria-activedescendant` ile bildirilir,
 * odak arama kutusunda kalır.
 */
export function SearchResultsList({
  id,
  options,
  activeId,
  messages,
  onChoose,
}: SearchResultsListProps) {
  const groups = [
    {
      key: 'a',
      label: messages.groupAirports,
      options: options.filter((option) => option.kind === 'airport'),
    },
    {
      key: 'p',
      label: messages.groupAircraft,
      options: options.filter((option) => option.kind === 'aircraft'),
    },
  ].filter((group) => group.options.length > 0)
  return (
    <div
      id={id}
      role="listbox"
      aria-label={messages.results}
      className="map-search__results"
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
    >
      {groups.map((group) => (
        <div key={group.key} role="group" aria-labelledby={`${id}-g${group.key}`}>
          <div id={`${id}-g${group.key}`} role="presentation" className="map-search__group-label">
            {group.label}
          </div>
          {group.options.map((option) => (
            <div
              key={option.id}
              id={option.id}
              role="option"
              aria-label={option.kind === 'airport' ? airportOptionLabel(option.row) : undefined}
              aria-selected={option.id === activeId}
              className={
                option.kind === 'airport'
                  ? 'map-search__option'
                  : 'map-search__option map-search__option--aircraft'
              }
              onClick={(event) => onChoose(option, pointerTypeOf(event))}
            >
              {option.kind === 'airport' ? (
                <AirportOptionText row={option.row} />
              ) : (
                searchResultText(option.aircraft)
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Hesapsız canlı arama (D-108): uçak (sefer no, çağrı kodu, tescil ya da hex; `GET /v1/search`) ve
 * havalimanı (IATA ya da ICAO kodu, ad, il, şehir, ülke; tarayıcıda, haritanın listesinde).
 *
 * - **Yazarken** yalnız havalimanı önerilir (ağ isteği yok): kutu ARIA 1.2 combobox'ıdır, liste en çok
 *   8 havalimanıdır. Hiçbir öneri kendiliğinden seçilmez. Aşağı/yukarı ok listeyi açar ve gezer
 *   (iki uçta sarar; Alt+aşağı yalnız açar; etkin seçenek listenin görünen alanına kaydırılır), Enter
 *   etkin seçeneği seçer, Tab listeyi kapatır ve bir şey seçmez. Escape odak formun neresindeyse
 *   listeyi kapatır (açık havalimanı penceresi kapanmaz). Dışarı tıklamak ya da odağı formun dışına
 *   vermek listeyi kapatır; yalnız odaklanmak açmaz.
 * - **Enter ya da "Ara"** uçak aramasını da yapar; sonuç `submitOutcome`'un kurallarıyla tek uçak,
 *   tek havalimanı, bulunamadı ya da "Havalimanları" ve "Uçaklar" gruplu tek listedir. Liste "Ara"
 *   düğmesinden açılınca odak kutuya döner (oklar çalışır; dokunmada dönmez, klavye açılmaz).
 * - Havalimanı seçmek pine tıklamakla aynıdır (`onAirportFound`); odak kutudayken pencere açıldığı
 *   için pencere kapanınca odak kutuya döner (klavye ve fare). Dokunmayla seçilince ya da gönderilince
 *   telefon klavyesi kapanır: kart ya da pencere görünür ve pencere kapanınca klavye yeniden açılmaz.
 * - Durum metni ekran okuyucuya `aria-live="polite"` ile okunur; yazarken öneri sayısı son
 *   değişiklikten 600 ms sonra. Satır listenin altındadır: sayı belirince satırlar kaymaz.
 */
export function SearchBox({
  apiBaseUrl,
  locale,
  airports,
  messages,
  onFound,
  onAirportFound,
  notice = null,
}: SearchBoxProps) {
  const inputId = useId()
  const statusId = useId()
  const listId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ phase: 'idle' })
  const [listOpen, setListOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [builder, setBuilder] = useState<AirportSearchBuilder | null>(null)
  const [settledQuery, setSettledQuery] = useState('')
  const pending = useRef<AbortController | null>(null)
  const warmed = useRef(false)
  /**
   * Formdaki son basışın aygıtı (`pointerType`; hiç basılmadıysa boş). Odak çıkınca boşaltılmaz:
   * iOS'ta "Ara"ya dokunmak kutunun odağını gönderimden önce bırakır.
   */
  const lastPointer = useRef('')

  useEffect(() => () => pending.current?.abort(), [])

  // Öneri sayısı yazmaya ara verilince okunur (her tuşta canlı bölge değişmez).
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), STATUS_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  /**
   * Ad parçasını bir kez ister (odakta ya da üstüne gelince); parça gelince dizin bir sonraki
   * çizimde kurulur.
   */
  const warmAirportSearch = () => {
    if (warmed.current) return
    warmed.current = true
    void loadAirportSearch().then((loaded) => setBuilder(() => loaded))
  }

  // Dizin parça geldikten sonraki çizimde kurulur (tuş ya da odak işleyicisinde değil); liste ve dil
  // değişmedikçe aynı arama kullanılır.
  const airportSearch = useMemo(
    () => (builder === null || airports.length === 0 ? null : builder(airports, locale)),
    [builder, airports, locale],
  )
  const deferredQuery = useDeferredValue(query)
  const suggestions: AirportSearchResult = useMemo(
    () =>
      airportSearch === null || deferredQuery.trim() === ''
        ? NO_AIRPORT_RESULTS
        : airportSearch(deferredQuery),
    [airportSearch, deferredQuery],
  )

  const options: SearchOption[] =
    state.phase === 'pick'
      ? searchOptions(listId, state.airports, state.aircraft)
      : state.phase === 'idle'
        ? searchOptions(listId, suggestions.rows, [])
        : []
  const expanded = listOpen && options.length > 0
  const activeIndex = expanded ? options.findIndex((option) => option.id === activeId) : -1
  const activeOption = activeIndex < 0 ? undefined : options[activeIndex]
  const activeOptionId = activeOption?.id ?? null

  // `aria-activedescendant` listeyi kaydırmaz (odak kutudadır): klavyedeki etkin seçenek listenin
  // görünen alanında tutulur (WCAG 2.4.7). Liste aynı çizimde açılsa da DOM hazırdır.
  useLayoutEffect(() => {
    if (activeOptionId === null) return
    const option = document.getElementById(activeOptionId)
    const list = option?.closest('[role="listbox"]')
    if (option instanceof HTMLElement && list instanceof HTMLElement) revealOption(list, option)
  }, [activeOptionId])

  /** Listeyi kapatır, bir şey seçmez; gönderimin sonuç listesi düşer (kutu yazmaya döner). */
  const closeList = useCallback(() => {
    setListOpen(false)
    setActiveId(null)
    setState((current) => (current.phase === 'pick' ? { phase: 'idle' } : current))
  }, [])

  // Dışarı basmak listeyi kapatır (yalnız liste açıkken dinlenir).
  useEffect(() => {
    if (!expanded) return
    const closeOnOutside = (event: PointerEvent) => {
      const form = formRef.current
      if (form && event.target instanceof Node && !form.contains(event.target)) closeList()
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [expanded, closeList])

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    pending.current?.abort()
    pending.current = null
    setQuery(event.target.value)
    setState({ phase: 'idle' })
    setActiveId(null)
    setListOpen(true)
  }

  /** Dokunma ya da kalem (fare değil); aygıt bilinmiyorsa formdaki son basışın aygıtı. */
  const byTouch = (pointerType: string) => {
    const device = pointerType === '' ? lastPointer.current : pointerType
    return device !== '' && device !== 'mouse'
  }

  /**
   * Dokunmayla seçilince ya da gönderilince telefon klavyesi kapanır (kutu odağı bırakır): alttan
   * açılan kart ya da pencere görünür ve pencere kapanınca odak (klavye) kutuya dönmez, harita
   * tuvaline gider (pin dokunuşu gibi). Klavye ve farede odak kutuda kalır (WCAG 2.4.3).
   */
  const releaseTouchFocus = (pointerType: string) => {
    if (byTouch(pointerType) && document.activeElement === inputRef.current) {
      inputRef.current?.blur()
    }
  }

  function choose(option: SearchOption, pointerType: string | null) {
    setListOpen(false)
    setActiveId(null)
    setState({ phase: 'idle' })
    // Odak, pencere ya da kart açılmadan bırakılır: pencere dönüş hedefini açılışta saklar.
    if (pointerType !== null) releaseTouchFocus(pointerType)
    if (option.kind === 'airport') onAirportFound(option.row.airport)
    else onFound(option.aircraft)
  }

  /**
   * Gönderimin listesi "Ara" düğmesinden açıldıysa (klavyeyle ya da Chrome ve Firefox'ta tıklamayla
   * odak düğmede; Safari'de sayfada) odak kutuya döner: oklar, Enter ve Escape listede çalışır.
   * Dokunmada dönmez (telefon klavyesi açılırdı); arama sürerken odak başka yere geçtiyse alınmaz.
   */
  function refocusAfterSubmit() {
    const input = inputRef.current
    const active = document.activeElement
    if (input === null || active === input || byTouch('')) return
    if (active === null || active === document.body || formRef.current?.contains(active)) {
      input.focus({ preventScroll: true })
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (options.length === 0) return
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        if (!expanded) {
          setListOpen(true)
          const first = event.altKey ? undefined : options[step === 1 ? 0 : options.length - 1]
          setActiveId(first?.id ?? null)
          return
        }
        if (event.altKey) return
        setActiveId(options[moveActive(activeIndex, options.length, step)]?.id ?? null)
        return
      }
      case 'Enter':
        if (activeOption === undefined) return
        event.preventDefault()
        choose(activeOption, null)
        return
      case 'Tab':
        closeList()
        return
    }
  }

  /**
   * Escape, odak formun neresindeyse (kutu ya da "Ara") açık listeyi kapatır. Açık liste Escape'i
   * tüketir: açık havalimanı penceresi aynı tuşla kapanmaz.
   */
  function closeOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing || !expanded) return
    event.preventDefault()
    closeList()
  }

  /** Odak formdan çıkınca (kutudan ya da "Ara"dan) liste kapanır; form içinde gezinmek kapatmaz. */
  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && formRef.current?.contains(next)) return
    closeList()
  }

  function rememberPointer(event: ReactPointerEvent<HTMLFormElement>) {
    lastPointer.current = event.pointerType
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    if (q === '') return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setListOpen(false)
    setActiveId(null)
    setState({ phase: 'searching' })

    const normalized = aircraftQuery(q)
    const aircraftLookup: Promise<AircraftLookup> =
      normalized === null
        ? Promise.resolve({ status: 'skipped' })
        : fetchSearch(apiBaseUrl, normalized, controller.signal).then(
            (response): AircraftLookup => ({
              status: 'ok',
              kind: response.kind,
              results: response.results,
            }),
            (error: unknown): AircraftLookup => ({
              status: 'failed',
              rateLimited: error instanceof ApiError && error.status === 429,
            }),
          )
    const airportLookup: Promise<AirportSearchResult> =
      airports.length === 0
        ? Promise.resolve(NO_AIRPORT_RESULTS)
        : loadAirportSearch().then((loaded) => {
            setBuilder(() => loaded)
            return loaded(airports, locale)(q)
          })
    const [aircraft, airportResult] = await Promise.all([aircraftLookup, airportLookup])
    // Yeni bir arama, yazma ya da bileşenin kaldırılması isteği iptal ettiyse sessiz kalınır.
    if (controller.signal.aborted) return
    if (pending.current === controller) pending.current = null

    const outcome = submitOutcome({
      query: q,
      aircraft,
      airports: airportResult,
      airportsLoaded: airports.length > 0,
    })
    switch (outcome.type) {
      case 'aircraft':
        setState({ phase: 'idle' })
        releaseTouchFocus('')
        onFound(outcome.aircraft)
        return
      case 'airport':
        setState({ phase: 'idle' })
        releaseTouchFocus('')
        onAirportFound(outcome.airport)
        return
      case 'list':
        setState({
          phase: 'pick',
          airports: outcome.airports,
          airportTotal: outcome.airportTotal,
          aircraft: outcome.aircraft,
          aircraftFailure: outcome.aircraftFailure,
        })
        setListOpen(true)
        refocusAfterSubmit()
        return
      case 'notFound':
        setState({ phase: 'notFound', parts: outcome.parts })
        return
      case 'failed':
        setState({ phase: 'failed', rateLimited: outcome.rateLimited })
        return
    }
  }

  const typing = state.phase === 'idle' && listOpen && query.trim() !== '' && settledQuery === query
  const status: SearchStatus = typing ? typingStatus(suggestions, query) : state
  const statusText = searchStatusText(status, messages, locale)
  const text = statusText === '' && state.phase === 'idle' && notice ? notice : statusText
  return (
    <form
      ref={formRef}
      role="search"
      className="map-panel map-search"
      onSubmit={search}
      onKeyDown={closeOnEscape}
      onBlur={handleBlur}
      onPointerDown={rememberPointer}
      aria-busy={state.phase === 'searching'}
    >
      <label htmlFor={inputId} className="sr-only">
        {messages.label}
      </label>
      <div className="map-search__row">
        <svg
          className="map-search__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          name="q"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={activeOption?.id}
          className="map-search__input"
          value={query}
          onChange={changeQuery}
          onKeyDown={handleKeyDown}
          onFocus={warmAirportSearch}
          onPointerEnter={warmAirportSearch}
          placeholder={messages.placeholder}
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby={statusId}
        />
        <button type="submit" className="map-button map-search__submit">
          {messages.submit}
        </button>
      </div>
      {expanded ? (
        <SearchResultsList
          id={listId}
          options={options}
          activeId={activeOptionId}
          messages={messages}
          onChoose={choose}
        />
      ) : null}
      {/*
       * Canlı bölge boşken de DOM'da kalır; yoksa ilk duyuru kaçabilir. Boşken yer kaplamaz. Listenin
       * altındadır: yazarken 600 ms sonra beliren öneri sayısı satırları kaydırmaz.
       */}
      <p id={statusId} className="map-search__status" aria-live="polite">
        {text}
      </p>
    </form>
  )
}
