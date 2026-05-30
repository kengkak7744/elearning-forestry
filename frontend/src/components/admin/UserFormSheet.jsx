import { useEffect, useState } from 'react'
import { usersApi } from '@/api/users'
import { BUTTONS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

const emptyForm = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  role: 'learner',
  department: '',
  position: '',
  phone: '',
  responsibility: '',
  motivation: '',
}

export default function UserFormSheet({ open, onOpenChange, userId, onSaved }) {
  const isEdit = !!userId
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      setForm(emptyForm)
      return
    }
    setLoadingDetail(true)
    usersApi
      .getById(userId)
      .then((data) =>
        setForm({
          username: data.username,
          email: data.email,
          full_name: data.full_name,
          password: '',
          role: data.role,
          department: data.department || '',
          position: data.position || '',
          phone: data.phone || '',
          responsibility: data.responsibility || '',
          motivation: data.motivation || '',
        })
      )
      .catch(() => showToast('ไม่พบข้อมูลผู้ใช้', 'error'))
      .finally(() => setLoadingDetail(false))
  }, [open, userId, isEdit])

  const update = (key) => (e) => {
    const value = typeof e === 'string' ? e : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        const { password: _pw, ...updateData } = form
        await usersApi.update(userId, updateData)
        showToast('บันทึกการแก้ไขสำเร็จ', 'success')
      } else {
        await usersApi.create(form)
        showToast('สร้างผู้ใช้สำเร็จ', 'success')
      }
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'ปรับปรุงข้อมูลและสิทธิ์ของผู้ใช้'
              : 'กรอกรายละเอียดเพื่อสร้างบัญชีผู้ใช้ใหม่'}
          </SheetDescription>
        </SheetHeader>

        {loadingDetail ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" id="user-form">
            <div className="space-y-1.5">
              <Label htmlFor="u-username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-username"
                required
                disabled={isEdit}
                minLength={3}
                maxLength={20}
                value={form.username}
                onChange={update('username')}
                placeholder="เช่น EMP001"
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">username ไม่สามารถแก้ไขได้</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-fullname">
                ชื่อ-นามสกุล <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-fullname"
                required
                minLength={2}
                value={form.full_name}
                onChange={update('full_name')}
                placeholder="นายสมชาย ใจดี"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-email">
                อีเมล <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-email"
                type="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="somchai@forest.go.th"
              />
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="u-password">
                  รหัสผ่าน <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="u-password"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
                <p className="text-xs text-muted-foreground">
                  ผู้ใช้สามารถเปลี่ยนรหัสผ่านได้หลัง login ครั้งแรก
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="u-role">
                บทบาท <span className="text-destructive">*</span>
              </Label>
              <Select value={form.role} onValueChange={update('role')}>
                <SelectTrigger id="u-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learner">เจ้าหน้าที่ผู้เรียน</SelectItem>
                  <SelectItem value="manager">หัวหน้างาน</SelectItem>
                  <SelectItem value="instructor">วิทยากร</SelectItem>
                  <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-phone">
                เบอร์โทรศัพท์ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-phone"
                type="tel"
                required
                minLength={9}
                value={form.phone}
                onChange={update('phone')}
                placeholder="081-234-5678"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-department">หน่วยงาน</Label>
                <Input
                  id="u-department"
                  value={form.department}
                  onChange={update('department')}
                  placeholder="สำนักจัดการป่าไม้ภาคที่ 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-position">ตำแหน่ง</Label>
                <Input
                  id="u-position"
                  value={form.position}
                  onChange={update('position')}
                  placeholder="เจ้าพนักงานป่าไม้"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-responsibility">
                หน้าที่รับผิดชอบ <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="u-responsibility"
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={form.responsibility}
                onChange={update('responsibility')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-motivation">
                เหตุผลในการเรียน <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="u-motivation"
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={form.motivation}
                onChange={update('motivation')}
              />
            </div>
          </form>
        )}

        <SheetFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {BUTTONS.CANCEL}
          </Button>
          <Button type="submit" form="user-form" disabled={loading || loadingDetail}>
            {loading
              ? BUTTONS.SAVING
              : isEdit
              ? BUTTONS.SAVE_AND_FINISH
              : BUTTONS.CREATE_USER}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
