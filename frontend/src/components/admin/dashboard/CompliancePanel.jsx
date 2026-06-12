import { Link } from 'react-router-dom'
import { ChevronRight, Download, ShieldCheck } from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_SHOWN = 6

function toneOf(rate) {
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'destructive'
}

const BAR = {
  success: '[&>div]:bg-success',
  warning: '[&>div]:bg-warning',
  destructive: '[&>div]:bg-destructive',
}
const TEXT = {
  success: 'font-semibold text-success',
  warning: 'font-semibold text-warning',
  destructive: 'font-semibold text-destructive',
}

/**
 * Department compliance on mandatory training — worst-first from the server.
 * Capped at 6 with a "ดูทั้งหมด" link to the full departments page.
 */
export default function CompliancePanel({ compliance }) {
  if (compliance === null) return <Skeleton className="h-80 w-full rounded-xl" />

  const depts = Array.isArray(compliance.departments) ? compliance.departments : []
  const hasMandatory = compliance.mandatory_courses_count > 0

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            การอบรมหลักสูตรบังคับตามหน่วยงาน
          </h2>
          {hasMandatory && (
            <p className="mt-1 text-sm text-muted-foreground">
              จากหลักสูตรบังคับ {compliance.mandatory_courses_count} หลักสูตร
              (นับเฉพาะใบรับรองที่ยังไม่หมดอายุ)
            </p>
          )}
        </div>
        {hasMandatory && depts.length > 0 && (
          <Button asChild variant="outline" size="sm" className="flex-shrink-0">
            <a
              href={adminStatsApi.departmentComplianceCsvUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              ดาวน์โหลด CSV
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!hasMandatory ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีหลักสูตรบังคับในระบบ
          </p>
        ) : depts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลหน่วยงาน</p>
        ) : (
          <div className="space-y-4">
            {depts.slice(0, MAX_SHOWN).map((d) => {
              const rate = d.completion_rate
              const tone = toneOf(rate)
              return (
                <div key={d.department}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-foreground">{d.department}</span>
                    <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                      {d.actual_completions}/{d.required_completions} ครั้ง ·{' '}
                      <span className={TEXT[tone]}>{rate}%</span>
                    </span>
                  </div>
                  <Progress value={rate} className={`h-2 ${BAR[tone]}`} />
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{d.staff_count} คน</div>
                </div>
              )
            })}
            {depts.length > MAX_SHOWN && (
              <Link
                to="/admin/departments"
                className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                ดูทั้งหมด ({depts.length} หน่วยงาน)
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
