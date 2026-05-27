import { useState } from 'react'
import { quizzesApi } from '../api/quizzes'
import Icon from './Icon'

export default function QuizTaker({ quiz, onAttempted, showToast }) {
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { score, is_passed, results: {qid: {correct, correct_answer}} }

  const passedBefore = quiz.is_passed
  const currentlyPassed = result?.is_passed || passedBefore
  const hasQuestions = quiz.questions && quiz.questions.length > 0

  const setAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const reset = () => {
    setAnswers({})
    setResult(null)
    setStarted(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const data = await quizzesApi.submit(quiz.id, answers)
      setResult(data)
      if (data.is_passed) {
        showToast?.(`ผ่านแบบทดสอบ! คะแนน ${data.score}%`, 'success')
      } else {
        showToast?.(`ยังไม่ผ่าน คะแนน ${data.score}% (ต้องการ ${quiz.passing_score}%)`, 'error')
      }
      onAttempted?.(quiz.id, data)
    } catch (err) {
      showToast?.(err.response?.data?.detail || 'ส่งคำตอบไม่สำเร็จ', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-base sm:text-lg font-bold text-gray-800 inline-flex items-center gap-1.5">
          <Icon name="note" className="w-5 h-5 text-forest-600" />
          {quiz.title}
        </span>
        {currentlyPassed ? (
          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Icon name="check" className="w-3 h-3" /> ผ่านแล้ว
          </span>
        ) : quiz.can_skip ? (
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
            ไม่บังคับ
          </span>
        ) : (
          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
            ต้องผ่านเพื่อไปต่อ
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-3">
        คำถาม {quiz.questions.length} ข้อ · เกณฑ์ผ่าน {quiz.passing_score}%
        {quiz.best_score !== null && quiz.best_score !== undefined && (
          <span className="ml-2">· คะแนนสูงสุดของคุณ: {quiz.best_score}%</span>
        )}
      </p>

      {!hasQuestions && (
        <p className="text-sm text-gray-400 italic">ยังไม่มีคำถามในแบบทดสอบนี้</p>
      )}

      {hasQuestions && !started && !result && (
        <button
          onClick={() => setStarted(true)}
          className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-2 rounded-lg font-medium"
        >
          {currentlyPassed ? 'ทำใหม่' : 'เริ่มทำแบบทดสอบ'}
        </button>
      )}

      {hasQuestions && (started || result) && (
        <div className="space-y-4 mt-2">
          {quiz.questions.map((q, idx) => {
            const qResult = result?.results?.[q.id]
            const stateClass = qResult
              ? qResult.correct
                ? 'border-green-300 bg-green-50'
                : 'border-red-300 bg-red-50'
              : 'border-gray-200'

            return (
              <div key={q.id} className={`p-3 rounded-lg border ${stateClass}`}>
                <p className="font-medium text-sm text-gray-800 mb-2 break-words">
                  {idx + 1}. {q.question_text}
                  {qResult && (
                    <span className={`ml-2 text-xs inline-flex items-center gap-0.5 ${qResult.correct ? 'text-green-700' : 'text-red-700'}`}>
                      <Icon name={qResult.correct ? 'check' : 'xmark'} className="w-3.5 h-3.5" />
                      {qResult.correct ? 'ถูกต้อง' : 'ผิด'}
                    </span>
                  )}
                </p>

                {q.question_type === 'single_choice' && (
                  <div className="space-y-1.5">
                    {q.choices?.map((c, ci) => {
                      const isCorrectChoice = qResult?.correct_answer === ci
                      return (
                        <label key={ci} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === ci}
                            onChange={() => setAnswer(q.id, ci)}
                            disabled={!!result}
                            className="mt-1"
                          />
                          <span className={`text-sm break-words ${isCorrectChoice ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                            {c.text}
                            {isCorrectChoice && <Icon name="check" className="w-3.5 h-3.5 ml-1 inline text-green-700" />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-1.5">
                    {q.choices?.map((c, ci) => {
                      const selected = (answers[q.id] || []).includes(ci)
                      const isCorrectChoice = qResult?.correct_answer?.includes?.(ci)
                      return (
                        <label key={ci} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current = answers[q.id] || []
                              const next = selected ? current.filter((x) => x !== ci) : [...current, ci]
                              setAnswer(q.id, next)
                            }}
                            disabled={!!result}
                            className="mt-1"
                          />
                          <span className={`text-sm break-words ${isCorrectChoice ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                            {c.text}
                            {isCorrectChoice && <Icon name="check" className="w-3.5 h-3.5 ml-1 inline text-green-700" />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {q.question_type === 'written' && (
                  <div>
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      disabled={!!result}
                      placeholder="พิมพ์คำตอบ..."
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    {qResult && qResult.correct_answer && (
                      <p className="text-xs text-green-700 mt-1">เฉลย: {qResult.correct_answer}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex gap-2 pt-1 flex-wrap">
            {!result ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-5 py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'กำลังส่ง...' : 'ส่งคำตอบ'}
                </button>
                <button
                  onClick={() => { setStarted(false); setAnswers({}); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <>
                <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  result.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  คะแนน: {result.score}% {result.is_passed ? '· ผ่านเกณฑ์' : '· ไม่ผ่านเกณฑ์'}
                </div>
                <button
                  onClick={reset}
                  className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-2 rounded-lg font-medium"
                >
                  ทำใหม่
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
