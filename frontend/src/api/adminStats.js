import apiClient from './client'

export const adminStatsApi = {
  overview: () => apiClient.get('/admin/stats/overview').then(r => r.data),
  topCourses: (limit = 10) => apiClient.get('/admin/stats/top-courses', { params: { limit } }).then(r => r.data),
  topDepartments: (limit = 10) => apiClient.get('/admin/stats/top-departments', { params: { limit } }).then(r => r.data),
  recentEnrollments: (limit = 20) => apiClient.get('/admin/stats/recent-enrollments', { params: { limit } }).then(r => r.data),
  departmentCompliance: () => apiClient.get('/admin/stats/department-compliance').then(r => r.data),
  courseFeedback: (minCount = 3) =>
    apiClient.get('/admin/stats/course-feedback', { params: { min_count: minCount } }).then(r => r.data),
  // Built like certificatesApi.downloadUrl — same path the API client uses,
  // so the browser navigates directly and the auth cookie rides along.
  departmentComplianceCsvUrl: () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/admin/stats/department-compliance.csv`
  },
}
