import { useEffect } from 'react'
import Icon from './Icon'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

export default function CourseScoresModal({ open, quizzes, onClose }) {
  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const list = Array.isArray(quizzes) ? quizzes : []

  // Total: weight each quiz equally. Each quiz's contribution = best_score (%).
  // total = average of best_scores across all quizzes the user has attempted.
  const attempted = list.filter(q => q.best_score !== null && q.best_score !== undefined)
  const total = list.length
  const taken = attempted.length
  const avgScore = taken
    ? Math.round(attempted.reduce((s, q) => s + (q.best_score || 0), 0) / taken)
    : 0
  const passedCount = list.filter(q => q.is_passed).length

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
              คะแนนของคุณในหลักสูตรนี้
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              สรุปคะแนนจากทุกแบบทดสอบในหลักสูตร
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

        <div className="p-5 overflow-y-auto flex-1">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard label="คะแนนเฉลี่ย" value={`${avgScore}%`} tone="forest" />
            <SummaryCard label="ผ่านแล้ว" value={`${passedCount}/${total}`} tone="green" />
            <SummaryCard label="ทำแล้ว" value={`${taken}/${total}`} tone="gray" />
          </div>

          {total === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
              ยังไม่มีแบบทดสอบในหลักสูตรนี้
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((q) => {
                const taken = q.best_score !== null && q.best_score !== undefined
                return (
                  <li
                    key={q.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                      <p className="text-xs text-gray-500">
                        {placementLabels[q.placement] || q.placement}
                        {' · '}เกณฑ์ผ่าน {q.passing_score}%
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {taken ? (
                        <p className={`text-lg font-bold tabular-nums ${q.is_passed ? 'text-green-700' : 'text-red-600'}`}>
                          {q.best_score}%
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">ยังไม่ทำ</p>
                      )}
                      {taken && (
                        <p className={`text-xs font-medium inline-flex items-center gap-0.5 ${q.is_passed ? 'text-green-700' : 'text-red-600'}`}>
                          <Icon name={q.is_passed ? 'check' : 'xmark'} className="w-3 h-3" />
                          {q.is_passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }) {
  const bg = tone === 'forest' ? 'bg-forest-50' : tone === 'green' ? 'bg-green-50' : 'bg-gray-50'
  const color = tone === 'forest' ? 'text-forest-700' : tone === 'green' ? 'text-green-700' : 'text-gray-700'
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
