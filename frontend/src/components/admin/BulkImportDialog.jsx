import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react'
import { usersApi } from '@/api/users'
import { BUTTONS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastApiError } from '@/utils/apiError'

const TEMPLATE_HEADERS = [
  'username',
  'email',
  'full_name',
  'department',
  'position',
  'phone',
  'responsibility',
  'motivation',
  'role',
  'password',
]
const TEMPLATE_SAMPLE = [
  'emp001',
  'somchai@forest.go.th',
  'นายสมชาย ใจดี',
  'สำนักจัดการป่าไม้ภาคที่ 1',
  'เจ้าพนักงานป่าไม้',
  '081-234-5678',
  'ดูแลการสำรวจป่า',
  'พัฒนาความรู้',
  'learner',
  '',
]

function downloadTemplate() {
  // Prepend BOM so Excel opens UTF-8 Thai correctly without garbling.
  const csv =
    '﻿' +
    TEMPLATE_HEADERS.join(',') +
    '\n' +
    TEMPLATE_SAMPLE.map((v) => (v.includes(',') ? `"${v}"` : v)).join(',') +
    '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'user-import-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function copyPasswordsToClipboard(created) {
  const lines = created
    .filter((c) => c.generated_password)
    .map((c) => `${c.username}\t${c.generated_password}`)
  if (lines.length === 0) return
  const text = 'username\tpassword\n' + lines.join('\n')
  navigator.clipboard
    .writeText(text)
    .then(() => showToast('คัดลอกรหัสผ่านลงคลิปบอร์ดแล้ว', 'success'))
    .catch(() => showToast('คัดลอกไม่สำเร็จ', 'error'))
}

export default function BulkImportDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const reset = () => {
    setFile(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClose = (next) => {
    if (loading) return
    if (!next) {
      // If import finished, tell parent so it can refresh the user list.
      if (result && result.created_count > 0) onDone?.()
      reset()
    }
    onOpenChange(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || loading) return
    setLoading(true)
    setResult(null)
    try {
      const data = await usersApi.bulkImport(file)
      setResult(data)
      if (data.created_count > 0) {
        showToast(`สร้างผู้ใช้ ${data.created_count} คนสำเร็จ`, 'success')
      } else if (data.skipped_count + data.error_count > 0) {
        showToast('ไม่ได้สร้างผู้ใช้ใหม่', 'error')
      }
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const generatedRows = (result?.created ?? []).filter((c) => c.generated_password)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>นำเข้าผู้ใช้จากไฟล์ CSV</DialogTitle>
          <DialogDescription>
            สร้างผู้ใช้หลายคนพร้อมกันจากไฟล์ CSV — เหมาะกับการเพิ่มเจ้าหน้าที่ใหม่ทั้งทีม
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">รูปแบบไฟล์ที่ต้องการ</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                <li>คอลัมน์บังคับ: <code className="font-mono">username, email, full_name, department, position, phone</code></li>
                <li>คอลัมน์เสริม: <code className="font-mono">responsibility, motivation, role, password</code></li>
                <li>ถ้าเว้น <code className="font-mono">password</code> ระบบจะสร้างรหัสผ่านสุ่มให้ (แสดงในผลลัพธ์)</li>
                <li>ถ้าเว้น <code className="font-mono">role</code> จะเป็น <code className="font-mono">learner</code> โดยปริยาย</li>
              </ul>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={downloadTemplate}
                className="-ml-3 mt-1 h-auto p-0 text-primary"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                ดาวน์โหลด template CSV
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3" id="bulk-import-form">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-import-file">เลือกไฟล์ CSV</Label>
                <Input
                  id="bulk-import-file"
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} · {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </form>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                {BUTTONS.CANCEL}
              </Button>
              <Button type="submit" form="bulk-import-form" disabled={!file || loading}>
                <Upload className="mr-1 h-4 w-4" />
                {loading ? 'กำลังนำเข้า...' : 'เริ่มนำเข้า'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md border border-success/30 bg-success/5 p-2 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  สร้างสำเร็จ
                </div>
                <div className="text-2xl font-semibold tabular-nums text-success">
                  {result.created_count}
                </div>
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-center">
                <div className="text-xs text-warning">ข้าม</div>
                <div className="text-2xl font-semibold tabular-nums text-warning">
                  {result.skipped_count}
                </div>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-center">
                <div className="text-xs text-destructive">ผิดพลาด</div>
                <div className="text-2xl font-semibold tabular-nums text-destructive">
                  {result.error_count}
                </div>
              </div>
            </div>

            {generatedRows.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-foreground">
                    รหัสผ่านที่สร้างใหม่ ({generatedRows.length})
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyPasswordsToClipboard(result.created)}
                  >
                    คัดลอกทั้งหมด
                  </Button>
                </div>
                <p className="mb-1 text-[11px] text-destructive">
                  รหัสผ่านเหล่านี้แสดงเพียงครั้งเดียว — กรุณาคัดลอกและส่งให้ผู้ใช้ทันที
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">username</th>
                        <th className="px-2 py-1.5 text-left font-medium">password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {generatedRows.map((c) => (
                        <tr key={c.username}>
                          <td className="px-2 py-1 font-mono">{c.username}</td>
                          <td className="px-2 py-1 font-mono">{c.generated_password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.skipped?.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  ข้าม ({result.skipped.length})
                </h4>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="secondary" className="font-normal">
                        แถว {s.row}
                      </Badge>
                      <span className="text-foreground">
                        {s.username ?? s.email}
                      </span>
                      <span className="text-muted-foreground">— {s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors?.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ผิดพลาด ({result.errors.length})
                </h4>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="secondary" className="font-normal">
                        แถว {e.row}
                      </Badge>
                      <span className="text-foreground">{e.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={reset}>
                นำเข้าไฟล์อื่น
              </Button>
              <Button type="button" onClick={() => handleClose(false)}>
                เสร็จสิ้น
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
