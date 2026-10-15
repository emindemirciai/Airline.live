import { format, type Messages } from '@havayolu/i18n'
import { formatLiveLayerTime, type LiveLayerState } from '../../../lib/live-layer'

type Labels = Messages['admin']['liveLayer']

/**
 * Anahtarın durumu (metinle; renk yalnızca destektir) ve son değişiklik. `result`: az önce
 * yapılan değişikliğin sonuç satırı; yalnızca şimdiki durumla uyuşuyorsa gösterilir.
 */
export function LiveLayerStatus({
  layer,
  result,
  t,
}: {
  layer: LiveLayerState
  result: 'on' | 'off' | null
  t: Labels
}) {
  const current = layer.enabled ? 'on' : 'off'
  return (
    <div className="live-layer-status" data-state={current}>
      <p className="live-layer-state">
        <span>{t.state}: </span>
        <strong>{layer.enabled ? t.on : t.off}</strong>
      </p>
      <p className="hint">
        {layer.updatedAt !== null && layer.updatedBy !== null
          ? format(t.lastChange, {
              time: formatLiveLayerTime(layer.updatedAt),
              who: layer.updatedBy,
            })
          : t.neverChanged}
      </p>
      {result !== null && result === current ? (
        <p role="status" className="live-layer-result">
          {result === 'off' ? t.switchedOff : t.switchedOn}
        </p>
      ) : null}
    </div>
  )
}

/** "İşlem kaydı" tablosu: Zaman, Kim, İşlem, Neden (son 20, en yeni önce). */
export function LiveLayerLog({ actions, t }: { actions: LiveLayerState['actions']; t: Labels }) {
  if (actions.length === 0) return <p className="hint">{t.log.empty}</p>
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={t.log.caption}>
      <table className="table">
        <caption>{t.log.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.log.columns.at}</th>
            <th scope="col">{t.log.columns.actor}</th>
            <th scope="col">{t.log.columns.action}</th>
            <th scope="col">{t.log.columns.reason}</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action, index) => (
            <tr key={`${action.at}-${index}`}>
              <td className="mono">{formatLiveLayerTime(action.at)}</td>
              <td>{action.actor}</td>
              <td>{t.log.actions[action.action]}</td>
              <td>{action.reason ?? t.log.noReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
