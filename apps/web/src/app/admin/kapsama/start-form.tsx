'use client'

import { useActionState } from 'react'
import {
  startCoverageReportAction,
  type StartCoverageError,
  type StartCoverageState,
} from './actions'

export interface StartFormLabels {
  hours: string
  options: { value: number; label: string }[]
  submit: string
  pending: string
  note: string
  errors: Record<StartCoverageError, string>
}

/** "Raporu başlat" formu: pencere seçimi (izinli saatler) ve server action. */
export function StartCoverageForm({
  labels,
  defaultHours,
}: {
  labels: StartFormLabels
  defaultHours: number
}) {
  const [state, action, pending] = useActionState<StartCoverageState, FormData>(
    startCoverageReportAction,
    { error: null },
  )
  return (
    <form action={action} className="form coverage-form">
      <label className="field">
        <span>{labels.hours}</span>
        <select name="hours" defaultValue={String(defaultHours)}>
          {labels.options.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{labels.note}</p>
      {state.error ? (
        <p role="alert" className="form-error">
          {labels.errors[state.error]}
        </p>
      ) : null}
      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? labels.pending : labels.submit}
        </button>
      </div>
    </form>
  )
}
