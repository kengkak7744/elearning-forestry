import { useMemo } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Lock,
  Paperclip,
  PlayCircle,
  Trophy,
  Tv,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mediaUrl } from '@/utils/media'
import { apiPathPrefix } from '@/api/client'

/**
 * Pick a sensible file extension for the downloaded file. Prefer the actual
 * extension from the URL if it's there; fall back to the obvious one for
 * the content type.
 */
function fileExtForContentType(type, contentUrl) {
  if (typeof contentUrl === 'string') {
    const dot = contentUrl.lastIndexOf('.')
    if (dot > -1 && dot > contentUrl.lastIndexOf('/')) {
      const ext = contentUrl.slice(dot + 1).toLowerCase()
      if (ext.length > 0 && ext.length <= 5) return ext
    }
  }
  return type === 'video_file' ? 'mp4' : 'pdf'
}

function LessonRow({
  lesson,
  index,
  isActive,
  isCompleted,
  isClickable,
  hasQuiz,
  quizPassed,
  isReached,
  onClick,
}) {
  const Icon = lesson.content_type === 'pdf'
    ? FileText
    : lesson.content_type === 'video_youtube'
    ? Tv
    : PlayCircle

  const resourceCount = Array.isArray(lesson.resources) ? lesson.resources.length : 0
  const lessonLabel = [
    `บทเรียน ${index + 1}: ${lesson.title}`,
    isActive ? 'กำลังเปิดอยู่' : '',
    isCompleted ? 'เรียนจบแล้ว' : '',
    !isClickable ? 'ยังไม่สามารถเปิดได้' : '',
    hasQuiz ? (quizPassed ? 'มีแบบทดสอบ ผ่านแล้ว' : 'มีแบบทดสอบ') : '',
    resourceCount > 0 ? `มีเอกสารประกอบ ${resourceCount} ไฟล์` : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-current={isActive ? 'page' : undefined}
      aria-label={lessonLabel}
      title={!isReached ? 'ต้องเรียนตามลำดับ — ยังไม่ปลดล็อกบทนี้' : undefined}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
        isActive && 'bg-primary/10 border-l-4 border-primary',
        !isActive && isClickable && 'hover:bg-muted',
        !isClickable && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
          isCompleted
            ? 'bg-success text-success-foreground'
            : isActive
            ? 'bg-primary/20 text-primary'
            : !isReached
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
      </span>
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isActive ? 'font-medium text-primary' : 'text-foreground'
        )}
      >
        {lesson.title}
      </span>
      {resourceCount > 0 && (
        <span
          className="inline-flex flex-shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground"
          title={`มีเอกสารประกอบ ${resourceCount} ไฟล์`}
          aria-label={`มีเอกสารประกอบ ${resourceCount} ไฟล์`}
        >
          <Paperclip className="h-3 w-3" aria-hidden="true" />
          {resourceCount}
        </span>
      )}
      {hasQuiz && (
        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-0.5 text-[11px]',
            quizPassed ? 'text-success' : 'text-warning'
          )}
        >
          แบบทดสอบ{quizPassed && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
        </span>
      )}
      {!isReached && (
        <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
    </button>
  )
}

