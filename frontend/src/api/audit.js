import apiClient from './client'

export const auditApi = {
  list: async ({ skip = 0, limit = 50, action, target_type, actor_id } = {}) => {
    const params = { skip, limit }
    if (action) params.action = action
    if (target_type) params.target_type = target_type
    if (actor_id) params.actor_id = actor_id
    const response = await apiClient.get('/admin/audit-logs', { params })
    return Array.isArray(response.data) ? response.data : []
  },
  actions: async () => {
    const response = await apiClient.get('/admin/audit-logs/actions')
    return response.data?.actions ?? []
  },
}
