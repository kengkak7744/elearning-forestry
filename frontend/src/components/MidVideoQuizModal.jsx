import { useState, useEffect } from 'react'
import QuizTaker from './QuizTaker'

export default function MidVideoQuizModal({ quiz, onContinue, onSkip, onAttempted, showToast }) {
  const [passed, setPassed] = useState(quiz?.is_passed || false)

  useEffect(() => {
    setPassed(quiz?.is_passed || false)
  }, [quiz?.id, quiz?.is_passed])

  if (!quiz) return null

  const canContinue = quiz.can_skip || passed

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto my-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
              ⏸ แบบทดสอบกลางวิดีโอ
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mb-4">
            {quiz.can_skip
              ? 'คุณสามารถข้ามได้ หรือทำให้ผ่านเพื่อนับเป็นความคืบหน้า'
              : 'ต้องผ่านแบบทดสอบนี้เพื่อดูวิดีโอต่อ'}
          </p>

          <QuizTaker
            quiz={quiz}
            showToast={showToast}
            onAttempted={(qid, attempt) => {
              if (attempt.is_passed) setPassed(true)
              onAttempted?.(qid, attempt)
            }}
          />

          <div className="mt-5 pt-4 border-t border-gray-200 flex gap-2 justify-end flex-wrap">
            {quiz.can_skip && (
              <button
                onClick={onSkip}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg"
              >
                ข้ามแบบทดสอบ
              </button>
            )}
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-5 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ดำเนินการต่อ →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
