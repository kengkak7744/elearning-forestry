import { useState } from 'react'
import { FolderTree } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { showToast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toastApiError } from '@/utils/apiError'

/**
 * Course-level auto-split: upload one PDF whose table of contents has multiple
 * levels, and the server builds the whole tree — top-level headings become
 * MODULES, their sub-headings become LESSONS inside them. The created modules
 * are appended to the course via onModulesAdded.
 */
export default function CoursePdfSplitPanel({ courseId, onModulesAdded }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    // Reset so re-picking the same file still fires onChange.
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('รองรับเฉพาะไฟล์ PDF', 'error')
      return
    }
    setBusy(true)
    setProgress(0)
    try {
      const result = await lessonsApi.splitPdfIntoModules(courseId, file, setProgress)
      const mods = result?.modules ?? []
      if (mods.length > 0) onModulesAdded?.(mods)
      showToast(
        `แยกเป็น ${result?.created_modules ?? mods.length} โมดูล / ${result?.created_lessons ?? 0} บทเรียนสำเร็จ`,
        'success'
      )
    } catch (err) {
      toastApiError(err, 'แยกโมดูลไม่สำเร็จ')
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={`course-autosplit-${courseId}`}
          className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <FolderTree className="h-4 w-4 text-primary" aria-hidden="true" />
          แยก PDF เป็นโมดูล + บทเรียนอัตโนมัติตามสารบัญ
        </Label>
        <Switch
          id={`course-autosplit-${courseId}`}
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={busy}
        />
      </div>
      {enabled && (
        <div className="mt-2 space-y-1.5">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={busy}
            className="text-sm"
            aria-label="เลือกไฟล์ PDF เพื่อแยกเป็นโมดูลและบทเรียน"
          />
          <p className="text-[11px] text-muted-foreground">
            อัปโหลด PDF 1 ไฟล์ที่มีสารบัญหลายระดับ — หัวข้อหลัก = โมดูล, หัวข้อย่อยระดับ 2 = บทเรียน
            (สูงสุด 2 ระดับ และลดความลึกอัตโนมัติถ้าได้เกิน 50 ตอน) ต่อท้ายโมดูลเดิมในคอร์ส (ไฟล์ไม่เกิน 400 MB)
          </p>
          {busy && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {progress < 100 ? `กำลังอัปโหลด ${progress}%` : 'กำลังแยกโมดูล...'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
