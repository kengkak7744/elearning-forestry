import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock, Search, ShieldX } from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function formatThaiDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const STATUS_META = {
  valid: {
    icon: CheckCircle2,
    label: 'ใบรับรองเป็นของจริงและยังมีผล',
    tone: 'success',
  },
  expired: {
    icon: Clock,
    label: 'ใบรับรองหมดอายุแล้ว',
    tone: 'warning',
  },
  revoked: {
    icon: ShieldX,
    label: 'ใบรับรองถูกเพิกถอน',
    tone: 'destructive',
  },
  not_found: {
    icon: AlertCircle,
    label: 'ไม่พบเลขที่ใบรับรองนี้ในระบบ',
    tone: 'destructive',
  },
}

function StatusCard({ result }) {
  const meta = STATUS_META[result.status] || STATUS_META.not_found
  const Icon = meta.icon
  const colorCls =
    meta.tone === 'success'
      ? 'border-success/40 bg-success/5 text-success'
      : meta.tone === 'warning'
      ? 'border-warning/40 bg-warning/5 text-warning'
      : 'border-destructive/40 bg-destructive/5 text-destructive'

  return (
    <Card className={`border-2 ${colorCls}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <Icon className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{meta.label}</div>
            <div className="mt-0.5 font-mono text-xs text-foreground/70">
              เลขที่ {result.certificate_number}
            </div>
          </div>
        </div>

        {result.status !== 'not_found' && (
          <dl className="mt-5 grid gap-3 border-t border-current/20 pt-5 text-sm text-foreground sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">ผู้ได้รับ</dt>
              <dd className="mt-0.5 font-medium">{result.holder_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">หลักสูตร</dt>
              <dd className="mt-0.5 font-medium">{result.course_title}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ออกให้เมื่อ</dt>
              <dd className="mt-0.5 font-medium">{formatThaiDate(result.issued_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">หมดอายุ</dt>
              <dd className="mt-0.5 font-medium">
                {result.expires_at ? formatThaiDate(result.expires_at) : 'ไม่มีกำหนด'}
              </dd>
            </div>
            {result.final_score != null && (
              <div>
                <dt className="text-xs text-muted-foreground">คะแนนสอบสุดท้าย</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {Math.round(result.final_score)}%
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

export default function CertificateVerifyPage() {
  useDocumentTitle('ตรวจสอบใบรับรอง')
  const { certNumber: paramNumber } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(paramNumber || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runVerify = async (value) => {
    const v = (value || '').trim()
    if (!v) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await certificatesApi.verify(v)
      setResult(data)
    } catch (err) {
      if (err.response?.status === 429) {
        setError('ตรวจสอบบ่อยเกินไป — กรุณาลองใหม่อีกครั้งในอีก 1 นาที')
      } else {
        setError(err.response?.data?.detail || 'ไม่สามารถตรวจสอบได้ในขณะนี้')
      }
    } finally {
      setLoading(false)
    }
  }

  // Auto-run when arriving via direct link / QR scan, but only once.
  useEffect(() => {
    if (paramNumber) runVerify(paramNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramNumber])

  const handleSubmit = (e) => {
    e.preventDefault()
    const next = input.trim().toUpperCase()
    if (!next) return
    // Push the number into the URL so the result is shareable / bookmarkable.
    navigate(`/verify/${encodeURIComponent(next)}`, { replace: false })
    runVerify(next)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <img
            src="/elearning/forest_logo.png"
            alt=""
            width="36"
            height="36"
            className="h-9 w-9"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              ตรวจสอบใบรับรอง — กรมป่าไม้
            </div>
            <div className="text-xs text-muted-foreground">
              ระบบ e-Learning · Certificate verification
            </div>
          </div>
        </div>
      </header>

      <main
        aria-labelledby="verify-heading"
        className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
      >
        <h1
          id="verify-heading"
          className="text-2xl font-semibold text-foreground sm:text-3xl"
        >
          ตรวจสอบความถูกต้องของใบรับรอง
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          กรอกเลขที่ใบรับรอง (เช่น <span className="font-mono">CERT-20260601-A3F2B1</span>)
          หรือสแกน QR code บนใบรับรองเพื่อตรวจสอบ
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="CERT-YYYYMMDD-XXXXXX"
            className="font-mono uppercase"
            autoFocus
            spellCheck={false}
            autoCapitalize="characters"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Search className="mr-1.5 h-4 w-4" />
            {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
          </Button>
        </form>

        <div className="mt-6">
          {loading && <Skeleton className="h-48 w-full rounded-xl" />}
          {!loading && error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}
          {!loading && !error && result && <StatusCard result={result} />}
        </div>

        <div className="mt-10 space-y-2 text-xs text-muted-foreground">
          <p>
            <Badge variant="secondary" className="mr-1.5 font-normal">หมายเหตุ</Badge>
            หน้านี้แสดงข้อมูลที่ปรากฏบนตัวใบรับรองเท่านั้น —
            ไม่เปิดเผยข้อมูลส่วนบุคคลอื่นใดของผู้ได้รับ
          </p>
          <p>
            หากท่านพบใบรับรองที่น่าสงสัยว่าปลอมแปลง กรุณาแจ้งผู้ดูแลระบบ
            พร้อมเลขที่ใบรับรองและภาพถ่ายของใบรับรองนั้น
          </p>
        </div>
      </main>
    </div>
  )
}
