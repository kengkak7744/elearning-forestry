import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { mediaUrl } from '@/utils/media'
import { formatThaiDate, initials } from '@/utils/formatting'

/** Avatar + "สวัสดี {ชื่อ}" + today's Thai date. */
export default function DashboardGreeting({ user }) {
  const firstName = user?.full_name?.split(' ')[0] || 'คุณ'
  const today = formatThaiDate(new Date().toISOString())

  return (
    <div className="mb-6 flex items-center gap-3">
      <Avatar className="h-11 w-11">
        {user?.profile_image && (
          <AvatarImage src={mediaUrl(user.profile_image)} alt={user?.full_name || ''} />
        )}
        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
          {initials(user?.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-foreground sm:text-xl">สวัสดี {firstName}</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">{today}</p>
      </div>
    </div>
  )
}
