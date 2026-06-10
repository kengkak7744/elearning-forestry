import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CourseCard from '@/components/learner/CourseCard'

export default function BookmarksTab() {
  const [items, setItems] = useState(null)

  const load = () => {
    coursesApi
      .myBookmarks()
      .then(setItems)
      .catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [])

  const handleRemove = async (courseId) => {
    // Optimistic remove
    setItems((prev) => (prev ?? []).filter((c) => c.id !== courseId))
    try {
      await coursesApi.unbookmark(courseId)
    } catch {
      load() // revert by re-fetching truth
    }
  }

  if (items === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
          <p className="text-sm text-muted-foreground">
            ยังไม่มีบุ๊กมาร์ก — กดไอคอน{' '}
            <span className="inline-block">🔖</span> บนการ์ดหลักสูตรเพื่อบันทึกไว้ดูภายหลัง
          </p>
          <Button asChild>
            <Link to="/courses">ไปดูหลักสูตรทั้งหมด</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <CourseCard
          key={c.id}
          course={c}
          bookmarked
          onToggleBookmark={() => handleRemove(c.id)}
        />
      ))}
    </div>
  )
}
