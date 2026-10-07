'use client'

import type { Messages } from '@havayolu/i18n'
import type { Locale, PublicAircraft } from '@havayolu/shared'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'
// Göreli yol: vitest `@/` takma adını çözmez (panel testleri bu dosyayı yükler).
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
 * paketine girmez. Parça harita hazır olunca boşta (`preloadAirportSearch`, live-map.tsx), kutu
 * odaklanınca ya da üstüne gelinince ve ilk gönderimde istenir. Yüklenemezse arama yalnız tam kodla
 * çalışır (`codeOnlyAirportSearch`); durum satırı adların yüklenemediğini söyler.
 */
const loadAirportSearch = withImportFallback<AirportSearchBuilder>(
  () => import('./airport-search-index').then((module) => module.buildAirportSearch),
  codeOnlyAirportSearch,
  'Airport search',
)

/** Havalimanı aramasının parçasını önceden ister (canlı harita hazır olunca boşta; D-101). */
export function preloadAirportSearch(): void {
  void loadAirportSearch()
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

/** Havalimanı satırı: IATA kodu, görünen ad ve "yer · ICAO" (ekran okuyucu için virgüllerle). */
function AirportOptionText({ row }: { row: AirportSearchRow }) {
  const place = row.place === '' ? row.airport.icao : `${row.place} · ${row.airport.icao}`
  return (
    <>
      <span className="map-search__code">{row.code}</span>
      {row.name === '' ? null : (
        <>
          <span className="sr-only">, </span>
          <span className="map-search__name">{row.name}</span>
        </>
      )}
      <span className="sr-only">, </span>
      <span className="map-search__place">{place}</span>
    </>
  )
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
 *   (iki uçta sarar; Alt+aşağı yalnız açar), Enter etkin seçeneği seçer, Escape listeyi kapatır
 *   (açık havalimanı penceresi kapanmaz), Tab listeyi kapatır ve bir şey seçmez. Dışarı tıklamak ya
 *   da odağı başka yere vermek listeyi kapatır; yalnız odaklanmak açmaz.
 * - **Enter ya da "Ara"** uçak aramasını da yapar; sonuç `submitOutcome`'un kurallarıyla tek uçak,
 *   tek havalimanı, bulunamadı ya da "Havalimanları" ve "Uçaklar" gruplu tek listedir.
 * - Havalimanı seçmek pine tıklamakla aynıdır (`onAirportFound`); odak kutudayken pencere açıldığı
 *   için pencere kapanınca odak kutuya döner. Dokunmayla uçak seçilince klavye kapanır (kart görünür).
 * - Durum metni ekran okuyucuya `aria-live="polite"` ile okunur; yazarken öneri sayısı son
 *   değişiklikten 600 ms sonra.
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

  function choose(option: SearchOption, pointerType: string | null) {
    setListOpen(false)
    setActiveId(null)
    setState({ phase: 'idle' })
    if (option.kind === 'airport') {
      onAirportFound(option.row.airport)
      return
    }
    onFound(option.aircraft)
    // Dokunmayla seçilince telefon klavyesi kapanır: alttan açılan kart görünür.
    if (pointerType !== null && pointerType !== 'mouse') inputRef.current?.blur()
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
      case 'Escape':
        // Açık liste Escape'i tüketir: açık havalimanı penceresi aynı tuşla kapanmaz.
        if (!expanded) return
        event.preventDefault()
        closeList()
        return
      case 'Tab':
        closeList()
        return
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && formRef.current?.contains(next)) return
    closeList()
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
        onFound(outcome.aircraft)
        return
      case 'airport':
        setState({ phase: 'idle' })
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
  const statusText = searchStatusText(status, messages)
  const text = statusText === '' && state.phase === 'idle' && notice ? notice : statusText
  return (
    <form
      ref={formRef}
      role="search"
      className="map-panel map-search"
      onSubmit={search}
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
          onBlur={handleBlur}
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
      {/* Canlı bölge boşken de DOM'da kalır; yoksa ilk duyuru kaçabilir. Boşken yer kaplamaz. */}
      <p id={statusId} className="map-search__status" aria-live="polite">
        {text}
      </p>
      {expanded ? (
        <SearchResultsList
          id={listId}
          options={options}
          activeId={activeOption?.id ?? null}
          messages={messages}
          onChoose={choose}
        />
      ) : null}
    </form>
  )
}
