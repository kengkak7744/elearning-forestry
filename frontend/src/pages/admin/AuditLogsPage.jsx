import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
} from 'lucide-react'
import { auditApi } from '@/api/audit'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toastApiError } from '@/utils/apiError'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 50

// Action verb → Thai label + badge tone. Anything unmapped renders the raw
// action string with the default secondary badge — cheap forward-compat.
const ACTION_META = {
  'user.create': { label: 'สร้างผู้ใช้', tone: 'success' },
  'user.update': { label: 'แก้ไขผู้ใช้', tone: 'default' },
  'user.delete': { label: 'ลบผู้ใช้', tone: 'destructive' },
  'user.reset_password': { label: 'รีเซ็ตรหัสผ่าน', tone: 'warning' },
  'user.bulk_import': { label: 'นำเข้าผู้ใช้ (CSV)', tone: 'success' },
  'course.create': { label: 'สร้างหลักสูตร', tone: 'success' },
  'course.update': { label: 'แก้ไขหลักสูตร', tone: 'default' },
  'course.delete': { label: 'ลบหลักสูตร', tone: 'destructive' },
  'course.duplicate': { label: 'ทำสำเนาหลักสูตร', tone: 'default' },
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action]
  if (!meta) {
    return <Badge variant="secondary" className="font-mono text-[10px]">{action}</Badge>
  }
  if (meta.tone === 'destructive') {
    return <Badge variant="destructive">{meta.label}</Badge>
  }
  if (meta.tone === 'success') {
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success">
        {meta.label}
      </Badge>
    )
  }
  if (meta.tone === 'warning') {
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning">
        {meta.label}
      </Badge>
    )
  }
  return <Badge variant="secondary" className="font-normal">{meta.label}</Badge>
}

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditLogsPage() {
  useDocumentTitle('Audit log')

  const [actionFilter, setActionFilter] = useState('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    auditApi.actions().then(setActions).catch(() => setActions([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    auditApi
      .list({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        action: actionFilter === 'all' ? undefined : actionFilter,
        target_type: targetTypeFilter === 'all' ? undefined : targetTypeFilter,
      })
      .then(setRows)
      .catch((err) =>
        toastApiError(err, 'โหลดบันทึกไม่สำเร็จ')
      )
      .finally(() => setLoading(false))
  }, [actionFilter, targetTypeFilter, page, reloadKey])

  // Reset to page 0 when filters change (prevents landing on an empty page).
  useEffect(() => {
    setPage(0)
  }, [actionFilter, targetTypeFilter])

  const hasNext = rows.length === PAGE_SIZE

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
            <History className="h-6 w-6 text-muted-foreground" />
            บันทึกการดำเนินการของผู้ดูแล
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ใครทำอะไรกับใคร เมื่อไหร่ — สำหรับตรวจสอบและตามรอยการเปลี่ยนแปลง
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'mr-1.5 h-3.5 w-3.5 animate-spin' : 'mr-1.5 h-3.5 w-3.5'} />
          รีเฟรช
        </Button>
      </div>

      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              ประเภทการดำเนินการ
            </label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_META[a]?.label ?? a}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {a}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              ประเภทเป้าหมาย
            </label>
            <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="user">ผู้ใช้</SelectItem>
                <SelectItem value="course">หลักสูตร</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            ไม่มีรายการบันทึก
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">เวลา</TableHead>
                  <TableHead>ผู้ดำเนินการ</TableHead>
                  <TableHead>การดำเนินการ</TableHead>
                  <TableHead>เป้าหมาย</TableHead>
                  <TableHead className="min-w-[280px]">รายละเอียด</TableHead>
                  <TableHead className="whitespace-nowrap">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatTime(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">
                        {r.actor_username}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{r.actor_role}</div>
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={r.action} />
                    </TableCell>
                    <TableCell>
                      {r.target_label ? (
                        <>
                          <div className="text-sm text-foreground">{r.target_label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.target_type}
                            {r.target_id != null && ` #${r.target_id}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {r.summary || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {r.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          หน้า {page + 1} · แสดง {rows.length} รายการ
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            ก่อนหน้า
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || loading}
          >
            ถัดไป
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
