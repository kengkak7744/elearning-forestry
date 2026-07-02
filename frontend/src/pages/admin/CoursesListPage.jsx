import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, ImageIcon, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { categoryLabel, useCategories } from '@/hooks/useCategories'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFetchData from '@/hooks/useFetchData'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ManageCategoriesDialog from '@/components/admin/ManageCategoriesDialog'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminEmptyState from '@/components/admin/AdminEmptyState'
import SkeletonRows from '@/components/admin/SkeletonRows'
import LoadMoreButton from '@/components/admin/LoadMoreButton'
import { cn } from '@/lib/utils'
import { toastApiError } from '@/utils/apiError'

const PAGE_SIZE = 50

function CoverThumb({ src, alt }) {
  return (
    <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

export default function CoursesListPage() {
  useDocumentTitle('จัดการหลักสูตร')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const categories = useCategories()
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const navigate = useNavigate()

  const buildParams = () => {
    const params = { limit: PAGE_SIZE }
    if (search) params.search = search
    if (categoryFilter) params.category = categoryFilter
    return params
  }

  const {
    data: courses,
    loading,
    setData,
    reload,
  } = useFetchData(() => coursesApi.list(buildParams()), [search, categoryFilter], {
    errorFallback: 'โหลดรายการไม่สำเร็จ',
    initialData: [],
    debounceMs: search ? 350 : 0,
  })

  // Reset paging when filters change — done in the change handlers (not an
  // effect) to avoid a cascading set-state-in-effect.
  const onSearchChange = (e) => {
    setSearch(e.target.value)
    setReachedEnd(false)
  }
  const onCategoryChange = (value) => {
    setCategoryFilter(value)
    setReachedEnd(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = await coursesApi.list({ ...buildParams(), skip: courses.length })
      setData((prev) => [...prev, ...next])
      if (next.length < PAGE_SIZE) setReachedEnd(true)
    } catch (err) {
      toastApiError(err, 'โหลดเพิ่มเติมไม่สำเร็จ')
    } finally {
      setLoadingMore(false)
    }
  }

  const canLoadMore =
    !loading && !reachedEnd && courses.length >= PAGE_SIZE && courses.length % PAGE_SIZE === 0

  const handleDelete = async () => {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    try {
      await coursesApi.delete(target.id)
      showToast('ลบหลักสูตรเรียบร้อย', 'success')
      setReachedEnd(false)
      reload()
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  const handleDuplicate = async (course) => {
    if (duplicatingId) return // guard against double-click
    setDuplicatingId(course.id)
    try {
      const data = await coursesApi.duplicate(course.id)
      showToast(
        data?.message || `ทำสำเนาหลักสูตร '${course.title}' เรียบร้อย`,
        'success'
      )
      // Drop the admin into the new course's editor so they can rename/publish
      // immediately instead of hunting for it in the list.
      if (data?.id) navigate(`/admin/courses/${data.id}/edit`)
    } catch (err) {
      toastApiError(err, 'ทำสำเนาไม่สำเร็จ')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <AdminPageHeader
        title="จัดการหลักสูตร"
        subtitle="รายการหลักสูตรทั้งหมด"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCategoriesOpen(true)}
            >
              <Tags className="mr-1 h-4 w-4" aria-hidden="true" />
              จัดการหมวดหมู่
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/admin/courses/new/edit">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                สร้างหลักสูตรใหม่
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-4 border-border/60">
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Label htmlFor="admin-course-search" className="sr-only">
              ค้นหาหลักสูตร
            </Label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-course-search"
              type="search"
              placeholder="ค้นหาหลักสูตร..."
              value={search}
              onChange={onSearchChange}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCategoryChange('')}
              aria-pressed={categoryFilter === ''}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                categoryFilter === ''
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              )}
            >
              ทั้งหมด
            </button>
            {categories.map((c) => {
              const active = categoryFilter === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onCategoryChange(active ? '' : c.value)}
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
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <SkeletonRows count={5} className="h-16" />
      ) : courses.length === 0 ? (
        <AdminEmptyState>ไม่พบหลักสูตร</AdminEmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden border-border/60 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[64px]">ปก</TableHead>
                  <TableHead>ชื่อหลักสูตร</TableHead>
                  <TableHead>หมวด</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ผู้ลงทะเบียน</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => {
                  const catLabel = categoryLabel(categories, c.category)
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <CoverThumb
                          src={c.cover_image ? mediaUrl(c.cover_image) : null}
                          alt={c.title}
                        />
                      </TableCell>
                      <TableCell className="min-w-[240px] max-w-[420px]">
                        <Link
                          to={`/admin/courses/${c.id}/edit`}
                          className="block truncate font-medium text-foreground hover:text-primary"
                        >
                          {c.title}
                        </Link>
                        {c.instructor_name && (
                          <p className="truncate text-xs text-muted-foreground">
                            วิทยากร: {c.instructor_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {catLabel && (
                          <Badge variant="secondary" className="font-normal">
                            {catLabel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.is_published ? (
                            <Badge variant="outline" className="border-success/40 text-success">
                              เผยแพร่
                            </Badge>
                          ) : (
                            <Badge variant="secondary">ฉบับร่าง</Badge>
                          )}
                          {c.is_mandatory && (
                            <Badge variant="destructive">บังคับ</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.enrolled_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm" title="แก้ไข">
                            <Link to={`/admin/courses/${c.id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">แก้ไข</span>
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(c)}
                            disabled={duplicatingId === c.id}
                            title="ทำสำเนา"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">ทำสำเนา</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmTarget(c)}
                            className="text-destructive hover:text-destructive"
                            title="ลบ"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">ลบ</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile stacked cards */}
          <div className="space-y-3 md:hidden">
            {courses.map((c) => {
              const catLabel = categoryLabel(categories, c.category)
              return (
                <Card key={c.id} className="border-border/60">
                  <CardContent className="flex items-start gap-3 p-3">
                    <CoverThumb
                      src={c.cover_image ? mediaUrl(c.cover_image) : null}
                      alt={c.title}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/courses/${c.id}/edit`}
                        className="block text-sm font-medium text-foreground hover:text-primary"
                      >
                        {c.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {catLabel && (
                          <Badge variant="secondary" className="font-normal">
                            {catLabel}
                          </Badge>
                        )}
                        {c.is_mandatory && <Badge variant="destructive">บังคับ</Badge>}
                        {!c.is_published && <Badge variant="secondary">ฉบับร่าง</Badge>}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        ผู้ลงทะเบียน {c.enrolled_count ?? 0} คน
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link to={`/admin/courses/${c.id}/edit`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">แก้ไข</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(c)}
                        disabled={duplicatingId === c.id}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">ทำสำเนา</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmTarget(c)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">ลบ</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {!loading && courses.length > 0 && (
        <>
          {canLoadMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
          <div className="mt-4 text-sm text-muted-foreground">
            แสดง {courses.length} รายการ
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="ลบหลักสูตร"
        description={
          <>
            ต้องการลบหลักสูตร &ldquo;{confirmTarget?.title}&rdquo; และข้อมูลทั้งหมด?
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </>
        }
        confirmLabel="ยืนยันลบ"
        destructive
        onConfirm={handleDelete}
      />

      <ManageCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </div>
  )
}
