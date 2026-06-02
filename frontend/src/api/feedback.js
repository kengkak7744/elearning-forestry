import apiClient from './client'

export const feedbackApi = {
  // Public-ish: aggregate stars + count + distribution for a course. Visible to
  // anyone who can view the course (enrolment not required).
  summary: (courseId) =>
    apiClient.get(`/courses/${courseId}/feedback/summary`).then((r) => r.data),

  // My feedback for this course (if I've left one) plus whether I'm currently
  // allowed to submit — the client uses `can_submit` to decide whether to
  // even show the submission form.
  mine: (courseId) =>
    apiClient.get(`/courses/${courseId}/feedback/me`).then((r) => r.data),

  // Upsert. Backend returns 400 with a Thai reason if the course isn't fully
  // completed yet.
  submit: (courseId, { rating, comment }) =>
    apiClient
      .post(`/courses/${courseId}/feedback`, { rating, comment })
      .then((r) => r.data),

  // Admin/instructor only: full list with author info.
  list: (courseId, { skip = 0, limit = 50 } = {}) =>
    apiClient
      .get(`/courses/${courseId}/feedback`, { params: { skip, limit } })
      .then((r) => r.data),
}
