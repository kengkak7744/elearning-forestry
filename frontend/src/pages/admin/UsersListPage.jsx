import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LineChart,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react'
import { usersApi } from '@/api/users'
import { BUTTONS, CATEGORY_BADGES, ROLE_BADGES, ROLE_LABELS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function UserSummarySheet({ userId, open, onOpenChange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !userId) return
    setData(null)
    setLoading(true)
    usersApi
      .getLearningSummary(userId)
      .then(setData)
      .catch((err) =>
        showToast(err.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ', 'error')
      )
      .finally(() => setLoading(false))
  }, [open, userId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>ประวัติการเรียนของผู้ใช้</SheetTitle>
          <SheetDescription>
            สรุปหลักสูตรที่ลงทะเบียน ความคืบหน้า ใบรับรอง และคะแนนแบบทดสอบ
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identity */}
            <Card className="border-border/60">
              <CardContent className="space-y-1 p-4">
                <div className="text-base font-semibold text-foreground">
                  {data.user.full_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">@{data.user.username}</span>
                  {' · '}
                  {data.user.email}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {ROLE_LABELS[data.user.role] ?? data.user.role}
                  </Badge>
                  <span>{data.user.department || '-'}</span>
                  {data.user.position && <span>· {data.user.position}</span>}
                  <span>· เข้าระบบเมื่อ {formatDate(data.user.created_at)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={BookOpen}
                label="หลักสูตร"
                value={data.enrollments.length}
                hint={`จบ ${
                  data.enrollments.filter((e) => e.progress_percent >= 100).length
                } หลักสูตร`}
              />
              <StatTile
                icon={Trophy}
                label="ใบรับรอง"
                value={data.certificates.length}
              />
              <StatTile
                icon={ClipboardList}
                label="ทำแบบทดสอบ"
                value={data.quiz_stats.unique_quizzes}
                hint={`${data.quiz_stats.total_attempts} ครั้งทั้งหมด`}
              />
              <StatTile
                icon={LineChart}
                label="คะแนนเฉลี่ย"
                value={`${data.quiz_stats.average_score}%`}
                hint={`ผ่าน ${data.quiz_stats.passed_count}/${data.quiz_stats.unique_quizzes} ชุด`}
              />
            </div>

            {/* Enrollments */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                หลักสูตรที่ลงทะเบียน
              </h3>
              {data.enrollments.length === 0 ? (
                <Card className="border-dashed border-border/60">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    ยังไม่ได้ลงทะเบียนหลักสูตรใด
                  </CardContent>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {data.enrollments.map((e) => {
                    const cat = CATEGORY_BADGES[e.category]
                    const done = e.progress_percent >= 100
                    return (
                      <li key={e.course_id}>
                        <Card className="border-border/60">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="line-clamp-1 text-sm font-medium text-foreground">
                                  {e.title}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                  {cat && (
                                    <Badge variant="secondary" className="font-normal">
                                      {cat.label}
                                    </Badge>
                                  )}
                                  {e.is_mandatory && (
                                    <Badge variant="destructive">บังคับ</Badge>
                                  )}
                                  {done && (
                                    <Badge className="bg-success text-success-foreground hover:bg-success">
                                      <CheckCircle2 className="mr-0.5 h-3 w-3" />
                                      เรียนจบ
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <div className="text-sm font-semibold tabular-nums text-foreground">
                                  {e.progress_percent}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {e.completed_lessons}/{e.total_lessons} บท
                                </div>
                              </div>
                            </div>
                            <Progress value={e.progress_percent} className="mt-2 h-1.5" />
                            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                              <span>ลงทะเบียน {formatDate(e.enrolled_at)}</span>
                              {e.last_accessed_at && (
                                <span>ล่าสุด {formatDate(e.last_accessed_at)}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Certificates */}
            {data.certificates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  ใบรับรอง
                </h3>
                <ul className="space-y-2">
                  {data.certificates.map((c) => (
                    <li key={c.id}>
                      <Card className="border-border/60">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Award className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-1 text-sm font-medium text-foreground">
                              {c.course_title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              เลขที่ {c.certificate_number}
                              {c.final_score != null &&
                                ` · คะแนน ${Math.round(c.final_score)}%`}
                              {c.issued_at && ` · ${formatDate(c.issued_at)}`}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
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
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [summaryUserId, setSummaryUserId] = useState(null)

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

  const handleDelete = async () => {
    if (!confirmDelete) return
    const target = confirmDelete
    setConfirmDelete(null)
    try {
      await usersApi.delete(target.id)
      showToast(`ลบบัญชี ${target.full_name} เรียบร้อย`, 'success')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
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
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const roleMeta = ROLE_BADGES[u.role]
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => setSummaryUserId(u.id)}
                          className="text-left text-foreground hover:text-primary hover:underline"
                        >
                          {u.username}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSummaryUserId(u.id)}
                          className="text-left font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {u.full_name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {roleMeta?.label ?? ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.department || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u.id)}
                            title={BUTTONS.EDIT}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">{BUTTONS.EDIT}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(u)}
                            title={BUTTONS.RESET_PASSWORD}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span className="sr-only">{BUTTONS.RESET_PASSWORD}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(u)}
                            className="text-destructive hover:text-destructive"
                            title={BUTTONS.DELETE}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">{BUTTONS.DELETE}</span>
                          </Button>
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
                      <button
                        type="button"
                        onClick={() => setSummaryUserId(u.id)}
                        className="min-w-0 text-left"
                      >
                        <div className="truncate font-medium text-foreground hover:text-primary hover:underline">
                          {u.full_name}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          @{u.username}
                        </div>
                      </button>
                      <Badge variant="secondary" className="flex-shrink-0 font-normal">
                        {roleMeta?.label ?? u.role}
                      </Badge>
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div className="truncate">{u.email}</div>
                      <div className="truncate">{u.department || '-'}</div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(u.id)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        {BUTTONS.EDIT}
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(u)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {BUTTONS.DELETE}
                      </Button>
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

      <UserSummarySheet
        userId={summaryUserId}
        open={!!summaryUserId}
        onOpenChange={(open) => !open && setSummaryUserId(null)}
      />

      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบผู้ใช้</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบบัญชี &ldquo;{confirmDelete?.full_name}&rdquo; ออกจากระบบ?
              <br />
              <span className="mt-2 block font-medium text-destructive">
                การกระทำนี้จะลบประวัติการเรียน ใบรับรอง และการลงทะเบียนทั้งหมดของผู้ใช้
                <br />
                และไม่สามารถย้อนกลับได้
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{BUTTONS.CANCEL}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {BUTTONS.CONFIRM_DELETE}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
