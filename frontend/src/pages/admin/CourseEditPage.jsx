import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LineChart, Plus, Save } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { modulesApi } from '@/api/modules'
import { lessonsApi } from '@/api/lessons'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import QuizManager from '@/components/QuizManager'
import CourseStatsModal from '@/components/CourseStatsModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import CourseOverviewTab from '@/components/admin/course-edit/CourseOverviewTab'
import CourseSettingsTab from '@/components/admin/course-edit/CourseSettingsTab'
import ModuleEditor from '@/components/admin/course-edit/ModuleEditor'
import CoursePdfSplitPanel from '@/components/admin/course-edit/CoursePdfSplitPanel'
import PromptInputDialog from '@/components/admin/course-edit/PromptInputDialog'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { toastApiError } from '@/utils/apiError'

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
    allow_downloads: true,
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
        // Default ON for any course created before this field existed.
        allow_downloads: data.allow_downloads ?? true,
        recertify_after_days: data.recertify_after_days ?? '',
      })
      setCoverImage(data.cover_image || null)
      setModules(data.modules || [])
    } catch (err) {
      toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
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
      toastApiError(err, 'บันทึกไม่สำเร็จ')
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
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]
    // Reset so re-picking the same file still fires onChange.
    e.target.value = ''
    if (!file) return
    // Client-side guards — backend re-validates regardless. Catches the common
    // failures (wrong format / too big) with an immediate popup instead of a
    // round-trip.
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      showToast('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('ไฟล์ใหญ่เกิน 10 MB', 'error')
      return
    }
    setCoverUploading(true)
    setCoverProgress(0)
    try {
      const result = await coursesApi.uploadCoverImage(id, file, setCoverProgress)
      setCoverImage(result.cover_image)
      showToast('อัปโหลดรูปภาพปกสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
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
          toastApiError(err, 'เพิ่มโมดูลไม่สำเร็จ')
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
      toastApiError(err, 'แก้ไขไม่สำเร็จ')
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
          toastApiError(err, 'ลบไม่สำเร็จ')
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
          toastApiError(err, 'เพิ่มบทเรียนไม่สำเร็จ')
        }
        setPromptState(null)
      },
    })
  }

  const handleLessonsAdded = (moduleId, newLessons) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, ...newLessons] } : m
      )
    )
  }

  const handleModulesAdded = (newModules) => {
    setModules((prev) => [
      ...prev,
      ...newModules.map((m) => ({ ...m, lessons: m.lessons || [] })),
    ])
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
      toastApiError(err, 'บันทึกไม่สำเร็จ')
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
          toastApiError(err, 'ลบไม่สำเร็จ')
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
      <AdminPageHeader
        backTo="/admin/courses"
        backLabel="จัดการหลักสูตร"
        title={isNew ? 'สร้างหลักสูตรใหม่' : courseData.title || 'แก้ไขหลักสูตร'}
        subtitle={isNew ? 'กรอกข้อมูลพื้นฐานเพื่อเริ่มต้น' : 'จัดการเนื้อหา แบบทดสอบ และการเผยแพร่'}
        actions={
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
        }
      />

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
          <CourseOverviewTab
            isNew={isNew}
            courseData={courseData}
            updateField={updateField}
            coverImage={coverImage}
            coverUploading={coverUploading}
            coverProgress={coverProgress}
            onCoverUpload={handleCoverUpload}
            onSubmit={handleSaveCourse}
          />
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
              <CoursePdfSplitPanel
                courseId={parseInt(id)}
                onModulesAdded={handleModulesAdded}
              />
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
                      onLessonsAdded={(newLessons) =>
                        handleLessonsAdded(module.id, newLessons)
                      }
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
          <CourseSettingsTab
            isNew={isNew}
            courseData={courseData}
            updateField={updateField}
            onRequestDelete={() => setDeleteCourseOpen(true)}
          />
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

      <ConfirmDialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel="ยืนยันลบ"
        destructive
        onConfirm={confirmState?.onConfirm}
      />

      <ConfirmDialog
        open={deleteCourseOpen}
        onOpenChange={setDeleteCourseOpen}
        title="ลบหลักสูตร"
        description={
          <>
            ต้องการลบหลักสูตร &ldquo;{courseData.title}&rdquo; พร้อมโมดูล บทเรียน และข้อมูลทั้งหมด?
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </>
        }
        confirmLabel="ยืนยันลบหลักสูตร"
        destructive
        onConfirm={handleDeleteCourse}
      />

      <CourseStatsModal
        open={statsOpen}
        courseId={isNew ? null : id}
        onClose={() => setStatsOpen(false)}
      />
    </div>
  )
}
