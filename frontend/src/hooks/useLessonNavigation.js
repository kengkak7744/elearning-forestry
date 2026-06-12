import { useMemo } from 'react'

/**
 * Computes the current lesson's position within the course and the prev/next
 * destinations (lesson → lesson → final quiz). Pure derivation from the course
 * shape — moved verbatim from CourseViewerPage.
 */
export default function useLessonNavigation({ course, currentLesson, viewingFinal, finalQuiz }) {
  const currentPos = useMemo(() => {
    if (!course || !currentLesson) return null
    for (let mi = 0; mi < course.modules.length; mi++) {
      const m = course.modules[mi]
      for (let li = 0; li < m.lessons.length; li++) {
        if (m.lessons[li].id === currentLesson.id) return { mi, li, m }
      }
    }
    return null
  }, [course, currentLesson])

  const nextDest = useMemo(() => {
    if (viewingFinal) return null
    if (!currentPos) return null
    const { mi, li, m } = currentPos
    if (li + 1 < m.lessons.length)
      return { type: 'lesson', lesson: m.lessons[li + 1], moduleId: m.id }
    for (let i = mi + 1; i < course.modules.length; i++) {
      if (course.modules[i].lessons.length > 0) {
        return {
          type: 'lesson',
          lesson: course.modules[i].lessons[0],
          moduleId: course.modules[i].id,
        }
      }
    }
    if (finalQuiz) return { type: 'final' }
    return null
  }, [course, currentPos, viewingFinal, finalQuiz])

  const prevDest = useMemo(() => {
    if (!course) return null
    if (viewingFinal) {
      for (let i = course.modules.length - 1; i >= 0; i--) {
        const m = course.modules[i]
        if (m.lessons.length > 0)
          return {
            type: 'lesson',
            lesson: m.lessons[m.lessons.length - 1],
            moduleId: m.id,
          }
      }
      return null
    }
    if (!currentPos) return null
    const { mi, li, m } = currentPos
    if (li > 0) return { type: 'lesson', lesson: m.lessons[li - 1], moduleId: m.id }
    for (let i = mi - 1; i >= 0; i--) {
      if (course.modules[i].lessons.length > 0) {
        const prev = course.modules[i]
        return {
          type: 'lesson',
          lesson: prev.lessons[prev.lessons.length - 1],
          moduleId: prev.id,
        }
      }
    }
    return null
  }, [course, currentPos, viewingFinal])

  return { currentPos, nextDest, prevDest }
}
