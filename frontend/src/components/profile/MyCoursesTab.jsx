import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2 } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { mediaUrl } from '@/utils/media'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export default function MyCoursesTab() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    coursesApi.myEnrollments().then(setItems).catch(() => setItems([]))
  }, [])

  if (items === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">คุณยังไม่ได้ลงทะเบียนหลักสูตรใด</p>
          <Button asChild>
            <Link to="/courses">ไปดูหลักสูตรทั้งหมด</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => {
        const progress = e.progress_percent ?? 0
        const id = e.course?.id ?? e.course_id
        const title = e.course?.title ?? e.title
        const coverField = e.course?.cover_image ?? e.cover_image
        const cover = coverField ? mediaUrl(coverField) : '/elearning/forest_logo.png'
        return (
          <Card key={id} className="overflow-hidden border-border/60">
            <Link to={`/courses/${id}/learn`} className="block group">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap gap-1">
                  {progress >= 100 && (
                    <Badge className="bg-success text-success-foreground hover:bg-success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      เสร็จสิ้น
                    </Badge>
                  )}
                  {e.is_mandatory && <Badge variant="destructive">บังคับ</Badge>}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{title}</h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {e.completed_lessons ?? 0}/{e.total_lessons ?? 0} บทเรียน
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}
