import { useMemo, useState } from 'react'
import useFetchData from '@/hooks/useFetchData'
import {
  Award,
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
import { Label } from '@/components/ui/label'
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
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminEmptyState from '@/components/admin/AdminEmptyState'
import SkeletonRows from '@/components/admin/SkeletonRows'
import LoadMoreButton from '@/components/admin/LoadMoreButton'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(50)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeBusy, setRevokeBusy] = useState(false)

  const {
    data: certs,
    loading,
    reload: load,
  } = useFetchData(
    async () => {
      const data = await certificatesApi.adminAll()
      return Array.isArray(data) ? data : []
    },
    [],
    { errorFallback: 'โหลดข้อมูลไม่สำเร็จ', initialData: [] }
  )

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

  // Reset the client-side page window when the filter narrows/changes.
  const onSearchChange = (e) => {
    setSearch(e.target.value)
    setVisibleCount(50)
  }
  const onStatusChange = (v) => {
    setStatusFilter(v)
    setVisibleCount(50)
  }
  const visible = filtered.slice(0, visibleCount)

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
      <AdminPageHeader
        icon={Award}
        title="ใบรับรองทั้งหมด"
        subtitle="ค้นหา ตรวจสอบ และเพิกถอนใบรับรองที่ออกให้ผู้เรียน"
      />

      {/* Filters */}
      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Label htmlFor="admin-certificate-search" className="sr-only">
              ค้นหาใบรับรอง
            </Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-certificate-search"
              value={search}
              onChange={onSearchChange}
              placeholder="ค้นหา: เลขที่ / ชื่อผู้ได้รับ / หลักสูตร / หน่วยงาน"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { v: 'all', label: 'ทั้งหมด', count: counts.total },
              { v: 'valid', label: 'ใช้งานได้', count: counts.valid },
              { v: 'expired', label: 'หมดอายุ', count: counts.expired },
              { v: 'revoked', label: 'เพิกถอน', count: counts.revoked },
            ].map((t) => (
              <Button
                key={t.v}
                variant={statusFilter === t.v ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStatusChange(t.v)}
                aria-pressed={statusFilter === t.v}
              >
                {t.label} ({t.count})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <SkeletonRows count={6} className="h-14 rounded-md" />
      ) : filtered.length === 0 ? (
        <AdminEmptyState>ไม่พบใบรับรองที่ตรงกับเงื่อนไข</AdminEmptyState>
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
                {visible.map((c) => (
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
                            aria-label={`ดาวน์โหลด PDF ใบรับรอง ${c.certificate_number}`}
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="ml-1 sm:hidden">ดาวน์โหลด</span>
                          </a>
                        </Button>
                        {c.is_revoked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnrevoke(c)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                            ยกเลิกการเพิกถอน
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openRevoke(c)}
                          >
                            <ShieldX className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
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

      {!loading && filtered.length > visibleCount && (
        <LoadMoreButton onClick={() => setVisibleCount((v) => v + 50)} />
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="เพิกถอนใบรับรอง"
        description={
          'เมื่อเพิกถอนแล้ว หน้า "ตรวจสอบใบรับรอง" จะแสดงว่าใบรับรองนี้ถูกเพิกถอน ไฟล์ PDF เดิมยังคงอยู่แต่จะถือว่าใช้ไม่ได้'
        }
        confirmLabel={revokeBusy ? 'กำลังเพิกถอน...' : 'เพิกถอน'}
        cancelLabel={BUTTONS.CANCEL}
        destructive
        busy={revokeBusy}
        confirmDisabled={!revokeReason.trim()}
        onConfirm={handleRevoke}
      >
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
              <label htmlFor="revoke-reason" className="mb-1 block text-xs font-medium text-foreground">
                เหตุผลในการเพิกถอน <span className="text-destructive" aria-hidden="true">*</span>
                <span className="sr-only"> จำเป็น</span>
              </label>
              <Textarea
                id="revoke-reason"
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
      </ConfirmDialog>
    </div>
  )
}
