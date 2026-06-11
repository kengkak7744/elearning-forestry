import { toast as sonnerToast } from 'sonner'

/**
 * Backward-compatible toast shim. Existing call sites use `showToast(message, type)`.
 * New code should import `toast` from 'sonner' directly.
 */
export function showToast(message, type = 'success') {
  if (!message) return
  // Guard against non-string payloads (e.g. an API error object) reaching
  // sonner and rendering as "[object Object]".
  const text = typeof message === 'string' ? message : String(message)
  const variant = sonnerToast[type] ?? sonnerToast
  variant(text)
}

export { sonnerToast as toast }
