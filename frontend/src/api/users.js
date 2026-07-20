import apiClient from './client'

export const usersApi = {
  /** List all users (admin). */
  list: async ({ skip = 0, limit = 50, search, role } = {}) => {
    const params = { skip, limit }
    if (search) params.search = search
    if (role) params.role = role
    
    const response = await apiClient.get('/users', { params })
    return response.data
  },

  /** Get a user by id (admin). */
  getById: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data
  },

  /** Create a new user (admin). */
  create: async (userData) => {
    const response = await apiClient.post('/users', userData)
    return response.data
  },

  /** Update a user (admin). */
  update: async (userId, userData) => {
    const response = await apiClient.put(`/users/${userId}`, userData)
    return response.data
  },

  /** Permanently delete a user account (admin) — removes all learning history, certificates, and enrollments. */
  delete: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`)
    return response.data
  },

  /** A user's learning summary (admin) — enrollments, certificates, quiz stats. */
  getLearningSummary: async (userId) => {
    const response = await apiClient.get(`/users/${userId}/learning-summary`)
    return response.data
  },

  /** Detailed progress and quiz results for one enrolled course (admin/manager). */
  getCourseLearningDetail: async (userId, courseId) => {
    const response = await apiClient.get(
      `/users/${userId}/courses/${courseId}/learning-detail`
    )
    return response.data
  },

  /** Reset a user's password (admin). */
  resetPassword: async (userId, newPassword) => {
    const response = await apiClient.post(`/users/${userId}/reset-password`, {
      new_password: newPassword,
    })
    return response.data
  },

  /**
   * Bulk CSV import (admin). Returns
   * `{ created_count, skipped_count, error_count, created, skipped, errors }`.
   * `created[i].generated_password` is plaintext (returned once, not stored) —
   * the admin needs to hand it to the new user.
   */
  bulkImport: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post('/users/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}
