import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CertificateCard from '@/components/shared/CertificateCard'

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
          <CertificateCard cert={c} />
        </li>
      ))}
    </ul>
  )
}
