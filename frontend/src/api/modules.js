import apiClient from './client'

export const modulesApi = {
  create: async (data) => {
    const response = await apiClient.post('/modules', data)
    return response.data
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/modules/${id}`, data)
    return response.data
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/modules/${id}`)
    return response.data
  },
}