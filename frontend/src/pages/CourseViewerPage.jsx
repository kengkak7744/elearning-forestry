import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { coursesApi } from '../api/courses'
import { progressApi } from '../api/progress'
import { quizzesApi } from '../api/quizzes'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import Toast from '../components/Toast'
import QuizTaker from '../components/QuizTaker'
import MidVideoQuizModal from '../components/MidVideoQuizModal'
import CourseScoresModal from '../components/CourseScoresModal'
import { mediaUrl } from '../utils/media'

export default function CourseViewerPage() {
  const { id, lessonId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentLesson, setCurrentLesson] = useState(null)
  const [progress, setProgress] = useState({})  // { lessonId: { current_position, is_completed } }
  const [expandedModules, setExpandedModules] = useState(new Set())
  const [quizzes, setQuizzes] = useState([])  // all course quizzes with is_passed status
  const [viewingFinal, setViewingFinal] = useState(false)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)

  const [toast, setToast] = useState({ message: '', type: 'success' })
  const showToast = (m, t = 'success') => setToast({ message: m, type: t })

  const videoRef = useRef(null)
  const lastSavedRef = useRef(0)

  // Mid-video quiz
  const [activeMidQuiz, setActiveMidQuiz] = useState(null)
  const [triggeredQuizIds, setTriggeredQuizIds] = useState(new Set())
  const ytIframeRef = useRef(null)
  const ytPlayerRef = useRef(null)
  const ytPollRef = useRef(null)
  const lastYtSavedRef = useRef(0)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])

  // Time-on-page gate (per lesson)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const fixUrl = mediaUrl

  // Load course + progress
  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line
  }, [id])

  // Switch lesson when URL changes; on first entry without lessonId, resume where the user left off
  useEffect(() => {
    if (!course) return
    const allLessons = course.modules.flatMap(m => m.lessons)

    // If URL specifies a lesson, use it
    if (lessonId) {
      const lesson = allLessons.find(l => l.id === parseInt(lessonId))
      setCurrentLesson(lesson)
      if (lesson) {
        const mod = course.modules.find(m => m.lessons.some(l => l.id === lesson.id))
        if (mod) setExpandedModules(prev => new Set([...prev, mod.id]))
      }
      return
    }

    // No lessonId — wait for progress, then pick resume lesson
    if (!progressLoaded) return
    if (allLessons.length === 0) return

    // Sort lessons by most recent access (uses last_accessed_at from backend)
    const accessed = allLessons
      .map(l => ({ lesson: l, p: progress[l.id] }))
      .filter(x => x.p?.last_accessed_at)
      .sort((a, b) =>
        new Date(b.p.last_accessed_at).getTime() - new Date(a.p.last_accessed_at).getTime()
      )

    // 1. Most recent NOT completed — they were mid-way through this
    const mostRecentOngoing = accessed.find(x => !x.p.is_completed)?.lesson
    // 2. Most recent at all — they were last viewing this (even if completed)
    const mostRecent = accessed[0]?.lesson
    // 3. The first lesson that's not yet completed (never started)
    const firstIncomplete = allLessons.find(l => !progress[l.id]?.is_completed)
    // 4. Fall back to first lesson
    const resume = mostRecentOngoing || mostRecent || firstIncomplete || allLessons[0]
    navigate(`/courses/${id}/learn/${resume.id}`, { replace: true })
  }, [course, lessonId, id, navigate, progressLoaded, progress])

  const loadCourse = async () => {
    setLoading(true)
    setProgressLoaded(false)
    try {
      const data = await coursesApi.getById(id)
      setCourse(data)

      try {
        const progressList = await progressApi.getByCourse(id)
        const progressMap = {}
        progressList.forEach(p => { progressMap[p.lesson_id] = p })
        setProgress(progressMap)
      } catch (e) {}
      setProgressLoaded(true)

      try {
        const quizList = await quizzesApi.getCourseAll(id)
        setQuizzes(quizList)
      } catch (e) {
        setQuizzes([])
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดหลักสูตรไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const refreshQuizzes = async () => {
    try {
      const quizList = await quizzesApi.getCourseAll(id)
      setQuizzes(quizList)
    } catch (e) {}
  }

  // Group quizzes
  const lessonQuizzes = useMemo(() => {
    const map = {}
    quizzes.forEach(q => {
      if (q.lesson_id) {
        if (!map[q.lesson_id]) map[q.lesson_id] = []
        map[q.lesson_id].push(q)
      }
    })
    return map
  }, [quizzes])

  const finalQuiz = useMemo(
    () => quizzes.find(q => q.placement === 'final' && q.course_id) || null,
    [quizzes]
  )

  // A module is "cleared" if all its non-skippable lesson quizzes are passed
  const isModuleCleared = (module) => {
    const moduleQuizIds = module.lessons.flatMap(l => (lessonQuizzes[l.id] || []))
    const blocking = moduleQuizIds.filter(q => !q.can_skip && q.questions.length > 0)
    return blocking.every(q => q.is_passed)
  }

  // Module index → unlocked? First module always. Otherwise, all previous modules must be cleared.
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
    // eslint-disable-next-line
  }, [course, quizzes])

  const allModulesCleared = course && course.modules.length > 0
    && course.modules.every(m => isModuleCleared(m))

  // Save video progress every 10 seconds + check mid-video triggers
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return
    const currentTime = Math.floor(videoRef.current.currentTime)
    const duration = videoRef.current.duration

    // Mid-video quiz check
    const due = findDueMidQuiz(currentTime)
    if (due) {
      triggerMidQuiz(due)
      return
    }

    // Only save every 10 seconds
    if (currentTime - lastSavedRef.current >= 10) {
      lastSavedRef.current = currentTime
      const isCompleted = duration && currentTime >= duration * 0.9

      progressApi.update({
        lesson_id: currentLesson.id,
        current_position: currentTime,
        is_completed: isCompleted,
      }).then(p => {
        setProgress(prev => ({ ...prev, [currentLesson.id]: p }))
      }).catch(() => {})
    }
  }

  const handleVideoEnded = () => {
    if (!currentLesson) return
    progressApi.update({
      lesson_id: currentLesson.id,
      current_position: Math.floor(videoRef.current?.duration || 0),
      is_completed: true,
    }).then(p => {
      setProgress(prev => ({ ...prev, [currentLesson.id]: p }))
      showToast('จบบทเรียนแล้ว')
    }).catch(() => {})
  }

  // Resume from saved position
  const handleLoadedMetadata = () => {
    if (!videoRef.current || !currentLesson) return
    const saved = progress[currentLesson.id]
    if (saved && saved.current_position > 0 && !saved.is_completed) {
      videoRef.current.currentTime = saved.current_position
    }
    lastSavedRef.current = 0
  }

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const switchLesson = (lesson, moduleId) => {
    if (moduleId && !unlockedModuleIds.has(moduleId)) {
      showToast('ต้องทำแบบทดสอบของโมดูลก่อนหน้าให้ผ่านก่อน', 'error')
      return
    }
    markPdfCompleteIfApplicable()
    setViewingFinal(false)
    navigate(`/courses/${id}/learn/${lesson.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const switchToFinal = () => {
    if (!allModulesCleared) {
      showToast('ต้องผ่านแบบทดสอบในทุกโมดูลก่อน', 'error')
      return
    }
    markPdfCompleteIfApplicable()
    setViewingFinal(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Elapsed time on this lesson (clock seconds while page is mounted).
  // For PDFs, restore from saved progress on F5/reconnect — current_position
  // on a PDF lesson stores the seconds-on-page (see save effect below).
  useEffect(() => {
    if (!currentLesson || viewingFinal) return
    if (!progressLoaded) return
    const restored = currentLesson.content_type === 'pdf'
      ? (progressRef.current[currentLesson.id]?.current_position || 0)
      : 0
    setElapsedSeconds(restored)
    const iv = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [currentLesson?.id, viewingFinal, progressLoaded])

  // PDF: save elapsed view time every 10s; mark complete once time gate is met (or after 30s default)
  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'pdf' || viewingFinal) return
    if (elapsedSeconds === 0 || elapsedSeconds % 10 !== 0) return
    const completeAt = minSeconds > 0 ? minSeconds : 30
    const isCompleted = elapsedSeconds >= completeAt
    progressApi.update({
      lesson_id: currentLesson.id,
      current_position: elapsedSeconds,
      is_completed: isCompleted,
    }).then(p => setProgress(prev => ({ ...prev, [currentLesson.id]: p }))).catch(() => {})
    // eslint-disable-next-line
  }, [elapsedSeconds])

  // Mark current PDF lesson as complete when navigating away (best-effort)
  const markPdfCompleteIfApplicable = () => {
    if (!currentLesson || currentLesson.content_type !== 'pdf') return
    if (elapsedSeconds < 5) return
    progressApi.update({
      lesson_id: currentLesson.id,
      current_position: Math.max(elapsedSeconds, progress[currentLesson.id]?.current_position || 0),
      is_completed: true,
    }).then(p => setProgress(prev => ({ ...prev, [currentLesson.id]: p }))).catch(() => {})
  }

  const minSeconds = currentLesson?.min_view_seconds || 0
  const timeGateMet = minSeconds === 0 || elapsedSeconds >= minSeconds
  const remainingSeconds = Math.max(0, minSeconds - elapsedSeconds)
  const fmtTime = (s) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}วิ`
  }

  // Prev/Next destinations — memoized
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
    if (li + 1 < m.lessons.length) return { type: 'lesson', lesson: m.lessons[li + 1], moduleId: m.id }
    for (let i = mi + 1; i < course.modules.length; i++) {
      if (course.modules[i].lessons.length > 0) {
        return { type: 'lesson', lesson: course.modules[i].lessons[0], moduleId: course.modules[i].id }
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
        if (m.lessons.length > 0) return { type: 'lesson', lesson: m.lessons[m.lessons.length - 1], moduleId: m.id }
      }
      return null
    }
    if (!currentPos) return null
    const { mi, li, m } = currentPos
    if (li > 0) return { type: 'lesson', lesson: m.lessons[li - 1], moduleId: m.id }
    for (let i = mi - 1; i >= 0; i--) {
      if (course.modules[i].lessons.length > 0) {
        const prev = course.modules[i]
        return { type: 'lesson', lesson: prev.lessons[prev.lessons.length - 1], moduleId: prev.id }
      }
    }
    return null
  }, [course, currentPos, viewingFinal])

  // Lesson-level gate: every non-skippable quiz on the current lesson must be
  // passed before the learner can move to the next lesson.
  const blockingQuiz = useMemo(() => {
    if (!currentLesson) return null
    const lq = lessonQuizzes[currentLesson.id] || []
    return lq.find(q => !q.can_skip && (q.questions?.length || 0) > 0 && !q.is_passed) || null
  }, [currentLesson, lessonQuizzes])
  const currentLessonGated = !blockingQuiz

  const goNext = () => {
    if (!timeGateMet) {
      showToast(`ต้องอยู่บนหน้านี้อีก ${fmtTime(remainingSeconds)} ก่อนไปต่อ`, 'error')
      return
    }
    if (blockingQuiz) {
      // Take the learner *to* the quiz they need to pass, not just block silently.
      if (blockingQuiz.placement === 'mid_video') {
        // Open the same modal the video-time trigger would.
        setActiveMidQuiz(blockingQuiz)
      } else {
        // end_of_lesson quizzes are rendered inline below the lesson — scroll to it.
        const el = document.getElementById(`quiz-${blockingQuiz.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Brief highlight so the user notices where they landed.
          el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2')
          }, 1800)
        }
      }
      showToast('ต้องผ่านแบบทดสอบนี้ก่อนไปต่อ', 'error')
      return
    }
    if (!nextDest) {
      showToast('คุณเรียนถึงบทสุดท้ายแล้ว', 'success')
      return
    }
    if (nextDest.type === 'final') switchToFinal()
    else switchLesson(nextDest.lesson, nextDest.moduleId)
  }

  const goPrev = () => {
    if (!prevDest) {
      showToast('นี่คือบทแรกแล้ว', 'success')
      return
    }
    if (prevDest.type === 'lesson') {
      markPdfCompleteIfApplicable()
      setViewingFinal(false)
      navigate(`/courses/${id}/learn/${prevDest.lesson.id}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Overall course progress (lessons + final quiz)
  const totalLessons = useMemo(
    () => course ? course.modules.reduce((sum, m) => sum + m.lessons.length, 0) : 0,
    [course]
  )
  const completedLessons = useMemo(
    () => Object.values(progress).filter(p => p?.is_completed).length,
    [progress]
  )
  const totalItems = totalLessons + (finalQuiz ? 1 : 0)
  const completedItems = completedLessons + (finalQuiz?.is_passed ? 1 : 0)
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // === Mid-video quiz triggering ===

  // Refs to read the latest state from inside long-lived intervals
  const currentLessonRef = useRef(currentLesson)
  const lessonQuizzesRef = useRef(lessonQuizzes)
  const triggeredQuizIdsRef = useRef(triggeredQuizIds)
  useEffect(() => { currentLessonRef.current = currentLesson }, [currentLesson])
  useEffect(() => { lessonQuizzesRef.current = lessonQuizzes }, [lessonQuizzes])
  useEffect(() => { triggeredQuizIdsRef.current = triggeredQuizIds }, [triggeredQuizIds])

  // Find a mid_video quiz that should be triggered at this currentTime
  const findDueMidQuiz = (currentTime) => {
    const cl = currentLessonRef.current
    if (!cl) return null
    const mids = (lessonQuizzesRef.current[cl.id] || []).filter(
      q => q.placement === 'mid_video' && q.trigger_time != null && q.questions.length > 0
    )
    return mids.find(q => currentTime >= q.trigger_time && !triggeredQuizIdsRef.current.has(q.id)) || null
  }

  const pauseCurrentVideo = () => {
    if (videoRef.current) {
      try { videoRef.current.pause() } catch {}
    }
    if (ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo() } catch {}
    }
  }

  const playCurrentVideo = () => {
    if (videoRef.current) {
      try { videoRef.current.play() } catch {}
    }
    if (ytPlayerRef.current?.playVideo) {
      try { ytPlayerRef.current.playVideo() } catch {}
    }
  }

  const triggerMidQuiz = (quiz) => {
    setTriggeredQuizIds(prev => new Set([...prev, quiz.id]))
    setActiveMidQuiz(quiz)
    pauseCurrentVideo()
  }

  const closeMidQuiz = () => {
    setActiveMidQuiz(null)
    playCurrentVideo()
  }

  // Reset triggered quiz set when lesson changes
  useEffect(() => {
    setTriggeredQuizIds(new Set())
    setActiveMidQuiz(null)
  }, [currentLesson?.id])

  // YouTube IFrame API loader
  const loadYTApi = () => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT)
        return
      }
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
      if (!existingScript) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.body.appendChild(tag)
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev()
        resolve(window.YT)
      }
      // In case the script loaded but the callback already fired
      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll)
          resolve(window.YT)
        }
      }, 200)
    })
  }

  // PDF lessons: trigger mid-content quiz after `trigger_time` seconds of viewing
  const quizzesLoaded = quizzes.length > 0
  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'pdf' || !currentLesson.content_url) return
    if (!quizzesLoaded) return

    const mids = (lessonQuizzesRef.current[currentLesson.id] || []).filter(
      q => q.placement === 'mid_video' && q.questions.length > 0 && !triggeredQuizIdsRef.current.has(q.id)
    )
    if (mids.length === 0) return

    const timers = mids.map(q => {
      const seconds = Math.max(0, q.trigger_time || 0)
      return setTimeout(() => {
        if (!triggeredQuizIdsRef.current.has(q.id)) {
          triggerMidQuiz(q)
        }
      }, seconds * 1000)
    })

    return () => { timers.forEach(t => clearTimeout(t)) }
    // eslint-disable-next-line
  }, [currentLesson?.id, currentLesson?.content_type, currentLesson?.content_url, quizzesLoaded])

  // Attach YT player when a YouTube lesson is shown
  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'video_youtube' || !currentLesson.content_url) {
      return
    }

    let cancelled = false
    lastYtSavedRef.current = 0
    loadYTApi().then(YT => {
      if (cancelled || !ytIframeRef.current) return
      try {
        ytPlayerRef.current = new YT.Player(ytIframeRef.current, {
          events: {
            onReady: () => {
              // Restore saved position
              const cl = currentLessonRef.current
              const saved = cl ? progressRef.current[cl.id] : null
              if (saved?.current_position > 0 && !saved.is_completed) {
                try { ytPlayerRef.current.seekTo(saved.current_position, true) } catch {}
                lastYtSavedRef.current = saved.current_position
              }

              if (ytPollRef.current) clearInterval(ytPollRef.current)
              // Poll every 2s — halves postMessage traffic; mid-quiz still fires within 2s of the trigger.
              ytPollRef.current = setInterval(() => {
                if (!ytPlayerRef.current?.getCurrentTime) return
                let t = 0
                try { t = ytPlayerRef.current.getCurrentTime() } catch { return }
                const tFloor = Math.floor(t)

                const due = findDueMidQuiz(tFloor)
                if (due) triggerMidQuiz(due)

                // Save progress every 10s
                if (tFloor - lastYtSavedRef.current >= 10) {
                  lastYtSavedRef.current = tFloor
                  let duration = 0
                  try { duration = ytPlayerRef.current.getDuration() || 0 } catch {}
                  const isCompleted = duration > 0 && tFloor >= duration * 0.9
                  const lid = currentLessonRef.current?.id
                  if (lid) {
                    progressApi.update({
                      lesson_id: lid,
                      current_position: tFloor,
                      is_completed: isCompleted,
                    }).then(p => setProgress(prev => ({ ...prev, [lid]: p }))).catch(() => {})
                  }
                }
              }, 2000)
            },
          },
        })
      } catch (e) {}
    })

    return () => {
      cancelled = true
      if (ytPollRef.current) {
        clearInterval(ytPollRef.current)
        ytPollRef.current = null
      }
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy() } catch {}
        ytPlayerRef.current = null
      }
    }
    // eslint-disable-next-line
  }, [currentLesson?.id, currentLesson?.content_type, currentLesson?.content_url])

  const getYoutubeEmbed = (url) => {
    if (!url) return null
    
    // Patterns to match:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    // https://www.youtube.com/shorts/VIDEO_ID
    // https://m.youtube.com/watch?v=VIDEO_ID
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&"'>]+)/,
    ]
    
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) {
          const params = new URLSearchParams({ enablejsapi: '1' })
          if (origin) params.set('origin', origin)
          return `https://www.youtube.com/embed/${match[1]}?${params.toString()}`
        }
    }

    return url  // fallback: try as-is
    }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
  }

  if (!course) {
    return <div className="p-8 text-center text-gray-500">ไม่พบหลักสูตร</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link
            to={`/courses/${id}`}
            className="text-gray-600 hover:text-forest-600 text-sm flex items-center gap-1 flex-shrink-0"
          >
            ← กลับ
          </Link>
          <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate flex-1 text-center">
            {course.title}
          </h1>
          <button
            type="button"
            onClick={() => setScoresOpen(true)}
            className="text-sm text-gray-600 hover:text-forest-600 flex-shrink-0 inline-flex items-center gap-1"
            aria-label="ดูคะแนนของฉัน"
          >
            <Icon name="trophy" className="w-5 h-5" />
            <span className="hidden sm:inline">คะแนน</span>
          </button>
          <Link to="/" className="text-sm text-gray-600 hover:text-forest-600 flex-shrink-0">
            <Icon name="home" className="w-5 h-5" />
          </Link>
        </div>
        {/* Course progress bar */}
        <div className="px-4 sm:px-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-forest-500 to-forest-700 h-1.5 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium tabular-nums flex-shrink-0">
              {completedItems}/{totalItems} ({progressPercent}%)
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-28 sm:pb-32">
        {/* Final quiz view */}
        {viewingFinal && finalQuiz && (
          <>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 sm:p-6 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
                <Icon name="trophy" className="w-6 h-6 text-amber-600" />
                แบบทดสอบสุดท้าย
              </h2>
              <p className="text-sm text-gray-600">ทำแบบทดสอบรวมเพื่อจบหลักสูตร</p>
            </div>
            <div className="mb-4">
              <QuizTaker
                quiz={finalQuiz}
                showToast={showToast}
                onAttempted={refreshQuizzes}
              />
            </div>
          </>
        )}

        {/* Main player area */}
        {!viewingFinal && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          {currentLesson ? (
            <>
              {/* Video / PDF / YouTube */}
              <div className="bg-black aspect-video">
                {currentLesson.content_type === 'video_file' && currentLesson.content_url && (
                  <video
                    ref={videoRef}
                    src={fixUrl(currentLesson.content_url)}
                    controls
                    className="w-full h-full"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                )}

                {currentLesson.content_type === 'video_youtube' && currentLesson.content_url && (
                <iframe
                    ref={ytIframeRef}
                    key={currentLesson.id}
                    src={getYoutubeEmbed(currentLesson.content_url)}
                    title={currentLesson.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {currentLesson.content_type === 'pdf' && currentLesson.content_url && (
                  <iframe
                    src={fixUrl(currentLesson.content_url)}
                    title={currentLesson.title}
                    className="w-full h-full bg-white"
                  />
                )}

                {(!currentLesson.content_url) && (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm">
                    ยังไม่มีเนื้อหาในบทเรียนนี้
                  </div>
                )}
              </div>

              {/* Lesson info */}
              <div className="p-4 sm:p-6">
                {(() => {
                  return currentPos ? (
                    <div className="text-xs text-forest-600 font-medium mb-2">
                      โมดูล {currentPos.mi + 1} · บทเรียน {currentPos.li + 1}
                    </div>
                  ) : null
                })()}
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
                  {currentLesson.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    {currentLesson.content_type === 'pdf' ? (
                      <><Icon name="document" className="w-3.5 h-3.5" /> PDF</>
                    ) : currentLesson.content_type === 'video_youtube' ? (
                      <><Icon name="tv" className="w-3.5 h-3.5" /> YouTube</>
                    ) : (
                      <><Icon name="film" className="w-3.5 h-3.5" /> วิดีโอ</>
                    )}
                  </span>
                  {currentLesson.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Icon name="stopwatch" className="w-3.5 h-3.5" /> {fmtTime(currentLesson.duration_seconds)}
                    </span>
                  )}
                  {currentLesson.total_pages && (
                    <span className="flex items-center gap-1">
                      <Icon name="document" className="w-3.5 h-3.5" /> {currentLesson.total_pages} หน้า
                    </span>
                  )}
                  {minSeconds > 0 && (
                    <span className={`flex items-center gap-1 ${timeGateMet ? 'text-green-600' : 'text-amber-600'}`}>
                      <Icon name="hourglass" className="w-3.5 h-3.5" /> ต้องอยู่ขั้นต่ำ {fmtTime(minSeconds)}
                    </span>
                  )}
                </div>
                {currentLesson.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-3">
                    {currentLesson.description}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              เลือกบทเรียนจากรายการด้านล่าง
            </div>
          )}
        </div>
        )}

        {/* Lesson quizzes — Prev/Next moved to fixed bottom bar */}
        {!viewingFinal && currentLesson && (lessonQuizzes[currentLesson.id] || []).length > 0 && (
          <div className="space-y-3 mb-4">
            {lessonQuizzes[currentLesson.id].map(quiz => (
              <div key={quiz.id} id={`quiz-${quiz.id}`} className="rounded-xl transition-shadow">
                <QuizTaker
                  quiz={quiz}
                  showToast={showToast}
                  onAttempted={refreshQuizzes}
                />
              </div>
            ))}
          </div>
        )}

        {/* Lesson list (sidebar stacked below on all screens per your request) */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h3 className="font-bold text-gray-800 mb-4">บทเรียนในหลักสูตร</h3>
          
          {course.modules.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีบทเรียน</p>
          )}

          <div className="space-y-2">
            {course.modules.map((module, mIdx) => {
              const unlocked = unlockedModuleIds.has(module.id)
              const cleared = isModuleCleared(module)
              return (
              <div key={module.id} className={`border rounded-lg overflow-hidden ${unlocked ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full bg-gray-50 hover:bg-gray-100 p-3 flex items-center gap-3 text-left transition"
                >
                  <span className="text-gray-400 text-sm w-4">
                    {expandedModules.has(module.id) ? '▼' : '▶'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    โมดูลที่ {mIdx + 1}
                  </span>
                  <span className="flex-1 font-medium text-gray-800 flex items-center gap-2">
                    {module.title}
                    {!unlocked && <Icon name="lock" className="w-4 h-4 text-gray-500" />}
                    {unlocked && cleared && <Icon name="check" className="w-4 h-4 text-green-600" />}
                  </span>
                  <span className="text-xs text-gray-500">
                    {module.lessons.length} บทเรียน
                  </span>
                </button>

                {expandedModules.has(module.id) && (
                  <div className="divide-y divide-gray-100">
                    {module.lessons.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400 text-center">ยังไม่มีบทเรียน</p>
                    ) : (
                      module.lessons.map((lesson, lIdx) => {
                        const isActive = !viewingFinal && currentLesson?.id === lesson.id
                        const lProgress = progress[lesson.id]
                        const isDone = lProgress?.is_completed
                        const hasQuiz = (lessonQuizzes[lesson.id] || []).length > 0
                        const quizPassed = hasQuiz && lessonQuizzes[lesson.id].every(q => q.is_passed || q.can_skip)
                        // Lesson nav gate: learner can re-enter lessons they've reached
                        // (current + any with prior progress). New lessons stay locked
                        // until they "Next" their way into them.
                        const lessonReached = isActive || !!lProgress
                        const lessonClickable = unlocked && lessonReached
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => switchLesson(lesson, module.id)}
                            disabled={!lessonClickable}
                            title={!lessonReached ? 'ต้องเรียนตามลำดับ — ยังไม่ปลดล็อกบทนี้' : undefined}
                            className={`w-full p-3 flex items-center gap-3 text-left transition ${
                              isActive
                                ? 'bg-forest-50 border-l-4 border-forest-500'
                                : lessonClickable ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-60'
                            }`}
                          >
                            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isDone
                                ? 'bg-forest-500 text-white'
                                : isActive
                                ? 'bg-forest-200 text-forest-700'
                                : !lessonReached
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {isDone ? <Icon name="check" className="w-3 h-3" /> : lIdx + 1}
                            </span>
                            <span className={`flex-1 text-sm ${isActive ? 'font-medium text-forest-700' : 'text-gray-700'}`}>
                              {lesson.title}
                            </span>
                            {hasQuiz && (
                              <span className={`flex-shrink-0 inline-flex items-center ${quizPassed ? 'text-green-600' : 'text-amber-600'}`}>
                                <Icon name="note" className="w-4 h-4" />
                                {quizPassed && <Icon name="check" className="w-3 h-3 -ml-0.5" />}
                              </span>
                            )}
                            {!lessonReached && unlocked && (
                              <Icon name="lock" className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {lesson.content_type === 'pdf' ? 'PDF' : 'วิดีโอ'}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              )
            })}

            {/* Final quiz entry */}
            {finalQuiz && (
              <button
                onClick={switchToFinal}
                disabled={!allModulesCleared}
                className={`w-full border rounded-lg p-3 flex items-center gap-3 text-left transition ${
                  viewingFinal
                    ? 'bg-amber-50 border-amber-300'
                    : allModulesCleared
                      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                      : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                }`}
              >
                <Icon name="trophy" className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <span className="flex-1 font-medium text-gray-800 flex items-center gap-2">
                  {finalQuiz.title}
                  {!allModulesCleared && <Icon name="lock" className="w-4 h-4 text-gray-500" />}
                  {finalQuiz.is_passed && (
                    <span className="text-green-600 text-xs inline-flex items-center gap-0.5">
                      <Icon name="check" className="w-3 h-3" /> ผ่านแล้ว
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {finalQuiz.questions.length} คำถาม
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar — always visible */}
      {currentLesson && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
            {/* Time gate progress (compact, only while not met) */}
            {!viewingFinal && minSeconds > 0 && !timeGateMet && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                    <Icon name="hourglass" className="w-3.5 h-3.5" />
                    ต้องอยู่บนหน้านี้อีก {fmtTime(remainingSeconds)}
                  </span>
                  <span className="text-gray-500 tabular-nums">
                    {fmtTime(elapsedSeconds)} / {fmtTime(minSeconds)}
                  </span>
                </div>
                <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-1.5 transition-all"
                    style={{ width: `${Math.min(100, (elapsedSeconds / minSeconds) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={goPrev}
                disabled={!prevDest}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← ก่อนหน้า
              </button>

              {/* Middle: current lesson title (desktop only) */}
              {!viewingFinal && (
                <span className="hidden md:block text-xs text-gray-500 truncate max-w-md text-center px-2">
                  {currentLesson.title}
                </span>
              )}
              {viewingFinal && (
                <span className="hidden md:inline-flex items-center gap-1 text-xs text-amber-700 font-medium text-center px-2">
                  <Icon name="trophy" className="w-4 h-4" /> แบบทดสอบสุดท้าย
                </span>
              )}

              {viewingFinal ? (
                finalQuiz?.is_passed ? (
                  <button
                    onClick={() => setScoresOpen(true)}
                    className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5"
                  >
                    <Icon name="trophy" className="w-4 h-4" />
                    จบหลักสูตร · รับใบรับรอง
                  </button>
                ) : (
                  <button
                    onClick={goPrev}
                    className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
                  >
                    กลับบทเรียน
                  </button>
                )
              ) : (() => {
                const blocked = !currentLessonGated
                return (
                  <button
                    onClick={goNext}
                    disabled={!timeGateMet || !nextDest}
                    title={blocked ? 'คลิกเพื่อไปทำแบบทดสอบที่ต้องผ่าน' : undefined}
                    className={`flex-1 sm:flex-none px-5 sm:px-6 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${
                      blocked ? 'bg-amber-500 hover:bg-amber-600' : 'bg-forest-500 hover:bg-forest-600'
                    }`}
                  >
                    {blocked ? (
                      <><Icon name="lock" className="w-4 h-4" /> ไปทำแบบทดสอบ</>
                    ) : !nextDest ? (
                      <>จบหลักสูตรแล้ว <Icon name="check" className="w-4 h-4" /></>
                    ) : nextDest.type === 'final' ? (
                      <><Icon name="trophy" className="w-4 h-4" /> แบบทดสอบสุดท้าย</>
                    ) : (
                      <>ถัดไป →</>
                    )}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Mid-video quiz modal */}
      <MidVideoQuizModal
        quiz={activeMidQuiz}
        showToast={showToast}
        onAttempted={refreshQuizzes}
        onContinue={closeMidQuiz}
        onSkip={closeMidQuiz}
      />

      <CourseScoresModal
        open={scoresOpen}
        quizzes={quizzes}
        courseId={id}
        onClose={() => setScoresOpen(false)}
      />
    </div>
  )
}