import apiClient, { apiPathPrefix } from './client'

export const certSettingsApi = {
  get: () => apiClient.get('/admin/cert-settings').then((r) => r.data),
  update: (payload) =>
    apiClient.put('/admin/cert-settings', payload).then((r) => r.data),
  // Upload a PNG signature scan for 'left' or 'right'. The apiClient defaults
  // to Content-Type: application/json, and axios JSON-serialises a FormData
  // body under that header (→ backend 422). Set 'multipart/form-data' so axios
  // passes the FormData through; the browser then fills in the real boundary.
  uploadSignature: (side, file) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post(`/admin/cert-settings/upload-signature/${side}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  deleteSignature: (side) =>
    apiClient
      .delete(`/admin/cert-settings/signature/${side}`)
      .then((r) => r.data),
  // Direct URL the browser navigates to — auth cookie rides along, PDF
  // opens in a new tab. Same pattern as departmentMembersCsvUrl.
  previewUrl: () => `${apiPathPrefix()}/admin/cert-settings/preview`,
}
