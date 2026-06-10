import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LessonEditor from '@/components/admin/course-edit/LessonEditor'

export default function ModuleEditor({
  module,
  index,
  onUpdate,
  onDelete,
  onAddLesson,
  onUpdateLesson,
  onSaveLesson,
  onDeleteLesson,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [expanded, setExpanded] = useState(true)

  const handleSave = () => {
    onUpdate({ title })
    setEditing(false)
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
