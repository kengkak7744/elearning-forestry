import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  LineChart,
  Plus,
  Save,
  Trash2,
  Video,
} from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { modulesApi } from '@/api/modules'
import { lessonsApi } from '@/api/lessons'
import { CATEGORY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/constants/labels'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import QuizManager from '@/components/QuizManager'
import CourseStatsModal from '@/components/CourseStatsModal'
import useDocumentTitle from '@/hooks/useDocumentTitle'

function PromptInputDialog({ open, title, label, placeholder, onConfirm, onCancel }) {
  const [value, setValue] = useState('')
  useEffect(() => {
    if (!open) setValue('')
  }, [open])

  const submit = (e) => {
    e.preventDefault()
    if (!value.trim()) return
    onConfirm(value.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} id="prompt-form" className="space-y-1.5">
          <Label htmlFor="prompt-input">{label}</Label>
          <Input
            id="prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            required
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button type="submit" form="prompt-form" disabled={!value.trim()}>
            ยืนยัน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CourseEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [promptState, setPromptState] = useState(null)

  const [statsOpen, setStatsOpen] = useState(false)
  const [deleteCourseOpen, setDeleteCourseOpen] = useState(false)

  const [coverImage, setCoverImage] = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverProgress, setCoverProgress] = useState(0)

  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    category: 'technical',
    is_mandatory: false,
    estimated_hours: '',
    instructor_name: '',
    is_published: false,
    recertify_after_days: '',
  })

  const [modules, setModules] = useState([])

  useDocumentTitle(
    isNew ? 'สร้างหลักสูตรใหม่' : courseData.title ? `แก้ไข: ${courseData.title}` : 'แก้ไขหลักสูตร'
  )


  const loadCourse = async () => {
    setLoading(true)
    try {
      const data = await coursesApi.getById(id)
      setCourseData({
        title: data.title || '',
        description: data.description || '',
        category: data.category || 'technical',
        is_mandatory: data.is_mandatory || false,
        estimated_hours: data.estimated_hours || '',
        instructor_name: data.instructor_name || '',
        is_published: data.is_published || false,
        recertify_after_days: data.recertify_after_days ?? '',
      })
      setCoverImage(data.cover_image || null)
      setModules(data.modules || [])
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isNew) loadCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const updateField = (key) => (val) => {
    setCourseData((prev) => ({ ...prev, [key]: val }))
  }

  const handleSaveCourse = async (e) => {
    e?.preventDefault?.()
    setSaving(true)
    const payload = {
      ...courseData,
      estimated_hours: courseData.estimated_hours
        ? parseInt(courseData.estimated_hours)
        : null,
      recertify_after_days: courseData.recertify_after_days
        ? parseInt(courseData.recertify_after_days)
        : null,
    }
    try {
      if (isNew) {
        const created = await coursesApi.create(payload)
        showToast('สร้างหลักสูตรสำเร็จ', 'success')
        navigate(`/admin/courses/${created.id}/edit`, { replace: true })
      } else {
        await coursesApi.update(id, payload)
        showToast('บันทึกหลักสูตรสำเร็จ', 'success')
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourse = async () => {
    setDeleteCourseOpen(false)
    try {
      await coursesApi.delete(id)
      showToast('ลบหลักสูตรเรียบร้อย', 'success')
      navigate('/admin/courses')
    } catch (err) {
      showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverUploading(true)
    setCoverProgress(0)
    try {
      const result = await coursesApi.uploadCoverImage(id, file, setCoverProgress)
      setCoverImage(result.cover_image)
      showToast('อัปโหลดรูปภาพปกสำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'อัปโหลดไม่สำเร็จ', 'error')
    } finally {
      setCoverUploading(false)
      setCoverProgress(0)
    }
  }

  const handleAddModule = () => {
    setPromptState({
      title: 'เพิ่มโมดูลใหม่',
      label: 'ชื่อโมดูล',
      placeholder: 'เช่น บทที่ 1 บทนำ',
      onConfirm: async (title) => {
        try {
          const newModule = await modulesApi.create({
            course_id: parseInt(id),
            title,
            order_index: modules.length,
          })
          setModules([...modules, { ...newModule, lessons: [] }])
          showToast('เพิ่มโมดูลสำเร็จ', 'success')
        } catch (err) {
          showToast(err.response?.data?.detail || 'เพิ่มโมดูลไม่สำเร็จ', 'error')
        }
        setPromptState(null)
      },
    })
  }

  const handleUpdateModule = async (moduleId, updates) => {
    try {
      await modulesApi.update(moduleId, updates)
      setModules(modules.map((m) => (m.id === moduleId ? { ...m, ...updates } : m)))
    } catch (err) {
      showToast(err.response?.data?.detail || 'แก้ไขไม่สำเร็จ', 'error')
    }
  }

  const handleDeleteModule = (moduleId) => {
    setConfirmState({
      title: 'ลบโมดูล',
      description: 'ต้องการลบโมดูลนี้และบทเรียนทั้งหมดในโมดูล?',
      onConfirm: async () => {
        try {
          await modulesApi.delete(moduleId)
          setModules(modules.filter((m) => m.id !== moduleId))
          showToast('ลบโมดูลเรียบร้อย', 'success')
        } catch (err) {
          showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
        }
        setConfirmState(null)
      },
    })
  }

  const handleAddLesson = (moduleId) => {
    const module = modules.find((m) => m.id === moduleId)
    setPromptState({
      title: 'เพิ่มบทเรียนใหม่',
      label: 'ชื่อบทเรียน',
      placeholder: 'เช่น ความสำคัญของการอนุรักษ์ป่าไม้',
      onConfirm: async (title) => {
        try {
          const newLesson = await lessonsApi.create({
            module_id: moduleId,
            title,
            content_type: 'video_youtube',
            order_index: module.lessons.length,
          })
          setModules(
            modules.map((m) =>
              m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m
            )
          )
          showToast('เพิ่มบทเรียนสำเร็จ', 'success')
        } catch (err) {
          showToast(err.response?.data?.detail || 'เพิ่มบทเรียนไม่สำเร็จ', 'error')
        }
        setPromptState(null)
      },
    })
  }

  const handleUpdateLesson = (moduleId, lessonId, updates) => {
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)),
            }
          : m
      )
    )
  }

  const handleSaveLesson = async (lesson) => {
    try {
      await lessonsApi.update(lesson.id, lesson)
      showToast('บันทึกบทเรียนสำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  const handleDeleteLesson = (moduleId, lessonId) => {
    setConfirmState({
      title: 'ลบบทเรียน',
      description: 'ต้องการลบบทเรียนนี้หรือไม่?',
      onConfirm: async () => {
        try {
          await lessonsApi.delete(lessonId)
          setModules(
            modules.map((m) =>
              m.id === moduleId
                ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
                : m
            )
          )
          showToast('ลบบทเรียนเรียบร้อย', 'success')
        } catch (err) {
          showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
        }
        setConfirmState(null)
      },
    })
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="mb-6 h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <Link
        to="/admin/courses"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        จัดการหลักสูตร
      </Link>

      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {isNew ? 'สร้างหลักสูตรใหม่' : courseData.title || 'แก้ไขหลักสูตร'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNew ? 'กรอกข้อมูลพื้นฐานเพื่อเริ่มต้น' : 'จัดการเนื้อหา แบบทดสอบ และการเผยแพร่'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <Button variant="outline" onClick={() => setStatsOpen(true)}>
              <LineChart className="mr-1.5 h-4 w-4" />
              ดูสถิติ
            </Button>
          )}
          <Button onClick={handleSaveCourse} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'กำลังบันทึก...' : isNew ? 'สร้างหลักสูตร' : 'บันทึก'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="content" disabled={isNew}>
            เนื้อหา
          </TabsTrigger>
          <TabsTrigger value="quizzes" disabled={isNew}>
            แบบทดสอบ
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={isNew}>
            ตั้งค่า
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">ข้อมูลหลักสูตร</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCourse} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ce-title">
                    ชื่อหลักสูตร <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ce-title"
                    required
                    minLength={3}
                    maxLength={200}
                    value={courseData.title}
                    onChange={(e) => updateField('title')(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ce-description">คำอธิบายหลักสูตร</Label>
                  <Textarea
                    id="ce-description"
                    rows={5}
                    value={courseData.description}
                    onChange={(e) => updateField('description')(e.target.value)}
                  />
                </div>

                {!isNew && (
                  <div className="space-y-2">
                    <Label>รูปภาพปกหลักสูตร</Label>
                    <div className="flex items-start gap-4">
                      {coverImage ? (
                        <img
                          src={mediaUrl(coverImage)}
                          alt="ปกหลักสูตร"
                          className="h-20 w-32 flex-shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          disabled={coverUploading}
                          className="text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 10 MB
                        </p>
                        {coverUploading && (
                          <div className="mt-2 space-y-1">
                            <Progress value={coverProgress} className="h-1.5" />
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {coverProgress}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-cat">
                      หมวดหมู่ <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={courseData.category}
                      onValueChange={updateField('category')}
                    >
                      <SelectTrigger id="ce-cat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-instructor">วิทยากร</Label>
                    <Input
                      id="ce-instructor"
                      maxLength={150}
                      value={courseData.instructor_name}
                      onChange={(e) => updateField('instructor_name')(e.target.value)}
                      placeholder="เช่น ดร. สมศักดิ์ พงษ์พันธ์"
                    />
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENT (modules/lessons) */}
        <TabsContent value="content">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <h2 className="text-base font-semibold">โมดูลและบทเรียน</h2>
              <Button size="sm" onClick={handleAddModule}>
                <Plus className="mr-1 h-4 w-4" />
                เพิ่มโมดูล
              </Button>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  ยังไม่มีโมดูล กดปุ่ม &ldquo;เพิ่มโมดูล&rdquo; เพื่อเริ่มต้น
                </p>
              ) : (
                <div className="space-y-3">
                  {modules.map((module, mIdx) => (
                    <ModuleEditor
                      key={module.id}
                      module={module}
                      index={mIdx}
                      onUpdate={(updates) => handleUpdateModule(module.id, updates)}
                      onDelete={() => handleDeleteModule(module.id)}
                      onAddLesson={() => handleAddLesson(module.id)}
                      onUpdateLesson={(lessonId, updates) =>
                        handleUpdateLesson(module.id, lessonId, updates)
                      }
                      onSaveLesson={handleSaveLesson}
                      onDeleteLesson={(lessonId) => handleDeleteLesson(module.id, lessonId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUIZZES (final) */}
        <TabsContent value="quizzes">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">แบบทดสอบสุดท้าย</h2>
              <p className="text-sm text-muted-foreground">
                ใช้ประเมินการเรียนรู้รวมทั้งหลักสูตร
              </p>
            </CardHeader>
            <CardContent>
              <QuizManager courseId={parseInt(id)} scope="final" showToast={showToast} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings">
          <div className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold">การเผยแพร่</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="ce-pub">เผยแพร่หลักสูตร</Label>
                    <p className="text-xs text-muted-foreground">
                      หากปิดอยู่ ผู้เรียนจะมองไม่เห็นหลักสูตรนี้
                    </p>
                  </div>
                  <Switch
                    id="ce-pub"
                    checked={courseData.is_published}
                    onCheckedChange={updateField('is_published')}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="ce-mand">หลักสูตรบังคับ</Label>
                    <p className="text-xs text-muted-foreground">
                      ผู้เรียนทุกคนจำเป็นต้องเรียนหลักสูตรนี้
                    </p>
                  </div>
                  <Switch
                    id="ce-mand"
                    checked={courseData.is_mandatory}
                    onCheckedChange={updateField('is_mandatory')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ce-hours">ระยะเวลา (ชั่วโมง)</Label>
                  <Input
                    id="ce-hours"
                    type="number"
                    min={0}
                    value={courseData.estimated_hours}
                    onChange={(e) => updateField('estimated_hours')(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ce-recert">
                    อายุใบรับรอง (วัน)
                    <span className="ml-1 font-normal text-muted-foreground">
                      — เว้นว่าง = ใบรับรองไม่หมดอายุ
                    </span>
                  </Label>
                  <Input
                    id="ce-recert"
                    type="number"
                    min={0}
                    value={courseData.recertify_after_days}
                    onChange={(e) => updateField('recertify_after_days')(e.target.value)}
                    placeholder="เช่น 365 = ต้องอบรมใหม่ทุก 1 ปี"
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    เมื่อใบรับรองหมดอายุ ผู้เรียนต้องทำแบบทดสอบสุดท้ายอีกครั้งเพื่อขอใบรับรองใหม่
                  </p>
                </div>
              </CardContent>
            </Card>

            {!isNew && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <h2 className="text-base font-semibold text-destructive">
                    โซนอันตราย
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    การกระทำนี้ไม่สามารถย้อนกลับได้
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteCourseOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    ลบหลักสูตรนี้
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <PromptInputDialog
        open={!!promptState}
        title={promptState?.title}
        label={promptState?.label}
        placeholder={promptState?.placeholder}
        onConfirm={promptState?.onConfirm}
        onCancel={() => setPromptState(null)}
      />

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmState?.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCourseOpen} onOpenChange={setDeleteCourseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหลักสูตร</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบหลักสูตร &ldquo;{courseData.title}&rdquo; พร้อมโมดูล บทเรียน และข้อมูลทั้งหมด?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบหลักสูตร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CourseStatsModal
        open={statsOpen}
        courseId={isNew ? null : id}
        onClose={() => setStatsOpen(false)}
      />
    </div>
  )
}

function ModuleEditor({
  module,
  index,
  onUpdate,
  onDelete,
  onAddLesson,
  onUpdateLesson,
  onSaveLesson,
  onDeleteLesson,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [expanded, setExpanded] = useState(true)

  const handleSave = () => {
    onUpdate({ title })
    setEditing(false)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'ย่อ' : 'ขยาย'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">
          โมดูลที่ {index + 1}
        </span>
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="h-8 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 cursor-text text-left text-sm font-medium text-foreground hover:text-primary"
          >
            {module.title}
          </button>
        )}
        <Button variant="outline" size="sm" onClick={onAddLesson}>
          <Plus className="mr-1 h-3 w-3" />
          บทเรียน
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">ลบโมดูล</span>
        </Button>
      </div>

      {expanded && (
        <div className="divide-y divide-border">
          {module.lessons.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">ยังไม่มีบทเรียน</p>
          ) : (
            module.lessons.map((lesson, lIdx) => (
              <LessonEditor
                key={lesson.id}
                lesson={lesson}
                index={lIdx}
                onUpdate={(updates) => onUpdateLesson(lesson.id, updates)}
                onSave={() => onSaveLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function LessonEditor({ lesson, index, onUpdate, onSave, onDelete }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const setField = (key) => (val) => {
    onUpdate({ [key]: val })
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const updated = await lessonsApi.uploadVideo(lesson.id, file, setUploadProgress)
      onUpdate(updated)
      showToast('อัปโหลดวิดีโอสำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'อัปโหลดไม่สำเร็จ', 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const updated = await lessonsApi.uploadPdf(lesson.id, file, setUploadProgress)
      onUpdate(updated)
      showToast('อัปโหลด PDF สำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'อัปโหลดไม่สำเร็จ', 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const contentTypeLabel =
    CONTENT_TYPE_OPTIONS.find((o) => o.value === lesson.content_type)?.label ?? lesson.content_type

  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? `ย่อบทเรียน ${lesson.title}` : `ขยายบทเรียน ${lesson.title}`}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
        <span className="flex-1 truncate text-sm text-foreground">{lesson.title}</span>
        <Badge variant="secondary" className="font-normal">
          {contentTypeLabel}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">ลบบทเรียน</span>
        </Button>
      </div>

      {expanded && (
        <div className="ml-8 mt-3 space-y-3 pb-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">ชื่อบทเรียน</Label>
              <Input
                value={lesson.title}
                onChange={(e) => setField('title')(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ประเภทเนื้อหา</Label>
              <Select
                value={lesson.content_type}
                onValueChange={setField('content_type')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {lesson.content_type === 'video_youtube' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <Video className="mr-1 inline h-3 w-3" />
                YouTube URL
              </Label>
              <Input
                type="url"
                value={lesson.content_url || ''}
                onChange={(e) => setField('content_url')(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          {lesson.content_type === 'video_file' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <Video className="mr-1 inline h-3 w-3" />
                ไฟล์วิดีโอ
              </Label>
              {lesson.content_url ? (
                <p className="text-xs text-success">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">ยังไม่ได้อัปโหลด</p>
              )}
              <Input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>
          )}

          {lesson.content_type === 'pdf' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <FileText className="mr-1 inline h-3 w-3" />
                ไฟล์ PDF
              </Label>
              {lesson.content_url ? (
                <p className="text-xs text-success">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">ยังไม่ได้อัปโหลด</p>
              )}
              <Input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {(lesson.content_type === 'video_youtube' ||
              lesson.content_type === 'video_file') && (
              <div className="space-y-1">
                <Label className="text-xs">ความยาว (วินาที)</Label>
                <Input
                  type="number"
                  min={0}
                  value={lesson.duration_seconds || ''}
                  onChange={(e) =>
                    setField('duration_seconds')(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
            )}
            {lesson.content_type === 'pdf' && (
              <div className="space-y-1">
                <Label className="text-xs">จำนวนหน้า</Label>
                <Input
                  type="number"
                  min={0}
                  value={lesson.total_pages || ''}
                  onChange={(e) =>
                    setField('total_pages')(e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย</Label>
            <Textarea
              rows={2}
              value={lesson.description || ''}
              onChange={(e) => setField('description')(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              เวลาขั้นต่ำที่ต้องอยู่บนหน้า (วินาที){' '}
              <span className="text-muted-foreground">— 0 หรือเว้นว่าง = ปิด</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={lesson.min_view_seconds || ''}
              onChange={(e) =>
                setField('min_view_seconds')(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="เช่น 120 = 2 นาที"
            />
          </div>

          <Button size="sm" onClick={onSave}>
            <Save className="mr-1 h-3 w-3" />
            บันทึกบทเรียน
          </Button>

          <div className="border-t border-border pt-3">
            <h4 className="mb-2 text-sm font-medium text-foreground">เอกสารประกอบ</h4>
            <LessonResourcesEditor lesson={lesson} onChange={onUpdate} />
          </div>

          <div className="border-t border-border pt-3">
            <h4 className="mb-2 text-sm font-medium text-foreground">แบบทดสอบ</h4>
            <QuizManager lessonId={lesson.id} scope="lesson" showToast={showToast} />
          </div>
        </div>
      )}
    </div>
  )
}

function LessonResourcesEditor({ lesson, onChange }) {
  // `lesson.resources` arrives from the parent's course-loading flow. We treat
  // it as the source of truth and push optimistic updates back via onChange so
  // the lesson tree stays consistent with what the learner sees.
  const resources = lesson.resources ?? []
  const [draftTitle, setDraftTitle] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftType, setDraftType] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!draftTitle.trim() || !draftUrl.trim()) return
    setAdding(true)
    try {
      const created = await lessonsApi.addResource(lesson.id, {
        title: draftTitle.trim(),
        url: draftUrl.trim(),
        resource_type: draftType.trim() || null,
      })
      onChange({ resources: [...resources, created] })
      setDraftTitle('')
      setDraftUrl('')
      setDraftType('')
      showToast('เพิ่มเอกสารสำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'เพิ่มไม่สำเร็จ', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (resourceId) => {
    try {
      await lessonsApi.deleteResource(resourceId)
      onChange({ resources: resources.filter((r) => r.id !== resourceId) })
      showToast('ลบเอกสารเรียบร้อย', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="space-y-3">
      {resources.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีเอกสารประกอบ</p>
      ) : (
        <ul className="space-y-1.5">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground" title={r.url}>
                {r.title}
              </span>
              {r.resource_type && (
                <Badge variant="secondary" className="font-normal">
                  {r.resource_type}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(r.id)}
                className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label={`ลบเอกสาร ${r.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="ชื่อเอกสาร เช่น แบบฟอร์ม กฟภ."
          maxLength={200}
        />
        <Input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="URL หรือ /pdfs/file.pdf"
          maxLength={500}
        />
        <Input
          value={draftType}
          onChange={(e) => setDraftType(e.target.value)}
          placeholder="ประเภท เช่น PDF"
          maxLength={50}
          className="sm:w-24"
        />
        <Button type="submit" size="sm" disabled={adding || !draftTitle.trim() || !draftUrl.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          เพิ่ม
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        ใช้ลิงก์ภายนอก (https://...) หรือ path ภายในที่อัปโหลดไว้แล้ว
      </p>
    </div>
  )
}
