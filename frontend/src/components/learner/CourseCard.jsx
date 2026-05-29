import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CATEGORY_BADGES } from '@/constants/labels'
import { mediaUrl } from '@/utils/media'
import { cn } from '@/lib/utils'

const FALLBACK_COVER = '/elearning/forest_logo.png'

/**
 * variants:
 *  - 'default'  — grid card for courses list (square-ish cover + body)
 *  - 'compact'  — horizontal-friendly card for dashboard row
 */
export default function CourseCard({ course, variant = 'default', progress }) {
  const cat = CATEGORY_BADGES[course.category]
  const cover = course.cover_image ? mediaUrl(course.cover_image) : FALLBACK_COVER

  if (variant === 'compact') {
    return (
      <Link
        to={`/courses/${course.id}`}
        className="group block w-72 flex-shrink-0 focus:outline-none"
      >
        <Card className="overflow-hidden border-border/60 transition-shadow group-hover:shadow-md">
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
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
                <Progress value={progress} className="h-1.5" />
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
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
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
                <CheckCircle2 className="mr-0.5 h-3 w-3" />
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
              <Progress value={progress} className="h-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>คืบหน้า</span>
                <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              {course.estimated_hours ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {course.estimated_hours} ชั่วโมง
                </span>
              ) : null}
              {course.modules_count !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
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
