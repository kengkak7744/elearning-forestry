import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, Pencil, Trophy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { coursesApi } from '@/api/courses'
import { certificatesApi } from '@/api/certificates'
import { mediaUrl } from '@/utils/media'
import { ROLE_LABELS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

function initials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

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

function ProfileTab() {
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

function SecurityTab() {
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
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
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
            <Input
              id="cur-pw"
              type="password"
              required
              autoComplete="current-password"
              value={data.current_password}
              onChange={update('current_password')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">รหัสผ่านใหม่</Label>
            <Input
              id="new-pw"
              type="password"
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
            <Input
              id="confirm-pw"
              type="password"
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

function MyCoursesTab() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    coursesApi.myEnrollments().then(setItems).catch(() => setItems([]))
  }, [])

  if (items === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">คุณยังไม่ได้ลงทะเบียนหลักสูตรใด</p>
          <Button asChild>
            <Link to="/courses">ไปดูหลักสูตรทั้งหมด</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => {
        const progress = e.progress_percent ?? 0
        const id = e.course?.id ?? e.course_id
        const title = e.course?.title ?? e.title
        const coverField = e.course?.cover_image ?? e.cover_image
        const cover = coverField ? mediaUrl(coverField) : '/elearning/forest_logo.png'
        return (
          <Card key={id} className="overflow-hidden border-border/60">
            <Link to={`/courses/${id}/learn`} className="block group">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap gap-1">
                  {progress >= 100 && (
                    <Badge className="bg-success text-success-foreground hover:bg-success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      เสร็จสิ้น
                    </Badge>
                  )}
                  {e.is_mandatory && <Badge variant="destructive">บังคับ</Badge>}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{title}</h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {e.completed_lessons ?? 0}/{e.total_lessons ?? 0} บทเรียน
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}

function CertificatesTab() {
  const [certs, setCerts] = useState(null)

  useEffect(() => {
    certificatesApi.mine().then(setCerts).catch(() => setCerts([]))
  }, [])

  if (certs === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  if (certs.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            ยังไม่มีใบรับรอง — เรียนจบหลักสูตรเพื่อรับใบรับรอง
          </p>
        </CardContent>
      </Card>
    )
  }

  const fmtExpiry = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : ''

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {certs.map((c) => (
        <li key={c.id}>
          <Card
            className={c.is_expired ? 'border-destructive/40' : 'border-border/60'}
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                  c.is_expired
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">
                  {c.course?.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  เลขที่ {c.certificate_number}
                  {c.final_score != null && <span> · คะแนน {Math.round(c.final_score)}%</span>}
                </p>
                {c.expires_at && (
                  <p
                    className={`text-[11px] ${
                      c.is_expired
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground/80'
                    }`}
                  >
                    {c.is_expired ? 'หมดอายุแล้ว — ต้องอบรมใหม่' : `หมดอายุ ${fmtExpiry(c.expires_at)}`}
                  </p>
                )}
              </div>
              <Button asChild size="sm" variant="outline">
                <a
                  href={certificatesApi.downloadUrl(c.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ดาวน์โหลด
                </a>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export default function ProfilePage() {
  useDocumentTitle('โปรไฟล์')
  const { user } = useAuth()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Profile header */}
      <Card className="mb-6 border-border/60">
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {initials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {user?.full_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email} · {ROLE_LABELS[user?.role]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="profile">โปรไฟล์</TabsTrigger>
          <TabsTrigger value="security">ความปลอดภัย</TabsTrigger>
          <TabsTrigger value="courses">หลักสูตรของฉัน</TabsTrigger>
          <TabsTrigger value="certificates">ใบรับรอง</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="courses">
          <MyCoursesTab />
        </TabsContent>
        <TabsContent value="certificates">
          <CertificatesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
