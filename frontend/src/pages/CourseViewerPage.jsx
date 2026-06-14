import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { showToast } from '@/lib/toast'
import { fmtTime } from '@/utils/formatting'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useCourseViewerData from '@/hooks/useCourseViewerData'
import useLessonNavigation from '@/hooks/useLessonNavigation'
import useLessonPlayback from '@/hooks/useLessonPlayback'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QuizTaker from '@/components/QuizTaker'
import MidVideoQuizModal from '@/components/MidVideoQuizModal'
import CourseScoresModal from '@/components/CourseScoresModal'
import LessonFooter from '@/components/learner/LessonFooter'
import ViewerHeader from '@/components/viewer/ViewerHeader'
import ViewerSidebar from '@/components/viewer/ViewerSidebar'
import LessonPlayer from '@/components/viewer/LessonPlayer'
import LessonInfoTabs from '@/components/viewer/LessonInfoTabs'
import FinalQuizView from '@/components/viewer/FinalQuizView'
import CourseCompleteView from '@/components/viewer/CourseCompleteView'
import UpNextOverlay from '@/components/viewer/UpNextOverlay'
import SaveErrorBanner from '@/components/viewer/SaveErrorBanner'

function scrollToPageTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
}

/**
 * Course viewer / player. This component is the orchestrator: it owns the
 * lesson-selection + completion UI state and ties together three hooks —
 *   useCourseViewerData  (course/progress/quiz loading + derived structures)
 *   useLessonNavigation  (prev/next/position math)
 *   useLessonPlayback    (players, mid-quizzes, min-view gate, resilient saving)
 * — then composes the viewer/* presentational components.
 */
