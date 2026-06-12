import { useEffect, useRef, useState } from 'react'
import { progressApi } from '@/api/progress'
import { showToast } from '@/lib/toast'
import useMidVideoQuizzes from './useMidVideoQuizzes'
import useYouTubePlayer from './useYouTubePlayer'

/**
 * Owns everything about playing the current lesson and persisting its progress:
 *  - mid-video quizzes (useMidVideoQuizzes) + the YouTube player (useYouTubePlayer)
 *  - native <video> time/ended/metadata handlers and the PDF/elapsed wall-clock
 *    timer (paused while the tab is hidden so a PDF gate can't tick in the dark)
 *  - the min-view time gate (timeGateMet / remainingSeconds)
 *  - resilient saving: every save funnels through saveProgress, which tracks
 *    consecutive failures (saveFailed) and supports retry; flushProgress
 *    persists the current position before a lesson switch and on tab-hide
 *  - the "up next" overlay open state, armed when a video ends
 *
 * The protected quiz/player machinery is wired here exactly as it was on the
 * page — moved, not reauthored.
 */
export default function useLessonPlayback({
  currentLesson,
  lessonQuizzes,
  quizzesLoaded,
  progressLoaded,
  viewingFinal,
  progress,
  setProgress,
  nextDest,
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [upNextOpen, setUpNextOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const videoRef = useRef(null)
  const lastSavedRef = useRef(0)
  const progressRef = useRef(progress)
  const currentLessonRef = useRef(currentLesson)
  const elapsedSecondsRef = useRef(elapsedSeconds)
  const nextDestRef = useRef(nextDest)
  const endedHandledRef = useRef(false)
  const failCountRef = useRef(0)
  const lastPayloadRef = useRef(null)
  const flushRef = useRef(null)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])
  useEffect(() => {
    currentLessonRef.current = currentLesson
  }, [currentLesson])
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])
  useEffect(() => {
    nextDestRef.current = nextDest
  }, [nextDest])

  // Every progress save funnels through here so we keep the progress map in
  // sync and can surface a banner after repeated failures (spotty connection).
  // Resolves to the saved record on success, undefined on failure.
  const saveProgress = (payload) => {
    lastPayloadRef.current = payload
    return progressApi
      .update(payload)
      .then((p) => {
        failCountRef.current = 0
        setSaveFailed(false)
        setProgress((prev) => ({ ...prev, [payload.lesson_id]: p }))
        return p
      })
      .catch(() => {
        failCountRef.current += 1
        if (failCountRef.current >= 2) setSaveFailed(true)
        return undefined
      })
  }

  const retrySave = () => {
    if (lastPayloadRef.current) saveProgress(lastPayloadRef.current)
  }

  const dismissSaveError = () => setSaveFailed(false)

  // === Mid-video quizzes + YouTube player (existing hooks) ===
  const midQuiz = useMidVideoQuizzes({
    currentLesson,
    lessonQuizzes,
    quizzesLoaded,
    onPause: () => pauseCurrentVideo(),
    onResume: () => playCurrentVideo(),
    onSeek: (t) => seekCurrentVideo(t),
  })

  const { iframeRef: ytIframeRef, playerRef: ytPlayerRef } = useYouTubePlayer({
    lesson: currentLesson,
    getResumePosition: () => {
      const saved = currentLessonRef.current
        ? progressRef.current[currentLessonRef.current.id]
        : null
      return saved?.current_position > 0 && !saved.is_completed
        ? saved.current_position
        : 0
    },
    onQuizCheck: (tFloor) => {
      const due = midQuiz.findDueMidQuiz(tFloor)
      if (due) {
        midQuiz.triggerMidQuiz(due)
        return
      }
      // The YouTube integration has no onEnded — the 2s poll is the only signal
      // we get. PlayerState 0 === ENDED → drive the same end-of-video handler.
      try {
        if (ytPlayerRef.current?.getPlayerState?.() === 0) handleMediaEnded()
      } catch {}
    },
    onSaveProgress: (tFloor, isCompleted) => {
      const lid = currentLessonRef.current?.id
      if (!lid) return
      saveProgress({ lesson_id: lid, current_position: tFloor, is_completed: isCompleted })
    },
  })

  function pauseCurrentVideo() {
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

  function playCurrentVideo() {
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

  function seekCurrentVideo(seconds) {
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = seconds
        const p = videoRef.current.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      } catch {}
    }
    if (ytPlayerRef.current?.seekTo) {
      try {
        ytPlayerRef.current.seekTo(seconds, true)
        ytPlayerRef.current.playVideo?.()
      } catch {}
    }
  }

  // Shared end-of-video handler for native <video> (onEnded) and YouTube
  // (poll-detected ENDED). Marks the lesson complete once, then offers the
  // up-next card when there's a destination to advance to.
  function handleMediaEnded() {
    const lesson = currentLessonRef.current
    if (!lesson || endedHandledRef.current) return
    endedHandledRef.current = true

    let pos = progressRef.current[lesson.id]?.current_position || 0
    if (lesson.content_type === 'video_file' && videoRef.current) {
      pos = Math.floor(videoRef.current.duration || pos)
    } else if (lesson.content_type === 'video_youtube' && ytPlayerRef.current?.getDuration) {
      try {
        pos = Math.floor(ytPlayerRef.current.getDuration() || pos)
      } catch {}
    }

    saveProgress({ lesson_id: lesson.id, current_position: pos, is_completed: true }).then(
      (p) => {
        if (p) showToast('จบบทเรียนแล้ว', 'success')
      }
    )

    // The overlay decides ready-vs-gated from the props the page passes at
    // render time; only open it when there's somewhere to go.
    if (nextDestRef.current) setUpNextOpen(true)
  }

  // === Native video progress + mid-quiz check ===
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return
    const currentTime = Math.floor(videoRef.current.currentTime)
    const duration = videoRef.current.duration

    const due = midQuiz.findDueMidQuiz(currentTime)
    if (due) {
      midQuiz.triggerMidQuiz(due)
      return
    }

    if (currentTime - lastSavedRef.current >= 10) {
      lastSavedRef.current = currentTime
      const isCompleted = duration && currentTime >= duration * 0.9
      saveProgress({
        lesson_id: currentLesson.id,
        current_position: currentTime,
        is_completed: isCompleted,
      })
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !currentLesson) return
    const saved = progress[currentLesson.id]
    if (saved && saved.current_position > 0 && !saved.is_completed) {
      videoRef.current.currentTime = saved.current_position
    }
    lastSavedRef.current = 0
  }

  // Persist the current position immediately — before a lesson switch and when
  // the tab is backgrounded — so a quick navigate/close doesn't lose up to 10s
  // of progress. PDF keeps its existing "mark complete on leave" semantics.
  function flushProgress() {
    const lesson = currentLessonRef.current
    if (!lesson) return
    const existing = progressRef.current[lesson.id]

    if (lesson.content_type === 'pdf') {
      if (elapsedSecondsRef.current < 5) return
      saveProgress({
        lesson_id: lesson.id,
        current_position: Math.max(
          elapsedSecondsRef.current,
          existing?.current_position || 0
        ),
        is_completed: true,
      })
      return
    }

    let pos = 0
    let completed = existing?.is_completed || false
    if (lesson.content_type === 'video_file' && videoRef.current) {
      pos = Math.floor(videoRef.current.currentTime || 0)
      const dur = videoRef.current.duration
      if (dur && pos >= dur * 0.9) completed = true
    } else if (lesson.content_type === 'video_youtube' && ytPlayerRef.current?.getCurrentTime) {
      try {
        pos = Math.floor(ytPlayerRef.current.getCurrentTime() || 0)
        const dur = ytPlayerRef.current.getDuration?.() || 0
        if (dur && pos >= dur * 0.9) completed = true
      } catch {}
    }
    if (pos <= 0 && !completed) return
    saveProgress({ lesson_id: lesson.id, current_position: pos, is_completed: completed })
  }

  // Keep the visibility listener pointed at the latest closure, then flush once
  // when the tab is hidden.
  useEffect(() => {
    flushRef.current = flushProgress
  })
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flushRef.current?.()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Fresh slate per lesson: re-arm the "video ended" guard and close up-next.
  useEffect(() => {
    setUpNextOpen(false)
    endedHandledRef.current = false
  }, [currentLesson?.id])

  // Elapsed time on this lesson (drives the min-view gate and the PDF timer).
  const minSeconds = currentLesson?.min_view_seconds || 0
  useEffect(() => {
    if (!currentLesson || viewingFinal) return
    if (!progressLoaded) return
    const restored =
      currentLesson.content_type === 'pdf'
        ? progressRef.current[currentLesson.id]?.current_position || 0
        : 0
    setElapsedSeconds(restored)
    const iv = setInterval(() => {
      // Pause the wall-clock min-view timer while the tab is hidden so a PDF
      // gate can't tick down in a backgrounded tab. (Videos pause naturally.)
      if (document.hidden) return
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(iv)
  }, [currentLesson?.id, viewingFinal, progressLoaded])

  useEffect(() => {
    if (!currentLesson || currentLesson.content_type !== 'pdf' || viewingFinal) return
    if (elapsedSeconds === 0 || elapsedSeconds % 10 !== 0) return
    const completeAt = minSeconds > 0 ? minSeconds : 30
    const isCompleted = elapsedSeconds >= completeAt
    saveProgress({
      lesson_id: currentLesson.id,
      current_position: elapsedSeconds,
      is_completed: isCompleted,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds])

  const timeGateMet = minSeconds === 0 || elapsedSeconds >= minSeconds
  const remainingSeconds = Math.max(0, minSeconds - elapsedSeconds)

  return {
    videoRef,
    ytIframeRef,
    elapsedSeconds,
    minSeconds,
    timeGateMet,
    remainingSeconds,
    midQuiz,
    upNextOpen,
    setUpNextOpen,
    saveFailed,
    retrySave,
    dismissSaveError,
    flushProgress,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleMediaEnded,
  }
}
