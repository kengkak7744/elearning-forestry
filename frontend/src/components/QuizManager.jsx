import { useState, useEffect } from 'react'
import { quizzesApi } from '../api/quizzes'
import QuizEditor from './QuizEditor'

export default function QuizManager({ lessonId, courseId, scope, showToast }) {
  // scope: "lesson" or "final"
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuizzes()
    // eslint-disable-next-line
  }, [lessonId, courseId])

  const loadQuizzes = async () => {
    setLoading(true)
    try {
      if (scope === 'lesson' && lessonId) {
        const data = await quizzesApi.getByLessonAdmin(lessonId)
        setQuizzes(data)
      } else if (scope === 'final' && courseId) {
        try {
          const final = await quizzesApi.getFinalAdmin(courseId)
          setQuizzes([final])
        } catch {
          setQuizzes([])
        }
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดแบบทดสอบไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuiz = async (placement) => {
    try {
      const payload = {
        title: placement === 'final' ? 'แบบทดสอบสุดท้าย' : 'แบบทดสอบ',
        placement,
        can_skip: true,
        show_correct_answer: true,
        passing_score: 70,
        order_index: quizzes.length,
        trigger_time: placement === 'mid_video' ? 60 : null,
      }
      if (scope === 'lesson') payload.lesson_id = lessonId
      else payload.course_id = courseId

      const newQuiz = await quizzesApi.create(payload)
      setQuizzes([...quizzes, { ...newQuiz, questions: [] }])
      showToast('เพิ่มแบบทดสอบสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'เพิ่มไม่สำเร็จ', 'error')
    }
  }

  const handleUpdateQuiz = (quizId, updates) => {
    setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, ...updates } : q))
  }

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('ลบแบบทดสอบนี้?')) return
    try {
      await quizzesApi.delete(quizId)
      setQuizzes(quizzes.filter(q => q.id !== quizId))
      showToast('ลบแบบทดสอบสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
    }
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-2">กำลังโหลด...</p>

  return (
    <div className="space-y-3">
      {quizzes.map(quiz => (
        <QuizEditor
          key={quiz.id}
          quiz={quiz}
          onUpdate={(updates) => handleUpdateQuiz(quiz.id, updates)}
          onDelete={() => handleDeleteQuiz(quiz.id)}
          showToast={showToast}
        />
      ))}

      {scope === 'lesson' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleAddQuiz('mid_video')}
            className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200"
          >
            + แบบทดสอบกลางวิดีโอ
          </button>
          <button
            onClick={() => handleAddQuiz('end_of_lesson')}
            className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200"
          >
            + แบบทดสอบท้ายบท
          </button>
        </div>
      )}

      {scope === 'final' && quizzes.length === 0 && (
        <button
          onClick={() => handleAddQuiz('final')}
          className="text-sm bg-forest-100 text-forest-700 px-4 py-2 rounded hover:bg-forest-200"
        >
          + สร้างแบบทดสอบสุดท้าย
        </button>
      )}
    </div>
  )
}