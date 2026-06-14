import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useFetchData from '@/hooks/useFetchData'
import {
  Award,
  Building2,
  Check,
  GraduationCap,
  Search,
  Users,
} from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { ROLE_LABELS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
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
import { Skeleton } from '@/components/ui/skeleton'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminEmptyState from '@/components/admin/AdminEmptyState'

const ROLE_TONE = {
  admin: 'bg-destructive/15 text-destructive',
  instructor: 'bg-primary/15 text-primary',
  manager: 'bg-warning/20 text-warning',
  learner: 'bg-muted text-muted-foreground',
}

function RoleBadge({ role, count }) {
  const label = ROLE_LABELS[role] || role
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        ROLE_TONE[role] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
      <span className="font-semibold tabular-nums">{count}</span>
    </span>
  )
}

function DepartmentCard({ dept }) {
  // Roles displayed in priority order (admin > instructor > manager > learner)
  // so the highest-privilege roles surface first when scanning a long list.
  const ordered = ['admin', 'instructor', 'manager', 'learner']
    .map((r) => [r, dept.role_breakdown?.[r] ?? 0])
    .filter(([, n]) => n > 0)

  return (
    <Link
      to={`/admin/departments/${encodeURIComponent(dept.name)}`}
      className="group flex w-full flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="line-clamp-2">{dept.name}</span>
        </h3>
        <span className="flex-shrink-0 text-2xl font-semibold tabular-nums text-foreground">
          {dept.user_count}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {ordered.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">ไม่มีบทบาทใด</span>
        ) : (
          ordered.map(([role, n]) => <RoleBadge key={role} role={role} count={n} />)
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-success" aria-hidden="true" />
          ใช้งานอยู่ {dept.active_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <GraduationCap className="h-3 w-3" aria-hidden="true" />
          ลงทะเบียน {dept.enrollment_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <Award className="h-3 w-3" aria-hidden="true" />
          ใบรับรอง {dept.cert_count}
        </span>
      </div>
    </Link>
  )
}

export default function AdminDepartmentsPage() {
  useDocumentTitle('หน่วยงานทั้งหมด')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('users')

  const { data: departments, loading } = useFetchData(
    () => adminStatsApi.departments(),
    [],
    { errorFallback: 'โหลดข้อมูลหน่วยงานไม่สำเร็จ', initialData: [] }
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? departments.filter((d) => d.name.toLowerCase().includes(q))
      : [...departments]
    const sorters = {
      users: (a, b) => b.user_count - a.user_count,
      name: (a, b) => a.name.localeCompare(b.name, 'th'),
      certs: (a, b) => b.cert_count - a.cert_count,
    }
    return list.sort(sorters[sortBy] ?? sorters.users)
  }, [departments, search, sortBy])

  const totalUsers = useMemo(
    () => departments.reduce((sum, d) => sum + d.user_count, 0),
    [departments]
  )
  const totalActive = useMemo(
    () => departments.reduce((sum, d) => sum + d.active_count, 0),
    [departments]
  )

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <AdminPageHeader
        icon={Building2}
        title="หน่วยงานทั้งหมด"
        subtitle="คลิกที่หน่วยงานเพื่อดูสมาชิก ความคืบหน้าหลักสูตร และส่งออก CSV"
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'หน่วยงาน', value: departments.length },
          { label: 'ผู้ใช้ทั้งหมด', value: totalUsers },
          { label: 'ใช้งานอยู่', value: totalActive },
          { label: 'แสดงผล', value: filtered.length },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold tabular-nums text-foreground">
                {s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Label htmlFor="admin-department-search" className="sr-only">
              ค้นหาหน่วยงาน
            </Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-department-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาหน่วยงาน"
              className="pl-8"
            />
          </div>
          <Label htmlFor="admin-department-sort" className="sr-only">
            เรียงลำดับหน่วยงาน
          </Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger id="admin-department-sort" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="users">ผู้ใช้งานมากสุด</SelectItem>
              <SelectItem value="name">ชื่อหน่วยงาน</SelectItem>
              <SelectItem value="certs">ใบรับรองมากสุด</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Users}>ไม่พบหน่วยงาน</AdminEmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DepartmentCard key={d.name} dept={d} />
          ))}
        </div>
      )}
    </div>
  )
}
