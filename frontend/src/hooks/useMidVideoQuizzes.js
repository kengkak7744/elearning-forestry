import { useEffect, useRef, useState } from 'react'
import { showToast } from '@/lib/toast'

/**
 * Mid-video quiz orchestration: tracks which quizzes already fired for the
 * current lesson, finds the next due quiz for a playhead position, and
 * handles the failed-quiz rewind flow. Also schedules wall-clock triggers for
 * PDF lessons (no playhead to poll).
 *
 * The page supplies media control callbacks:
 * - onPause()/onResume(): pause/play whichever player is active
 * - onSeek(seconds): seek the active player and resume playback
 */
export default function useMidVideoQuizzes({
  currentLesson,
  lessonQuizzes,
  quizzesLoaded,
  onPause,
  onResume,
  onSeek,
}) {
  const [activeMidQuiz, setActiveMidQuiz] = useState(null)
  const [triggeredQuizIds, setTriggeredQuizIds] = useState(new Set())

  // Refs keep the latest values visible to interval/timeout callbacks.
  const currentLessonRef = useRef(currentLesson)
  const lessonQuizzesRef = useRef(lessonQuizzes)
  const triggeredQuizIdsRef = useRef(triggeredQuizIds)
  useEffect(() => {
    currentLessonRef.current = currentLesson
  }, [currentLesson])
  useEffect(() => {
    lessonQuizzesRef.current = lessonQuizzes
  }, [lessonQuizzes])
  useEffect(() => {
    triggeredQuizIdsRef.current = triggeredQuizIds
  }, [triggeredQuizIds])

  const findDueMidQuiz = (currentTime) => {
    const cl = currentLessonRef.current
    if (!cl) return null
    const mids = (lessonQuizzesRef.current[cl.id] || []).filter(
      (q) =>
        q.placement === 'mid_video' &&
        q.trigger_time != null &&
        q.questions.length > 0
    )
    return (
      mids.find(
        (q) =>
          currentTime >= q.trigger_time && !triggeredQuizIdsRef.current.has(q.id)
      ) || null
    )
  }

  const triggerMidQuiz = (quiz) => {
    setTriggeredQuizIds((prev) => new Set([...prev, quiz.id]))
    setActiveMidQuiz(quiz)
    onPause()
  }

  const closeMidQuiz = () => {
    setActiveMidQuiz(null)
    onResume()
  }

  /**
   * Failed-mid-quiz rewind: when a learner fails a mid-video quiz, the
   * "ย้อนไปดูใหม่" button in the modal calls this. We seek the video
   * back to the previous mid-video quiz's trigger_time (or 0 if this is
   * the first one) so they can re-watch the section that led up to the
   * question. The failed quiz is removed from triggeredQuizIds so it
   * re-triggers when the playhead reaches its trigger_time again.
   */
  const rewindMidQuiz = (quiz) => {
    const cl = currentLessonRef.current
    if (!cl || !quiz) return
    const mids = (lessonQuizzesRef.current[cl.id] || [])
      .filter((q) => q.placement === 'mid_video' && q.trigger_time != null)
      .sort((a, b) => a.trigger_time - b.trigger_time)
    const idx = mids.findIndex((q) => q.id === quiz.id)
    const rewindTo = idx > 0 ? mids[idx - 1].trigger_time : 0

    setTriggeredQuizIds((prev) => {
      const next = new Set(prev)
      next.delete(quiz.id)
      return next
    })
    setActiveMidQuiz(null)

    onSeek(rewindTo)

    const mm = Math.floor(rewindTo / 60)
    const ss = rewindTo % 60
    showToast(
      `ย้อนไปดูตั้งแต่นาที ${mm}:${String(ss).padStart(2, '0')} แล้วลองทำใหม่`,
      'success'
    )
  }

  // Fresh slate per lesson.
  useEffect(() => {
    setTriggeredQuizIds(new Set())
    setActiveMidQuiz(null)
  }, [currentLesson?.id])

  // PDF mid-quiz trigger — no playhead, so fire on wall-clock timers.
  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'pdf' || !currentLesson.content_url)
      return
    if (!quizzesLoaded) return
    const mids = (lessonQuizzesRef.current[currentLesson.id] || []).filter(
      (q) =>
        q.placement === 'mid_video' &&
        q.questions.length > 0 &&
        !triggeredQuizIdsRef.current.has(q.id)
    )
    if (mids.length === 0) return
    const timers = mids.map((q) => {
      const seconds = Math.max(0, q.trigger_time || 0)
      return setTimeout(() => {
        if (!triggeredQuizIdsRef.current.has(q.id)) {
          triggerMidQuiz(q)
        }
      }, seconds * 1000)
    })
    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.id, currentLesson?.content_type, currentLesson?.content_url, quizzesLoaded])

  return {
    activeMidQuiz,
    // Plain setter for the "blocking quiz" path in goNext — shows the modal
    // without marking it triggered or pausing (matches the original behavior).
    showMidQuiz: setActiveMidQuiz,
    findDueMidQuiz,
    triggerMidQuiz,
    closeMidQuiz,
    rewindMidQuiz,
  }
}
