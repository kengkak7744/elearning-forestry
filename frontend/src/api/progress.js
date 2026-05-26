import client from './client'

export const progressApi = {
  update: (data) => client.post('/progress/', data).then(r => r.data),
  getByCourse: (courseId) => client.get(`/progress/course/${courseId}`).then(r => r.data),
}