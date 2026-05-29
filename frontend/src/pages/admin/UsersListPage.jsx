import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Ban, KeyRound, Pencil, Plus, Search } from 'lucide-react'
import { usersApi } from '@/api/users'
import { ROLE_BADGES, ROLE_LABELS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

function UserFormSheet({ open, onOpenChange, userId, onSaved }) {
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
            ยกเลิก
          </Button>
          <Button type="submit" form="user-form" disabled={loading || loadingDetail}>
            {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างผู้ใช้'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ResetPasswordDialog({ target, onClose }) {
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
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
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
            ยกเลิก
          </Button>
          <Button type="submit" form="reset-pw-form" disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'รีเซ็ตรหัสผ่าน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersListPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const editId = params.get('id')
  const isAdding = params.get('new') === '1'

  const [resetTarget, setResetTarget] = useState(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await usersApi.list({
        search,
        role: roleFilter === 'all' ? undefined : roleFilter,
      })
      setUsers(data)
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดรายการไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(loadUsers, search ? 400 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter])

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return
    const target = confirmDeactivate
    setConfirmDeactivate(null)
    try {
      await usersApi.deactivate(target.id)
      showToast('ระงับบัญชีเรียบร้อย', 'success')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  const openEdit = (userId) => {
    setParams({ id: String(userId) })
  }

  const openAdd = () => {
    setParams({ new: '1' })
  }

  const closeSheet = () => {
    navigate('/admin/users', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">จัดการผู้ใช้</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            รายการเจ้าหน้าที่ทั้งหมดในระบบ
          </p>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto">
          <Plus className="mr-1 h-4 w-4" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ค้นหาชื่อ username หรืออีเมล..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกบทบาท</SelectItem>
              <SelectItem value="learner">เจ้าหน้าที่ผู้เรียน</SelectItem>
              <SelectItem value="manager">หัวหน้างาน</SelectItem>
              <SelectItem value="instructor">วิทยากร</SelectItem>
              <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            ไม่พบข้อมูล
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden border-border/60 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>หน่วยงาน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const roleMeta = ROLE_BADGES[u.role]
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell className="font-medium text-foreground">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {roleMeta?.label ?? ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.department || '-'}
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            ระงับ
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u.id)}
                            title="แก้ไข"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">แก้ไข</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(u)}
                            title="รีเซ็ตรหัสผ่าน"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span className="sr-only">รีเซ็ตรหัสผ่าน</span>
                          </Button>
                          {u.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeactivate(u)}
                              className="text-destructive hover:text-destructive"
                              title="ระงับบัญชี"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span className="sr-only">ระงับ</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {users.map((u) => {
              const roleMeta = ROLE_BADGES[u.role]
              return (
                <Card key={u.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {u.full_name}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          @{u.username}
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0 font-normal">
                        {roleMeta?.label ?? u.role}
                      </Badge>
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div className="truncate">{u.email}</div>
                      <div className="truncate">{u.department || '-'}</div>
                      <div>
                        {u.is_active ? (
                          <span className="text-success">● ใช้งาน</span>
                        ) : (
                          <span>● ระงับ</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(u.id)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        แก้ไข
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setResetTarget(u)}
                      >
                        <KeyRound className="mr-1 h-3 w-3" />
                        รีเซ็ตรหัส
                      </Button>
                      {u.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeactivate(u)}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          ระงับ
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        แสดง {users.length} รายการ
      </div>

      <UserFormSheet
        open={!!editId || isAdding}
        onOpenChange={(open) => !open && closeSheet()}
        userId={editId}
        onSaved={loadUsers}
      />

      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />

      <AlertDialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ระงับบัญชี</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการระงับบัญชี &ldquo;{confirmDeactivate?.full_name}&rdquo; ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันระงับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
