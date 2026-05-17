import apiClient from './client'

export const authApi = {
  /** เข้าสู่ระบบ — ใช้ identifier (employee_id หรือ email) */
  login: async (identifier, password) => {
    const response = await apiClient.post('/auth/login', {
      identifier,
      password,
    })
    return response.data
  },

  /** สมัครสมาชิกสำหรับบุคคลทั่วไป */
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData)
    return response.data
  },

  /** ดึงข้อมูลผู้ใช้ปัจจุบัน */
  getMe: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  /** เปลี่ยนรหัสผ่าน */
  changePassword: async (currentPassword, newPassword) => {
    const response = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  },

  /** ออกจากระบบ */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (e) {
      // ไม่สนใจ error ตอน logout
    }
    localStorage.removeItem('access_token')
  },
}