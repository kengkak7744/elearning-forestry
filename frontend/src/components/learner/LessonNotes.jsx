import { useEffect, useRef, useState } from 'react'
import { Check, NotebookPen } from 'lucide-react'
import { lessonsApi } from '@/api/lessons'
import { Textarea } from '@/components/ui/textarea'

const DEBOUNCE_MS = 700
const MAX_LENGTH = 20000

function formatRelative(iso) {
  if (!iso) return ''
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 5) return 'เมื่อสักครู่'
  if (diffSec < 60) return `${Math.floor(diffSec)} วินาทีที่แล้ว`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * One textarea per lesson, debounced autosave. State machine:
 *   idle  → user types → 'dirty' → DEBOUNCE_MS quiet → 'saving' → 'saved'
 * `lessonId` change resets everything. Pending writes flush on unmount/lesson-switch
 * so a fast clicker doesn't lose the last keystroke.
 */
export default function LessonNotes({ lessonId }) {
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | dirty | saving | saved | error
  const debouncedRef = useRef(null)
  const pendingRef = useRef(null)
  const initialRef = useRef('')
  const mountedRef = useRef(true)

  // Reset + load whenever lesson changes
  useEffect(() => {
    mountedRef.current = true
    setStatus('loading')
    setContent('')
    setSavedAt(null)
    initialRef.current = ''
    let cancelled = false
    lessonsApi
      .getMyNote(lessonId)
      .then((data) => {
        if (cancelled) return
        const text = data?.content ?? ''
        setContent(text)
        initialRef.current = text
        setSavedAt(data?.updated_at ?? null)
        setStatus('idle')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
      mountedRef.current = false
      // Flush any pending change before unmount so a quick navigate-away
      // doesn't drop the user's last keystroke.
      if (debouncedRef.current) {
        clearTimeout(debouncedRef.current)
        debouncedRef.current = null
        const finalContent = pendingRef.current
        if (finalContent != null && finalContent !== initialRef.current) {
          lessonsApi.saveMyNote(lessonId, finalContent).catch(() => {})
        }
        pendingRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const scheduleSave = (next) => {
    pendingRef.current = next
    if (debouncedRef.current) clearTimeout(debouncedRef.current)
    debouncedRef.current = setTimeout(async () => {
      debouncedRef.current = null
      const toSave = pendingRef.current
      pendingRef.current = null
      if (!mountedRef.current) return
      setStatus('saving')
      try {
        const data = await lessonsApi.saveMyNote(lessonId, toSave)
        if (!mountedRef.current) return
        initialRef.current = toSave
        setSavedAt(data?.updated_at ?? new Date().toISOString())
        setStatus('saved')
      } catch {
        if (mountedRef.current) setStatus('error')
      }
    }, DEBOUNCE_MS)
  }

  const handleChange = (e) => {
    const next = e.target.value
    setContent(next)
    setStatus('dirty')
    scheduleSave(next)
  }

  const statusLabel = (() => {
    switch (status) {
      case 'loading':
        return 'กำลังโหลดบันทึก...'
      case 'dirty':
        return 'มีการเปลี่ยนแปลง — รอบันทึก...'
      case 'saving':
        return 'กำลังบันทึก...'
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="h-3 w-3" />
            บันทึกแล้ว
          </span>
        )
      case 'error':
        return <span className="text-destructive">บันทึกไม่สำเร็จ</span>
      default:
        return savedAt ? `บันทึกครั้งล่าสุด ${formatRelative(savedAt)}` : 'ยังไม่มีบันทึก'
    }
  })()

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <NotebookPen className="h-3.5 w-3.5" />
          บันทึกส่วนตัวของฉัน
        </div>
        <div className="text-[11px] text-muted-foreground" aria-live="polite">
          {statusLabel}
        </div>
      </div>
      <Textarea
        value={content}
        onChange={handleChange}
        disabled={status === 'loading'}
        rows={5}
        maxLength={MAX_LENGTH}
        placeholder="จดบันทึกประเด็นสำคัญในบทเรียนนี้... (บันทึกอัตโนมัติ ผู้อื่นมองไม่เห็น)"
        className="resize-y"
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {content.length.toLocaleString('th-TH')} / {MAX_LENGTH.toLocaleString('th-TH')} ตัวอักษร
      </p>
    </div>
  )
}
