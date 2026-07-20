import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { mediaUrl } from '@/utils/media'
import { initials } from '@/utils/formatting'
import AvatarImagePreview from '@/components/shared/AvatarImagePreview'

export default function UserAvatar({ user, className = 'h-9 w-9', preview = false }) {
  const name = user?.full_name || user?.username || ''
  const src = user?.profile_image ? mediaUrl(user.profile_image) : ''

  const avatar = (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )

  if (!preview) return avatar

  return (
    <AvatarImagePreview src={src || undefined} alt={name}>
      {avatar}
    </AvatarImagePreview>
  )
}
