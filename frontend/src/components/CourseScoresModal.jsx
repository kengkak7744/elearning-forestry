import { useEffect, useState } from 'react'
import { certificatesApi } from '../api/certificates'
import Icon from './Icon'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
}

export default function CourseScoresModal({ open, quizzes, courseId, onClose }) {
  const [cert, setCert] = useState(null) // {certificate_id, ...} when issued
  const [certLoading, setCertLoading] = useState(false)
  const [certError, setCertError] = useState('')

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // When the learner has passed the course, look up their existing certificate
  // so we can render Download (vs. Claim) on the button.
  useEffect(() => {
    if (!open || !courseId) return
    setCert(null)
    setCertError('')
    certificatesApi.eligibility(courseId)
      .then((data) => {
        if (data.has_certificate) {
          setCert({ id: data.certificate_id, number: data.certificate_number })
        }
      })
      .catch(() => {})
  }, [open, courseId])

  const claim = async () => {
    if (!courseId) return
    setCertLoading(true)
    setCertError('')
    try {
      const data = await certificatesApi.issue(courseId)
      setCert({ id: data.id, number: data.certificate_number })
      window.open(certificatesApi.downloadUrl(data.id), '_blank', 'noopener')
    } catch (err) {
      setCertError(err.response?.data?.detail || 'ออกใบรับรองไม่สำเร็จ')
    } finally {
      setCertLoading(false)
    }
  }

  if (!open) return null

  const list = Array.isArray(quizzes) ? quizzes : []
  const finalQuiz = list.find((q) => q.placement === 'final')
  const lessonQuizzes = list
    .filter((q) => q.placement !== 'final')
    // Lesson-check quizzes that "can_skip" are optional; still shown but flagged.
    .sort((a, b) => {
      // Required first, then by placement
      if (a.can_skip !== b.can_skip) return a.can_skip ? 1 : -1
      return 0
    })

  const requiredLessonQuizzes = lessonQuizzes.filter((q) => !q.can_skip)
  const passedRequired = requiredLessonQuizzes.filter((q) => q.is_passed).length

  const finalTaken = finalQuiz && finalQuiz.best_score !== null && finalQuiz.best_score !== undefined
  const coursePassed = !!finalQuiz && finalQuiz.is_passed &&
    requiredLessonQuizzes.every((q) => q.is_passed)

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-scores-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4 sm:my-0 max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 id="course-scores-title" className="text-lg font-bold text-gray-800">
              ผลการเรียนของคุณ
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              คะแนนหลักสูตรนับจากแบบทดสอบสุดท้าย แบบทดสอบกลางบทเป็นด่านกั้นเท่านั้น
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0 min-w-[32px] min-h-[32px]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* The course grade = final exam result */}
          {finalQuiz ? (
            <div className={`rounded-xl p-5 ${
              finalTaken
                ? (finalQuiz.is_passed ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200')
                : 'bg-gray-50 border-2 border-gray-200'
            }`}>
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">คะแนนหลักสูตร</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                {finalTaken ? (
                  <>
                    <span className={`text-5xl font-bold tabular-nums ${
                      finalQuiz.is_passed ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {finalQuiz.best_score}%
                    </span>
                    <span className={`text-sm font-medium inline-flex items-center gap-1 ${
                      finalQuiz.is_passed ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <Icon name={finalQuiz.is_passed ? 'check' : 'xmark'} className="w-4 h-4" />
                      {finalQuiz.is_passed ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-medium text-gray-500">ยังไม่ได้ทำแบบทดสอบสุดท้าย</span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {finalQuiz.title} · เกณฑ์ผ่าน {finalQuiz.passing_score}%
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-5 bg-gray-50 border-2 border-gray-200 text-center">
              <p className="text-sm text-gray-600">หลักสูตรนี้ยังไม่มีแบบทดสอบสุดท้าย</p>
            </div>
          )}

          {/* Course completion banner */}
          {finalQuiz && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
              coursePassed
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-blue-50 text-blue-800 border border-blue-100'
            }`}>
              <Icon name={coursePassed ? 'trophy' : 'note'} className="w-5 h-5 flex-shrink-0" />
              <span>
                {coursePassed
                  ? 'คุณผ่านหลักสูตรนี้แล้ว ผ่านครบทุกด่านและแบบทดสอบสุดท้าย'
                  : `ผ่านด่านบังคับแล้ว ${passedRequired}/${requiredLessonQuizzes.length} ด่าน · ต้องผ่านแบบทดสอบสุดท้ายเพื่อจบหลักสูตร`}
              </span>
            </div>
          )}

          {/* Certificate — only when the course is actually passed.
              Backend rechecks eligibility (which also requires all lessons completed),
              so the button can also fail with a clear reason. */}
          {coursePassed && courseId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Icon name="trophy" className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">ใบรับรองการผ่านหลักสูตร</p>
                  {cert ? (
                    <p className="text-xs text-amber-800 mt-0.5">
                      เลขที่ {cert.number}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800 mt-0.5">
                      ออกใบรับรอง PDF ได้ทันที
                    </p>
                  )}
                  {certError && <p className="text-xs text-red-700 mt-1">{certError}</p>}
                </div>
                {cert ? (
                  <a
                    href={certificatesApi.downloadUrl(cert.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Icon name="document" className="w-4 h-4" />
                    ดาวน์โหลด
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={claim}
                    disabled={certLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {certLoading ? 'กำลังออก...' : 'รับใบรับรอง'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lesson check-quizzes — binary pass/fail, no numeric score shown */}
          {lessonQuizzes.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-800 mb-2">
                ด่านบทเรียน
                <span className="text-xs text-gray-500 font-normal ml-2">
                  (ต้องผ่านเพื่อเรียนต่อ)
                </span>
              </h4>
              <ul className="space-y-1.5">
                {lessonQuizzes.map((q) => {
                  const taken = q.best_score !== null && q.best_score !== undefined
                  return (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200"
                    >
                      <StatusBadge taken={taken} passed={q.is_passed} optional={q.can_skip} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                        <p className="text-xs text-gray-500">
                          {placementLabels[q.placement] || q.placement}
                          {q.can_skip && <span className="ml-1 text-gray-400">· ไม่บังคับ</span>}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ taken, passed, optional }) {
  if (!taken) {
    return (
      <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 inline-flex items-center justify-center flex-shrink-0" title="ยังไม่ทำ">
        <Icon name="hourglass" className="w-4 h-4" />
      </span>
    )
  }
  if (passed) {
    return (
      <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 inline-flex items-center justify-center flex-shrink-0" title="ผ่าน">
        <Icon name="check" className="w-4 h-4" />
      </span>
    )
  }
  return (
    <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center flex-shrink-0 ${
      optional ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
    }`} title={optional ? 'ไม่บังคับ' : 'ไม่ผ่าน'}>
      <Icon name={optional ? 'note' : 'xmark'} className="w-4 h-4" />
    </span>
  )
}
