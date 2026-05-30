import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { usersApi } from '@/api/users'
import { BUTTONS, ROLE_BADGES, ROLE_LABELS } from '@/constants/labels'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import UserFormSheet from '@/components/admin/UserFormSheet'
import UserSummarySheet from '@/components/admin/UserSummarySheet'
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog'
import useDocumentTitle from '@/hooks/useDocumentTitle'

export default function UsersListPage() {
  useDocumentTitle('จัดการผู้ใช้')
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

  const openEdit = (userId) => setParams({ id: String(userId) })
  const openAdd = () => setParams({ new: '1' })
  const closeSheet = () => navigate('/admin/users', { replace: true })

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
          {BUTTONS.ADD_USER}
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
