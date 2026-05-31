import apiClient from './client'

export const coursesApi = {
  /** รายการหลักสูตรทั้งหมด */
  list: async ({ skip = 0, limit = 50, category, is_mandatory, search } = {}) => {
    const params = { skip, limit }
    if (category) params.category = category
    if (is_mandatory !== undefined) params.is_mandatory = is_mandatory
    if (search) params.search = search

    const response = await apiClient.get('/courses', { params })
    return Array.isArray(response.data) ? response.data : []
  },

  /** รายละเอียดหลักสูตร */
  getById: async (courseId) => {
    const response = await apiClient.get(`/courses/${courseId}`)
    return response.data
  },

  /** สร้างหลักสูตรใหม่ (instructor/admin) */
  create: async (courseData) => {
    const response = await apiClient.post('/courses', courseData)
    return response.data
  },

  /** แก้ไขหลักสูตร */
  update: async (courseId, courseData) => {
    const response = await apiClient.put(`/courses/${courseId}`, courseData)
    return response.data
  },

  /** ลบหลักสูตร */
  delete: async (courseId) => {
    const response = await apiClient.delete(`/courses/${courseId}`)
    return response.data
  },

  /** หลักสูตรของฉัน + ความคืบหน้า */
  myEnrollments: async () => {
    const response = await apiClient.get('/courses/me/enrollments')
    // Always hand callers an array. A proxy returning HTML, a stale cached
    // 304 with the wrong body, or any non-array success body would otherwise
    // crash every consumer that does `.filter`/`.map` on it.
    return Array.isArray(response.data) ? response.data : []
  },

  /** อัปโหลดรูปภาพปกหลักสูตร */
  uploadCoverImage: async (courseId, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(`/courses/${courseId}/upload-cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    return response.data
  },

  // การลงทะเบียนเรียนหลักสูตร
  enroll: async (courseId) => {
    const response = await apiClient.post(`/courses/${courseId}/enroll`)
    return response.data
  },

  // การยกเลิกการลงทะเบียนเรียนหลักสูตร
  unenroll: async (courseId) => {
    const response = await apiClient.delete(`/courses/${courseId}/enroll`)
    return response.data
  },

  // ===== Bookmarks (save-for-later) =====
  myBookmarks: async () => {
    const response = await apiClient.get('/courses/me/bookmarks')
    return Array.isArray(response.data) ? response.data : []
  },
  bookmark: async (courseId) => {
    const response = await apiClient.post(`/courses/${courseId}/bookmark`)
    return response.data
  },
  unbookmark: async (courseId) => {
    const response = await apiClient.delete(`/courses/${courseId}/bookmark`)
    return response.data
  },
}