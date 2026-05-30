import { cloneElement, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { authApi } from '@/api/auth'
import { showToast } from '@/lib/toast'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const initialForm = {
  username: '',
  full_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  department: '',
  position: '',
  responsibility: '',
  motivation: '',
}

const steps = [
  { key: 'account', label: 'บัญชี' },
  { key: 'personal', label: 'ข้อมูลส่วนตัว' },
  { key: 'study', label: 'ข้อมูลการเรียน' },
]

function validateStep(step, form) {
  const errors = {}
  if (step === 0) {
    if (!form.username || form.username.length < 3)
      errors.username = 'ต้องมีอย่างน้อย 3 ตัวอักษร'
    else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username))
      errors.username = 'ใช้ได้เฉพาะ a-z, 0-9, _ . -'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    if (!form.password || form.password.length < 6)
      errors.password = 'อย่างน้อย 6 ตัวอักษร'
    if (form.confirm_password !== form.password)
      errors.confirm_password = 'รหัสผ่านไม่ตรงกัน'
  } else if (step === 1) {
    if (!form.full_name || form.full_name.length < 2)
      errors.full_name = 'กรุณากรอกชื่อ-นามสกุล'
    if (!form.phone || form.phone.length < 9)
      errors.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง'
    if (!form.department || form.department.length < 2)
      errors.department = 'กรุณากรอกหน่วยงาน'
    if (!form.position || form.position.length < 2)
      errors.position = 'กรุณากรอกตำแหน่ง'
  } else if (step === 2) {
    if (!form.responsibility || form.responsibility.length < 5)
      errors.responsibility = 'อย่างน้อย 5 ตัวอักษร'
    if (!form.motivation || form.motivation.length < 5)
      errors.motivation = 'อย่างน้อย 5 ตัวอักษร'
  }
  return errors
}

