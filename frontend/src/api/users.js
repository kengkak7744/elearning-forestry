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

  /** ระงับบัญชี (admin) */
  deactivate: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`)
    return response.data
  },
}