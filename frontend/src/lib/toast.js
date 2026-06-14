export const TOAST_EVENT = 'elearning:toast'

/**
 * Backward-compatible toast shim. Existing call sites use `showToast(message, type)`.
 * Sonner is loaded on demand so the login shell does not preload the toast
 * library before the user actually triggers feedback.
 */
export function showToast(message, type = 'success') {
  if (!message) return
  // Guard against non-string payloads (e.g. an API error object) reaching
  // sonner and rendering as "[object Object]".
  const text = typeof message === 'string' ? message : String(message)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { message: text, type },
      })
    )
  }
}
