import { Link } from 'react-router-dom'
import { ArrowLeft, Layers, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import LessonTree from '@/components/learner/LessonTree'
import LessonProgressSummary from './LessonProgressSummary'

/**
 * Sticky top bar: back link, course title, course progress bar, a
 * "บทเรียน n/total" position indicator, the scores (trophy) button, and the
 * mobile lesson-tree Sheet (which carries its own progress summary).
 */
export default function ViewerHeader({
  course,
  courseId,
  progressPercent,
  completedItems,
  totalItems,
  completedLessons,
  totalLessons,
  positionLabel,
  treeProps,
  mobileTreeOpen,
  onMobileTreeOpenChange,
  onViewScores,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
          <Link to={`/courses/${courseId}`} aria-label="กลับหน้าหลักสูตร">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{course.title}</div>
          <div className="mt-0.5 flex items-center gap-2">
            {positionLabel && (
              <span className="flex-shrink-0 text-[10px] font-medium text-muted-foreground">
                {positionLabel}
              </span>
            )}
            <Progress value={progressPercent} className="h-1 flex-1" />
            <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {completedItems}/{totalItems} ({progressPercent}%)
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={onViewScores}
          aria-label="ดูคะแนน"
        >
          <Trophy className="h-4 w-4" />
        </Button>
        <Sheet open={mobileTreeOpen} onOpenChange={onMobileTreeOpenChange}>
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
            <LessonProgressSummary completed={completedLessons} total={totalLessons} />
            <LessonTree {...treeProps} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
