import apiClient from './client'

export const certSettingsApi = {
  get: () => apiClient.get('/admin/cert-settings').then((r) => r.data),
  update: (payload) =>
    apiClient.put('/admin/cert-settings', payload).then((r) => r.data),
}