export default function CourseViewerPage() {
  const { id, lessonId } = useParams()
  const navigate = useNavigate()

  const [currentLesson, setCurrentLesson] = useState(null)
  const [expandedModules, setExpandedModules] = useState(new Set())
  const [viewingFinal, setViewingFinal] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const {
    course,
    loading,
    loadError,
    reload,
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
  } = useCourseViewerData(id)

  // While studying, the tab shows the current lesson title — easier to spot the
  // right tab when several courses/lessons are open at once.
  useDocumentTitle(
    currentLesson && course ? `${currentLesson.title} · ${course.title}` : course?.title
  )

  const { currentPos, nextDest, prevDest } = useLessonNavigation({
    course,
    currentLesson,
    viewingFinal,
    finalQuiz,
  })

  const {
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
  } = useLessonPlayback({
    currentLesson,
    lessonQuizzes,
    quizzesLoaded: quizzes.length > 0,
    progressLoaded,
    viewingFinal,
    progress,
    setProgress,
    nextDest,
  })

  // Switch lesson when URL changes; on first entry without lessonId, resume
  useEffect(() => {
    if (!course) return

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
  }, [course, lessonId, id, navigate, progressLoaded, progress, allLessons])

  // Any lesson-URL change exits the completion screen. (Keyed on lessonId only,
  // so a progress save — which goNext fires on completion — can't reset it.)
  useEffect(() => {
    setShowComplete(false)
  }, [lessonId])

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
    flushProgress()
    setShowComplete(false)
    setViewingFinal(false)
    setMobileTreeOpen(false)
    navigate(`/courses/${id}/learn/${lesson.id}`)
    scrollToPageTop()
  }

  const switchToFinal = () => {
    if (!allModulesCleared) {
      showToast('ต้องผ่านแบบทดสอบในทุกโมดูลก่อน', 'error')
      return
    }
    flushProgress()
    setShowComplete(false)
    setViewingFinal(true)
    setMobileTreeOpen(false)
    scrollToPageTop()
  }

  const blockingQuiz = useMemo(() => {
    if (!currentLesson) return null
    const lq = lessonQuizzes[currentLesson.id] || []
    return (
      lq.find((q) => !q.can_skip && (q.questions?.length || 0) > 0 && !q.is_passed) || null
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
        midQuiz.showMidQuiz(blockingQuiz)
      } else {
        const el = document.getElementById(`quiz-${blockingQuiz.id}`)
        if (el) {
          // Respect prefers-reduced-motion — CSS reset only catches scroll-behavior,
          // not JS-initiated smooth scrolling.
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
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
      // End of course: show the in-viewer completion screen instead of silently
      // issuing the cert + opening a PDF tab + bouncing away. CourseCompleteView
      // drives the (idempotent) cert claim + download on demand.
      flushProgress()
      setUpNextOpen(false)
      setShowComplete(true)
      scrollToPageTop()
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
      flushProgress()
      setViewingFinal(false)
      navigate(`/courses/${id}/learn/${prevDest.lesson.id}`)
      scrollToPageTop()
    }
  }

  const totalItems = totalLessons + (finalQuiz ? 1 : 0)
  const completedItems = completedLessons + (finalQuiz?.is_passed ? 1 : 0)
  const progressPercent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  const lessonNumber = useMemo(() => {
    if (!currentLesson) return 0
    return allLessons.findIndex((l) => l.id === currentLesson.id) + 1
  }, [allLessons, currentLesson])

  const positionLabel = showComplete
    ? 'จบหลักสูตรแล้ว'
    : viewingFinal
    ? 'แบบทดสอบสุดท้าย'
    : currentLesson
    ? `บทเรียน ${lessonNumber}/${totalLessons}`
    : null

  const upNextTitle =
    nextDest?.type === 'final'
      ? finalQuiz?.title || 'แบบทดสอบสุดท้าย'
      : nextDest?.lesson?.title || ''
  const emptyLessonMessage =
    totalLessons === 0 ? 'ยังไม่มีบทเรียนในหลักสูตรนี้' : 'เปิดรายการบทเรียนเพื่อเลือกบทเรียน'

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

  if (loadError && !course) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border/60">
          <CardContent className="p-6 text-center">
            <h1 className="text-base font-semibold text-foreground">โหลดหลักสูตรไม่สำเร็จ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              เกิดข้อผิดพลาดในการโหลดหลักสูตร โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={reload}>ลองใหม่</Button>
              <Button variant="outline" onClick={() => navigate(`/courses/${id}`)}>
                กลับสู่หน้าหลักสูตร
              </Button>
            </div>
          </CardContent>
        </Card>
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
      <ViewerHeader
        course={course}
        courseId={id}
        progressPercent={progressPercent}
        completedItems={completedItems}
        totalItems={totalItems}
        completedLessons={completedLessons}
        totalLessons={totalLessons}
        positionLabel={positionLabel}
        treeProps={treeProps}
        mobileTreeOpen={mobileTreeOpen}
        onMobileTreeOpenChange={setMobileTreeOpen}
        onViewScores={() => setScoresOpen(true)}
      />

      {saveFailed && <SaveErrorBanner onRetry={retrySave} onDismiss={dismissSaveError} />}

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="min-w-0">
            {showComplete ? (
              <CourseCompleteView
                course={course}
                courseId={id}
                finalQuiz={finalQuiz}
                onViewScores={() => setScoresOpen(true)}
                onBackToCourse={() => navigate(`/courses/${id}`)}
              />
            ) : viewingFinal && finalQuiz ? (
              <FinalQuizView finalQuiz={finalQuiz} onAttempted={refreshQuizzes} />
            ) : currentLesson ? (
              <>
                <LessonPlayer
                  lesson={currentLesson}
                  videoRef={videoRef}
                  ytIframeRef={ytIframeRef}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleMediaEnded}
                  onLoadedMetadata={handleLoadedMetadata}
                  overlay={
                    upNextOpen && nextDest ? (
                      <UpNextOverlay
                        title={upNextTitle}
                        ready={timeGateMet && !blockingQuiz}
                        blockingQuiz={blockingQuiz}
                        remainingSeconds={remainingSeconds}
                        onPlay={goNext}
                        onCancel={() => setUpNextOpen(false)}
                        onGoToQuiz={() => {
                          setUpNextOpen(false)
                          goNext()
                        }}
                      />
                    ) : null
                  }
                />

                <LessonInfoTabs
                  key={currentLesson.id}
                  lesson={currentLesson}
                  currentPos={currentPos}
                  minSeconds={minSeconds}
                  timeGateMet={timeGateMet}
                  allowDownloads={course.allow_downloads}
                />

                {/* End-of-lesson quizzes — always visible, never tucked inside a tab */}
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
                  {emptyLessonMessage}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: progress summary + lesson tree (desktop only) */}
          <ViewerSidebar
            treeProps={treeProps}
            completedLessons={completedLessons}
            totalLessons={totalLessons}
          />
        </div>
      </div>

      {!showComplete && (
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
          onFinish={() => setShowComplete(true)}
        />
      )}

      <MidVideoQuizModal
        quiz={midQuiz.activeMidQuiz}
        showToast={showToast}
        onAttempted={refreshQuizzes}
        onContinue={midQuiz.closeMidQuiz}
        onSkip={midQuiz.closeMidQuiz}
        onRewind={midQuiz.rewindMidQuiz}
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
