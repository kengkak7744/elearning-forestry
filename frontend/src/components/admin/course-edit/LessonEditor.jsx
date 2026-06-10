import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Save, Trash2, Video } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { CONTENT_TYPE_OPTIONS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import QuizManager from '@/components/QuizManager'
import LessonResourcesEditor from '@/components/admin/course-edit/LessonResourcesEditor'
import { toastApiError } from '@/utils/apiError'

export default function LessonEditor({ lesson, index, onUpdate, onSave, onDelete }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const setField = (key) => (val) => {
    onUpdate({ [key]: val })
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const updated = await lessonsApi.uploadVideo(lesson.id, file, setUploadProgress)
      onUpdate(updated)
      showToast('อัปโหลดวิดีโอสำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const updated = await lessonsApi.uploadPdf(lesson.id, file, setUploadProgress)
      onUpdate(updated)
      showToast('อัปโหลด PDF สำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const contentTypeLabel =
    CONTENT_TYPE_OPTIONS.find((o) => o.value === lesson.content_type)?.label ?? lesson.content_type

  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? `ย่อบทเรียน ${lesson.title}` : `ขยายบทเรียน ${lesson.title}`}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
        <span className="flex-1 truncate text-sm text-foreground">{lesson.title}</span>
        <Badge variant="secondary" className="font-normal">
          {contentTypeLabel}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">ลบบทเรียน</span>
        </Button>
      </div>

      {expanded && (
        <div className="ml-8 mt-3 space-y-3 pb-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">ชื่อบทเรียน</Label>
              <Input
                value={lesson.title}
                onChange={(e) => setField('title')(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ประเภทเนื้อหา</Label>
              <Select
                value={lesson.content_type}
                onValueChange={setField('content_type')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {lesson.content_type === 'video_youtube' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <Video className="mr-1 inline h-3 w-3" />
                YouTube URL
              </Label>
              <Input
                type="url"
                value={lesson.content_url || ''}
                onChange={(e) => setField('content_url')(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          {lesson.content_type === 'video_file' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <Video className="mr-1 inline h-3 w-3" />
                ไฟล์วิดีโอ
              </Label>
              {lesson.content_url ? (
                <p className="text-xs text-success">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">ยังไม่ได้อัปโหลด</p>
              )}
              <Input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>
          )}

          {lesson.content_type === 'pdf' && (
            <div className="space-y-1">
              <Label className="text-xs">
                <FileText className="mr-1 inline h-3 w-3" />
                ไฟล์ PDF
              </Label>
              {lesson.content_url ? (
                <p className="text-xs text-success">
                  อัปโหลดแล้ว: {lesson.content_url.split('/').pop()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">ยังไม่ได้อัปโหลด</p>
              )}
              <Input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploading}
                className="text-sm"
              />
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {(lesson.content_type === 'video_youtube' ||
              lesson.content_type === 'video_file') && (
              <div className="space-y-1">
                <Label className="text-xs">ความยาว (วินาที)</Label>
                <Input
                  type="number"
                  min={0}
                  value={lesson.duration_seconds || ''}
                  onChange={(e) =>
                    setField('duration_seconds')(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
            )}
            {lesson.content_type === 'pdf' && (
              <div className="space-y-1">
                <Label className="text-xs">จำนวนหน้า</Label>
                <Input
                  type="number"
                  min={0}
                  value={lesson.total_pages || ''}
                  onChange={(e) =>
                    setField('total_pages')(e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย</Label>
            <Textarea
              rows={2}
              value={lesson.description || ''}
              onChange={(e) => setField('description')(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              เวลาขั้นต่ำที่ต้องอยู่บนหน้า (วินาที){' '}
              <span className="text-muted-foreground">— 0 หรือเว้นว่าง = ปิด</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={lesson.min_view_seconds || ''}
              onChange={(e) =>
                setField('min_view_seconds')(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="เช่น 120 = 2 นาที"
            />
          </div>

          <Button size="sm" onClick={onSave}>
            <Save className="mr-1 h-3 w-3" />
            บันทึกบทเรียน
          </Button>

          <div className="border-t border-border pt-3">
            <h4 className="mb-2 text-sm font-medium text-foreground">เอกสารประกอบ</h4>
            <LessonResourcesEditor lesson={lesson} onChange={onUpdate} />
          </div>

          <div className="border-t border-border pt-3">
            <h4 className="mb-2 text-sm font-medium text-foreground">แบบทดสอบ</h4>
            <QuizManager lessonId={lesson.id} scope="lesson" showToast={showToast} />
          </div>
        </div>
      )}
    </div>
  )
}
