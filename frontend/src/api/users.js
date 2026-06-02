import apiClient from './client'

export const usersApi = {
  /** รายการผู้ใช้ทั้งหมด (admin) */
  list: async ({ skip = 0, limit = 50, search, role } = {}) => {
    const params = { skip, limit }
    if (search) params.search = search
    if (role) params.role = role
    
    const response = await apiClient.get('/users', { params })
    return response.data
  },

  /** ข้อมูลผู้ใช้ตาม id */
  getById: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data
  },

  /** สร้างผู้ใช้ใหม่ (admin) */
  create: async (userData) => {
    const response = await apiClient.post('/users', userData)
    return response.data
  },

  /** แก้ไขผู้ใช้ (admin) */
  update: async (userId, userData) => {
    const response = await apiClient.put(`/users/${userId}`, userData)
    return response.data
  },

  /** ลบบัญชีผู้ใช้ถาวร (admin) — ลบประวัติการเรียน, ใบรับรอง, การลงทะเบียนทั้งหมด */
  delete: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`)
    return response.data
  },

  /** สรุปการเรียนของผู้ใช้ (admin) — enrollments, certificates, quiz stats */
  getLearningSummary: async (userId) => {
    const response = await apiClient.get(`/users/${userId}/learning-summary`)
    return response.data
  },

  /** รีเซ็ตรหัสผ่านผู้ใช้ (admin) */
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