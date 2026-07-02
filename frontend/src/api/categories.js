import apiClient from './client'

export const categoriesApi = {
  /** All categories with usage counts: [{ id, value, label, course_count }]. */
  list: async () => {
    const response = await apiClient.get('/categories')
    return Array.isArray(response.data) ? response.data : []
  },

  /** Add a category (instructor/admin). */
  create: async (label) => {
    const response = await apiClient.post('/categories', { label })
    return response.data
  },

  /** Remove a category (instructor/admin). Rejected while courses still use it. */
  remove: async (categoryId) => {
    const response = await apiClient.delete(`/categories/${categoryId}`)
    return response.data
  },
}
