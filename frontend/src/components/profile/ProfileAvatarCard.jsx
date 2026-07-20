import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import { toastApiError } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/utils/formatting'
import AvatarImagePreview from '@/components/shared/AvatarImagePreview'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — matches backend MAX_IMAGE_SIZE

export default function ProfileAvatarCard() {
  const { user, updateUser } = useAuth()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const pick = () => fileRef.current?.click()

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)', 'error')
      return
    }
    if (file.size > MAX_BYTES) {
      showToast('ไฟล์ใหญ่เกิน 10 MB', 'error')
      return
    }

    setBusy(true)
    try {
      const updated = await authApi.uploadAvatar(file)
      updateUser(updated)
      showToast('อัปเดตรูปโปรไฟล์สำเร็จ', 'success')
    } catch (err) {
      toastApiError(err, 'อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const updated = await authApi.deleteAvatar()
      updateUser(updated)
      showToast('ลบรูปโปรไฟล์แล้ว', 'success')
    } catch (err) {
      toastApiError(err, 'ลบรูปไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const src = user?.profile_image ? mediaUrl(user.profile_image) : undefined

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center">
        <AvatarImagePreview src={src} alt={user?.full_name || ''}>
          <Avatar className="h-20 w-20">
            {src && <AvatarImage src={src} alt={user?.full_name || ''} />}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
        </AvatarImagePreview>

        <div className="flex-1 text-center sm:text-left">
          <div className="text-sm font-semibold text-foreground">รูปโปรไฟล์</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            JPG, PNG, WEBP หรือ GIF ขนาดไม่เกิน 10 MB (ไม่บังคับ)
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button type="button" size="sm" variant="outline" onClick={pick} disabled={busy}>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              {user?.profile_image ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
            </Button>
            {user?.profile_image && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                ลบรูป
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFile}
        />
      </CardContent>
    </Card>
  )
}
