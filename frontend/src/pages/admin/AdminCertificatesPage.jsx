import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Clock,
  Download,
  RotateCcw,
  Search,
  ShieldX,
} from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { showToast } from '@/lib/toast'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toastApiError } from '@/utils/apiError'
import { formatThaiDate } from '@/utils/formatting'
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

function StatusBadge({ cert }) {
  if (cert.is_revoked) {
    return (
      <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 font-normal">
        เพิกถอนแล้ว
      </Badge>
    )
  }
  if (cert.is_expired) {
    return (
      <Badge className="bg-warning/20 text-warning hover:bg-warning/20 font-normal">
        หมดอายุ
      </Badge>
    )
  }
  return (
    <Badge className="bg-success/15 text-success hover:bg-success/15 font-normal">
      ใช้งานได้
    </Badge>
  )
}

export default function AdminCertificatesPage() {
  useDocumentTitle('ใบรับรองทั้งหมด')
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeBusy, setRevokeBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await certificatesApi.adminAll()
      setCerts(Array.isArray(data) ? data : [])
    } catch (err) {
      toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return certs.filter((c) => {
      if (statusFilter === 'revoked' && !c.is_revoked) return false
      if (statusFilter === 'expired' && (c.is_revoked || !c.is_expired)) return false
      if (statusFilter === 'valid' && (c.is_revoked || c.is_expired)) return false
      if (!q) return true
      return (
        c.certificate_number.toLowerCase().includes(q) ||
        c.user?.full_name?.toLowerCase().includes(q) ||
        c.course?.title?.toLowerCase().includes(q) ||
        c.user?.department?.toLowerCase().includes(q)
      )
    })
  }, [certs, search, statusFilter])

  const counts = useMemo(() => {
    let valid = 0
    let expired = 0
    let revoked = 0
    for (const c of certs) {
      if (c.is_revoked) revoked++
      else if (c.is_expired) expired++
      else valid++
    }
    return { valid, expired, revoked, total: certs.length }
  }, [certs])

  const openRevoke = (cert) => {
    setRevokeTarget(cert)
    setRevokeReason('')
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    const reason = revokeReason.trim()
    if (!reason) {
      showToast('กรุณาระบุเหตุผลในการเพิกถอน', 'warning')
      return
    }
    setRevokeBusy(true)
    try {
      await certificatesApi.revoke(revokeTarget.id, reason)
      showToast('เพิกถอนใบรับรองเรียบร้อย', 'success')
      setRevokeTarget(null)
      await load()
    } catch (err) {
      toastApiError(err, 'เพิกถอนไม่สำเร็จ')
    } finally {
      setRevokeBusy(false)
    }
  }

  const handleUnrevoke = async (cert) => {
    try {
      await certificatesApi.unrevoke(cert.id)
      showToast('ยกเลิกการเพิกถอนเรียบร้อย', 'success')
      await load()
    } catch (err) {
      toastApiError(err, 'ยกเลิกการเพิกถอนไม่สำเร็จ')
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
          <Award className="h-6 w-6 text-muted-foreground" />
          ใบรับรองทั้งหมด
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ค้นหา ตรวจสอบ และเพิกถอนใบรับรองที่ออกให้ผู้เรียน
        </p>
      </div>

      {/* Counts strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'ทั้งหมด', value: counts.total, tone: 'neutral' },
          { label: 'ใช้งานได้', value: counts.valid, tone: 'success' },
          { label: 'หมดอายุ', value: counts.expired, tone: 'warning' },
          { label: 'เพิกถอน', value: counts.revoked, tone: 'destructive' },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div
                className={`text-xl font-semibold tabular-nums ${
                  s.tone === 'success'
                    ? 'text-success'
                    : s.tone === 'warning'
                    ? 'text-warning'
                    : s.tone === 'destructive'
                    ? 'text-destructive'
                    : 'text-foreground'
                }`}
              >
                {s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา: เลขที่ / ชื่อผู้ได้รับ / หลักสูตร / หน่วยงาน"
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {[
              { v: 'all', label: 'ทั้งหมด' },
              { v: 'valid', label: 'ใช้งานได้' },
              { v: 'expired', label: 'หมดอายุ' },
              { v: 'revoked', label: 'เพิกถอน' },
            ].map((t) => (
              <Button
                key={t.v}
                variant={statusFilter === t.v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(t.v)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            ไม่พบใบรับรองที่ตรงกับเงื่อนไข
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">เลขที่</TableHead>
                  <TableHead>ผู้ได้รับ</TableHead>
                  <TableHead>หลักสูตร</TableHead>
                  <TableHead className="whitespace-nowrap">ออกเมื่อ</TableHead>
                  <TableHead className="whitespace-nowrap">หมดอายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {c.certificate_number}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">
                        {c.user?.full_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.user?.department || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {c.course?.title}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatThaiDate(c.issued_at, { month: 'short' })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {c.expires_at ? formatThaiDate(c.expires_at, { month: 'short' }) : 'ไม่มีกำหนด'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge cert={c} />
                      {c.is_revoked && c.revoked_reason && (
                        <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-muted-foreground" title={c.revoked_reason}>
                          เหตุผล: {c.revoked_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={certificatesApi.downloadUrl(c.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="ดาวน์โหลด PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        {c.is_revoked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnrevoke(c)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            ยกเลิกการเพิกถอน
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openRevoke(c)}
                          >
                            <ShieldX className="mr-1 h-3.5 w-3.5" />
                            เพิกถอน
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เพิกถอนใบรับรอง</AlertDialogTitle>
            <AlertDialogDescription>
              เมื่อเพิกถอนแล้ว หน้า "ตรวจสอบใบรับรอง" จะแสดงว่าใบรับรองนี้ถูกเพิกถอน
              ไฟล์ PDF เดิมยังคงอยู่แต่จะถือว่าใช้ไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeTarget && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="font-mono text-xs">{revokeTarget.certificate_number}</div>
                <div className="mt-1 font-medium">{revokeTarget.user?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {revokeTarget.course?.title}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  เหตุผลในการเพิกถอน <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value.slice(0, 500))}
                  placeholder="ตัวอย่าง: ออกผิดให้ผู้รับ / ตรวจพบทุจริตในการสอบ / ฯลฯ"
                  rows={3}
                />
                <div className="mt-0.5 text-right text-[11px] text-muted-foreground tabular-nums">
                  {revokeReason.length}/500
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeBusy}>{BUTTONS.CANCEL}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeBusy || !revokeReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeBusy ? 'กำลังเพิกถอน...' : 'เพิกถอน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
