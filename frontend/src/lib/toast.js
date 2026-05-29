import { toast as sonnerToast } from 'sonner'

/**
 * Backward-compatible toast shim. Existing call sites use `showToast(message, type)`.
 * New code should import `toast` from 'sonner' directly.
 */
export function showToast(message, type = 'success') {
  if (!message) return
  const variant = sonnerToast[type] ?? sonnerToast
  variant(message)
}

export { sonnerToast as toast }
