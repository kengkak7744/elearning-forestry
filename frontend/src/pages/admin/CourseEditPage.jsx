import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { coursesApi } from '../../api/courses'
import { modulesApi } from '../../api/modules'
import { lessonsApi } from '../../api/lessons'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import PromptDialog from '../../components/PromptDialog'
import QuizManager from '../../components/QuizManager'
import { CATEGORY_OPTIONS, CONTENT_TYPE_OPTIONS } from '../../constants/labels'
import { mediaUrl } from '../../utils/media'

export default function CourseEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // Toast state for module/lesson actions
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const showToast = (message, type = 'success') => setToast({ message, type })
  const closeToast = () => setToast({ message: '', type: 'success' })
  const [confirmState, setConfirmState] = useState({ open: false })
  const [promptState, setPromptState] = useState({ open: false })

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
  })

  const [modules, setModules] = useState([])

  useEffect(() => {
    if (!isNew) loadCourse()
    // eslint-disable-next-line
  }, [id])

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
      })
      setCoverImage(data.cover_image || null)
      setModules(data.modules || [])
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCourseChange = (e) => {
    const { name, value, type, checked } = e.target
    setCourseData({ ...courseData, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSaveCourse = async (e) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...courseData,
      estimated_hours: courseData.estimated_hours ? parseInt(courseData.estimated_hours) : null,
    }

    try {
      if (isNew) {
        const created = await coursesApi.create(payload)
        showToast('สร้างหลักสูตรสำเร็จ')
        navigate(`/admin/courses/${created.id}/edit`, { replace: true })
      } else {
        await coursesApi.update(id, payload)
        showToast('บันทึกหลักสูตรสำเร็จ')
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
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
      showToast('อัปโหลดรูปภาพปกสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'อัปโหลดไม่สำเร็จ', 'error')
    } finally {
      setCoverUploading(false)
      setCoverProgress(0)
    }
  }

  const handleAddModule = () => {
    setPromptState({
      open: true,
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
          showToast('เพิ่มโมดูลสำเร็จ')
        } catch (err) {
          showToast(err.response?.data?.detail || 'เพิ่มโมดูลไม่สำเร็จ', 'error')
        }
        setPromptState({ open: false })
      },
    })
  }

  const handleUpdateModule = async (moduleId, updates) => {
    try {
      await modulesApi.update(moduleId, updates)
      setModules(modules.map(m => m.id === moduleId ? { ...m, ...updates } : m))
    } catch (err) {
      showToast(err.response?.data?.detail || 'แก้ไขไม่สำเร็จ', 'error')
    }
  }

  const handleDeleteModule = (moduleId) => {
    setConfirmState({
      open: true,
      title: 'ลบโมดูล',
      message: 'ต้องการลบโมดูลนี้และบทเรียนทั้งหมดในโมดูล?',
      danger: true,
      onConfirm: async () => {
        try {
          await modulesApi.delete(moduleId)
          setModules(modules.filter(m => m.id !== moduleId))
          showToast('ลบโมดูลเรียบร้อย')
        } catch (err) {
          showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
        }
        setConfirmState({ open: false })
      },
    })
  }

  const handleAddLesson = async (moduleId) => {
    setPromptState({
      open: true,
      title: 'เพิ่มบทเรียนใหม่',
      label: 'ชื่อบทเรียน',
      placeholder: 'เช่น บทที่ 1: ความสำคัญของการอนุรักษ์ป่าไม้',
      onConfirm: async (title) => {
        const module = modules.find(m => m.id === moduleId)
        try {
          const newLesson = await lessonsApi.create({
            module_id: moduleId,
            title,
            content_type: 'video_youtube',
            order_index: module.lessons.length,
          })
          setModules(modules.map(m =>
            m.id === moduleId
              ? { ...m, lessons: [...m.lessons, newLesson] }
              : m
          ))
          showToast('เพิ่มบทเรียนสำเร็จ')
        } catch (err) {
          showToast(err.response?.data?.detail || 'เพิ่มบทเรียนไม่สำเร็จ', 'error')
        }
      },
    })
  }

  const handleUpdateLesson = (moduleId, lessonId, updates) => {
    setModules(modules.map(m =>
      m.id === moduleId
        ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l) }
        : m
    ))
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
      open: true,
      title: 'ลบบทเรียน',
      message: 'ต้องการลบบทเรียนนี้หรือไม่?',
      danger: true,
      onConfirm: async () => {
        try {
          await lessonsApi.delete(lessonId)
          setModules(modules.map(m =>
            m.id === moduleId
              ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
              : m
          ))
          showToast('ลบบทเรียนเรียบร้อย')
        } catch (err) {
          showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
        }
        setConfirmState({ open: false })
      },
    })      
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
      </AdminLayout>
    )
  }


  return (
    <AdminLayout>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="text-sm text-gray-500 mb-4">
          <Link to="/admin/courses" className="hover:text-forest-600">จัดการหลักสูตร</Link>
          <span className="mx-2">/</span>
          <span>{isNew ? 'สร้างหลักสูตรใหม่' : 'แก้ไขหลักสูตร'}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">
          {isNew ? 'สร้างหลักสูตรใหม่' : 'แก้ไขหลักสูตร'}
        </h1>

        {/* Course meta form */}
        <form onSubmit={handleSaveCourse} className="bg-white rounded-xl shadow-sm p-5 sm:p-6 mb-6 space-y-4">
          <h2 className="font-bold text-gray-800 border-b border-gray-200 pb-3">ข้อมูลหลักสูตร</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อหลักสูตร <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={courseData.title}
              onChange={handleCourseChange}
              required
              minLength={3}
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบายหลักสูตร
            </label>
            <textarea
              name="description"
              value={courseData.description}
              onChange={handleCourseChange}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none resize-none"
            />
          </div>

          {/* Cover image — only for existing courses */}
          {!isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รูปภาพปกหลักสูตร
              </label>
              <div className="flex items-start gap-4">
                {coverImage ? (
                  <img
                    src={mediaUrl(coverImage)}
                    alt="ปกหลักสูตร"
                    className="w-32 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-32 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 bg-gray-50">
                    <span className="text-xs text-gray-400">ไม่มีรูปภาพ</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={coverUploading}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 10 MB</p>
                  {coverUploading && (
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-forest-500 h-2 transition-all"
                          style={{ width: `${coverProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{coverProgress}%</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หมวดหมู่ <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={courseData.category}
                onChange={handleCourseChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วิทยากร
              </label>
              <input
                type="text"
                name="instructor_name"
                value={courseData.instructor_name}
                onChange={handleCourseChange}
                maxLength={150}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                placeholder="เช่น ดร. สมศักดิ์ พงษ์พันธ์"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ระยะเวลา (ชั่วโมง)
              </label>
              <input
                type="number"
                name="estimated_hours"
                value={courseData.estimated_hours}
                onChange={handleCourseChange}
                min={0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              />
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 flex-1">
                <input
                  type="checkbox"
                  name="is_mandatory"
                  checked={courseData.is_mandatory}
                  onChange={handleCourseChange}
                  className="w-4 h-4 text-forest-500"
                />
                <span className="text-sm text-gray-700">บังคับ</span>
              </label>
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 flex-1">
                <input
                  type="checkbox"
                  name="is_published"
                  checked={courseData.is_published}
                  onChange={handleCourseChange}
                  className="w-4 h-4 text-forest-500"
                />
                <span className="text-sm text-gray-700">เผยแพร่</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="bg-forest-500 hover:bg-forest-600 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : isNew ? 'สร้างหลักสูตร' : 'บันทึก'}
            </button>
            <Link
              to="/admin/courses"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition"
            >
              ยกเลิก
            </Link>
          </div>
        </form>

        {/* Modules and Lessons — only show after course created */}
        {!isNew && (
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">โมดูลและบทเรียน</h2>
              <button
                onClick={handleAddModule}
                className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition"
              >
                + เพิ่มโมดูล
              </button>
            </div>

            {modules.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                ยังไม่มีโมดูล กดปุ่ม "เพิ่มโมดูล" เพื่อเริ่มต้น
              </p>
            ) : (
              <div className="space-y-4">
                {modules.map((module, mIdx) => (
                  <ModuleEditor
                    key={module.id}
                    module={module}
                    index={mIdx}
                    onUpdate={(updates) => handleUpdateModule(module.id, updates)}
                    onDelete={() => handleDeleteModule(module.id)}
                    onAddLesson={() => handleAddLesson(module.id)}
                    onUpdateLesson={(lessonId, updates) => handleUpdateLesson(module.id, lessonId, updates)}
                    onSaveLesson={handleSaveLesson}
                    onDeleteLesson={(lessonId) => handleDeleteLesson(module.id, lessonId)}
                    showToast={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Final quiz */}
        {!isNew && (
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 mt-6">
            <h2 className="font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4">
              แบบทดสอบสุดท้าย
            </h2>
            <QuizManager
              courseId={parseInt(id)}
              scope="final"
              showToast={showToast}
            />
          </div>
        )}
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ open: false })}
      />

      {/* Prompt dialog */}
      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        label={promptState.label}
        placeholder={promptState.placeholder}
        onConfirm={promptState.onConfirm}
        onCancel={() => setPromptState({ open: false })}
      />
    </AdminLayout>
  )
}

function ModuleEditor({ module, index, onUpdate, onDelete, onAddLesson, onUpdateLesson, onSaveLesson, onDeleteLesson, showToast }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [expanded, setExpanded] = useState(true)

  const handleSave = () => {
    onUpdate({ title })
    setEditing(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Module header */}
      <div className="bg-gray-50 p-3 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 text-lg w-6 flex-shrink-0"
        >
          {expanded ? '▼' : '▶'}
        </button>

        <span className="text-sm text-gray-500 font-mono flex-shrink-0">
          โมดูลที่ {index + 1}
        </span>

        {editing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className="flex-1 font-medium text-gray-800 cursor-pointer hover:text-forest-600"
          >
            {module.title}
          </span>
        )}

        <button
          onClick={onAddLesson}
          className="text-xs bg-forest-100 text-forest-700 px-3 py-1 rounded hover:bg-forest-200 flex-shrink-0"
        >
          + บทเรียน
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 px-2 flex-shrink-0"
        >
          ลบ
        </button>
      </div>

      {/* Lessons */}
      {expanded && (
        <div className="divide-y divide-gray-100">
          {module.lessons.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">ยังไม่มีบทเรียน</p>
          ) : (
            module.lessons.map((lesson, lIdx) => (
              <LessonEditor
                key={lesson.id}
                lesson={lesson}
                index={lIdx}
                onUpdate={(updates) => onUpdateLesson(lesson.id, updates)}
                onSave={() => onSaveLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson.id)}
                showToast={showToast}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function LessonEditor({ lesson, index, onUpdate, onSave, onDelete, showToast }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const handleChange = (e) => {
    const { name, value, type } = e.target
    onUpdate({ [name]: type === 'number' ? (value ? parseInt(value) : null) : value })
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

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 text-sm w-6 flex-shrink-0"
        >
          {expanded ? '−' : '+'}
        </button>
        <span className="text-xs text-gray-500 font-mono flex-shrink-0">{index + 1}.</span>
        <span className="flex-1 text-sm text-gray-800 truncate">{lesson.title}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {CONTENT_TYPE_OPTIONS.find(o => o.value === lesson.content_type)?.label || lesson.content_type}
        </span>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 flex-shrink-0"
        >
          ลบ
        </button>
      </div>

      {expanded && (
        <div className="ml-8 mt-3 space-y-3 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">ชื่อบทเรียน</label>
              <input
                type="text"
                name="title"
                value={lesson.title}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">ประเภทเนื้อหา</label>
              <select
                name="content_type"
                value={lesson.content_type}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              >
                {CONTENT_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content URL section — different per type */}
          {lesson.content_type === 'video_youtube' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">YouTube URL</label>
              <input
                type="url"
                name="content_url"
                value={lesson.content_url || ''}
                onChange={handleChange}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          )}

          {lesson.content_type === 'video_file' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">ไฟล์วิดีโอ</label>
              {lesson.content_url ? (
                <div className="text-xs text-green-700 mb-2">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </div>
              ) : (
                <div className="text-xs text-gray-400 mb-2">ยังไม่ได้อัปโหลด</div>
              )}
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-forest-500 h-2 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{uploadProgress}%</div>
                </div>
              )}
            </div>
          )}

          {lesson.content_type === 'pdf' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">ไฟล์ PDF</label>
              {lesson.content_url ? (
                <div className="text-xs text-green-700 mb-2">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </div>
              ) : (
                <div className="text-xs text-gray-400 mb-2">ยังไม่ได้อัปโหลด</div>
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-forest-500 h-2 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{uploadProgress}%</div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(lesson.content_type === 'video_youtube' || lesson.content_type === 'video_file') && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">ความยาว (วินาที)</label>
                <input
                  type="number"
                  name="duration_seconds"
                  value={lesson.duration_seconds || ''}
                  onChange={handleChange}
                  min={0}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            )}

            {lesson.content_type === 'pdf' && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">จำนวนหน้า</label>
                <input
                  type="number"
                  name="total_pages"
                  value={lesson.total_pages || ''}
                  onChange={handleChange}
                  min={0}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">คำอธิบาย</label>
            <textarea
              name="description"
              value={lesson.description || ''}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              เวลาขั้นต่ำที่ต้องอยู่บนหน้า (วินาที)
              <span className="text-gray-400 ml-1">— ใส่ 0 หรือเว้นว่าง = ปิด</span>
            </label>
            <input
              type="number"
              name="min_view_seconds"
              value={lesson.min_view_seconds || ''}
              onChange={handleChange}
              min={0}
              placeholder="เช่น 120 = 2 นาที"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          <button
            onClick={onSave}
            className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-1.5 rounded font-medium transition"
          >
            บันทึกบทเรียน
          </button>

          <div className="border-t border-gray-200 pt-3 mt-3">
            <h4 className="font-medium text-sm text-gray-800 mb-2">แบบทดสอบ</h4>
            <QuizManager
              lessonId={lesson.id}
              scope="lesson"
              showToast={showToast}
            />
          </div>
        </div>
      )}
    </div>
  )
}