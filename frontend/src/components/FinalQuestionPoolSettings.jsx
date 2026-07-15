import { useId } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'

const questionTypeLabels = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
  opinion: 'ความคิดเห็น',
}

function groupQuestions(questions) {
  const modules = new Map()

  questions.forEach((question) => {
    const moduleTitle = question.module_title || 'ไม่ระบุโมดูล'
    const lessonTitle = question.lesson_title || 'ไม่ระบุบทเรียน'
    const moduleKey = question.module_id ?? moduleTitle
    const lessonKey = question.lesson_id ?? `${moduleKey}-${lessonTitle}`

    if (!modules.has(moduleKey)) {
      modules.set(moduleKey, { key: moduleKey, title: moduleTitle, lessons: new Map() })
    }
    const module = modules.get(moduleKey)
    if (!module.lessons.has(lessonKey)) {
      module.lessons.set(lessonKey, { key: lessonKey, title: lessonTitle, questions: [] })
    }
    module.lessons.get(lessonKey).questions.push(question)
  })

  return Array.from(modules.values()).map((module) => ({
    ...module,
    lessons: Array.from(module.lessons.values()),
  }))
}

export default function FinalQuestionPoolSettings({
  mode,
  onModeChange,
  selectedQuestionIds,
  onSelectedQuestionIdsChange,
  availableQuestions,
  ownQuestionCount,
  loading,
  error,
  onRetry,
}) {
  const idPrefix = useId()
  const titleId = `final-pool-title-${idPrefix}`
  const ownId = `final-pool-own-${idPrefix}`
  const allId = `final-pool-all-${idPrefix}`
  const selectedId = `final-pool-selected-${idPrefix}`
  const questions = Array.isArray(availableQuestions) ? availableQuestions : []
  const availableIds = new Set(questions.map((question) => Number(question.id)))
  const selectedSet = new Set(
    (selectedQuestionIds || []).map(Number).filter((id) => availableIds.has(id))
  )
  const groupedQuestions = groupQuestions(questions)
  const sourceUnavailable = loading || !!error

  const updateSelection = (questionId, checked) => {
    const next = new Set(selectedSet)
    if (checked) next.add(Number(questionId))
    else next.delete(Number(questionId))
    onSelectedQuestionIdsChange(Array.from(next))
  }

  return (
    <section className="space-y-3 border-t border-border pt-3" aria-labelledby={titleId}>
      <div>
        <h4 id={titleId} className="text-sm font-medium text-foreground">
          แหล่งคำถามสำหรับแบบทดสอบสุดท้าย
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          เลือกใช้คำถามที่สร้างในแบบทดสอบนี้ หรือสุ่มจากคำถามในบทเรียน
        </p>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={onModeChange}
        aria-labelledby={titleId}
        className="gap-2"
      >
        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <RadioGroupItem id={ownId} value="own" className="mt-0.5" />
          <Label htmlFor={ownId} className="min-h-6 flex-1 cursor-pointer font-normal">
            <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              คำถามในแบบทดสอบนี้
              <Badge variant="secondary">{ownQuestionCount} ข้อ</Badge>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              ใช้และแก้ไขคำถามที่เพิ่มไว้ด้านล่าง
            </span>
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <RadioGroupItem
            id={allId}
            value="all_lessons"
            className="mt-0.5"
            disabled={sourceUnavailable}
          />
          <Label htmlFor={allId} className="min-h-6 flex-1 cursor-pointer font-normal">
            <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              สุ่มจากทุกบทเรียน
              <Badge variant="secondary">
                {loading ? 'กำลังโหลด' : `${questions.length} ข้อ`}
              </Badge>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              สร้างชุดข้อสอบใหม่จากคลังคำถามของทุกบทเรียนในหลักสูตร
            </span>
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <RadioGroupItem
            id={selectedId}
            value="selected"
            className="mt-0.5"
            disabled={sourceUnavailable}
          />
          <Label htmlFor={selectedId} className="min-h-6 flex-1 cursor-pointer font-normal">
            <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              เลือกคำถามเอง
              <Badge variant="secondary">{selectedSet.size} ข้อ</Badge>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              เลือกคำถามรายข้อ โดยจัดกลุ่มตามโมดูลและบทเรียน
            </span>
          </Label>
        </div>
      </RadioGroup>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          กำลังโหลดคลังคำถาม...
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>โหลดคลังคำถามไม่สำเร็จ</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              ลองอีกครั้ง
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && mode !== 'own' && questions.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>ยังไม่มีคำถามในบทเรียน</AlertTitle>
          <AlertDescription>
            เพิ่มคำถามในแบบทดสอบของบทเรียนก่อน แล้วจึงกลับมาตั้งค่าแบบทดสอบสุดท้าย
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && mode === 'selected' && questions.length > 0 && (
        <div className="space-y-2" aria-labelledby="selected-question-list-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 id="selected-question-list-title" className="text-sm font-medium text-foreground">
                คำถามที่ต้องการใช้
              </h5>
              <p className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
                เลือกแล้ว {selectedSet.size} จาก {questions.length} ข้อ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onSelectedQuestionIdsChange(questions.map((question) => Number(question.id)))
                }
                disabled={selectedSet.size === questions.length}
              >
                เลือกทั้งหมด
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onSelectedQuestionIdsChange([])}
                disabled={selectedSet.size === 0}
              >
                ล้างที่เลือก
              </Button>
            </div>
          </div>

          <ScrollArea className="h-80 rounded-md border border-border">
            <div className="space-y-4 p-3">
              {groupedQuestions.map((module) => (
                <section key={module.key} className="space-y-2">
                  <h6 className="text-sm font-semibold text-foreground">{module.title}</h6>
                  {module.lessons.map((lesson) => (
                    <div key={lesson.key} className="overflow-hidden rounded-md border border-border">
                      <div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-2">
                        <span className="text-xs font-medium text-foreground">{lesson.title}</span>
                        <Badge variant="outline">{lesson.questions.length} ข้อ</Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {lesson.questions.map((question) => {
                          const checkboxId = `final-pool-question-${question.id}`
                          return (
                            <div key={question.id} className="flex items-start gap-3 px-3 py-2.5">
                              <Checkbox
                                id={checkboxId}
                                className="mt-0.5"
                                checked={selectedSet.has(Number(question.id))}
                                onCheckedChange={(checked) =>
                                  updateSelection(question.id, checked === true)
                                }
                              />
                              <Label
                                htmlFor={checkboxId}
                                className="min-h-6 min-w-0 flex-1 cursor-pointer font-normal"
                              >
                                <span className="block text-sm leading-relaxed text-foreground">
                                  {question.question_text || 'คำถามไม่มีข้อความ'}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {question.quiz_title || 'แบบทดสอบบทเรียน'}
                                  {' · '}
                                  {questionTypeLabels[question.question_type] || question.question_type}
                                </span>
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </section>
  )
}
