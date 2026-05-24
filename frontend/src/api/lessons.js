import apiClient from './client'

export const lessonsApi = {
  create: async (data) => {
    const response = await apiClient.post('/lessons', data)
    return response.data
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/lessons/${id}`, data)
    return response.data
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/lessons/${id}`)
    return response.data
  },
  uploadVideo: async (lessonId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/lessons/${lessonId}/upload-video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },
  uploadPdf: async (lessonId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/lessons/${lessonId}/upload-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },
}