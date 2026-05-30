import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const typeLabels = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
  opinion: 'ความคิดเห็น (ไม่ตรวจ)',
}

export default function QuestionEditor({ question, index, onUpdate, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({
    question_text: question.question_text,
    choices: question.choices || [],
    correct_text: question.correct_text || '',
  })

  const handleSave = async () => {
    try {
      const updated = await quizzesApi.updateQuestion(question.id, draft)
      onUpdate(updated)
      setExpanded(false)
      showToast('บันทึกคำถามสำเร็จ', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  const updateChoice = (idx, field, value) => {
    const next = [...draft.choices]
    next[idx] = { ...next[idx], [field]: value }
    if (
      question.question_type === 'single_choice' &&
      field === 'is_correct' &&
      value
    ) {
      next.forEach((c, i) => {
        if (i !== idx) c.is_correct = false
      })
    }
    setDraft({ ...draft, choices: next })
  }

  const addChoice = () => {
    setDraft({
      ...draft,
      choices: [
        ...draft.choices,
        { text: `ตัวเลือก ${draft.choices.length + 1}`, is_correct: false },
      ],
    })
  }

  const removeChoice = (idx) => {
    setDraft({ ...draft, choices: draft.choices.filter((_, i) => i !== idx) })
  }

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <div className="flex items-center gap-2 p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? 'ย่อคำถาม' : 'ขยายคำถาม'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </Button>
        <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">
          Q{index + 1}
        </span>
        <Badge variant="secondary" className="flex-shrink-0 bg-background font-normal">
          {typeLabels[question.question_type]}
        </Badge>
        <span className="flex-1 truncate text-sm text-foreground">
          {question.question_text}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">ลบ</span>
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-card p-3">
          <div className="space-y-1">
            <Label htmlFor={`qe-text-${question.id}`} className="text-xs">
              คำถาม
            </Label>
            <Textarea
              id={`qe-text-${question.id}`}
              rows={2}
              value={draft.question_text}
              onChange={(e) =>
                setDraft({ ...draft, question_text: e.target.value })
              }
            />
          </div>

          {(question.question_type === 'single_choice' ||
            question.question_type === 'multiple_choice') && (
            <div>
              <Label className="text-xs">ตัวเลือก</Label>
              <div className="mt-2 space-y-2">
                {draft.choices.map((choice, idx) => {
                  const correctId = `qe-${question.id}-correct-${idx}`
                  const textId = `qe-${question.id}-text-${idx}`
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        id={correctId}
                        type={
                          question.question_type === 'single_choice'
                            ? 'radio'
                            : 'checkbox'
                        }
                        name={`q-${question.id}-correct`}
                        checked={choice.is_correct}
                        onChange={(e) =>
                          updateChoice(idx, 'is_correct', e.target.checked)
                        }
                        aria-label={`ตัวเลือกที่ ${idx + 1} ถูกต้อง`}
                        className="h-4 w-4 accent-primary"
                      />
                      <Label htmlFor={textId} className="sr-only">
                        ข้อความตัวเลือกที่ {idx + 1}
                      </Label>
                      <Input
                        id={textId}
                        value={choice.text}
                        onChange={(e) => updateChoice(idx, 'text', e.target.value)}
                        className="flex-1"
                      />
                      {draft.choices.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeChoice(idx)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label={`ลบตัวเลือกที่ ${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={addChoice}
                className="mt-2 text-primary hover:text-primary"
              >
                <Plus className="mr-1 h-3 w-3" />
                เพิ่มตัวเลือก
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                ติ๊กเครื่องหมายหน้าตัวเลือกที่ถูกต้อง
              </p>
            </div>
          )}

          {question.question_type === 'written' && (
            <div className="space-y-1">
              <Label htmlFor={`qe-correct-${question.id}`} className="text-xs">
                คำตอบที่ถูกต้อง
              </Label>
              <Input
                id={`qe-correct-${question.id}`}
                value={draft.correct_text}
                onChange={(e) =>
                  setDraft({ ...draft, correct_text: e.target.value })
                }
                placeholder="คำตอบที่ถูก (เปรียบเทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่)"
              />
            </div>
          )}

          {question.question_type === 'opinion' && (
            <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-foreground">
              คำถามแบบความคิดเห็น — ผู้เรียนตอบอะไรก็ได้ (หรือเว้นว่าง) จะถูกนับว่าตอบถูกเสมอ
            </p>
          )}

          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1 h-3.5 w-3.5" />
            บันทึก
          </Button>
        </div>
      )}
    </div>
  )
}