export default function LessonTree({
  course,
  currentLessonId,
  viewingFinal,
  progress,
  lessonQuizzes,
  unlockedModuleIds,
  isModuleCleared,
  expandedModules,
  onToggleModule,
  onSwitchLesson,
  finalQuiz,
  allModulesCleared,
  onSwitchToFinal,
}) {
  return (
    <div className="space-y-2">
      {course.modules.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีบทเรียน</p>
      )}

      {course.modules.map((module, mIdx) => {
        const unlocked = unlockedModuleIds.has(module.id)
        const cleared = isModuleCleared(module)
        const expanded = expandedModules.has(module.id)

        return (
          <div
            key={module.id}
            className={cn(
              'overflow-hidden rounded-lg border border-border bg-card',
              !unlocked && 'opacity-70'
            )}
          >
            <button
              type="button"
              onClick={() => onToggleModule(module.id)}
              aria-expanded={expanded}
              aria-controls={`module-lessons-${module.id}`}
              className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2.5 text-left transition hover:bg-muted/60"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">
                โมดูล {mIdx + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="truncate">{module.title}</span>
                {!unlocked && <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
                {unlocked && cleared && (
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" aria-hidden="true" />
                )}
              </span>
              <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                {module.lessons.length} บท
              </span>
            </button>

            {expanded && (
              <div id={`module-lessons-${module.id}`} className="divide-y divide-border">
                {module.lessons.length === 0 ? (
                  <p className="px-3 py-3 text-center text-sm text-muted-foreground">
                    ยังไม่มีบทเรียน
                  </p>
                ) : (
                  module.lessons.map((lesson, lIdx) => {
                    const isActive = !viewingFinal && currentLessonId === lesson.id
                    const lp = progress[lesson.id]
                    const isCompleted = !!lp?.is_completed
                    const isReached = isActive || !!lp
                    const isClickable = unlocked && isReached
                    const lq = lessonQuizzes[lesson.id] || []
                    const hasQuiz = lq.length > 0
                    const quizPassed =
                      hasQuiz && lq.every((q) => q.is_passed || q.can_skip)
                    return (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        index={lIdx}
                        isActive={isActive}
                        isCompleted={isCompleted}
                        isClickable={isClickable}
                        isReached={isReached}
                        hasQuiz={hasQuiz}
                        quizPassed={quizPassed}
                        onClick={() => onSwitchLesson(lesson, module.id)}
                      />
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}

      {finalQuiz && (
        <button
          type="button"
          onClick={onSwitchToFinal}
          disabled={!allModulesCleared}
          aria-current={viewingFinal ? 'page' : undefined}
          aria-label={[
            finalQuiz.title,
            viewingFinal ? 'กำลังเปิดอยู่' : '',
            allModulesCleared ? '' : 'ยังไม่สามารถเปิดได้ ต้องผ่านทุกโมดูลก่อน',
            finalQuiz.is_passed ? 'ผ่านแล้ว' : '',
            `${finalQuiz.questions.length} คำถาม`,
          ].filter(Boolean).join(' ')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
            viewingFinal
              ? 'border-warning/40 bg-warning/10'
              : allModulesCleared
              ? 'border-warning/30 bg-warning/5 hover:bg-warning/10'
              : 'cursor-not-allowed border-border bg-muted/20 opacity-60'
          )}
        >
          <Trophy className="h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
            <span className="truncate">{finalQuiz.title}</span>
            {!allModulesCleared && (
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {finalQuiz.is_passed && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> ผ่านแล้ว
              </span>
            )}
          </span>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
            {finalQuiz.questions.length} คำถาม
          </span>
        </button>
      )}

      <CourseDownloads course={course} />
    </div>
  )
}

/**
 * Bottom-of-the-tree consolidated downloads panel.
 *
 * PDFs are offered as ONE merged file: the server concatenates every PDF lesson
 * in module/lesson order (with a bookmark per lesson) so the learner gets a
 * single document instead of many separate downloads. The link points straight
 * at the merge endpoint so the browser sends the auth cookie itself. Uploaded
 * videos can't be folded into a PDF, so any of those stay listed individually
 * below. YouTube lessons are skipped — we don't host the bytes.
 *
 * Hidden when `course.allow_downloads === false` (admin override on the
 * course-editor Settings tab) or when no lesson has a downloadable file.
 */
function CourseDownloads({ course }) {
  const { pdfLessons, videoLessons } = useMemo(() => {
    const pdfs = []
    const videos = []
    if (Array.isArray(course?.modules)) {
      for (const m of course.modules) {
        for (const lesson of m.lessons ?? []) {
          if (!lesson.content_url) continue
          if (lesson.content_type === 'pdf') pdfs.push(lesson)
          else if (lesson.content_type === 'video_file') videos.push(lesson)
        }
      }
    }
    return { pdfLessons: pdfs, videoLessons: videos }
  }, [course])

  const total = pdfLessons.length + videoLessons.length
  if (course?.allow_downloads === false || total === 0) return null

  const mergedHref = `${apiPathPrefix()}/lessons/course/${course.id}/merged-pdf`
  const mergedName = `${(course.title || 'เอกสารหลักสูตร').replace(/[\\/:*?"<>|]+/g, '').slice(0, 120)}.pdf`

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2.5">
        <Download className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">เอกสารประกอบทั้งหมด</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{total} ไฟล์</span>
      </div>

      <div className="space-y-3 p-3">
        {pdfLessons.length > 0 && (
          <a
            href={mergedHref}
            download={mergedName}
            className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
          >
            <FileText className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              ดาวน์โหลดเอกสารรวมเป็น PDF เดียว
              <span className="block text-[11px] font-normal text-muted-foreground">
                รวม {pdfLessons.length} บทเรียนเป็นไฟล์เดียว
              </span>
            </span>
            <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          </a>
        )}

        {videoLessons.length > 0 && (
          <div>
            <div className="mb-1.5 px-0.5 text-[11px] font-medium text-muted-foreground">
              ไฟล์วิดีโอ (ดาวน์โหลดแยก)
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {videoLessons.map((lesson) => {
                const ext = fileExtForContentType(lesson.content_type, lesson.content_url)
                return (
                  <li key={lesson.id}>
                    <a
                      href={mediaUrl(lesson.content_url)}
                      download={`${lesson.title || 'lesson'}.${ext}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-muted/30"
                    >
                      <PlayCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {lesson.title}
                      </span>
                      <Download className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
