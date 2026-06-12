import { Download, Trophy } from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { BUTTONS } from '@/constants/labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { daysUntil, formatThaiDate } from '@/utils/formatting'
import { cn } from '@/lib/utils'

/**
 * One certificate row. Shared between the learner dashboard
 * (CertificatesSection) and the profile CertificatesTab.
 *
 * Status badges:
 *  - is_revoked  → outline-destructive "ถูกเพิกถอน" + download hidden
 *  - is_expired  → destructive "หมดอายุแล้ว"
 *  - ≤ 30 days   → warning "ใกล้หมดอายุ"
 */
export default function CertificateCard({ cert }) {
  const daysLeft = daysUntil(cert.expires_at)
  const expiringSoon =
    !cert.is_expired && !cert.is_revoked && daysLeft != null && daysLeft > 0 && daysLeft <= 30

  let badge = null
  if (cert.is_revoked) {
    badge = (
      <Badge variant="outline" className="flex-shrink-0 border-destructive/50 text-destructive">
        ถูกเพิกถอน
      </Badge>
    )
  } else if (cert.is_expired) {
    badge = (
      <Badge variant="destructive" className="flex-shrink-0">
        หมดอายุแล้ว
      </Badge>
    )
  } else if (expiringSoon) {
    badge = (
      <Badge className="flex-shrink-0 border-transparent bg-warning text-warning-foreground hover:bg-warning/80">
        ใกล้หมดอายุ
      </Badge>
    )
  }

  const borderClass = cert.is_expired
    ? 'border-destructive/40'
    : cert.is_revoked
      ? 'border-border/60 opacity-90'
      : 'border-border/60'
  const iconClass = cert.is_expired
    ? 'bg-destructive/10 text-destructive'
    : cert.is_revoked
      ? 'bg-muted text-muted-foreground'
      : 'bg-primary/10 text-primary'

  return (
    <Card className={cn('h-full', borderClass)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md',
            iconClass
          )}
        >
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 min-w-0 flex-1 text-sm font-medium text-foreground">
              {cert.course?.title}
            </p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground">
            เลขที่ {cert.certificate_number}
            {cert.final_score != null && <span> · คะแนน {Math.round(cert.final_score)}%</span>}
          </p>
          {cert.issued_at && (
            <p className="text-[11px] text-muted-foreground/80">
              ออกเมื่อ {formatThaiDate(cert.issued_at, { month: 'short', fallback: '' })}
              {cert.expires_at && !cert.is_revoked && (
                <span
                  className={cn(
                    cert.is_expired && 'font-medium text-destructive',
                    expiringSoon && 'font-medium text-warning'
                  )}
                >
                  {' · '}
                  {cert.is_expired
                    ? 'หมดอายุแล้ว'
                    : `หมดอายุ ${formatThaiDate(cert.expires_at, { month: 'short', fallback: '' })}`}
                </span>
              )}
            </p>
          )}
        </div>
        {cert.is_revoked ? (
          <span className="flex-shrink-0 self-center text-[11px] text-muted-foreground">
            ติดต่อผู้ดูแลระบบ
          </span>
        ) : (
          <Button asChild size="sm" variant="outline" className="flex-shrink-0">
            <a href={certificatesApi.downloadUrl(cert.id)} target="_blank" rel="noopener noreferrer">
              <Download className="mr-1 h-3.5 w-3.5" />
              {BUTTONS.DOWNLOAD_CERTIFICATE}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
