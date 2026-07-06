import { useState } from 'react'
import { authApi } from '@/api/auth'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import PasswordInput from '@/components/shared/PasswordInput'
import { toastApiError } from '@/utils/apiError'

export default function SecurityTab() {
  const [data, setData] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })
  const [loading, setLoading] = useState(false)

  const update = (k) => (e) => setData({ ...data, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (data.new_password !== data.confirm_new_password) {
      showToast('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน', 'error')
      return
    }
    if (data.new_password.length < 6) {
      showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'error')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword(data.current_password, data.new_password)
      showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'success')
      setData({ current_password: '', new_password: '', confirm_new_password: '' })
    } catch (err) {
      toastApiError(err, 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <h3 className="text-base font-semibold">เปลี่ยนรหัสผ่าน</h3>
        <p className="text-sm text-muted-foreground">
          กรอกรหัสผ่านปัจจุบันและตั้งรหัสผ่านใหม่
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">รหัสผ่านปัจจุบัน</Label>
            <PasswordInput
              id="cur-pw"
              required
              autoComplete="current-password"
              value={data.current_password}
              onChange={update('current_password')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">รหัสผ่านใหม่</Label>
            <PasswordInput
              id="new-pw"
              required
              minLength={6}
              autoComplete="new-password"
              value={data.new_password}
              onChange={update('new_password')}
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">ยืนยันรหัสผ่านใหม่</Label>
            <PasswordInput
              id="confirm-pw"
              required
              minLength={6}
              autoComplete="new-password"
              value={data.confirm_new_password}
              onChange={update('confirm_new_password')}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
