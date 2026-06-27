import apiClient from './client'

export const authApi = {
  /** Log in with a username or email. */
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

  session: async () => {
    const response = await apiClient.get('/auth/session')
    return response.data
  },

  updateMe: async (userData) => {
    const response = await apiClient.patch('/auth/me', userData)
    return response.data
  },

  // Upload/replace my profile picture. Must set multipart/form-data explicitly —
  // the apiClient defaults to application/json, under which axios would
  // JSON-serialise the FormData (→ backend 422). Returns the updated user.
  uploadAvatar: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Remove my profile picture (back to the initials avatar). Returns updated user.
  deleteAvatar: async () => {
    const response = await apiClient.delete('/auth/me/avatar')
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
    } catch {
      // ignore
    }
    localStorage.removeItem('access_token')
  },
}
