import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight, FileText, Search } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { searchApi } from '@/api/search'
import { BUTTONS, CATEGORY_BADGES } from '@/constants/labels'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CourseCard from '@/components/learner/CourseCard'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

const MATCH_FIELD_LABELS = {
  title: 'ชื่อบทเรียน',
  description: 'คำอธิบาย',
  notes: 'บันทึก',
  module: 'ชื่อโมดูล',
}

function highlightMatch(text, term) {
  if (!text || !term) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-warning/40 px-0.5 text-foreground">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  )
}

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
  const [searchDraft, setSearchDraft] = useState(search)
  const committedSearchRef = useRef(search)
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

  useEffect(() => {
    if (search === committedSearchRef.current) return
    committedSearchRef.current = search
    setSearchDraft(search)
  }, [search])

  useEffect(() => {
    if (searchDraft === search) return undefined
    const timer = setTimeout(() => {
      const nextSearch = searchDraft.trim() ? searchDraft : ''
      committedSearchRef.current = nextSearch
      updateParam('q', nextSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchDraft, search, updateParam])

  const setMandatoryOnly = (v) => updateParam('m', v ? '1' : '')
  const toggleCategory = (value) => {
    const next = selectedCategories.includes(value)
      ? selectedCategories.filter((v) => v !== value)
      : [...selectedCategories, value]
    updateParam('cat', next.join(','))
  }
  const clearFilters = () => {
    setSearchDraft('')
    setParams({}, { replace: true })
  }

  const [courses, setCourses] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [lessonHits, setLessonHits] = useState([])
  const [lessonSearchLoading, setLessonSearchLoading] = useState(false)

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
    coursesApi
      .myBookmarks()
      .then((list) => setBookmarkedIds(new Set(list.map((c) => c.id))))
      .catch(() => setBookmarkedIds(new Set()))
  }, [])

  // Optimistic toggle — flip the Set immediately, only revert on API failure.
  const toggleBookmark = useCallback(
    async (courseId) => {
      const wasBookmarked = bookmarkedIds.has(courseId)
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (wasBookmarked) next.delete(courseId)
        else next.add(courseId)
        return next
      })
      try {
        if (wasBookmarked) await coursesApi.unbookmark(courseId)
        else await coursesApi.bookmark(courseId)
      } catch {
        // Revert
        setBookmarkedIds((prev) => {
          const next = new Set(prev)
          if (wasBookmarked) next.add(courseId)
          else next.delete(courseId)
          return next
        })
      }
    },
    [bookmarkedIds]
  )

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

  // Lesson-level search runs in parallel with the course-grid filter. Only
  // fires for queries ≥2 chars to avoid noisy single-letter hits, and is
  // debounced for the same reason as the course query.
  useEffect(() => {
    const trimmed = (search ?? '').trim()
    if (trimmed.length < 2) {
      setLessonHits([])
      setLessonSearchLoading(false)
      return
    }
    setLessonSearchLoading(true)
    const timer = setTimeout(() => {
      searchApi
        .lessons(trimmed)
        .then((data) => setLessonHits(data?.lessons ?? []))
        .catch(() => setLessonHits([]))
        .finally(() => setLessonSearchLoading(false))
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

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
            <Label htmlFor="course-search" className="sr-only">
              ค้นหาหลักสูตรหรือบทเรียน
            </Label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="course-search"
              type="search"
              placeholder="ค้นหาหลักสูตร..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
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
                    'min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors',
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
                className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                {BUTTONS.CLEAR_FILTERS}
              </button>
            )}
            <div className="ml-auto flex min-h-11 items-center gap-2">
              <Switch
                id="mandatory-only"
                aria-labelledby="mandatory-only-label"
                checked={mandatoryOnly}
                onCheckedChange={setMandatoryOnly}
              />
              <Label
                id="mandatory-only-label"
                htmlFor="mandatory-only"
                className="cursor-pointer text-sm"
              >
                เฉพาะหลักสูตรบังคับ
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson-level matches — surfaced above the course grid so a user
          searching for content buried inside lessons finds it immediately
          instead of bouncing off an empty/incomplete course-title result. */}
      {(search?.trim()?.length ?? 0) >= 2 && (lessonSearchLoading || lessonHits.length > 0) && (
        <Card className="mb-6 border-border/60">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" />
                พบในบทเรียน
              </h2>
              {!lessonSearchLoading && (
                <span className="text-xs text-muted-foreground">
                  {lessonHits.length} ผลลัพธ์
                </span>
              )}
            </div>
            {lessonSearchLoading ? (
              <Skeleton className="h-16 w-full rounded-md" />
            ) : (
              <ul className="space-y-1.5">
                {lessonHits.map((hit) => {
                  const fieldLabel = MATCH_FIELD_LABELS[hit.match_field]
                  return (
                    <li key={hit.id}>
                      <Link
                        to={`/courses/${hit.course.id}`}
                        className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="line-clamp-1 font-medium text-foreground">
                              {highlightMatch(hit.title, search)}
                            </span>
                            {fieldLabel && (
                              <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {fieldLabel}
                              </span>
                            )}
                          </div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {hit.course?.title}
                            {hit.module?.title ? ` · ${hit.module.title}` : ''}
                          </div>
                          {hit.snippet && (
                            <p className="line-clamp-2 text-[11px] text-muted-foreground">
                              {highlightMatch(hit.snippet, search)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <h2 id="course-results-heading" className="sr-only">
        รายการหลักสูตร
      </h2>
      {loading ? (
        <div
          aria-labelledby="course-results-heading"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
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
          <div
            aria-labelledby="course-results-heading"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {visibleCourses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                progress={progressMap[course.id]}
                bookmarked={bookmarkedIds.has(course.id)}
                onToggleBookmark={() => toggleBookmark(course.id)}
                imagePriority={index < 2}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
