// Build URLs to backend-served media (video/pdf/image).
//
// Auth is now via the httpOnly `access_token` cookie set at login, which the
// browser automatically sends on every same-site request (including media tags).
// No token is appended to the URL — keeps it out of access logs and history.

export function mediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url // external (e.g., YouTube) — return as-is
  return url.startsWith('/elearning') ? url : `/elearning${url}`
}
