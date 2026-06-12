import { Trophy } from 'lucide-react'
import { showToast } from '@/lib/toast'
import { Card, CardContent } from '@/components/ui/card'
import QuizTaker from '@/components/QuizTaker'

/**
 * The final-exam view: an intro card + the final QuizTaker. Moved verbatim from
 * CourseViewerPage's viewingFinal branch — the QuizTaker machinery is unchanged.
 */
export default function FinalQuizView({ finalQuiz, onAttempted }) {
  return (
    <>
      <Card className="mb-4 border-warning/30 bg-warning/5">
        <CardContent className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
            <Trophy className="h-6 w-6 text-warning" />
            แบบทดสอบสุดท้าย
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ทำแบบทดสอบรวมเพื่อจบหลักสูตร
          </p>
        </CardContent>
      </Card>
      <QuizTaker quiz={finalQuiz} showToast={showToast} onAttempted={onAttempted} />
    </>
  )
}
