import apiClient from './client'

export const adminStatsApi = {
  overview: () => apiClient.get('/admin/stats/overview').then(r => r.data),
  topCourses: (limit = 10) => apiClient.get('/admin/stats/top-courses', { params: { limit } }).then(r => r.data),
  topDepartments: (limit = 10) => apiClient.get('/admin/stats/top-departments', { params: { limit } }).then(r => r.data),
  recentEnrollments: (limit = 20) => apiClient.get('/admin/stats/recent-enrollments', { params: { limit } }).then(r => r.data),
  departmentCompliance: () => apiClient.get('/admin/stats/department-compliance').then(r => r.data),
  courseFeedback: (minCount = 3) =>
    apiClient.get('/admin/stats/course-feedback', { params: { min_count: minCount } }).then(r => r.data),
  // Department-based browse: list all departments, then drill into one.
  departments: () =>
    apiClient.get('/admin/stats/departments').then((r) => r.data),
  departmentMembers: (name) =>
    apiClient
      .get(`/admin/stats/departments/${encodeURIComponent(name)}/members`)
      .then((r) => r.data),
  departmentCourses: (name) =>
    apiClient
      .get(`/admin/stats/departments/${encodeURIComponent(name)}/courses`)
      .then((r) => r.data),
  departmentCourseMembers: (name, courseId) =>
    apiClient
      .get(`/admin/stats/departments/${encodeURIComponent(name)}/courses/${courseId}/members`)
      .then((r) => r.data),
  // Built like departmentComplianceCsvUrl — direct browser navigation so the
  // auth cookie rides along automatically.
  departmentMembersCsvUrl: (name) => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/admin/stats/departments/${encodeURIComponent(name)}/members.csv`
  },
  // Built like certificatesApi.downloadUrl — same path the API client uses,
  // so the browser navigates directly and the auth cookie rides along.
  departmentComplianceCsvUrl: () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    const prefix = path.startsWith('/elearning') ? '/elearning/api' : '/api'
    return `${prefix}/admin/stats/department-compliance.csv`
  },
}
