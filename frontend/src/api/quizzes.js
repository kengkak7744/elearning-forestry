import client from './client'

export const quizzesApi = {
  // Learner-safe — answer keys stripped
  getByLesson: async (lessonId) => {
    const response = await client.get(`/quizzes/lesson/${lessonId}`)
    return response.data
  },

  getFinal: async (courseId) => {
    const response = await client.get(`/quizzes/course/${courseId}/final`)
    return response.data
  },

  getCourseAll: async (courseId) => {
    const response = await client.get(`/quizzes/course/${courseId}/all`)
    return response.data
  },

  // Admin/instructor — full data with answers, for QuizEditor
  getByLessonAdmin: async (lessonId) => {
    const response = await client.get(`/quizzes/admin/lesson/${lessonId}`)
    return response.data
  },

  getFinalAdmin: async (courseId) => {
    const response = await client.get(`/quizzes/admin/course/${courseId}/final`)
    return response.data
  },

  getStats: async (quizId) => {
    const response = await client.get(`/quizzes/admin/${quizId}/stats`)
    return response.data
  },

  getCourseStats: async (courseId) => {
    const response = await client.get(`/quizzes/admin/course/${courseId}/stats`)
    return response.data
  },

  create: async (data) => {
    const response = await client.post('/quizzes/', data)
    return response.data
  },

  update: async (id, data) => {
    const response = await client.patch(`/quizzes/${id}`, data)
    return response.data
  },

  delete: async (id) => {
    const response = await client.delete(`/quizzes/${id}`)
    return response.data
  },

  submit: async (quizId, answers, questionIds, questionSetToken) => {
    const response = await client.post(`/quizzes/${quizId}/submit`, {
      answers,
      question_ids: questionIds,
      question_set_token: questionSetToken,
    })
    return response.data
  },

  // Questions
  addQuestion: async (quizId, data) => {
    const response = await client.post(`/quizzes/${quizId}/questions`, data)
    return response.data
  },

  addQuestionsBulk: async (quizId, questions) => {
    const response = await client.post(`/quizzes/${quizId}/questions/bulk`, {
      questions,
    })
    return response.data
  },

  updateQuestion: async (questionId, data) => {
    const response = await client.patch(`/quizzes/questions/${questionId}`, data)
    return response.data
  },

  deleteQuestion: async (questionId) => {
    const response = await client.delete(`/quizzes/questions/${questionId}`)
    return response.data
  },
}
