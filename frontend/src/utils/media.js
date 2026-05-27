// Helper for building URLs to backend-served media (video/pdf/image).
//
// Browsers don't attach Authorization headers to <video src>, <iframe src>, or
// <img src>, so we pass the JWT via a ?t= query param. The backend
// require_media_token dependency accepts it.
//
// Caveats: token appears in URL → may be logged in server access logs and
// browser history. Mitigated by short JWT expiry. Don't share these URLs.

export function mediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url // external (e.g., YouTube) — return as-is

  const normalized = url.startsWith('/elearning') ? url : `/elearning${url}`

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null
  if (!token) return normalized

  const sep = normalized.includes('?') ? '&' : '?'
  return `${normalized}${sep}t=${encodeURIComponent(token)}`
}
