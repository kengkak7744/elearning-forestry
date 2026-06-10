import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/auth'
import { showToast } from '@/lib/toast'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import StepIndicator from '@/components/auth/StepIndicator'
import {
  AccountStep,
  PersonalStep,
  REGISTER_STEPS,
  ReviewSummary,
  StudyStep,
  validateStep,
} from '@/components/auth/RegisterSteps'
import { toastApiError } from '@/utils/apiError'

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
    if (step < REGISTER_STEPS.length - 1) {
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
      toastApiError(err, 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const progress = reviewing
    ? 100
    : Math.round(((step + 1) / REGISTER_STEPS.length) * 100)

  const stepProps = { form, errors, update }

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
            <StepIndicator
              steps={REGISTER_STEPS}
              current={reviewing ? REGISTER_STEPS.length : step}
              label="ขั้นตอนการสมัคร"
            />
            <Progress value={progress} className="h-1.5" />
          </CardHeader>
          <CardContent>
            {reviewing ? (
              <ReviewSummary form={form} />
            ) : step === 0 ? (
              <AccountStep {...stepProps} />
            ) : step === 1 ? (
              <PersonalStep {...stepProps} />
            ) : (
              <StudyStep {...stepProps} />
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
                {step === REGISTER_STEPS.length - 1 ? 'ตรวจสอบข้อมูล' : BUTTONS.NEXT}
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
