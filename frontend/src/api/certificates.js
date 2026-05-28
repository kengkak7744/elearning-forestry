import client from './client'

export const certificatesApi = {
  eligibility: (courseId) =>
    client.get(`/certificates/course/${courseId}/eligibility`).then((r) => r.data),
  issue: (courseId) =>
    client.post(`/certificates/course/${courseId}/issue`).then((r) => r.data),
  mine: () => client.get('/certificates/me').then((r) => r.data),
  adminAll: () => client.get('/certificates/admin/all').then((r) => r.data),
  // Returns the full URL the browser can open (auth cookie is sent automatically)
  downloadUrl: (certId) => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/certificates/${certId}/download`
  },
}
