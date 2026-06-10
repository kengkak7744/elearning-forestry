import { showToast } from '@/lib/toast'

/**
 * Pull the backend's Thai error detail out of an axios error, falling back to
 * the caller-supplied message. Each call site keeps its own fallback string.
 */
export function getApiErrorMessage(err, fallback) {
  return err?.response?.data?.detail || fallback
}

export function toastApiError(err, fallback) {
  showToast(getApiErrorMessage(err, fallback), 'error')
}
