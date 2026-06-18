import { useState } from 'react'
import { ChevronDown, ChevronRight, FileStack, Plus, Trash2 } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import LessonEditor from '@/components/admin/course-edit/LessonEditor'
import { toastApiError } from '@/utils/apiError'

export default function ModuleEditor({
  module,
  index,
  onUpdate,
  onDelete,
  onAddLesson,
  onUpdateLesson,
  onSaveLesson,
  onDeleteLesson,
  onLessonsAdded,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [expanded, setExpanded] = useState(true)
  // Auto-split: when ON, picking a PDF uploads it and the server carves it into
  // one lesson per table-of-contents heading, down to 2 levels (deeper
  // sub-headings fold into their parent lesson).
  const [autoSplit, setAutoSplit] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [splitProgress, setSplitProgress] = useState(0)

  const handleSave = () => {
    onUpdate({ title })
    setEditing(false)
  }

  const handleSplitUpload = async (e) => {
    const file = e.target.files?.[0]
    // Reset so re-picking the same file still fires onChange.
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('รองรับเฉพาะไฟล์ PDF', 'error')
      return
    }
    setSplitting(true)
    setSplitProgress(0)
    try {
      const result = await lessonsApi.splitPdf(module.id, file, setSplitProgress)
      const newLessons = result?.lessons ?? []
      if (newLessons.length > 0) onLessonsAdded?.(newLessons)
      showToast(`แยกเป็น ${result?.created_count ?? newLessons.length} บทเรียนสำเร็จ`, 'success')
    } catch (err) {
      toastApiError(err, 'แยกบทเรียนไม่สำเร็จ')
    } finally {
      setSplitting(false)
      setSplitProgress(0)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'ย่อ' : 'ขยาย'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">
          โมดูลที่ {index + 1}
        </span>
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="h-8 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 cursor-text text-left text-sm font-medium text-foreground hover:text-primary"
          >
            {module.title}
          </button>
        )}
        <Button variant="outline" size="sm" onClick={onAddLesson}>
          <Plus className="mr-1 h-3 w-3" />
          บทเรียน
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">ลบโมดูล</span>
        </Button>
      </div>

      {expanded && (
        <div className="divide-y divide-border">
          {/* Auto-split-by-table-of-contents control */}
          <div className="bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor={`autosplit-${module.id}`}
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground"
              >
                <FileStack className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                แยก PDF เป็นบทเรียนอัตโนมัติตามสารบัญ
              </Label>
              <Switch
                id={`autosplit-${module.id}`}
                checked={autoSplit}
                onCheckedChange={setAutoSplit}
                disabled={splitting}
              />
            </div>
            {autoSplit && (
              <div className="mt-2 space-y-1.5">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleSplitUpload}
                  disabled={splitting}
                  className="text-sm"
                  aria-label="เลือกไฟล์ PDF เพื่อแยกเป็นบทเรียน"
                />
                <p className="text-[11px] text-muted-foreground">
                  อัปโหลด PDF 1 ไฟล์ที่มีสารบัญ (bookmarks) — ระบบจะแยกเป็นหลายบทเรียนให้อัตโนมัติ
                  ตามหัวข้อในสารบัญลึก 2 ระดับ (หัวข้อย่อยที่ลึกกว่านั้นถูกรวมเข้าบทเรียนแม่)
                  ชื่อแสดงลำดับชั้นแบบ &ldquo;บทที่ 1 › 1.1&rdquo; และต่อท้ายบทเรียนเดิมในโมดูลนี้
                </p>
                {splitting && (
                  <div className="space-y-1">
                    <Progress value={splitProgress} className="h-1.5" />
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {splitProgress < 100
                        ? `กำลังอัปโหลด ${splitProgress}%`
                        : 'กำลังแยกบทเรียน...'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {module.lessons.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">ยังไม่มีบทเรียน</p>
          ) : (
            module.lessons.map((lesson, lIdx) => (
              <LessonEditor
                key={lesson.id}
                lesson={lesson}
                index={lIdx}
                onUpdate={(updates) => onUpdateLesson(lesson.id, updates)}
                onSave={() => onSaveLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
