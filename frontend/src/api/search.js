import apiClient from './client'

export const searchApi = {
  /** Lesson-level full-text search across title, description, notes, module name. */
  lessons: async (q, { limit = 20 } = {}) => {
    if (!q || q.trim().length < 2) return { query: q, count: 0, lessons: [] }
    const response = await apiClient.get('/search/lessons', {
      params: { q: q.trim(), limit },
    })
    return response.data
  },
}
