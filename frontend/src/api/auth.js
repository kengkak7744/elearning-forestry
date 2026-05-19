import apiClient from './client'

export const authApi = {
  /** เข้าสู่ระบบด้วย username หรือ email */
  login: async (identifier, password) => {
    const response = await apiClient.post('/auth/login', {
      identifier,
      password,
    })
    return response.data
  },

  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData)
    return response.data
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('access_token')
  },
}