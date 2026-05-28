import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { coursesApi } from '../api/courses'
import { quizzesApi } from '../api/quizzes'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORY_BADGES } from '../constants/labels'
import ConfirmDialog from '../components/ConfirmDialog'
import CourseStatsModal from '../components/CourseStatsModal'
import CourseScoresModal from '../components/CourseScoresModal'

function formatThaiDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]
  const day = date.getDate()
  const month = thaiMonths[date.getMonth()]
  const year = date.getFullYear() + 543
  return `${day} ${month} ${year}`
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [confirmState, setConfirmState] = useState({ open: false })
  // Stats: admin gets the full course stats modal; learner gets their own scores.
  const isAdmin = user?.role === 'admin' || user?.role === 'instructor'
  const [statsOpen, setStatsOpen] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)
  const [myQuizzes, setMyQuizzes] = useState(null)
  const [scoresLoading, setScoresLoading] = useState(false)

  const openMyScores = async () => {
    setScoresLoading(true)
    try {
      const data = await quizzesApi.getCourseAll(id)
      setMyQuizzes(data)
      setScoresOpen(true)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'โหลดคะแนนไม่สำเร็จ' })
    } finally {
      setScoresLoading(false)
    }
  }

  const loadCourse = async () => {
    setLoading(true)
    try {
      const data = await coursesApi.getById(id)
      setCourse(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลหลักสูตร')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line
  }, [id])

  const handleEnroll = async () => {
    setEnrollLoading(true)
    setMessage({ type: '', text: '' })
    try {
      await coursesApi.enroll(course.id)
      setMessage({ type: 'success', text: 'ลงทะเบียนเรียนสำเร็จ' })
      await loadCourse()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'เกิดข้อผิดพลาด' })
    } finally {
      setEnrollLoading(false)
    }
  }

  const handleUnenroll = () => {
    setConfirmState({
      open: true,
      title: 'ยกเลิกการลงทะเบียน',
      message: 'ต้องการยกเลิกการลงทะเบียนหลักสูตรนี้ใช่หรือไม่? ความคืบหน้าจะถูกเก็บไว้',
      danger: true,
      onConfirm: async () => {
        setConfirmState({ open: false })
        setEnrollLoading(true)
        setMessage({ type: '', text: '' })
        try {
          await coursesApi.unenroll(course.id)
          setMessage({ type: 'success', text: 'ยกเลิกการลงทะเบียนเรียบร้อย' })
          await loadCourse()
        } catch (err) {
          setMessage({ type: 'error', text: err.response?.data?.detail || 'เกิดข้อผิดพลาด' })
        } finally {
          setEnrollLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        กำลังโหลด...
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">{error || 'ไม่พบหลักสูตร'}</p>
            <Link to="/courses" className="text-forest-600 hover:text-forest-700 font-medium">
              ← กลับไปหน้าหลักสูตร
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const cat = CATEGORY_BADGES[course.category] || { label: course.category, color: 'bg-gray-100' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/courses" className="text-gray-600 hover:text-forest-600 text-sm font-medium flex-shrink-0">
              ← กลับ
            </Link>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link to="/" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
              หน้าหลัก
            </Link>
            <Link to="/profile" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
              โปรไฟล์
            </Link>
            <button onClick={logout} className="text-xs sm:text-sm text-gray-600 hover:text-forest-600">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="bg-gradient-to-br from-forest-500 to-forest-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium bg-white text-forest-700`}>
              {cat.label}
            </span>
            {course.is_mandatory && (
              <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                หลักสูตรบังคับ
              </span>
            )}
            {!course.is_published && (
              <span className="bg-gray-700 text-white text-xs px-3 py-1 rounded-full font-medium">
                ฉบับร่าง
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
            {course.title}
          </h1>
          
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-forest-50">
            {course.instructor_name && (
              <div>
                <span className="text-forest-200">วิทยากร: </span>
                <span className="font-medium">{course.instructor_name}</span>
              </div>
            )}
            <div>
              <span className="text-forest-200">เผยแพร่: </span>
              <span className="font-medium">{formatThaiDate(course.created_at)}</span>
            </div>
            {course.estimated_hours && (
              <div>
                <span className="text-forest-200">ระยะเวลา: </span>
                <span className="font-medium">{course.estimated_hours} ชั่วโมง</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Description */}
          <div className="lg:col-span-2 space-y-6">
            {message.text && (
              <div className={`px-4 py-3 rounded-lg text-sm border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">รายละเอียดหลักสูตร</h2>
              {course.description ? (
                <p className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                  {course.description}
                </p>
              ) : (
                <p className="text-gray-400 italic">ไม่มีคำอธิบาย</p>
              )}
            </div>

            {/* Course structure */}
            <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">เนื้อหาในหลักสูตร</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-forest-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-forest-700">{course.total_modules}</div>
                  <div className="text-sm text-gray-600">โมดูล</div>
                </div>
                <div className="bg-forest-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-forest-700">{course.total_lessons}</div>
                  <div className="text-sm text-gray-600">บทเรียน</div>
                </div>
              </div>
              {course.total_lessons === 0 && (
                <p className="text-sm text-gray-500 mt-4">
                  ยังไม่มีบทเรียนในหลักสูตรนี้
                </p>
              )}
            </div>
          </div>

          {/* Right: Enrollment card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 lg:sticky lg:top-24">
              <div className="text-center mb-5 pb-5 border-b border-gray-100">
                <div className="text-3xl font-bold text-forest-600">
                  {course.enrolled_count}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  ผู้ลงทะเบียนเรียน
                </div>
              </div>

              {course.is_enrolled ? (
                <>
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center mb-4">
                    คุณลงทะเบียนแล้ว
                  </div>

                  <button
                    onClick={() => navigate(`/courses/${course.id}/learn`)}
                    className="w-full bg-forest-500 hover:bg-forest-600 text-white font-medium py-3 rounded-lg transition mb-3"
                  >
                    <Link
                      to={`/courses/${id}/learn`}
                    >
                      เริ่มเรียน
                    </Link>
                  </button>

                  <button
                    onClick={handleUnenroll}
                    disabled={enrollLoading}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {enrollLoading ? 'กำลังดำเนินการ...' : 'ยกเลิกการลงทะเบียน'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrollLoading}
                  className="w-full bg-forest-500 hover:bg-forest-600 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
                >
                  {enrollLoading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนเรียน'}
                </button>
              )}

              {/* Stats — admin sees all-users stats; learner sees only their own scores (if enrolled) */}
              {isAdmin ? (
                <button
                  onClick={() => setStatsOpen(true)}
                  className="w-full mt-3 bg-forest-50 hover:bg-forest-100 text-forest-700 font-medium py-2 rounded-lg transition"
                >
                  ดูสถิติหลักสูตร
                </button>
              ) : course.is_enrolled ? (
                <button
                  onClick={openMyScores}
                  disabled={scoresLoading}
                  className="w-full mt-3 bg-forest-50 hover:bg-forest-100 text-forest-700 font-medium py-2 rounded-lg transition disabled:opacity-50"
                >
                  {scoresLoading ? 'กำลังโหลด...' : 'ดูคะแนนของคุณ'}
                </button>
              ) : null}

              <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">หมวดหมู่</span>
                  <span className="font-medium text-gray-700">{cat.label}</span>
                </div>
                {course.estimated_hours && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">ระยะเวลา</span>
                    <span className="font-medium text-gray-700">{course.estimated_hours} ชั่วโมง</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">ประเภท</span>
                  <span className="font-medium text-gray-700">
                    {course.is_mandatory ? 'บังคับ' : 'เลือกได้'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ open: false })}
      />

      <CourseStatsModal
        open={statsOpen}
        courseId={id}
        onClose={() => setStatsOpen(false)}
      />

      <CourseScoresModal
        open={scoresOpen}
        quizzes={myQuizzes}
        courseId={id}
        onClose={() => setScoresOpen(false)}
      />
    </div>
  )
}