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
  // Upload one PDF and auto-split it into multiple lessons by its table of
  // contents (bookmarks). Appends the created lessons to the given module.
  // Returns { created_count, lessons: [...] }.
  splitPdf: async (moduleId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/lessons/module/${moduleId}/split-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },

  // === Supplementary resources (downloads / external links) ===
  listResources: async (lessonId) => {
    const response = await apiClient.get(`/lessons/${lessonId}/resources`)
    return Array.isArray(response.data) ? response.data : []
  },
  addResource: async (lessonId, { title, url, resource_type, file_size }) => {
    const response = await apiClient.post(`/lessons/${lessonId}/resources`, {
      title,
      url,
      resource_type: resource_type || null,
      file_size: file_size ?? null,
    })
    return response.data
  },
  deleteResource: async (resourceId) => {
    const response = await apiClient.delete(`/lessons/resources/${resourceId}`)
    return response.data
  },

  // === Personal notes (per-user, per-lesson, upsert) ===
  getMyNote: async (lessonId) => {
    const response = await apiClient.get(`/lessons/${lessonId}/notes/me`)
    return response.data // { content, updated_at }
  },
  saveMyNote: async (lessonId, content) => {
    const response = await apiClient.put(`/lessons/${lessonId}/notes/me`, {
      content,
    })
    return response.data
  },
}