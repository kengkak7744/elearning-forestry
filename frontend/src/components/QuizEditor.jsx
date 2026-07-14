import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  LineChart,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import BulkQuestionImportDialog from './BulkQuestionImportDialog'
import QuestionEditor from './QuestionEditor'
import QuizStatsModal from './QuizStatsModal'
import { toastApiError } from '@/utils/apiError'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

export default function QuizEditor({ quiz, onUpdate, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDeleteQ, setConfirmDeleteQ] = useState(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [draft, setDraft] = useState({
    title: quiz.title,
    trigger_time: quiz.trigger_time || 0,
    can_skip: quiz.can_skip,
    show_correct_answer: quiz.show_correct_answer,
    passing_score: quiz.passing_score,
    randomize_questions: quiz.randomize_questions || false,
    questions_per_attempt: quiz.questions_per_attempt || '',
  })

  const handleSaveSettings = async () => {
    try {
      const payload = { ...draft }
      if (quiz.placement !== 'mid_video') delete payload.trigger_time
      if (!payload.randomize_questions) {
        payload.questions_per_attempt = null
      } else {
        const n = parseInt(payload.questions_per_attempt, 10)
        payload.questions_per_attempt = Number.isFinite(n) && n > 0 ? n : null
      }
      const updated = await quizzesApi.update(quiz.id, payload)
      onUpdate(updated)
      setEditing(false)
      showToast('บันทึกการตั้งค่าสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'บันทึกไม่สำเร็จ')
    }
  }

  const handleAddQuestion = async (type) => {
    try {
      const newQ = await quizzesApi.addQuestion(quiz.id, {
        question_text:
          type === 'opinion' ? 'ความคิดเห็นของคุณต่อหลักสูตรนี้' : 'คำถามใหม่',
        question_type: type,
        choices:
          type === 'single_choice' || type === 'multiple_choice'
            ? [
                { text: 'ตัวเลือก 1', is_correct: true },
                { text: 'ตัวเลือก 2', is_correct: false },
              ]
            : null,
        correct_text: type === 'written' ? '' : null,
        order_index: quiz.questions.length,
      })
      onUpdate({ questions: [...quiz.questions, newQ] })
      showToast('เพิ่มคำถามสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'เพิ่มคำถามไม่สำเร็จ')
    }
  }

  const handleUpdateQuestion = (questionId, updates) => {
    onUpdate({
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    })
  }

  const handleBulkQuestionsImported = (questions) => {
    onUpdate({ questions: [...quiz.questions, ...questions] })
  }

  const handleDeleteQuestion = async () => {
    if (!confirmDeleteQ) return
    const questionId = confirmDeleteQ.id
    setConfirmDeleteQ(null)
    try {
      await quizzesApi.deleteQuestion(questionId)
      onUpdate({ questions: quiz.questions.filter((q) => q.id !== questionId) })
      showToast('ลบคำถามสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  const placementToneClass = {
    mid_video: 'border-primary/20 bg-primary/5',
    end_of_lesson: 'border-accent/20 bg-accent/5',
    final: 'border-warning/30 bg-warning/5',
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        placementToneClass[quiz.placement] ?? 'border-border bg-card'
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'ย่อ' : 'ขยาย'}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <Badge variant="secondary" className="flex-shrink-0 bg-background font-normal">
          {placementLabels[quiz.placement]}
        </Badge>
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {quiz.title}
        </span>
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          {quiz.questions.length} คำถาม
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatsOpen(true)}
          className="text-primary hover:text-primary"
        >
          <LineChart className="mr-1 h-3.5 w-3.5" />
          สถิติ
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">ลบ</span>
        </Button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-border bg-card p-4">
          {editing ? (
            <div className="space-y-3 rounded-md bg-muted/30 p-3">
              <div className="space-y-1">
                <Label htmlFor={`qe-title-${quiz.id}`} className="text-xs">
                  ชื่อแบบทดสอบ
                </Label>
                <Input
                  id={`qe-title-${quiz.id}`}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>

              {quiz.placement === 'mid_video' && (
                <div className="space-y-1">
                  <Label htmlFor={`qe-trigger-${quiz.id}`} className="text-xs">
                    เวลาที่แสดง (วินาที)
                  </Label>
                  <Input
                    id={`qe-trigger-${quiz.id}`}
                    type="number"
                    min={0}
                    value={draft.trigger_time}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        trigger_time: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor={`qe-pass-${quiz.id}`} className="text-xs">
                  คะแนนผ่าน (%)
                </Label>
                <Input
                  id={`qe-pass-${quiz.id}`}
                  type="number"
                  min={0}
                  max={100}
                  value={draft.passing_score}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      passing_score: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor={`qe-random-${quiz.id}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    สุ่มคำถาม
                  </Label>
                  <Switch
                    id={`qe-random-${quiz.id}`}
                    checked={draft.randomize_questions}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, randomize_questions: v })
                    }
                  />
                </div>
                {draft.randomize_questions && (
                  <div className="ml-1 space-y-1">
                    <Label htmlFor={`qe-perattempt-${quiz.id}`} className="text-xs">
                      จำนวนข้อต่อครั้ง (จากทั้งหมด {quiz.questions.length} ข้อ)
                    </Label>
                    <Input
                      id={`qe-perattempt-${quiz.id}`}
                      type="number"
                      min={1}
                      max={quiz.questions.length || undefined}
                      value={draft.questions_per_attempt}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          questions_per_attempt: e.target.value,
                        })
                      }
                      placeholder="เช่น 5"
                      className="w-32"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor={`qe-skip-${quiz.id}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  อนุญาตให้ข้าม
                </Label>
                <Switch
                  id={`qe-skip-${quiz.id}`}
                  checked={draft.can_skip}
                  onCheckedChange={(v) => setDraft({ ...draft, can_skip: v })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor={`qe-correct-${quiz.id}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  แสดงคำตอบที่ถูกหลังตอบ
                </Label>
                <Switch
                  id={`qe-correct-${quiz.id}`}
                  checked={draft.show_correct_answer}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, show_correct_answer: v })
                  }
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSaveSettings}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  บันทึก
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-3">
                {quiz.placement === 'mid_video' && (
                  <span>เวลา: {quiz.trigger_time}s</span>
                )}
                <span>คะแนนผ่าน: {quiz.passing_score}%</span>
                <span>{quiz.can_skip ? 'ข้ามได้' : 'ห้ามข้าม'}</span>
                <span>
                  {quiz.show_correct_answer ? 'แสดงเฉลย' : 'ไม่แสดงเฉลย'}
                </span>
                {quiz.randomize_questions && (
                  <span className="font-medium text-primary">
                    สุ่ม {quiz.questions_per_attempt || 'ทั้งหมด'}/
                    {quiz.questions.length} ข้อ
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="text-primary hover:text-primary"
              >
                แก้ไขการตั้งค่า
              </Button>
            </div>
          )}

          {/* Questions */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">คำถาม</h4>
            {quiz.questions.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                ยังไม่มีคำถาม
              </p>
            ) : (
              <div className="space-y-2">
                {quiz.questions.map((q, idx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    onUpdate={(updates) => handleUpdateQuestion(q.id, updates)}
                    onDelete={() => setConfirmDeleteQ(q)}
                    showToast={showToast}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkImportOpen(true)}
                className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                วางคำถามหลายข้อ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddQuestion('single_choice')}
              >
                <Plus className="mr-1 h-3 w-3" />
                เลือกข้อเดียว
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddQuestion('multiple_choice')}
              >
                <Plus className="mr-1 h-3 w-3" />
                เลือกหลายข้อ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddQuestion('written')}
              >
                <Plus className="mr-1 h-3 w-3" />
                เขียนตอบ
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddQuestion('opinion')}
                className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="mr-1 h-3 w-3" />
                ความคิดเห็น
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkQuestionImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        quizId={quiz.id}
        onImported={handleBulkQuestionsImported}
        showToast={showToast}
      />

      <AlertDialog
        open={!!confirmDeleteQ}
        onOpenChange={(o) => !o && setConfirmDeleteQ(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบคำถาม</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบคำถามนี้?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuizStatsModal
        open={statsOpen}
        quizId={quiz.id}
        onClose={() => setStatsOpen(false)}
      />
    </div>
  )
}
