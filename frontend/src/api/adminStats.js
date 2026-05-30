import apiClient from './client'

export const adminStatsApi = {
  overview: () => apiClient.get('/admin/stats/overview').then(r => r.data),
  topCourses: (limit = 10) => apiClient.get('/admin/stats/top-courses', { params: { limit } }).then(r => r.data),
  topDepartments: (limit = 10) => apiClient.get('/admin/stats/top-departments', { params: { limit } }).then(r => r.data),
  recentEnrollments: (limit = 20) => apiClient.get('/admin/stats/recent-enrollments', { params: { limit } }).then(r => r.data),
  departmentCompliance: () => apiClient.get('/admin/stats/department-compliance').then(r => r.data),
}
