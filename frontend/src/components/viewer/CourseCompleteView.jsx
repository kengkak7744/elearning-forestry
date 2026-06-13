import { useEffect, useState } from 'react'
import { Award, Download, Trophy } from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { showToast } from '@/lib/toast'
import { toastApiError } from '@/utils/apiError'
import { BUTTONS } from '@/constants/labels'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CourseFeedbackCard from '@/components/learner/CourseFeedbackCard'

/**
 * In-viewer completion screen, shown when the learner finishes the course
 * (goNext finds no next destination, or they pass the final exam). Replaces the
 * old silent "issue cert → open PDF tab → bounce to course page" behaviour with
 * a celebration: certificate claim/download, course feedback, and quick links.
 *
 * The certificate block is idempotent — `issue` returns the existing valid cert
 * if there is one — and only fires on an explicit "รับใบรับรอง" click; nothing
 * opens a new tab automatically.
 */
export default function CourseCompleteView({
  course,
  courseId,
  finalQuiz,
  onViewScores,
  onBackToCourse,
}) {
  const [elig, setElig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [certId, setCertId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    certificatesApi
      .eligibility(courseId)
      .then((data) => {
        if (cancelled) return
        setElig(data)
        // Only treat the cert as the "current" downloadable one when it's
        // actually valid. An expired (or revoked) cert must fall through to the
        // claim/renew branch so the learner can issue a fresh one — otherwise
        // they'd just see a download button for a certificate that no longer
        // counts, with no way to renew.
        if (
          data?.has_certificate &&
          data?.certificate_id &&
          !data?.is_revoked &&
          !data?.is_expired
        ) {
          setCertId(data.certificate_id)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  const handleIssue = async () => {
    const wasExpired = elig?.is_expired
    setIssuing(true)
    try {
      const data = await certificatesApi.issue(courseId)
      setCertId(data.id)
      // The fresh cert supersedes the expired one — clear the expired flag so
      // the render shows the new (valid) cert's download instead of the
      // "หมดอายุแล้ว" renewal prompt.
      setElig((prev) => (prev ? { ...prev, is_expired: false, has_certificate: true } : prev))
      showToast(
        wasExpired
          ? 'ต่ออายุใบรับรองเรียบร้อย'
          : data.already_existed
            ? 'เปิดใบรับรองที่เคยออกแล้ว'
            : 'ออกใบรับรองเรียบร้อย',
        'success'
      )
    } catch (err) {
      toastApiError(err, 'ออกใบรับรองไม่สำเร็จ')
    } finally {
      setIssuing(false)
    }
  }

  const finalScore = finalQuiz ? finalQuiz.best_score ?? elig?.final_score ?? null : null

  return (
    <div className="space-y-4">
      <Card className="border-success/30 bg-success/5">
        <CardContent className="p-6 text-center sm:p-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <Trophy className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            ยินดีด้วย! คุณเรียนจบหลักสูตรนี้แล้ว
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{course.title}</p>
          {finalScore != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-sm font-medium text-foreground">
              <Trophy className="h-4 w-4 text-warning" />
              คะแนนแบบทดสอบสุดท้าย {Math.round(finalScore)}%
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-5 sm:p-6">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <Award className="h-4 w-4 text-muted-foreground" />
            ใบรับรอง
          </h3>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-9 w-44" />
            ) : certId ? (
              <Button asChild>
                <a
                  href={certificatesApi.downloadUrl(certId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {BUTTONS.DOWNLOAD_CERTIFICATE}ใบรับรอง
                </a>
              </Button>
            ) : elig?.is_revoked ? (
              <p className="text-sm text-destructive">ใบรับรองถูกเพิกถอน</p>
            ) : elig?.eligible ? (
              // Eligible — either a first claim, or a renewal of an expired cert.
              <div className="space-y-2">
                {elig?.is_expired && (
                  <p className="text-xs text-warning">
                    ใบรับรองหมดอายุแล้ว — ออกใบรับรองใหม่เพื่อต่ออายุ
                  </p>
                )}
                <Button onClick={handleIssue} disabled={issuing}>
                  <Award className="mr-1.5 h-4 w-4" />
                  {issuing
                    ? BUTTONS.ISSUING_CERTIFICATE
                    : elig?.is_expired
                      ? BUTTONS.RENEW_CERTIFICATE
                      : BUTTONS.CLAIM_CERTIFICATE}
                </Button>
              </div>
            ) : (
              // Not currently eligible. If a cert exists but expired, the learner
              // must finish whatever's now outstanding (e.g. a re-added final
              // exam) before they can renew — surface that explicitly.
              <div className="space-y-1">
                {elig?.is_expired && (
                  <p className="text-xs text-warning">ใบรับรองหมดอายุแล้ว</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {elig?.reason || 'ยังไม่สามารถออกใบรับรองได้'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CourseFeedbackCard courseId={courseId} isEnrolled={course.is_enrolled} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onViewScores}>
          <Trophy className="mr-1.5 h-4 w-4" />
          ดูคะแนนทั้งหมด
        </Button>
        <Button variant="secondary" onClick={onBackToCourse}>
          กลับสู่หน้าหลักสูตร
        </Button>
      </div>
    </div>
  )
}