function StepIndicator({ current }) {
  return (
    <ol className="flex items-center gap-2" aria-label="ขั้นตอนการสมัคร">
      {steps.map((s, i) => {
        const isDone = i < current
        const isCurrent = i === current
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
                isDone && 'bg-primary text-primary-foreground',
                isCurrent && 'bg-primary/15 text-primary ring-2 ring-primary',
                !isDone && !isCurrent && 'bg-muted text-muted-foreground'
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-xs sm:text-sm',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Field({ id, label, error, required, children, hint }) {
  // Wire aria-invalid + aria-describedby onto the child input so screen readers
  // hear "X has an error: <message>" when focused, instead of just reading the
  // label. The describedby points to whichever message is currently visible
  // (error takes precedence over hint).
  const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const input = cloneElement(children, {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedById,
  })
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {input}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words text-sm text-foreground">{value || '-'}</div>
    </div>
  )
}

export default function RegisterPage() {
  useDocumentTitle('สมัครสมาชิก')

  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [reviewing, setReviewing] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const update = (key) => (e) => {
    const value = typeof e === 'string' ? e : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleNext = () => {
    const stepErrors = validateStep(step, form)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      setReviewing(true)
    }
  }

  const handleBack = () => {
    if (reviewing) {
      setReviewing(false)
      return
    }
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await authApi.register(form)
      showToast('สมัครสมาชิกสำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ', 'success')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      showToast(err.response?.data?.detail || 'สมัครสมาชิกไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const progress = reviewing
    ? 100
    : Math.round(((step + 1) / steps.length) * 100)

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 sm:items-center sm:py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/elearning/forest_logo.png"
            alt=""
            width="64"
            height="64"
            className="mb-3 h-14 w-14"
          />
          <h1 className="text-2xl font-semibold text-foreground">{BUTTONS.REGISTER}</h1>
          <p className="text-sm text-muted-foreground">สำหรับเจ้าหน้าที่กรมป่าไม้</p>
        </div>

        <Card className="border-border/60">
          <CardHeader className="space-y-3 pb-4">
            <StepIndicator current={reviewing ? steps.length : step} />
            <Progress value={progress} className="h-1.5" />
          </CardHeader>
          <CardContent>
            {reviewing ? (
              <div>
                <h3 className="mb-1 text-base font-semibold text-foreground">
                  ตรวจสอบข้อมูล
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยันการสมัคร
                </p>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-2">
                  <SummaryRow label="ชื่อผู้ใช้" value={form.username} />
                  <SummaryRow label="อีเมล" value={form.email} />
                  <SummaryRow label="ชื่อ-นามสกุล" value={form.full_name} />
                  <SummaryRow label="เบอร์โทรศัพท์" value={form.phone} />
                  <SummaryRow label="หน่วยงาน" value={form.department} />
                  <SummaryRow label="ตำแหน่ง" value={form.position} />
                  <SummaryRow label="หน้าที่รับผิดชอบ" value={form.responsibility} />
                  <SummaryRow label="แรงจูงใจในการเรียน" value={form.motivation} />
                </div>
              </div>
            ) : step === 0 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="reg-username"
                    label="ชื่อผู้ใช้ (Username)"
                    required
                    error={errors.username}
                    hint="ใช้ได้เฉพาะ a-z, 0-9, _ . -"
                  >
                    <Input
                      id="reg-username"
                      value={form.username}
                      onChange={update('username')}
                      placeholder="เช่น suphadej.a"
                      autoComplete="username"
                      autoFocus
                    />
                  </Field>
                  <Field
                    id="reg-email"
                    label="อีเมล"
                    required
                    error={errors.email}
                  >
                    <Input
                      id="reg-email"
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="name@forest.go.th"
                      autoComplete="email"
                    />
                  </Field>
                  <Field
                    id="reg-password"
                    label="รหัสผ่าน"
                    required
                    error={errors.password}
                    hint="อย่างน้อย 6 ตัวอักษร"
                  >
                    <Input
                      id="reg-password"
                      type="password"
                      value={form.password}
                      onChange={update('password')}
                      placeholder="••••••"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field
                    id="reg-confirm"
                    label="ยืนยันรหัสผ่าน"
                    required
                    error={errors.confirm_password}
                  >
                    <Input
                      id="reg-confirm"
                      type="password"
                      value={form.confirm_password}
                      onChange={update('confirm_password')}
                      placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
              </div>
            ) : step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    id="reg-fullname"
                    label="ชื่อ-นามสกุล"
                    required
                    error={errors.full_name}
                  >
                    <Input
                      id="reg-fullname"
                      value={form.full_name}
                      onChange={update('full_name')}
                      placeholder="นายสุภเดช อนุพันธ์"
                      autoComplete="name"
                      autoFocus
                    />
                  </Field>
                </div>
                <Field
                  id="reg-phone"
                  label="เบอร์โทรศัพท์"
                  required
                  error={errors.phone}
                >
                  <Input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    placeholder="081-234-5678"
                    autoComplete="tel"
                  />
                </Field>
                <Field
                  id="reg-department"
                  label="หน่วยงาน/สังกัด"
                  required
                  error={errors.department}
                >
                  <Input
                    id="reg-department"
                    value={form.department}
                    onChange={update('department')}
                    placeholder="สำนักจัดการป่าไม้ภาคที่ 1"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    id="reg-position"
                    label="ตำแหน่ง"
                    required
                    error={errors.position}
                  >
                    <Input
                      id="reg-position"
                      value={form.position}
                      onChange={update('position')}
                      placeholder="เจ้าพนักงานป่าไม้ปฏิบัติงาน"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Field
                  id="reg-responsibility"
                  label="มีหน้าที่รับผิดชอบอะไร"
                  required
                  error={errors.responsibility}
                  hint={`${form.responsibility.length}/1000 ตัวอักษร`}
                >
                  <Textarea
                    id="reg-responsibility"
                    value={form.responsibility}
                    onChange={update('responsibility')}
                    rows={3}
                    maxLength={1000}
                    placeholder="เช่น ดูแลการสำรวจป่าในพื้นที่ จัดทำรายงานประจำเดือน..."
                    autoFocus
                  />
                </Field>
                <Field
                  id="reg-motivation"
                  label="ทำไมจึงเข้ามาเรียน"
                  required
                  error={errors.motivation}
                  hint={`${form.motivation.length}/1000 ตัวอักษร`}
                >
                  <Textarea
                    id="reg-motivation"
                    value={form.motivation}
                    onChange={update('motivation')}
                    rows={3}
                    maxLength={1000}
                    placeholder="เช่น ต้องการพัฒนาความรู้ด้านกฎหมายป่าไม้..."
                  />
                </Field>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0 && !reviewing}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {BUTTONS.BACK}
            </Button>
            {reviewing ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? BUTTONS.REGISTERING : 'ยืนยันการสมัคร'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto"
              >
                {step === steps.length - 1 ? 'ตรวจสอบข้อมูล' : BUTTONS.NEXT}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          มีบัญชีแล้ว?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {BUTTONS.LOGIN}
          </Link>
        </p>
      </div>
    </div>
  )
}
