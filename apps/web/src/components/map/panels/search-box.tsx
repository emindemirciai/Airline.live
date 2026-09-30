'use client'

import type { Messages } from '@havayolu/i18n'
import type { PublicAircraft, SearchKind } from '@havayolu/shared'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
// Göreli yol: vitest `@/` takma adını çözmez (panel testleri bu dosyayı yükler).
import { ApiError, fetchSearch } from '../../../lib/live/api'
import { searchResultText } from './panel-format'

/** API'nin kabul ettiği en uzun sorgu (apps/api/src/live/routes.ts → SEARCH_QUERY_MAX_LENGTH). */
const QUERY_MAX_LENGTH = 32

type SearchState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'notFound'; kind: SearchKind }
  | { phase: 'pick'; results: PublicAircraft[] }
  | { phase: 'failed'; rateLimited: boolean }

export interface SearchBoxProps {
  apiBaseUrl: string
  messages: Messages['map']['search']
  onFound: (ac: PublicAircraft) => void
  /**
   * Arama yapılmamışken durum satırında gösterilen metin: paylaşılan bağlantıdaki (`/?hex=`) uçak
   * bulunamadıysa "bulunamadı" metni. Kullanıcı arama yapınca aramanın durumu gösterilir.
   */
  notice?: string | null
}

function statusText(state: SearchState, messages: Messages['map']['search']): string {
  switch (state.phase) {
    case 'idle':
      return ''
    case 'searching':
      return messages.searching
    case 'notFound':
      // Sefer no araması yalnızca rakamlı çağrı kodlarından eşleşir (domain.md → v1 sınırları).
      return state.kind === 'flight'
        ? `${messages.notFound} ${messages.flightNumberNote}`
        : messages.notFound
    case 'pick':
      return messages.pick
    case 'failed':
      return state.rateLimited ? messages.rateLimited : messages.error
  }
}

/**
 * Hesapsız canlı arama: sefer no, çağrı kodu, tescil ya da hex (`GET /v1/search`). Tek sonuç
 * doğrudan seçilir; birden fazlasında kullanıcı listeden seçer. Durum metni ekran okuyucuya
 * `aria-live="polite"` ile okunur.
 */
export function SearchBox({ apiBaseUrl, messages, onFound, notice = null }: SearchBoxProps) {
  const inputId = useId()
  const statusId = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ phase: 'idle' })
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => pending.current?.abort(), [])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    if (q === '') return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setState({ phase: 'searching' })
    try {
      const response = await fetchSearch(apiBaseUrl, q, controller.signal)
      if (controller.signal.aborted) return
      const [first, ...rest] = response.results
      if (!first) {
        setState({ phase: 'notFound', kind: response.kind })
      } else if (rest.length === 0) {
        setState({ phase: 'idle' })
        onFound(first)
      } else {
        setState({ phase: 'pick', results: response.results })
      }
    } catch (error) {
      // Yeni bir arama ya da bileşenin kaldırılması isteği iptal ettiyse sessiz kalınır.
      if (controller.signal.aborted) return
      setState({ phase: 'failed', rateLimited: error instanceof ApiError && error.status === 429 })
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }

  function pick(ac: PublicAircraft) {
    setState({ phase: 'idle' })
    onFound(ac)
  }

  function closeOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && state.phase === 'pick') setState({ phase: 'idle' })
  }

  const text = state.phase === 'idle' && notice ? notice : statusText(state, messages)
  return (
    <form
      role="search"
      className="map-panel map-search"
      onSubmit={search}
      onKeyDown={closeOnEscape}
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
          id={inputId}
          type="search"
          name="q"
          className="map-search__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
      {state.phase === 'pick' ? (
        <ul className="map-search__results" aria-label={messages.results}>
          {state.results.map((ac) => (
            <li key={ac.hex}>
              <button type="button" className="map-search__result" onClick={() => pick(ac)}>
                {searchResultText(ac)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
