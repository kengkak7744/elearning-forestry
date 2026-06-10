import { useMemo, useState } from 'react'
import { Check, Mail, Phone, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import RoleChip from '@/components/admin/department/RoleChip'

/** Searchable/filterable member table. Filter state lives here — it only
 * affects this tab. Clicking a name opens UserSummarySheet via onPickMember. */
export default function DeptMembersTab({ members, onPickMember }) {
  const [memberFilter, setMemberFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeOnly, setActiveOnly] = useState(false)

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase()
    return members.filter((m) => {
      if (activeOnly && !m.is_active) return false
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (!q) return true
      return (
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q)
      )
    })
  }, [members, memberFilter, roleFilter, activeOnly])

  return (
    <>
      {/* Filters */}
      <Card className="mb-3 border-border/60">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / ตำแหน่ง"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { v: 'all', label: 'ทุกบทบาท' },
              { v: 'admin', label: 'ผู้ดูแล' },
              { v: 'instructor', label: 'ผู้สอน' },
              { v: 'manager', label: 'ผู้จัดการ' },
              { v: 'learner', label: 'ผู้เรียน' },
            ].map((t) => (
              <Button
                key={t.v}
                size="sm"
                variant={roleFilter === t.v ? 'default' : 'outline'}
                onClick={() => setRoleFilter(t.v)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={activeOnly ? 'default' : 'outline'}
              onClick={() => setActiveOnly((v) => !v)}
            >
              {activeOnly ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              ใช้งานอยู่
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-2 text-xs text-muted-foreground">
        แสดง {filteredMembers.length} จาก {members.length} คน
        {(roleFilter !== 'all' || activeOnly || memberFilter) && (
          <button
            type="button"
            onClick={() => {
              setMemberFilter('')
              setRoleFilter('all')
              setActiveOnly(false)
            }}
            className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            <X className="h-3 w-3" /> ล้างตัวกรอง
          </button>
        )}
      </div>

      {filteredMembers.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            ไม่พบสมาชิกที่ตรงกับเงื่อนไข
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>ติดต่อ</TableHead>
                  <TableHead className="text-right whitespace-nowrap">เรียน / ใบรับรอง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => (
                  <TableRow key={m.id} className={m.is_active ? '' : 'opacity-60'}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onPickMember(m.id)}
                        className="group block text-left"
                        title="ดูหลักสูตรที่ลงทะเบียนของผู้ใช้นี้"
                      >
                        <div className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                          {m.full_name}
                          {!m.is_active && (
                            <Badge variant="secondary" className="ml-1.5 font-normal">
                              ปิด
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          @{m.username}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <RoleChip role={m.role} />
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div
                        className="truncate text-sm text-foreground"
                        title={m.position}
                      >
                        {m.position || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                          >
                            <Mail className="h-3 w-3" />
                            {m.email}
                          </a>
                        )}
                        {m.phone && (
                          <a
                            href={`tel:${m.phone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="h-3 w-3" />
                            {m.phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                      {m.enrollment_count} / {m.cert_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </>
  )
}
