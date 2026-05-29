import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export default function ViewerTopBar({ courseTitle, courseId, progress }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-3 sm:px-4">
        <Link
          to={courseId ? `/courses/${courseId}` : '/courses'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted hover:text-foreground"
          aria-label="กลับหน้าหลักสูตร"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{courseTitle ?? 'กำลังเรียน'}</div>
          {typeof progress === 'number' && (
            <div className="mt-1 flex items-center gap-2">
              <Progress value={progress} className="h-1 flex-1" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
