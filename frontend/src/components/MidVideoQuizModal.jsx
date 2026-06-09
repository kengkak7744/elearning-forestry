import { useEffect, useState } from 'react'
import { ChevronRight, Pause, RotateCcw } from 'lucide-react'
import QuizTaker from './QuizTaker'
import { BUTTONS } from '@/constants/labels'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function MidVideoQuizModal({
  quiz,
  onContinue,
  onSkip,
  onRewind,
  onAttempted,
  showToast,
}) {
  const [passed, setPassed] = useState(quiz?.is_passed || false)
  // `failed` flips to true after the learner attempts and doesn't pass.
  // Surfaces the "rewind to previous checkpoint" CTA so they have a clear
  // path out of a non-skippable quiz they got wrong.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPassed(quiz?.is_passed || false)
    setFailed(false)
  }, [quiz?.id, quiz?.is_passed])

  const open = !!quiz
  const canContinue = quiz?.can_skip || passed
  const showRewind = !!onRewind && failed && !passed

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSkip?.()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-primary" />
            แบบทดสอบกลางวิดีโอ
          </DialogTitle>
          <DialogDescription>
            {quiz?.can_skip
              ? 'คุณสามารถข้ามได้ หรือทำให้ผ่านเพื่อนับเป็นความคืบหน้า'
              : 'ต้องผ่านแบบทดสอบนี้เพื่อดูวิดีโอต่อ'}
          </DialogDescription>
        </DialogHeader>

        {quiz && (
          <QuizTaker
            quiz={quiz}
            showToast={showToast}
            onAttempted={(qid, attempt) => {
              if (attempt.is_passed) setPassed(true)
              else setFailed(true)
              onAttempted?.(qid, attempt)
            }}
          />
        )}

        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          {quiz?.can_skip && (
            <Button variant="outline" onClick={onSkip}>
              {BUTTONS.SKIP_QUIZ}
            </Button>
          )}
          {showRewind && (
            <Button
              variant="outline"
              onClick={() => onRewind(quiz)}
              className="border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              ย้อนไปดูใหม่
            </Button>
          )}
          <Button onClick={onContinue} disabled={!canContinue}>
            {BUTTONS.CONTINUE_WATCHING}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
