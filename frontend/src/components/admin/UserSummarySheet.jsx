import { useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  LineChart,
  Trophy,
} from 'lucide-react'
import { usersApi } from '@/api/users'
import { certificatesApi } from '@/api/certificates'
import { ROLE_LABELS } from '@/constants/labels'
import { useAuth } from '@/contexts/AuthContext'
import { categoryLabel, useCategories } from '@/hooks/useCategories'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/admin/UserAvatar'
import UserCourseStatsDialog from '@/components/admin/UserCourseStatsDialog'
import { toastApiError } from '@/utils/apiError'

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function CertificateRow({ certificate, downloadable }) {
  const card = (
    <Card className={downloadable ? 'border-border/60 transition-colors group-hover:bg-muted/40' : 'border-border/60'}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Award className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-sm font-medium text-foreground">
            {certificate.course_title}
          </div>
          <div className="text-[11px] text-muted-foreground">
            เลขที่ {certificate.certificate_number}
            {certificate.final_score != null &&
              ` · คะแนน ${Math.round(certificate.final_score)}%`}
            {certificate.issued_at && ` · ${formatDate(certificate.issued_at)}`}
          </div>
        </div>
        {downloadable && (
          <Download className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
        )}
      </CardContent>
    </Card>
  )

  if (!downloadable) return card

  return (
    <a
      href={certificatesApi.downloadUrl(certificate.id)}
      download={`${certificate.certificate_number}.pdf`}
      aria-label={`ดาวน์โหลดใบรับรอง ${certificate.course_title} เลขที่ ${certificate.certificate_number}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </a>
  )
}

export default function UserSummarySheet({ userId, open, onOpenChange }) {
  const { user: viewer } = useAuth()
  const categories = useCategories()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const canDownloadCertificates = viewer?.role === 'admin' || viewer?.role === 'instructor'

  useEffect(() => {
    setSelectedCourse(null)
    if (!open || !userId) return
    setData(null)
    setLoading(true)
    usersApi
      .getLearningSummary(userId)
      .then(setData)
      .catch((err) =>
        toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
      )
      .finally(() => setLoading(false))
  }, [open, userId])

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) setSelectedCourse(null)
    onOpenChange?.(nextOpen)
  }

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>ประวัติการเรียนของผู้ใช้</SheetTitle>
          <SheetDescription>
            สรุปหลักสูตรที่ลงทะเบียน ความคืบหน้า ใบรับรอง และคะแนนแบบทดสอบ
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-5">
            <Card className="border-border/60">
              <CardContent className="flex items-start gap-3 p-4">
                <UserAvatar user={data.user} className="h-12 w-12" preview />
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-base font-semibold text-foreground">
                    {data.user.full_name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">@{data.user.username}</span>
                    {' · '}
                    {data.user.email}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">
                      {ROLE_LABELS[data.user.role] ?? data.user.role}
                    </Badge>
                    <span>{data.user.department || '-'}</span>
                    {data.user.position && <span>· {data.user.position}</span>}
                    <span>· เข้าระบบเมื่อ {formatDate(data.user.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={BookOpen}
                label="หลักสูตร"
                value={data.enrollments.length}
                hint={`จบ ${
                  data.enrollments.filter((e) => e.progress_percent >= 100).length
                } หลักสูตร`}
              />
              <StatTile
                icon={Trophy}
                label="ใบรับรอง"
                value={data.certificates.length}
              />
              <StatTile
                icon={ClipboardList}
                label="ทำแบบทดสอบ"
                value={data.quiz_stats.unique_quizzes}
                hint={`${data.quiz_stats.total_attempts} ครั้งทั้งหมด`}
              />
              <StatTile
                icon={LineChart}
                label="คะแนนเฉลี่ย"
                value={`${data.quiz_stats.average_score}%`}
                hint={`ผ่าน ${data.quiz_stats.passed_count}/${data.quiz_stats.unique_quizzes} ชุด`}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                หลักสูตรที่ลงทะเบียน
              </h3>
              {data.enrollments.length === 0 ? (
                <Card className="border-dashed border-border/60">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    ยังไม่ได้ลงทะเบียนหลักสูตรใด
                  </CardContent>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {data.enrollments.map((e) => {
                    const catLabel = categoryLabel(categories, e.category)
                    const done = e.progress_percent >= 100
                    return (
                      <li key={e.course_id}>
                        <Card className="border-border/60 transition-shadow hover:shadow-md">
                          <button
                            type="button"
                            onClick={() => setSelectedCourse(e)}
                            aria-label={`ดูสถิติการเรียนหลักสูตร ${e.title} ของ ${data.user.full_name}`}
                            className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="line-clamp-1 text-sm font-medium text-foreground">
                                  {e.title}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                  {catLabel && (
                                    <Badge variant="secondary" className="font-normal">
                                      {catLabel}
                                    </Badge>
                                  )}
                                  {e.is_mandatory && (
                                    <Badge variant="destructive">บังคับ</Badge>
                                  )}
                                  {done && (
                                    <Badge className="bg-success text-success-foreground hover:bg-success">
                                      <CheckCircle2 className="mr-0.5 h-3 w-3" />
                                      เรียนจบ
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-shrink-0 items-start gap-1">
                                <div className="text-right">
                                  <div className="text-sm font-semibold tabular-nums text-foreground">
                                    {e.progress_percent}%
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {e.completed_lessons}/{e.total_lessons} บท
                                  </div>
                                </div>
                                <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              </div>
                            </div>
                            <Progress value={e.progress_percent} className="mt-2 h-1.5" />
                            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                              <span>ลงทะเบียน {formatDate(e.enrolled_at)}</span>
                              {e.last_accessed_at && (
                                <span>ล่าสุด {formatDate(e.last_accessed_at)}</span>
                              )}
                            </div>
                          </CardContent>
                          </button>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {data.certificates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">ใบรับรอง</h3>
                <ul className="space-y-2">
                  {data.certificates.map((c) => (
                    <li key={c.id}>
                      <CertificateRow
                        certificate={c}
                        downloadable={canDownloadCertificates}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
    <UserCourseStatsDialog
      open={!!selectedCourse}
      userId={userId}
      userName={data?.user?.full_name}
      course={selectedCourse}
      onClose={() => setSelectedCourse(null)}
    />
    </>
  )
}
