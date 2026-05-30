import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { BUTTONS, CATEGORY_BADGES } from '@/constants/labels'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CourseCard from '@/components/learner/CourseCard'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const categories = Object.entries(CATEGORY_BADGES).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export default function CoursesPage() {
  useDocumentTitle('หลักสูตรทั้งหมด')
  const [params, setParams] = useSearchParams()

  // Read filters from URL as stable primitives. Parsing into arrays must
  // happen via useMemo, otherwise every render produces a new reference and
  // useEffect below loops forever.
  const search = params.get('q') ?? ''
  const catParam = params.get('cat') ?? ''
  const mandatoryOnly = params.get('m') === '1'
  const selectedCategories = useMemo(
    () => (catParam ? catParam.split(',').filter(Boolean) : []),
    [catParam]
  )

  const updateParam = useCallback(
    (key, value) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )

  const setSearch = (v) => updateParam('q', v)
  const setMandatoryOnly = (v) => updateParam('m', v ? '1' : '')
  const toggleCategory = (value) => {
    const next = selectedCategories.includes(value)
      ? selectedCategories.filter((v) => v !== value)
      : [...selectedCategories, value]
    updateParam('cat', next.join(','))
  }
  const clearFilters = () => {
    setParams({}, { replace: true })
  }

  const [courses, setCourses] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Fetch enrollments once on mount — used to badge cards with progress %.
  useEffect(() => {
    coursesApi
      .myEnrollments()
      .then((list) => {
        const map = {}
        list.forEach((e) => {
          const id = e.course?.id ?? e.course_id
          const pct = e.progress_percent ?? e.progress_percentage ?? 0
          if (id != null) map[id] = pct
        })
        setProgressMap(map)
      })
      .catch(() => setProgressMap({}))
  }, [])

  // Server filters by single category; for multi-select fetch unfiltered and
  // narrow client-side. Depend on stable primitive `catParam`, not the
  // parsed array — derived arrays get new refs every render.
  useEffect(() => {
    const reqParams = {}
    if (search) reqParams.search = search
    const cats = catParam ? catParam.split(',').filter(Boolean) : []
    if (cats.length === 1) reqParams.category = cats[0]
    if (mandatoryOnly) reqParams.is_mandatory = true

    setLoading(true)
    const timer = setTimeout(() => {
      coursesApi
        .list(reqParams)
        .then(setCourses)
        .catch(() => setCourses([]))
        .finally(() => setLoading(false))
    }, search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search, catParam, mandatoryOnly])

  const visibleCourses = useMemo(() => {
    if (selectedCategories.length <= 1) return courses
    return courses.filter((c) => selectedCategories.includes(c.category))
  }, [courses, selectedCategories])

  const hasFilter =
    !!search || selectedCategories.length > 0 || mandatoryOnly

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">หลักสูตรทั้งหมด</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เลือกหลักสูตรที่สนใจเพื่อเริ่มเรียนรู้
        </p>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 -mx-4 mb-6 border-y border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ค้นหาหลักสูตร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((c) => {
              const active = selectedCategories.includes(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCategory(c.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                  aria-pressed={active}
                >
                  {c.label}
                </button>
              )
            })}
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                {BUTTONS.CLEAR_FILTERS}
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Switch
                id="mandatory-only"
                checked={mandatoryOnly}
                onCheckedChange={setMandatoryOnly}
              />
              <Label htmlFor="mandatory-only" className="cursor-pointer text-sm">
                เฉพาะหลักสูตรบังคับ
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : visibleCourses.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {hasFilter
                ? 'ไม่พบหลักสูตรตรงกับตัวกรอง — ลองปรับการค้นหา'
                : 'ยังไม่มีหลักสูตร'}
            </p>
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-primary hover:underline"
              >
                {BUTTONS.CLEAR_FILTERS}
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-3 text-xs text-muted-foreground">
            พบ {visibleCourses.length} หลักสูตร
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                progress={progressMap[course.id]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
