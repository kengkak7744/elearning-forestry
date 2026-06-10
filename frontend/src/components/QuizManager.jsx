import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import QuizEditor from './QuizEditor'
import { toastApiError } from '@/utils/apiError'

export default function QuizManager({ lessonId, courseId, scope, showToast }) {
  // scope: "lesson" or "final"
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

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
      toastApiError(err, 'โหลดแบบทดสอบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuizzes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, courseId])

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
      showToast('เพิ่มแบบทดสอบสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'เพิ่มไม่สำเร็จ')
    }
  }

  const handleUpdateQuiz = (quizId, updates) => {
    setQuizzes(quizzes.map((q) => (q.id === quizId ? { ...q, ...updates } : q)))
  }

  const handleDeleteQuiz = async () => {
    if (!confirmDelete) return
    const quizId = confirmDelete.id
    setConfirmDelete(null)
    try {
      await quizzesApi.delete(quizId)
      setQuizzes(quizzes.filter((q) => q.id !== quizId))
      showToast('ลบแบบทดสอบสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {quizzes.map((quiz) => (
        <QuizEditor
          key={quiz.id}
          quiz={quiz}
          onUpdate={(updates) => handleUpdateQuiz(quiz.id, updates)}
          onDelete={() => setConfirmDelete(quiz)}
          showToast={showToast}
        />
      ))}

      {scope === 'lesson' && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddQuiz('mid_video')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            แบบทดสอบกลางวิดีโอ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddQuiz('end_of_lesson')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            แบบทดสอบท้ายบท
          </Button>
        </div>
      )}

      {scope === 'final' && quizzes.length === 0 && (
        <Button onClick={() => handleAddQuiz('final')}>
          <Plus className="mr-1 h-4 w-4" />
          สร้างแบบทดสอบสุดท้าย
        </Button>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบแบบทดสอบ</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบแบบทดสอบ &ldquo;{confirmDelete?.title}&rdquo; และคำถามทั้งหมดในแบบทดสอบ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuiz}
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
