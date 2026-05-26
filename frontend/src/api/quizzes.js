import client from './client'

export const quizzesApi = {
  getByLesson: (lessonId) => client.get(`/quizzes/lesson/${lessonId}`).then(r => r.data),
  getFinal: (courseId) => client.get(`/quizzes/course/${courseId}/final`).then(r => r.data),
  getCourseAll: (courseId) => client.get(`/quizzes/course/${courseId}/all`).then(r => r.data),
  create: (data) => client.post('/quizzes/', data).then(r => r.data),
  update: (id, data) => client.patch(`/quizzes/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/quizzes/${id}`).then(r => r.data),
  submit: (quizId, answers) => client.post(`/quizzes/${quizId}/submit`, { answers }).then(r => r.data),
  
  // Questions
  addQuestion: (quizId, data) => client.post(`/quizzes/${quizId}/questions`, data).then(r => r.data),
  updateQuestion: (questionId, data) => client.patch(`/quizzes/questions/${questionId}`, data).then(r => r.data),
  deleteQuestion: (questionId) => client.delete(`/quizzes/questions/${questionId}`).then(r => r.data),
}