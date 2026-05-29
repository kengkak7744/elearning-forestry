import { CheckCircle2, ChevronDown, ChevronRight, FileText, Lock, PlayCircle, Tv, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
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
        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
      </span>
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isActive ? 'font-medium text-primary' : 'text-foreground'
        )}
      >
        {lesson.title}
      </span>
      {hasQuiz && (
        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-0.5 text-[11px]',
            quizPassed ? 'text-success' : 'text-warning'
          )}
        >
          แบบทดสอบ{quizPassed && <CheckCircle2 className="h-3 w-3" />}
        </span>
      )}
      {!isReached && (
        <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
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
              className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2.5 text-left transition hover:bg-muted/60"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">
                โมดูล {mIdx + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="truncate">{module.title}</span>
                {!unlocked && <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
                {unlocked && cleared && (
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                )}
              </span>
              <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                {module.lessons.length} บท
              </span>
            </button>

            {expanded && (
              <div className="divide-y divide-border">
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
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
            viewingFinal
              ? 'border-warning/40 bg-warning/10'
              : allModulesCleared
              ? 'border-warning/30 bg-warning/5 hover:bg-warning/10'
              : 'cursor-not-allowed border-border bg-muted/20 opacity-60'
          )}
        >
          <Trophy className="h-5 w-5 flex-shrink-0 text-warning" />
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
            <span className="truncate">{finalQuiz.title}</span>
            {!allModulesCleared && (
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            {finalQuiz.is_passed && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-success">
                <CheckCircle2 className="h-3 w-3" /> ผ่านแล้ว
              </span>
            )}
          </span>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
            {finalQuiz.questions.length} คำถาม
          </span>
        </button>
      )}
    </div>
  )
}
