/**
 * MapLibre GL JS v6 WebGL2 ister. Destek bir kez, küçük bir tuvalde denetlenir; açılan bağlam
 * hemen bırakılır (tarayıcıların eşzamanlı WebGL bağlamı sınırı vardır).
 */

let supported: boolean | undefined

function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Tarayıcı WebGL2 destekliyor mu (sonuç sayfa boyunca saklanır). */
export function supportsWebGL2(): boolean {
  supported ??= detectWebGL2()
  return supported
}
