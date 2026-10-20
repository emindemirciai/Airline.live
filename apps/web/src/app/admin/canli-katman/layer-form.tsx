'use client'

import { useActionState } from 'react'
import { LIVE_LAYER_REASON_MAX } from '../../../lib/live-layer'
import { setLiveLayerAction, type LiveLayerFormError, type LiveLayerFormState } from './actions'

export interface LiveLayerFormLabels {
  reason: string
  reasonHint: string
  turnOff: string
  turnOn: string
  pending: string
  errors: Record<LiveLayerFormError, string>
}

/**
 * Tek düğmeli anahtar formu: gizli `enabled` alanı şimdiki durumun tersidir. Açıkken düğme
 * "Canlı katmanı kapat" (tehlike rengi), kapalıyken "Canlı katmanı aç" yazar; telefonda tam
 * genişliktedir.
 */
export function LiveLayerForm({
  enabled,
  labels,
}: {
  enabled: boolean
  labels: LiveLayerFormLabels
}) {
  const [state, action, pending] = useActionState<LiveLayerFormState, FormData>(
    setLiveLayerAction,
    { error: null },
  )
  return (
    <form action={action} className="form live-layer-form">
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <label className="field">
        <span>{labels.reason}</span>
        <textarea name="reason" maxLength={LIVE_LAYER_REASON_MAX} rows={3} />
      </label>
      <p className="hint">{labels.reasonHint}</p>
      {state.error ? (
        <p role="alert" className="form-error">
          {labels.errors[state.error]}
        </p>
      ) : null}
      <button
        type="submit"
        className={enabled ? 'button button-danger live-layer-button' : 'button live-layer-button'}
        disabled={pending}
      >
        {pending ? labels.pending : enabled ? labels.turnOff : labels.turnOn}
      </button>
    </form>
  )
}
