import { Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck, BookOpen, CheckCircle2, Clock, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CATEGORY_BADGES } from '@/constants/labels'
import { mediaUrl } from '@/utils/media'
import { cn } from '@/lib/utils'

function BookmarkToggle({ bookmarked, onToggle }) {
  if (!onToggle) return null
  const Icon = bookmarked ? BookmarkCheck : Bookmark
  return (
    <button
      type="button"
      onClick={(e) => {
        // The card itself is an <a>; without preventDefault the browser
        // navigates before the toggle fires.
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      aria-label={bookmarked ? 'เอาออกจากบุ๊กมาร์ก' : 'บันทึกหลักสูตรนี้ไว้'}
      title={bookmarked ? 'เอาออกจากบุ๊กมาร์ก' : 'บันทึกหลักสูตรนี้ไว้'}
      className={cn(
        'absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-colors',
        bookmarked
          ? 'bg-warning text-warning-foreground shadow hover:bg-warning/90'
          : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', bookmarked && 'fill-current')} aria-hidden="true" />
    </button>
  )
}

function CourseCoverFallback({ title }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/12 via-card to-accent/12 px-4 text-center">
      <BookOpen className="h-8 w-8 text-primary/80" aria-hidden="true" />
      <span className="line-clamp-2 text-sm font-medium text-foreground">{title}</span>
    </div>
  )
}

/**
 * variants:
 *  - 'default'  — grid card for courses list (square-ish cover + body)
 *  - 'compact'  — horizontal-friendly card for dashboard row
 *
 * `bookmarked` + `onToggleBookmark` are optional. If both are provided, a
 * bookmark toggle button overlays the top-right corner of the cover image.
 */
export default function CourseCard({
  course,
  variant = 'default',
  progress,
  bookmarked = false,
  onToggleBookmark,
  imagePriority = false,
}) {
  const cat = CATEGORY_BADGES[course.category]
  const hasCover = Boolean(course.cover_image)
  const cover = hasCover ? mediaUrl(course.cover_image) : ''

  if (variant === 'compact') {
    return (
      <Link
        to={`/courses/${course.id}`}
        className="group block w-72 flex-shrink-0 focus:outline-none"
      >
        <Card className="overflow-hidden border-border/60 transition-shadow group-hover:shadow-md">
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {hasCover ? (
              <img
                src={cover}
                alt=""
                loading={imagePriority ? 'eager' : 'lazy'}
                fetchPriority={imagePriority ? 'high' : 'auto'}
                decoding={imagePriority ? 'sync' : 'async'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <CourseCoverFallback title={course.title} />
            )}
            <BookmarkToggle bookmarked={bookmarked} onToggle={onToggleBookmark} />
          </div>
          <CardContent className="p-4">
            {cat && (
              <Badge variant="secondary" className="mb-2 font-normal">
                {cat.label}
              </Badge>
            )}
            <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
              {course.title}
            </h3>
            {typeof progress === 'number' && (
              <div className="mt-3 space-y-1">
                <Progress
                  value={progress}
                  className="h-1.5"
                  aria-label={`ความคืบหน้าหลักสูตร ${course.title}`}
                />
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(progress)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  const hasProgress = typeof progress === 'number'
  const isCompleted = hasProgress && progress >= 100
  const inProgress = hasProgress && progress > 0 && progress < 100
  // Enrolled users go straight to the lesson viewer; non-enrolled view detail.
  const targetHref = hasProgress
    ? `/courses/${course.id}/learn`
    : `/courses/${course.id}`

  return (
    <Link
      to={targetHref}
      className="group block focus:outline-none"
    >
      <Card className="h-full overflow-hidden border-border/60 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {hasCover ? (
            <img
              src={cover}
              alt=""
              loading={imagePriority ? 'eager' : 'lazy'}
              fetchPriority={imagePriority ? 'high' : 'auto'}
              decoding={imagePriority ? 'sync' : 'async'}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <CourseCoverFallback title={course.title} />
          )}
          <BookmarkToggle bookmarked={bookmarked} onToggle={onToggleBookmark} />
          <div className="absolute left-2 top-2 flex gap-1">
            {course.is_mandatory && (
              <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                บังคับ
              </Badge>
            )}
            {!course.is_published && (
              <Badge variant="secondary">ฉบับร่าง</Badge>
            )}
            {isCompleted && (
              <Badge className="bg-success text-success-foreground hover:bg-success">
                <CheckCircle2 className="mr-0.5 h-3 w-3" aria-hidden="true" />
                เรียนจบ
              </Badge>
            )}
            {inProgress && (
              <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                กำลังเรียน
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="space-y-2 p-4">
          {cat && (
            <Badge variant="secondary" className={cn('font-normal')}>
              {cat.label}
            </Badge>
          )}
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">
            {course.title}
          </h3>
          {course.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {course.description}
            </p>
          )}
          {hasProgress && !isCompleted ? (
            <div className="space-y-1 pt-1">
              <Progress
                value={progress}
                className="h-1.5"
                aria-label={`ความคืบหน้าหลักสูตร ${course.title}`}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>คืบหน้า</span>
                <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              {course.estimated_hours ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {course.estimated_hours} ชั่วโมง
                </span>
              ) : null}
              {course.modules_count !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                  {course.modules_count} โมดูล
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
