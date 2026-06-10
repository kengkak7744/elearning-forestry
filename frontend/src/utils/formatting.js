/**
 * Shared display formatters. These replace per-page copies that had drifted
 * slightly — the options preserve each page's original rendering exactly.
 */

export function formatThaiDate(iso, { month = 'long', fallback = '-' } = {}) {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month,
    year: 'numeric',
  })
}

export function fmtTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}วิ`
}

export function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
