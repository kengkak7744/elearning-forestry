import apiClient from './client'

export const certSettingsApi = {
  get: () => apiClient.get('/admin/cert-settings').then((r) => r.data),
  update: (payload) =>
    apiClient.put('/admin/cert-settings', payload).then((r) => r.data),
  // Upload a PNG signature scan for 'left' or 'right'. Browser sets the
  // multipart/form-data boundary automatically — don't set Content-Type
  // manually or the boundary param goes missing and the backend rejects it.
  uploadSignature: (side, file) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post(`/admin/cert-settings/upload-signature/${side}`, form)
      .then((r) => r.data)
  },
  deleteSignature: (side) =>
    apiClient
      .delete(`/admin/cert-settings/signature/${side}`)
      .then((r) => r.data),
  // Direct URL the browser navigates to — auth cookie rides along, PDF
  // opens in a new tab. Same pattern as departmentMembersCsvUrl.
  previewUrl: () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/admin/cert-settings/preview`
  },
}
