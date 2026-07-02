import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { categoriesApi } from '@/api/categories'
import { refreshCategories, useCategories } from '@/hooks/useCategories'
import { showToast } from '@/lib/toast'
import { toastApiError } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Add/remove course categories (instructor/admin — the backend enforces the
 * role, this dialog only mounts on already-gated admin pages). Deleting is
 * blocked while any course still uses the category.
 */
export default function ManageCategoriesDialog({ open, onOpenChange }) {
  const categories = useCategories()
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async (e) => {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label || saving) return
    setSaving(true)
    try {
      await categoriesApi.create(label)
      await refreshCategories()
      setNewLabel('')
      showToast(`เพิ่มหมวดหมู่ "${label}" เรียบร้อย`, 'success')
    } catch (err) {
      toastApiError(err, 'เพิ่มหมวดหมู่ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat) => {
    if (deletingId) return
    setDeletingId(cat.id)
    try {
      await categoriesApi.remove(cat.id)
      await refreshCategories()
      showToast(`ลบหมวดหมู่ "${cat.label}" เรียบร้อย`, 'success')
    } catch (err) {
      toastApiError(err, 'ลบหมวดหมู่ไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>จัดการหมวดหมู่หลักสูตร</DialogTitle>
          <DialogDescription>
            เพิ่มหรือลบหมวดหมู่ — ลบได้เฉพาะหมวดหมู่ที่ไม่มีหลักสูตรใช้อยู่
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-category" className="text-xs">
              ชื่อหมวดหมู่ใหม่
            </Label>
            <Input
              id="new-category"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="เช่น การจัดการไฟป่า"
              maxLength={100}
            />
          </div>
          <Button type="submit" disabled={!newLabel.trim() || saving}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            เพิ่ม
          </Button>
        </form>

        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {categories.map((cat) => {
            const inUse = (cat.course_count ?? 0) > 0
            return (
              <li key={cat.value} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{cat.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {inUse ? `ใช้อยู่ ${cat.course_count} หลักสูตร` : 'ยังไม่มีหลักสูตรใช้'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(cat)}
                  disabled={inUse || cat.id == null || deletingId === cat.id}
                  title={inUse ? 'ลบไม่ได้ — มีหลักสูตรใช้หมวดหมู่นี้อยู่' : 'ลบหมวดหมู่'}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">ลบหมวดหมู่ {cat.label}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
