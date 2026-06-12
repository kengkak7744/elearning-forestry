import { useEffect, useMemo, useState } from 'react'
import { coursesApi } from '@/api/courses'
import { progressApi } from '@/api/progress'
import { quizzesApi } from '@/api/quizzes'
import { toastApiError } from '@/utils/apiError'

/**
 * Loads a course + its progress map + quizzes, and derives the structures the
 * viewer needs: the flattened lesson list, the per-lesson quiz map, the final
 * quiz, module unlock state, and lesson counts. Owns the progress map (and its
 * setter) so the playback hook can keep it in sync as it saves.
 */
export default function useCourseViewerData(id) {
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [progress, setProgress] = useState({})
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [quizzes, setQuizzes] = useState([])

  const loadCourse = async () => {
    setLoading(true)
    setLoadError(false)
    setProgressLoaded(false)
    try {
      const data = await coursesApi.getById(id)
      setCourse(data)
      try {
        const progressList = await progressApi.getByCourse(id)
        const progressMap = {}
        progressList.forEach((p) => {
          progressMap[p.lesson_id] = p
        })
        setProgress(progressMap)
      } catch {}
      setProgressLoaded(true)
      try {
        const quizList = await quizzesApi.getCourseAll(id)
        setQuizzes(quizList)
      } catch {
        setQuizzes([])
      }
    } catch (err) {
      setLoadError(true)
      toastApiError(err, 'โหลดหลักสูตรไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const refreshQuizzes = async () => {
    try {
      const quizList = await quizzesApi.getCourseAll(id)
      setQuizzes(quizList)
    } catch {}
  }

  const allLessons = useMemo(
    () => (course ? course.modules.flatMap((m) => m.lessons) : []),
    [course]
  )

  const lessonQuizzes = useMemo(() => {
    const map = {}
    quizzes.forEach((q) => {
      if (q.lesson_id) {
        if (!map[q.lesson_id]) map[q.lesson_id] = []
        map[q.lesson_id].push(q)
      }
    })
    return map
  }, [quizzes])

  const finalQuiz = useMemo(
    () => quizzes.find((q) => q.placement === 'final' && q.course_id) || null,
    [quizzes]
  )

  const isModuleCleared = (module) => {
    const moduleQuizIds = module.lessons.flatMap((l) => lessonQuizzes[l.id] || [])
    const blocking = moduleQuizIds.filter((q) => !q.can_skip && q.questions.length > 0)
    return blocking.every((q) => q.is_passed)
  }

  const unlockedModuleIds = useMemo(() => {
    if (!course) return new Set()
    const set = new Set()
    for (let i = 0; i < course.modules.length; i++) {
      if (i === 0) {
        set.add(course.modules[i].id)
        continue
      }
      const prev = course.modules[i - 1]
      if (isModuleCleared(prev) && set.has(prev.id)) {
        set.add(course.modules[i].id)
      } else {
        break
      }
    }
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, quizzes])

  const allModulesCleared =
    course &&
    course.modules.length > 0 &&
    course.modules.every((m) => isModuleCleared(m))

  const totalLessons = allLessons.length
  const completedLessons = useMemo(
    () => Object.values(progress).filter((p) => p?.is_completed).length,
    [progress]
  )

  return {
    course,
    loading,
    loadError,
    reload: loadCourse,
    progress,
    setProgress,
    progressLoaded,
    quizzes,
    refreshQuizzes,
    allLessons,
    lessonQuizzes,
    finalQuiz,
    isModuleCleared,
    unlockedModuleIds,
    allModulesCleared,
    totalLessons,
    completedLessons,
  }
}
