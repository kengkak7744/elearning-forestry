import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { usersApi } from '@/api/users'
import useFetchData from '@/hooks/useFetchData'
import { BUTTONS, ROLE_BADGES, ROLE_LABELS } from '@/constants/labels'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminEmptyState from '@/components/admin/AdminEmptyState'
import SkeletonRows from '@/components/admin/SkeletonRows'
import LoadMoreButton from '@/components/admin/LoadMoreButton'
import UserFormSheet from '@/components/admin/UserFormSheet'
import UserSummarySheet from '@/components/admin/UserSummarySheet'
import UserAvatar from '@/components/admin/UserAvatar'
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog'
import BulkImportDialog from '@/components/admin/BulkImportDialog'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { toastApiError } from '@/utils/apiError'

const PAGE_SIZE = 50

export default function UsersListPage() {
  useDocumentTitle('จัดการผู้ใช้')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const editId = params.get('id')
  const isAdding = params.get('new') === '1'

  const [resetTarget, setResetTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [summaryUserId, setSummaryUserId] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)

  const buildParams = () => ({
    skip: 0,
    limit: PAGE_SIZE,
    search,
    role: roleFilter === 'all' ? undefined : roleFilter,
  })

  const {
    data: users,
    loading,
    setData,
    reload: loadUsers,
  } = useFetchData(() => usersApi.list(buildParams()), [search, roleFilter], {
    errorFallback: 'โหลดรายการไม่สำเร็จ',
    initialData: [],
    debounceMs: search ? 400 : 0,
  })

  // Reset paging on filter change in the handlers (not an effect).
  const onSearchChange = (e) => {
    setSearch(e.target.value)
    setReachedEnd(false)
  }
  const onRoleChange = (value) => {
    setRoleFilter(value)
    setReachedEnd(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = await usersApi.list({ ...buildParams(), skip: users.length })
      setData((prev) => [...prev, ...next])
      if (next.length < PAGE_SIZE) setReachedEnd(true)
    } catch (err) {
      toastApiError(err, 'โหลดเพิ่มเติมไม่สำเร็จ')
    } finally {
      setLoadingMore(false)
    }
  }

  const canLoadMore =
    !loading && !reachedEnd && users.length >= PAGE_SIZE && users.length % PAGE_SIZE === 0

  const handleDelete = async () => {
    if (!confirmDelete) return
    const target = confirmDelete
    setConfirmDelete(null)
    try {
      await usersApi.delete(target.id)
      showToast(`ลบบัญชี ${target.full_name} เรียบร้อย`, 'success')
      setReachedEnd(false)
      loadUsers()
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    }
  }

  const openEdit = (userId) => setParams({ id: String(userId) })
  const openAdd = () => setParams({ new: '1' })
  const closeSheet = () => navigate('/admin/users', { replace: true })

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <AdminPageHeader
        title="จัดการผู้ใช้"
        subtitle="รายการเจ้าหน้าที่ทั้งหมดในระบบ"
        actions={
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setBulkOpen(true)}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-1 h-4 w-4" aria-hidden="true" />
              นำเข้าจาก CSV
            </Button>
            <Button onClick={openAdd} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              {BUTTONS.ADD_USER}
            </Button>
          </div>
        }
      />

      <Card className="mb-4 border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Label htmlFor="admin-user-search" className="sr-only">
              ค้นหาผู้ใช้
            </Label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-user-search"
              type="search"
              placeholder="ค้นหาชื่อ username หรืออีเมล..."
              value={search}
              onChange={onSearchChange}
              className="pl-9"
            />
          </div>
          <Label htmlFor="admin-role-filter" className="sr-only">
            กรองตามบทบาท
          </Label>
          <Select value={roleFilter} onValueChange={onRoleChange}>
            <SelectTrigger id="admin-role-filter" className="w-full sm:w-48">
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
        <SkeletonRows count={5} className="h-14" />
      ) : users.length === 0 ? (
        <AdminEmptyState>ไม่พบข้อมูล</AdminEmptyState>
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
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSummaryUserId(u.id)}
                          aria-label={`ดูสรุปการเรียนของ ${u.full_name}`}
                          className="group flex items-center gap-2 text-left"
                        >
                          <UserAvatar user={u} className="h-8 w-8" />
                          <span className="min-w-0">
                            <span className="block font-mono text-xs text-foreground group-hover:text-primary group-hover:underline">
                              @{u.username}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {u.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSummaryUserId(u.id)}
                          aria-label={`ดูสรุปการเรียนของ ${u.full_name}`}
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
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">{BUTTONS.EDIT}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(u)}
                            title={BUTTONS.RESET_PASSWORD}
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">{BUTTONS.RESET_PASSWORD}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(u)}
                            className="text-destructive hover:text-destructive"
                            title={BUTTONS.DELETE}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                      <div className="flex min-w-0 items-start gap-3">
                        <UserAvatar user={u} className="h-10 w-10" />
                        <button
                          type="button"
                          onClick={() => setSummaryUserId(u.id)}
                          aria-label={`ดูสรุปการเรียนของ ${u.full_name}`}
                          className="min-w-0 text-left"
                        >
                          <div className="truncate font-medium text-foreground hover:text-primary hover:underline">
                            {u.full_name}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            @{u.username}
                          </div>
                        </button>
                      </div>
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
                        <Pencil className="mr-1 h-3 w-3" aria-hidden="true" />
                        {BUTTONS.EDIT}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setResetTarget(u)}
                      >
                        <KeyRound className="mr-1 h-3 w-3" aria-hidden="true" />
                        รีเซ็ตรหัส
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(u)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
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

      {canLoadMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}

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

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onDone={loadUsers}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="ลบผู้ใช้"
        description={
          <>
            ต้องการลบบัญชี &ldquo;{confirmDelete?.full_name}&rdquo; ออกจากระบบ?
            <br />
            <span className="mt-2 block font-medium text-destructive">
              การกระทำนี้จะลบประวัติการเรียน ใบรับรอง และการลงทะเบียนทั้งหมดของผู้ใช้
              <br />
              และไม่สามารถย้อนกลับได้
            </span>
          </>
        }
        confirmLabel={BUTTONS.CONFIRM_DELETE}
        cancelLabel={BUTTONS.CANCEL}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
