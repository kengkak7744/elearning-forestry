import { showToast } from '@/lib/toast'

/**
 * Pull the backend's Thai error detail out of an axios error, falling back to
 * the caller-supplied message. Each call site keeps its own fallback string.
 *
 * Handles the three shapes the API can return:
 *  - HTTPException → { detail: "ข้อความ" } (a plain string)
 *  - 422 validation → { detail: [{ loc, msg, type }, ...] } (an array)
 *  - network error / proxy 413 → no response body at all
 * Without this, the array shape used to reach the toast as "[object Object]".
 */
export function getApiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail) && detail.length) {
    const msg = detail
      .map((d) => (typeof d === 'string' ? d : d?.msg))
      .filter(Boolean)
      .join(', ')
    if (msg) return msg
  }

  return fallback
}

export function toastApiError(err, fallback) {
  showToast(getApiErrorMessage(err, fallback), 'error')
}
