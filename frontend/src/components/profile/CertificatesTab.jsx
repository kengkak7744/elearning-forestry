import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatThaiDate } from '@/utils/formatting'

export default function CertificatesTab() {
  const [certs, setCerts] = useState(null)

  useEffect(() => {
    certificatesApi.mine().then(setCerts).catch(() => setCerts([]))
  }, [])

  if (certs === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  if (certs.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            ยังไม่มีใบรับรอง — เรียนจบหลักสูตรเพื่อรับใบรับรอง
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {certs.map((c) => (
        <li key={c.id}>
          <Card
            className={c.is_expired ? 'border-destructive/40' : 'border-border/60'}
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                  c.is_expired
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">
                  {c.course?.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  เลขที่ {c.certificate_number}
                  {c.final_score != null && <span> · คะแนน {Math.round(c.final_score)}%</span>}
                </p>
                {c.expires_at && (
                  <p
                    className={`text-[11px] ${
                      c.is_expired
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground/80'
                    }`}
                  >
                    {c.is_expired
                      ? 'หมดอายุแล้ว — ต้องอบรมใหม่'
                      : `หมดอายุ ${formatThaiDate(c.expires_at, { month: 'short', fallback: '' })}`}
                  </p>
                )}
              </div>
              <Button asChild size="sm" variant="outline">
                <a
                  href={certificatesApi.downloadUrl(c.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ดาวน์โหลด
                </a>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
