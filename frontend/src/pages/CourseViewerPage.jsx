import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { coursesApi } from '../api/courses'
import { progressApi } from '../api/progress'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import Toast from '../components/Toast'

export default function CourseViewerPage() {
  const { id, lessonId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentLesson, setCurrentLesson] = useState(null)
  const [progress, setProgress] = useState({})  // { lessonId: { current_position, is_completed } }
  const [expandedModules, setExpandedModules] = useState(new Set())

  const [toast, setToast] = useState({ message: '', type: 'success' })
  const showToast = (m, t = 'success') => setToast({ message: m, type: t })

  const videoRef = useRef(null)
  const lastSavedRef = useRef(0)

  const fixUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    if (url.startsWith('/elearning')) return url
    return `/elearning${url}`
    }

  // Load course + progress
  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line
  }, [id])

  // Switch lesson when URL changes
  useEffect(() => {
    if (!course) return
    const allLessons = course.modules.flatMap(m => m.lessons)
    
    let lesson
    if (lessonId) {
      lesson = allLessons.find(l => l.id === parseInt(lessonId))
    }
    if (!lesson && allLessons.length > 0) {
      lesson = allLessons[0]
      // Update URL to first lesson
      navigate(`/courses/${id}/learn/${lesson.id}`, { replace: true })
    }
    setCurrentLesson(lesson)
    
    // Expand the module containing this lesson
    if (lesson) {
      const mod = course.modules.find(m => m.lessons.some(l => l.id === lesson.id))
      if (mod) setExpandedModules(prev => new Set([...prev, mod.id]))
    }
  }, [course, lessonId, id, navigate])

  const loadCourse = async () => {
    setLoading(true)
    try {
      const data = await coursesApi.getById(id)
      setCourse(data)
      
      // Load progress
      try {
        const progressList = await progressApi.getByCourse(id)
        const progressMap = {}
        progressList.forEach(p => {
          progressMap[p.lesson_id] = p
        })
        setProgress(progressMap)
      } catch (e) {
        // Progress fetch is optional; ignore errors
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดหลักสูตรไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Save video progress every 10 seconds
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return
    const currentTime = Math.floor(videoRef.current.currentTime)
    const duration = videoRef.current.duration
    
    // Only save every 10 seconds
    if (currentTime - lastSavedRef.current >= 10) {
      lastSavedRef.current = currentTime
      const isCompleted = duration && currentTime >= duration * 0.9
      
      progressApi.update({
        lesson_id: currentLesson.id,
        current_position: currentTime,
        is_completed: isCompleted,
      }).then(p => {
        setProgress(prev => ({ ...prev, [currentLesson.id]: p }))
      }).catch(() => {})
    }
  }

  const handleVideoEnded = () => {
    if (!currentLesson) return
    progressApi.update({
      lesson_id: currentLesson.id,
      current_position: Math.floor(videoRef.current?.duration || 0),
      is_completed: true,
    }).then(p => {
      setProgress(prev => ({ ...prev, [currentLesson.id]: p }))
      showToast('จบบทเรียนแล้ว')
    }).catch(() => {})
  }

  // Resume from saved position
  const handleLoadedMetadata = () => {
    if (!videoRef.current || !currentLesson) return
    const saved = progress[currentLesson.id]
    if (saved && saved.current_position > 0 && !saved.is_completed) {
      videoRef.current.currentTime = saved.current_position
    }
    lastSavedRef.current = 0
  }

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const switchLesson = (lesson) => {
    navigate(`/courses/${id}/learn/${lesson.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getYoutubeEmbed = (url) => {
    if (!url) return null
    
    // Patterns to match:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    // https://www.youtube.com/shorts/VIDEO_ID
    // https://m.youtube.com/watch?v=VIDEO_ID
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&"'>]+)/,
    ]
    
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return `https://www.youtube.com/embed/${match[1]}`
    }
    
    return url  // fallback: try as-is
    }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
  }

  if (!course) {
    return <div className="p-8 text-center text-gray-500">ไม่พบหลักสูตร</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            to={`/courses/${id}`}
            className="text-gray-600 hover:text-forest-600 text-sm flex items-center gap-2"
          >
            ← กลับ
          </Link>
          <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate mx-4 flex-1 text-center">
            {course.title}
          </h1>
          <Link to="/" className="text-sm text-gray-600 hover:text-forest-600">
            <Icon name="home" className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Main player area */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          {currentLesson ? (
            <>
              {/* Video / PDF / YouTube */}
              <div className="bg-black aspect-video">
                {currentLesson.content_type === 'video_file' && currentLesson.content_url && (
                  <video
                    ref={videoRef}
                    src={fixUrl(currentLesson.content_url)}
                    controls
                    className="w-full h-full"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                )}

                {currentLesson.content_type === 'video_youtube' && currentLesson.content_url && (
                <iframe
                    src={getYoutubeEmbed(currentLesson.content_url)}
                    title={currentLesson.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {currentLesson.content_type === 'pdf' && currentLesson.content_url && (
                  <iframe
                    src={fixUrl(currentLesson.content_url)}
                    title={currentLesson.title}
                    className="w-full h-full bg-white"
                  />
                )}

                {(!currentLesson.content_url) && (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm">
                    ยังไม่มีเนื้อหาในบทเรียนนี้
                  </div>
                )}
              </div>

              {/* Lesson info */}
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                  {currentLesson.title}
                </h2>
                {currentLesson.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {currentLesson.description}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              เลือกบทเรียนจากรายการด้านล่าง
            </div>
          )}
        </div>

        {/* Lesson list (sidebar stacked below on all screens per your request) */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h3 className="font-bold text-gray-800 mb-4">บทเรียนในหลักสูตร</h3>
          
          {course.modules.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีบทเรียน</p>
          )}

          <div className="space-y-2">
            {course.modules.map((module, mIdx) => (
              <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full bg-gray-50 hover:bg-gray-100 p-3 flex items-center gap-3 text-left transition"
                >
                  <span className="text-gray-400 text-sm w-4">
                    {expandedModules.has(module.id) ? '▼' : '▶'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    โมดูลที่ {mIdx + 1}
                  </span>
                  <span className="flex-1 font-medium text-gray-800">{module.title}</span>
                  <span className="text-xs text-gray-500">
                    {module.lessons.length} บทเรียน
                  </span>
                </button>

                {expandedModules.has(module.id) && (
                  <div className="divide-y divide-gray-100">
                    {module.lessons.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400 text-center">ยังไม่มีบทเรียน</p>
                    ) : (
                      module.lessons.map((lesson, lIdx) => {
                        const isActive = currentLesson?.id === lesson.id
                        const lProgress = progress[lesson.id]
                        const isDone = lProgress?.is_completed
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => switchLesson(lesson)}
                            className={`w-full p-3 flex items-center gap-3 text-left transition ${
                              isActive
                                ? 'bg-forest-50 border-l-4 border-forest-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isDone
                                ? 'bg-forest-500 text-white'
                                : isActive
                                ? 'bg-forest-200 text-forest-700'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {isDone ? <Icon name="check" className="w-3 h-3" /> : lIdx + 1}
                            </span>
                            <span className={`flex-1 text-sm ${isActive ? 'font-medium text-forest-700' : 'text-gray-700'}`}>
                              {lesson.title}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {lesson.content_type === 'pdf' ? 'PDF' : 'วิดีโอ'}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  )
}