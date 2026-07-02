import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Loader2, Save, Trash2, Video } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { CONTENT_TYPE_OPTIONS } from '@/constants/labels'
import { extractYoutubeId, fetchYoutubeDuration } from '@/utils/youtube'
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

// ช่องเวลาในฟอร์มกรอกเป็น "นาที" (ทศนิยมได้) แต่ backend เก็บเป็นวินาที —
// แปลงไปกลับที่ขอบฟอร์มเท่านั้น
function secondsToMinutesText(seconds) {
  if (seconds == null || seconds === '') return ''
  return String(Math.round((seconds / 60) * 100) / 100)
}

function minutesTextToSeconds(text) {
  if (text == null || String(text).trim() === '') return null
  const minutes = parseFloat(text)
  if (!Number.isFinite(minutes) || minutes < 0) return null
  return Math.round(minutes * 60)
}

// อ่านความยาวจากไฟล์วิดีโอในเครื่องก่อนอัปโหลด (โหลดเฉพาะ metadata)
function readVideoFileDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration)
          : null
      )
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

export default function LessonEditor({ lesson, index, onUpdate, onSave, onDelete }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(() =>
    secondsToMinutesText(lesson.duration_seconds)
  )
  const [minViewMinutes, setMinViewMinutes] = useState(() =>
    secondsToMinutesText(lesson.min_view_seconds)
  )
  const [fetchingDuration, setFetchingDuration] = useState(false)
  // URL ล่าสุดที่ดึงความยาวแล้ว — เริ่มด้วย URL เดิมของบทเรียน เพื่อไม่ให้
  // blur เฉย ๆ ไปทับความยาวที่ผู้ใช้แก้เองไว้
  const lastFetchedUrlRef = useRef(lesson.content_url || null)

  const setField = (key) => (val) => {
    onUpdate({ [key]: val })
  }

  // ค่าวินาทีเปลี่ยนจากภายนอก (ดึงอัตโนมัติ / อัปโหลด) → อัปเดตช่องนาทีตาม
  // ระหว่างพิมพ์ไม่โดนทับเพราะ onChange ส่งค่าที่แปลงแล้วขึ้น parent ทันที
  useEffect(() => {
    if (minutesTextToSeconds(durationMinutes) !== (lesson.duration_seconds ?? null)) {
      setDurationMinutes(secondsToMinutesText(lesson.duration_seconds))
    }
  }, [durationMinutes, lesson.duration_seconds])

  useEffect(() => {
    if (minutesTextToSeconds(minViewMinutes) !== (lesson.min_view_seconds ?? null)) {
      setMinViewMinutes(secondsToMinutesText(lesson.min_view_seconds))
    }
  }, [minViewMinutes, lesson.min_view_seconds])

  const handleDurationMinutesChange = (e) => {
    setDurationMinutes(e.target.value)
    onUpdate({ duration_seconds: minutesTextToSeconds(e.target.value) })
  }

  const handleMinViewMinutesChange = (e) => {
    setMinViewMinutes(e.target.value)
    onUpdate({ min_view_seconds: minutesTextToSeconds(e.target.value) })
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const detected = await readVideoFileDuration(file)
      let updated = await lessonsApi.uploadVideo(lesson.id, file, setUploadProgress)
      if (detected) {
        // อัปโหลดบันทึก content_url ลงฐานข้อมูลไปแล้ว — บันทึกความยาวตามไปด้วย
        // เพื่อไม่ให้หายถ้าผู้ใช้ไม่ได้กด "บันทึกบทเรียน" ต่อ
        try {
          updated = await lessonsApi.update(lesson.id, { duration_seconds: detected })
        } catch {
          updated = { ...updated, duration_seconds: detected }
        }
      }
      onUpdate(updated)
      showToast(
        detected
          ? `อัปโหลดวิดีโอสำเร็จ — ความยาว ${secondsToMinutesText(detected)} นาที`
          : 'อัปโหลดวิดีโอสำเร็จ',
        'success'
      )
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleYoutubeUrlBlur = async () => {
    const url = (lesson.content_url || '').trim()
    if (!url || !extractYoutubeId(url) || url === lastFetchedUrlRef.current) return
    lastFetchedUrlRef.current = url
    setFetchingDuration(true)
    try {
      const seconds = await fetchYoutubeDuration(url)
      if (seconds) {
        onUpdate({ duration_seconds: seconds })
        showToast(
          `ดึงความยาววิดีโอสำเร็จ — ${secondsToMinutesText(seconds)} นาที`,
          'success'
        )
      } else {
        lastFetchedUrlRef.current = null // เปิดทางให้ลองใหม่
        showToast('ดึงความยาววิดีโออัตโนมัติไม่สำเร็จ กรอกเองได้ที่ช่อง "ความยาว (นาที)"', 'error')
      }
    } finally {
      setFetchingDuration(false)
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
                onBlur={handleYoutubeUrlBlur}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {fetchingDuration ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  กำลังดึงความยาววิดีโอ...
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  วางลิงก์แล้วระบบจะดึงความยาววิดีโอให้อัตโนมัติ (แก้ไขเองได้)
                </p>
              )}
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

          {(lesson.content_type === 'video_youtube' ||
            lesson.content_type === 'video_file') && (
            <div className="space-y-1">
              <Label className="text-xs">Caption URL (.vtt)</Label>
              <Input
                type="url"
                value={lesson.caption_url || ''}
                onChange={(e) => setField('caption_url')(e.target.value || null)}
                placeholder="/videos/caption-th.vtt หรือ https://..."
              />
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
                <Label className="text-xs">
                  ความยาว (นาที){' '}
                  <span className="text-muted-foreground">— ดึงให้อัตโนมัติ แก้ไขได้</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={durationMinutes}
                  onChange={handleDurationMinutesChange}
                  placeholder="เช่น 12.5"
                />
                {lesson.duration_seconds != null && (
                  <p className="text-xs text-muted-foreground">
                    = {lesson.duration_seconds} วินาที
                  </p>
                )}
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
            <Label className="text-xs">Transcript / สรุปเนื้อหา</Label>
            <Textarea
              rows={4}
              value={lesson.transcript || ''}
              onChange={(e) => setField('transcript')(e.target.value || null)}
              placeholder="ใส่คำบรรยายถอดเสียงหรือสรุปเนื้อหาสำคัญของบทเรียน"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              เวลาขั้นต่ำที่ต้องอยู่บนหน้า (นาที){' '}
              <span className="text-muted-foreground">— 0 หรือเว้นว่าง = ปิด</span>
            </Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={minViewMinutes}
              onChange={handleMinViewMinutesChange}
              placeholder="เช่น 2 = 2 นาที"
            />
            {lesson.min_view_seconds != null && lesson.min_view_seconds > 0 && (
              <p className="text-xs text-muted-foreground">
                = {lesson.min_view_seconds} วินาที
              </p>
            )}
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
