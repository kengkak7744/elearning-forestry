import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ClipboardPaste, Loader2 } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseThaiQuestions, toBulkQuestionPayload } from '@/utils/parseThaiQuestions'
import { toastApiError } from '@/utils/apiError'

const SAMPLE_TEXT = `1 ข้อใดเป็นผลเสียของการจัดการเชื้อเพลิงที่ไม่เหมาะสม
ก. เพิ่มความปลอดภัย
ข. เกิดไฟหลุดจากพื้นที่ควบคุม
ค. ลดค่าใช้จ่าย
ง. ลดความเสียหายของป่า
เฉลย ข

2 ข้อใดเป็นเชื้อเพลิงของไฟป่า
ก. ใบไม้แห้ง
ข. น้ำ
ค. กิ่งไม้
ง. หิน
เฉลย ก, ค

3 สามเหลี่ยมไฟมีองค์ประกอบอะไรบ้าง
คำตอบ: เชื้อเพลิง ความร้อน และออกซิเจน`

const QUESTION_TYPE_LABELS = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
}

export default function BulkQuestionImportDialog({
  open,
  onOpenChange,
  quizId,
  onImported,
  showToast,
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const parsed = useMemo(() => parseThaiQuestions(text), [text])

  const handleOpenChange = (nextOpen) => {
    if (loading) return
    if (!nextOpen) setText('')
    onOpenChange(nextOpen)
  }

  const handleImport = async () => {
    if (loading || parsed.questions.length === 0 || parsed.errors.length > 0) return
    setLoading(true)
    try {
      const created = await quizzesApi.addQuestionsBulk(
        quizId,
        toBulkQuestionPayload(parsed.questions)
      )
      onImported(created)
      showToast(`นำเข้าคำถาม ${created.length} ข้อสำเร็จ`, 'success')
      handleOpenChange(false)
    } catch (err) {
      toastApiError(err, 'นำเข้าคำถามไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            นำเข้าคำถามจากข้อความ
          </DialogTitle>
          <DialogDescription>
            รองรับคำถามแบบเลือกข้อเดียว เลือกหลายข้อ และเขียนตอบ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            id={`bulk-question-format-${quizId}`}
            className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
          >
            <p className="font-medium text-foreground">รูปแบบคำตอบ</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>เลือกข้อเดียว: ใส่บรรทัด <code>เฉลย ข</code></li>
              <li>เลือกหลายข้อ: คั่นตัวเลือกด้วยจุลภาค เช่น <code>เฉลย ก, ค</code></li>
              <li>เขียนตอบ: ไม่ต้องใส่ตัวเลือก และใช้ <code>คำตอบ: ข้อความคำตอบ</code></li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`bulk-question-text-${quizId}`}>ข้อความคำถาม</Label>
            <Textarea
              id={`bulk-question-text-${quizId}`}
              aria-describedby={`bulk-question-format-${quizId}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={SAMPLE_TEXT}
              className="min-h-64 font-mono text-sm leading-6"
              disabled={loading}
            />
          </div>

          {text.trim() && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="gap-1 border-success/30 bg-success/10 text-success"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  พร้อมนำเข้า {parsed.questions.length} ข้อ
                </Badge>
                {parsed.errors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    ผิดพลาด {parsed.errors.length} รายการ
                  </Badge>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {parsed.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              )}

              {parsed.questions.length > 0 && (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {parsed.questions.map((question) => {
                    const choices = question.choices ?? []
                    const correctChoiceText = choices
                      .filter((choice) => choice.is_correct)
                      .map((choice) => choice.text)
                      .join(', ')
                    return (
                      <div
                        key={question.sourceNumber}
                        className="rounded-md border border-border bg-muted/20 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5 flex-shrink-0">
                            {question.sourceNumber}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2">
                              <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                {question.question_text}
                              </p>
                              <Badge variant="secondary" className="flex-shrink-0 font-normal">
                                {QUESTION_TYPE_LABELS[question.question_type]}
                              </Badge>
                            </div>
                            {question.question_type === 'written' ? (
                              <p className="mt-1.5 text-xs font-medium text-success">
                                คำตอบ: {question.correct_text}
                              </p>
                            ) : (
                              <>
                                <div className="mt-1.5 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                  {choices.map((choice, index) => (
                                    <span
                                      key={`${question.sourceNumber}-${index}`}
                                      className={choice.is_correct ? 'font-medium text-success' : ''}
                                    >
                                      {['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'][index] ?? index + 1}. {choice.text}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-1.5 text-xs font-medium text-success">
                                  เฉลย {question.correctLabel}: {correctChoiceText}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={loading || parsed.questions.length === 0 || parsed.errors.length > 0}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardPaste className="mr-2 h-4 w-4" />
            )}
            นำเข้า {parsed.questions.length} ข้อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
