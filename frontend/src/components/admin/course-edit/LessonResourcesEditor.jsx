import { useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastApiError } from '@/utils/apiError'

export default function LessonResourcesEditor({ lesson, onChange }) {
  // `lesson.resources` arrives from the parent's course-loading flow. We treat
  // it as the source of truth and push optimistic updates back via onChange so
  // the lesson tree stays consistent with what the learner sees.
  const resources = lesson.resources ?? []
  const [draftTitle, setDraftTitle] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftType, setDraftType] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!draftTitle.trim() || !draftUrl.trim()) return
    setAdding(true)
    try {
      const created = await lessonsApi.addResource(lesson.id, {
        title: draftTitle.trim(),
        url: draftUrl.trim(),
        resource_type: draftType.trim() || null,
      })
      onChange({ resources: [...resources, created] })
      setDraftTitle('')
      setDraftUrl('')
      setDraftType('')
      showToast('เพิ่มเอกสารสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'เพิ่มไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (resourceId) => {
    try {
      await lessonsApi.deleteResource(resourceId)
      onChange({ resources: resources.filter((r) => r.id !== resourceId) })
      showToast('ลบเอกสารเรียบร้อย', 'success')
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-3">
      {resources.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีเอกสารประกอบ</p>
      ) : (
        <ul className="space-y-1.5">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground" title={r.url}>
                {r.title}
              </span>
              {r.resource_type && (
                <Badge variant="secondary" className="font-normal">
                  {r.resource_type}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(r.id)}
                className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label={`ลบเอกสาร ${r.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="ชื่อเอกสาร เช่น แบบฟอร์ม กฟภ."
          maxLength={200}
        />
        <Input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="URL หรือ /pdfs/file.pdf"
          maxLength={500}
        />
        <Input
          value={draftType}
          onChange={(e) => setDraftType(e.target.value)}
          placeholder="ประเภท เช่น PDF"
          maxLength={50}
          className="sm:w-24"
        />
        <Button type="submit" size="sm" disabled={adding || !draftTitle.trim() || !draftUrl.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          เพิ่ม
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        ใช้ลิงก์ภายนอก (https://...) หรือ path ภายในที่อัปโหลดไว้แล้ว
      </p>
    </div>
  )
}
