import client from './client'

export const certificatesApi = {
  eligibility: (courseId) =>
    client.get(`/certificates/course/${courseId}/eligibility`).then((r) => r.data),
  issue: (courseId) =>
    client.post(`/certificates/course/${courseId}/issue`).then((r) => r.data),
  mine: () => client.get('/certificates/me').then((r) => r.data),
  adminAll: () => client.get('/certificates/admin/all').then((r) => r.data),
  // Public — no auth, rate-limited server-side. Returns
  // { status: 'valid' | 'expired' | 'revoked' | 'not_found', ... }
  verify: (certNumber) =>
    client.get(`/certificates/verify/${encodeURIComponent(certNumber)}`).then((r) => r.data),
  // Admin actions — invalidate or restore a cert without deleting it.
  revoke: (certId, reason) =>
    client.post(`/certificates/${certId}/revoke`, { reason }).then((r) => r.data),
  unrevoke: (certId) =>
    client.post(`/certificates/${certId}/unrevoke`).then((r) => r.data),
  // Returns the full URL the browser can open (auth cookie is sent automatically)
  downloadUrl: (certId) => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/certificates/${certId}/download`
  },
}
