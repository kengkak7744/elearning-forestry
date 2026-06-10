import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, ImageIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { CATEGORY_BADGES } from '@/constants/labels'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toastApiError } from '@/utils/apiError'

const categories = Object.entries(CATEGORY_BADGES).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

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
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}
    </div>
  )
}

export default function CoursesListPage() {
  useDocumentTitle('จัดการหลักสูตร')
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (categoryFilter) params.category = categoryFilter
      const data = await coursesApi.list(params)
      setCourses(data)
    } catch (err) {
      toastApiError(err, 'โหลดรายการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter])

  const handleDelete = async () => {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    try {
      await coursesApi.delete(target.id)
      showToast('ลบหลักสูตรเรียบร้อย', 'success')
      load()
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
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            จัดการหลักสูตร
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            รายการหลักสูตรทั้งหมด
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/admin/courses/new/edit">
            <Plus className="mr-1 h-4 w-4" />
            สร้างหลักสูตรใหม่
          </Link>
        </Button>
      </div>

      <Card className="mb-4 border-border/60">
        <CardContent className="space-y-3 p-4">
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
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
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
                  onClick={() => setCategoryFilter(active ? '' : c.value)}
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
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            ไม่พบหลักสูตร
          </CardContent>
        </Card>
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
                  const cat = CATEGORY_BADGES[c.category]
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
                        {cat && (
                          <Badge variant="secondary" className="font-normal">
                            {cat.label}
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
                              <Pencil className="h-3.5 w-3.5" />
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
                            <Copy className="h-3.5 w-3.5" />
                            <span className="sr-only">ทำสำเนา</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmTarget(c)}
                            className="text-destructive hover:text-destructive"
                            title="ลบ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
              const cat = CATEGORY_BADGES[c.category]
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
                        {cat && (
                          <Badge variant="secondary" className="font-normal">
                            {cat.label}
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
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">แก้ไข</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(c)}
                        disabled={duplicatingId === c.id}
                      >
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">ทำสำเนา</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmTarget(c)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
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

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหลักสูตร</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบหลักสูตร &ldquo;{confirmTarget?.title}&rdquo; และข้อมูลทั้งหมด?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
