import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Film,
  Hourglass,
  Layers,
  ListChecks,
  Paperclip,
  Trophy,
  Tv,
} from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { progressApi } from '@/api/progress'
import { quizzesApi } from '@/api/quizzes'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import QuizTaker from '@/components/QuizTaker'
import MidVideoQuizModal from '@/components/MidVideoQuizModal'
import CourseScoresModal from '@/components/CourseScoresModal'
import LessonTree from '@/components/learner/LessonTree'
import LessonFooter from '@/components/learner/LessonFooter'
import LessonNotes from '@/components/learner/LessonNotes'
import { cn } from '@/lib/utils'

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function isInternalMediaUrl(url) {
  // Backend-served paths come back as /videos/, /pdfs/, /images/, etc. Anything
  // that doesn't start with http(s) is treated as a same-origin media path and
  // resolved via mediaUrl(). External links open in a new tab unchanged.
  return typeof url === 'string' && !/^https?:\/\//i.test(url)
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}วิ`
}

function getYoutubeEmbed(url) {
  if (!url) return null
  const pattern =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&"'>]+)/
  const match = url.match(pattern)
  if (!match) return url
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({ enablejsapi: '1' })
  if (origin) params.set('origin', origin)
  return `https://www.youtube.com/embed/${match[1]}?${params.toString()}`
}

function loadYTApi() {
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
    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(poll)
        resolve(window.YT)
      }
    }, 200)
  })
}

