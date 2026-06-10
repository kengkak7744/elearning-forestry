import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { ROLE_LABELS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function ViewField({ label, value, mono }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium text-foreground ${mono ? 'font-mono' : ''} whitespace-pre-wrap`}>
        {value || '-'}
      </div>
    </div>
  )
}

export default function ProfileTab() {
  const { user, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    position: user?.position || '',
    responsibility: user?.responsibility || '',
    motivation: user?.motivation || '',
  })

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const startEdit = () => {
    setForm({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      department: user?.department || '',
      position: user?.position || '',
      responsibility: user?.responsibility || '',
      motivation: user?.motivation || '',
    })
    setEditing(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await authApi.updateMe(form)
      updateUser(updated)
      showToast('บันทึกข้อมูลสำเร็จ', 'success')
      setEditing(false)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc[1]}: ${d.msg}`).join(', ')
        : detail || 'เกิดข้อผิดพลาด'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <h3 className="text-base font-semibold">ข้อมูลส่วนตัว</h3>
            <p className="text-sm text-muted-foreground">รายละเอียดบัญชีของคุณ</p>
          </div>
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            แก้ไข
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ViewField label="ชื่อผู้ใช้" value={user?.username} mono />
            <ViewField label="บทบาท" value={ROLE_LABELS[user?.role]} />
            <ViewField label="ชื่อ-นามสกุล" value={user?.full_name} />
            <ViewField label="อีเมล" value={user?.email} />
            <ViewField label="เบอร์โทรศัพท์" value={user?.phone} />
            <ViewField label="หน่วยงาน" value={user?.department} />
            <div className="sm:col-span-2">
              <ViewField label="ตำแหน่ง" value={user?.position} />
            </div>
            <div className="sm:col-span-2">
              <ViewField label="หน้าที่รับผิดชอบ" value={user?.responsibility} />
            </div>
            <div className="sm:col-span-2">
              <ViewField label="เหตุผลในการเรียน" value={user?.motivation} />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <h3 className="text-base font-semibold">แก้ไขข้อมูลส่วนตัว</h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ViewField label="ชื่อผู้ใช้ (แก้ไขไม่ได้)" value={user?.username} mono />
              <ViewField label="อีเมล (แก้ไขไม่ได้)" value={user?.email} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-fullname">ชื่อ-นามสกุล <span className="text-destructive">*</span></Label>
              <Input id="prof-fullname" required value={form.full_name} onChange={update('full_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone">เบอร์โทรศัพท์ <span className="text-destructive">*</span></Label>
              <Input id="prof-phone" type="tel" required value={form.phone} onChange={update('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-dept">หน่วยงาน/สังกัด <span className="text-destructive">*</span></Label>
              <Input id="prof-dept" required value={form.department} onChange={update('department')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-position">ตำแหน่ง <span className="text-destructive">*</span></Label>
              <Input id="prof-position" required value={form.position} onChange={update('position')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-responsibility">หน้าที่รับผิดชอบ <span className="text-destructive">*</span></Label>
              <Textarea
                id="prof-responsibility"
                required
                rows={3}
                maxLength={1000}
                value={form.responsibility}
                onChange={update('responsibility')}
              />
              <p className="text-xs text-muted-foreground">{form.responsibility.length}/1000 ตัวอักษร</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-motivation">เหตุผลในการเรียน <span className="text-destructive">*</span></Label>
              <Textarea
                id="prof-motivation"
                required
                rows={3}
                maxLength={1000}
                value={form.motivation}
                onChange={update('motivation')}
              />
              <p className="text-xs text-muted-foreground">{form.motivation.length}/1000 ตัวอักษร</p>
            </div>
          </div>

          <div className="flex gap-3 border-t border-border/60 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
