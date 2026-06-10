import { useEffect, useState } from 'react'
import { usersApi } from '@/api/users'
import { BUTTONS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
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

export default function ResetPasswordDialog({ target, onClose }) {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!target) {
      setPw1('')
      setPw2('')
    }
  }, [target])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pw1 !== pw2) {
      showToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', 'error')
      return
    }
    if (pw1.length < 6) {
      showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error')
      return
    }
    setLoading(true)
    try {
      await usersApi.resetPassword(target.id, pw1)
      showToast(`รีเซ็ตรหัสผ่านของ ${target.full_name} สำเร็จ`, 'success')
      onClose()
    } catch (err) {
      toastApiError(err, 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{BUTTONS.RESET_PASSWORD}</DialogTitle>
          <DialogDescription>
            สำหรับ <span className="font-medium text-foreground">{target?.full_name}</span> ·{' '}
            <span className="font-mono text-xs">@{target?.username}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          การกระทำนี้จะเปลี่ยนรหัสผ่านทันที กรุณาแจ้งรหัสใหม่ให้ผู้ใช้
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" id="reset-pw-form">
          <div className="space-y-1.5">
            <Label htmlFor="rp-new">
              รหัสผ่านใหม่ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rp-new"
              type="text"
              required
              minLength={6}
              autoFocus
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="font-mono"
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
            <p className="text-xs text-muted-foreground">
              เห็นเป็นข้อความเพื่อให้คัดลอกแจ้งผู้ใช้ได้
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">
              ยืนยันรหัสผ่าน <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rp-confirm"
              type="text"
              required
              minLength={6}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="font-mono"
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {BUTTONS.CANCEL}
          </Button>
          <Button type="submit" form="reset-pw-form" disabled={loading}>
            {loading ? BUTTONS.SAVING : BUTTONS.RESET_PASSWORD}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