export default function CourseViewerPage() {
  const { id, lessonId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentLesson, setCurrentLesson] = useState(null)
  const [progress, setProgress] = useState({})
  const [expandedModules, setExpandedModules] = useState(new Set())
  const [quizzes, setQuizzes] = useState([])
  const [viewingFinal, setViewingFinal] = useState(false)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)

  // While studying, the tab shows the current lesson title — easier to spot the
  // right tab when several courses/lessons are open at once.
  useDocumentTitle(
    currentLesson && course
      ? `${currentLesson.title} · ${course.title}`
      : course?.title
  )

  const videoRef = useRef(null)
  const lastSavedRef = useRef(0)

  const [activeMidQuiz, setActiveMidQuiz] = useState(null)
  const [triggeredQuizIds, setTriggeredQuizIds] = useState(new Set())
  const ytIframeRef = useRef(null)
  const ytPlayerRef = useRef(null)
  const ytPollRef = useRef(null)
  const lastYtSavedRef = useRef(0)
  const progressRef = useRef(progress)
  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const loadCourse = async () => {
    setLoading(true)
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
      showToast(err.response?.data?.detail || 'โหลดหลักสูตรไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Switch lesson when URL changes; on first entry without lessonId, resume
  useEffect(() => {
    if (!course) return
    const allLessons = course.modules.flatMap((m) => m.lessons)

    if (lessonId) {
      const lesson = allLessons.find((l) => l.id === parseInt(lessonId))
      setCurrentLesson(lesson)
      if (lesson) {
        const mod = course.modules.find((m) => m.lessons.some((l) => l.id === lesson.id))
        if (mod) setExpandedModules((prev) => new Set([...prev, mod.id]))
      }
      return
    }

    if (!progressLoaded) return
    if (allLessons.length === 0) return

    const accessed = allLessons
      .map((l) => ({ lesson: l, p: progress[l.id] }))
      .filter((x) => x.p?.last_accessed_at)
      .sort(
        (a, b) =>
          new Date(b.p.last_accessed_at).getTime() -
          new Date(a.p.last_accessed_at).getTime()
      )
    const mostRecentOngoing = accessed.find((x) => !x.p.is_completed)?.lesson
    const mostRecent = accessed[0]?.lesson
    const firstIncomplete = allLessons.find((l) => !progress[l.id]?.is_completed)
    const resume = mostRecentOngoing || mostRecent || firstIncomplete || allLessons[0]
    navigate(`/courses/${id}/learn/${resume.id}`, { replace: true })
  }, [course, lessonId, id, navigate, progressLoaded, progress])

  const refreshQuizzes = async () => {
    try {
      const quizList = await quizzesApi.getCourseAll(id)
      setQuizzes(quizList)
    } catch {}
  }

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

  // === Mid-video quiz triggering refs ===
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

  const pauseCurrentVideo = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {}
    }
    if (ytPlayerRef.current?.pauseVideo) {
      try {
        ytPlayerRef.current.pauseVideo()
      } catch {}
    }
  }

  const playCurrentVideo = () => {
    if (videoRef.current) {
      try {
        videoRef.current.play()
      } catch {}
    }
    if (ytPlayerRef.current?.playVideo) {
      try {
        ytPlayerRef.current.playVideo()
      } catch {}
    }
  }

  const triggerMidQuiz = (quiz) => {
    setTriggeredQuizIds((prev) => new Set([...prev, quiz.id]))
    setActiveMidQuiz(quiz)
    pauseCurrentVideo()
  }

  const closeMidQuiz = () => {
    setActiveMidQuiz(null)
    playCurrentVideo()
  }

  useEffect(() => {
    setTriggeredQuizIds(new Set())
    setActiveMidQuiz(null)
  }, [currentLesson?.id])

  // === Video progress + mid-quiz check ===
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return
    const currentTime = Math.floor(videoRef.current.currentTime)
    const duration = videoRef.current.duration

    const due = findDueMidQuiz(currentTime)
    if (due) {
      triggerMidQuiz(due)
      return
    }

    if (currentTime - lastSavedRef.current >= 10) {
      lastSavedRef.current = currentTime
      const isCompleted = duration && currentTime >= duration * 0.9
      progressApi
        .update({
          lesson_id: currentLesson.id,
          current_position: currentTime,
          is_completed: isCompleted,
        })
        .then((p) => setProgress((prev) => ({ ...prev, [currentLesson.id]: p })))
        .catch(() => {})
    }
  }

  const handleVideoEnded = () => {
    if (!currentLesson) return
    progressApi
      .update({
        lesson_id: currentLesson.id,
        current_position: Math.floor(videoRef.current?.duration || 0),
        is_completed: true,
      })
      .then((p) => {
        setProgress((prev) => ({ ...prev, [currentLesson.id]: p }))
        showToast('จบบทเรียนแล้ว', 'success')
      })
      .catch(() => {})
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !currentLesson) return
    const saved = progress[currentLesson.id]
    if (saved && saved.current_position > 0 && !saved.is_completed) {
      videoRef.current.currentTime = saved.current_position
    }
    lastSavedRef.current = 0
  }

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => {
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
    setMobileTreeOpen(false)
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
    setMobileTreeOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Elapsed time on this lesson
  const minSeconds = currentLesson?.min_view_seconds || 0
  useEffect(() => {
    if (!currentLesson || viewingFinal) return
    if (!progressLoaded) return
    const restored =
      currentLesson.content_type === 'pdf'
        ? progressRef.current[currentLesson.id]?.current_position || 0
        : 0
    setElapsedSeconds(restored)
    const iv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [currentLesson?.id, viewingFinal, progressLoaded])

  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'pdf' || viewingFinal) return
    if (elapsedSeconds === 0 || elapsedSeconds % 10 !== 0) return
    const completeAt = minSeconds > 0 ? minSeconds : 30
    const isCompleted = elapsedSeconds >= completeAt
    progressApi
      .update({
        lesson_id: currentLesson.id,
        current_position: elapsedSeconds,
        is_completed: isCompleted,
      })
      .then((p) => setProgress((prev) => ({ ...prev, [currentLesson.id]: p })))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds])

  const markPdfCompleteIfApplicable = () => {
    if (!currentLesson || currentLesson.content_type !== 'pdf') return
    if (elapsedSeconds < 5) return
    progressApi
      .update({
        lesson_id: currentLesson.id,
        current_position: Math.max(
          elapsedSeconds,
          progress[currentLesson.id]?.current_position || 0
        ),
        is_completed: true,
      })
      .then((p) => setProgress((prev) => ({ ...prev, [currentLesson.id]: p })))
      .catch(() => {})
  }

  const timeGateMet = minSeconds === 0 || elapsedSeconds >= minSeconds
  const remainingSeconds = Math.max(0, minSeconds - elapsedSeconds)

  // Prev/Next destinations
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

  const blockingQuiz = useMemo(() => {
    if (!currentLesson) return null
    const lq = lessonQuizzes[currentLesson.id] || []
    return (
      lq.find(
        (q) => !q.can_skip && (q.questions?.length || 0) > 0 && !q.is_passed
      ) || null
    )
  }, [currentLesson, lessonQuizzes])
  const currentLessonGated = !blockingQuiz

  const goNext = () => {
    if (!timeGateMet) {
      showToast(`ต้องอยู่บนหน้านี้อีก ${fmtTime(remainingSeconds)} ก่อนไปต่อ`, 'error')
      return
    }
    if (blockingQuiz) {
      if (blockingQuiz.placement === 'mid_video') {
        setActiveMidQuiz(blockingQuiz)
      } else {
        const el = document.getElementById(`quiz-${blockingQuiz.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-warning', 'ring-offset-2')
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-warning', 'ring-offset-2')
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

  // Course progress %
  const totalLessons = useMemo(
    () => (course ? course.modules.reduce((sum, m) => sum + m.lessons.length, 0) : 0),
    [course]
  )
  const completedLessons = useMemo(
    () => Object.values(progress).filter((p) => p?.is_completed).length,
    [progress]
  )
  const totalItems = totalLessons + (finalQuiz ? 1 : 0)
  const completedItems = completedLessons + (finalQuiz?.is_passed ? 1 : 0)
  const progressPercent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // PDF mid-quiz trigger
  const quizzesLoaded = quizzes.length > 0
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

  // YouTube IFrame API
  useEffect(() => {
    if (
      !currentLesson ||
      currentLesson.content_type !== 'video_youtube' ||
      !currentLesson.content_url
    ) {
      return
    }

    let cancelled = false
    lastYtSavedRef.current = 0
    loadYTApi().then((YT) => {
      if (cancelled || !ytIframeRef.current) return
      try {
        ytPlayerRef.current = new YT.Player(ytIframeRef.current, {
          events: {
            onReady: () => {
              const cl = currentLessonRef.current
              const saved = cl ? progressRef.current[cl.id] : null
              if (saved?.current_position > 0 && !saved.is_completed) {
                try {
                  ytPlayerRef.current.seekTo(saved.current_position, true)
                } catch {}
                lastYtSavedRef.current = saved.current_position
              }

              if (ytPollRef.current) clearInterval(ytPollRef.current)
              ytPollRef.current = setInterval(() => {
                if (!ytPlayerRef.current?.getCurrentTime) return
                let t = 0
                try {
                  t = ytPlayerRef.current.getCurrentTime()
                } catch {
                  return
                }
                const tFloor = Math.floor(t)
                const due = findDueMidQuiz(tFloor)
                if (due) triggerMidQuiz(due)
                if (tFloor - lastYtSavedRef.current >= 10) {
                  lastYtSavedRef.current = tFloor
                  let duration = 0
                  try {
                    duration = ytPlayerRef.current.getDuration() || 0
                  } catch {}
                  const isCompleted = duration > 0 && tFloor >= duration * 0.9
                  const lid = currentLessonRef.current?.id
                  if (lid) {
                    progressApi
                      .update({
                        lesson_id: lid,
                        current_position: tFloor,
                        is_completed: isCompleted,
                      })
                      .then((p) => setProgress((prev) => ({ ...prev, [lid]: p })))
                      .catch(() => {})
                  }
                }
              }, 2000)
            },
          },
        })
      } catch {}
    })

    return () => {
      cancelled = true
      if (ytPollRef.current) {
        clearInterval(ytPollRef.current)
        ytPollRef.current = null
      }
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy()
        } catch {}
        ytPlayerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.id, currentLesson?.content_type, currentLesson?.content_url])

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        กำลังโหลด...
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        ไม่พบหลักสูตร
      </div>
    )
  }

  const treeProps = {
    course,
    currentLessonId: currentLesson?.id,
    viewingFinal,
    progress,
    lessonQuizzes,
    unlockedModuleIds,
    isModuleCleared,
    expandedModules,
    onToggleModule: toggleModule,
    onSwitchLesson: switchLesson,
    finalQuiz,
    allModulesCleared,
    onSwitchToFinal: switchToFinal,
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Slim back bar with progress */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-3 sm:px-4">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
            <Link to={`/courses/${id}`} aria-label="กลับหน้าหลักสูตร">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{course.title}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <Progress value={progressPercent} className="h-1 flex-1" />
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {completedItems}/{totalItems} ({progressPercent}%)
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => setScoresOpen(true)}
            aria-label="ดูคะแนน"
          >
            <Trophy className="h-4 w-4" />
          </Button>
          <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 lg:hidden"
                aria-label="รายการบทเรียน"
              >
                <Layers className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-md">
              <SheetHeader className="mb-4">
                <SheetTitle>บทเรียนในหลักสูตร</SheetTitle>
              </SheetHeader>
              <LessonTree {...treeProps} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="min-w-0">
            {viewingFinal && finalQuiz ? (
              <>
                <Card className="mb-4 border-warning/30 bg-warning/5">
                  <CardContent className="p-5 sm:p-6">
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
                      <Trophy className="h-6 w-6 text-warning" />
                      แบบทดสอบสุดท้าย
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ทำแบบทดสอบรวมเพื่อจบหลักสูตร
                    </p>
                  </CardContent>
                </Card>
                <QuizTaker
                  quiz={finalQuiz}
                  showToast={showToast}
                  onAttempted={refreshQuizzes}
                />
              </>
            ) : currentLesson ? (
              <>
                {/* Player surface */}
                <Card className="mb-4 overflow-hidden border-border/60">
                  <div className="aspect-video bg-black">
                    {currentLesson.content_type === 'video_file' &&
                      currentLesson.content_url && (
                        <video
                          ref={videoRef}
                          src={mediaUrl(currentLesson.content_url)}
                          controls
                          className="h-full w-full"
                          onTimeUpdate={handleTimeUpdate}
                          onEnded={handleVideoEnded}
                          onLoadedMetadata={handleLoadedMetadata}
                        />
                      )}
                    {currentLesson.content_type === 'video_youtube' &&
                      currentLesson.content_url && (
                        <iframe
                          ref={ytIframeRef}
                          key={currentLesson.id}
                          src={getYoutubeEmbed(currentLesson.content_url)}
                          title={currentLesson.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    {currentLesson.content_type === 'pdf' && currentLesson.content_url && (
                      <iframe
                        src={mediaUrl(currentLesson.content_url)}
                        title={currentLesson.title}
                        className="h-full w-full bg-white"
                      />
                    )}
                    {!currentLesson.content_url && (
                      <div className="flex h-full w-full items-center justify-center text-sm text-white/80">
                        ยังไม่มีเนื้อหาในบทเรียนนี้
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    {currentPos && (
                      <div className="mb-2 text-xs font-medium text-primary">
                        โมดูล {currentPos.mi + 1} · บทเรียน {currentPos.li + 1}
                      </div>
                    )}
                    <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                      {currentLesson.title}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {currentLesson.content_type === 'pdf' ? (
                          <>
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </>
                        ) : currentLesson.content_type === 'video_youtube' ? (
                          <>
                            <Tv className="h-3.5 w-3.5" /> YouTube
                          </>
                        ) : (
                          <>
                            <Film className="h-3.5 w-3.5" /> วิดีโอ
                          </>
                        )}
                      </span>
                      {currentLesson.duration_seconds ? (
                        <span className="inline-flex items-center gap-1">
                          <Hourglass className="h-3.5 w-3.5" />
                          {fmtTime(currentLesson.duration_seconds)}
                        </span>
                      ) : null}
                      {currentLesson.total_pages ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> {currentLesson.total_pages} หน้า
                        </span>
                      ) : null}
                      {minSeconds > 0 && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            timeGateMet ? 'text-success' : 'text-warning'
                          )}
                        >
                          <Hourglass className="h-3.5 w-3.5" /> ขั้นต่ำ {fmtTime(minSeconds)}
                        </span>
                      )}
                    </div>
                    {currentLesson.description && (
                      <div className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm text-foreground">
                        {currentLesson.description}
                      </div>
                    )}

                    {Array.isArray(currentLesson.resources) &&
                      currentLesson.resources.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Paperclip className="h-3.5 w-3.5" />
                            เอกสารประกอบบทเรียน
                          </div>
                          <ul className="space-y-1.5">
                            {currentLesson.resources.map((r) => {
                              const internal = isInternalMediaUrl(r.url)
                              const href = internal ? mediaUrl(r.url) : r.url
                              const Icon = internal ? Download : ExternalLink
                              const size = fmtBytes(r.file_size)
                              return (
                                <li key={r.id}>
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
                                  >
                                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="flex-1 truncate text-foreground">
                                      {r.title}
                                    </span>
                                    {r.resource_type && (
                                      <Badge variant="secondary" className="font-normal">
                                        {r.resource_type}
                                      </Badge>
                                    )}
                                    {size && (
                                      <span className="text-[11px] tabular-nums text-muted-foreground">
                                        {size}
                                      </span>
                                    )}
                                    <Icon
                                      className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                                      aria-hidden="true"
                                    />
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}

                    <LessonNotes lessonId={currentLesson.id} />
                  </CardContent>
                </Card>

                {/* Lesson quizzes */}
                {(lessonQuizzes[currentLesson.id] || []).length > 0 && (
                  <div className="mb-4 space-y-3">
                    {lessonQuizzes[currentLesson.id].map((quiz) => (
                      <div
                        key={quiz.id}
                        id={`quiz-${quiz.id}`}
                        className="rounded-xl transition-shadow"
                      >
                        <QuizTaker
                          quiz={quiz}
                          showToast={showToast}
                          onAttempted={refreshQuizzes}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Card className="border-dashed border-border/60">
                <CardContent className="p-12 text-center text-sm text-muted-foreground">
                  เลือกบทเรียนจากเมนูด้านขวา
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Lesson tree (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-16">
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    บทเรียนในหลักสูตร
                  </div>
                  <LessonTree {...treeProps} />
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <LessonFooter
        currentLesson={currentLesson}
        viewingFinal={viewingFinal}
        finalQuiz={finalQuiz}
        prevDest={prevDest}
        nextDest={nextDest}
        timeGateMet={timeGateMet}
        minSeconds={minSeconds}
        elapsedSeconds={elapsedSeconds}
        remainingSeconds={remainingSeconds}
        currentLessonGated={currentLessonGated}
        onPrev={goPrev}
        onNext={goNext}
        onViewScores={() => setScoresOpen(true)}
      />

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
