import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PromptInputDialog({ open, title, label, placeholder, onConfirm, onCancel }) {
  const [value, setValue] = useState('')
  useEffect(() => {
    if (!open) setValue('')
  }, [open])

  const submit = (e) => {
    e.preventDefault()
    if (!value.trim()) return
    onConfirm(value.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      {/* aria-describedby={undefined}: the labelled input is the whole body —
          there is no description element, so opt out of Radix's warning. */}
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} id="prompt-form" className="space-y-1.5">
          <Label htmlFor="prompt-input">{label}</Label>
          <Input
            id="prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            required
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button type="submit" form="prompt-form" disabled={!value.trim()}>
            ยืนยัน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
