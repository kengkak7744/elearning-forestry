import { useEffect, useState } from 'react'
import { quizzesApi } from '../api/quizzes'
import Icon from './Icon'

const typeLabels = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
  opinion: 'ความคิดเห็น',
}

export default function QuizStatsModal({ open, quizId, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !quizId) return
    setLoading(true)
    setError('')
    quizzesApi.getStats(quizId)
      .then(setStats)
      .catch((err) => setError(err.response?.data?.detail || 'โหลดสถิติไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [open, quizId])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 sm:my-0 max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 truncate">
              สถิติแบบทดสอบ{stats?.title ? `: ${stats.title}` : ''}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              วิเคราะห์ความถูกต้องและคำตอบของผู้เรียน
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
          {loading && <p className="text-sm text-gray-500 text-center py-6">กำลังโหลด...</p>}
          {error && <p className="text-sm text-red-600 text-center py-6">{error}</p>}

          {stats && !loading && (
            <>
              {/* Overview cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCard label="จำนวนการทำ" value={stats.total_attempts} />
                <StatCard label="คะแนนเฉลี่ย" value={`${stats.average_score}%`} />
                <StatCard
                  label="ผ่านเกณฑ์"
                  value={`${stats.pass_rate}%`}
                  hint={`${stats.pass_count}/${stats.total_attempts}`}
                />
                <StatCard label="เกณฑ์ผ่าน" value={`${stats.passing_score}%`} muted />
              </div>

              {stats.total_attempts === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                  ยังไม่มีผู้ทำแบบทดสอบนี้
                </p>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-gray-800">รายละเอียดรายข้อ</h4>
                  {stats.questions.map((q, idx) => (
                    <QuestionStats key={q.id} q={q} index={idx} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, muted }) {
  return (
    <div className={`rounded-lg p-3 ${muted ? 'bg-gray-50' : 'bg-forest-50'}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-xl font-bold ${muted ? 'text-gray-700' : 'text-forest-700'} tabular-nums`}>
        {value}
      </p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function QuestionStats({ q, index }) {
  const isFreeText = q.question_type === 'written' || q.question_type === 'opinion'
  const isOpinion = q.question_type === 'opinion'

  // Color the correct-rate bar by performance
  const rate = q.correct_rate
  const barColor = isOpinion
    ? 'bg-blue-400'
    : rate >= 70 ? 'bg-green-500'
    : rate >= 40 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500 flex-shrink-0 mt-0.5">Q{index + 1}</span>
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded flex-shrink-0">
          {typeLabels[q.question_type] || q.question_type}
        </span>
        <p className="flex-1 text-sm text-gray-800 break-words">{q.question_text}</p>
      </div>

      {/* Correctness rate (skip the bar entirely for opinion — not a test) */}
      {!isOpinion && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600">ตอบถูก {q.correct_count}/{q.answered_count} คน</span>
            <span className="font-medium tabular-nums">{q.correct_rate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`${barColor} h-2 transition-all`} style={{ width: `${q.correct_rate}%` }} />
          </div>
        </div>
      )}

      {/* Choice distribution */}
      {q.choice_distribution && q.choices && (
        <div className="space-y-1.5 mt-2">
          {q.choices.map((c, ci) => {
            const count = q.choice_distribution[ci] || 0
            const pct = q.answered_count ? Math.round((count / q.answered_count) * 100) : 0
            return (
              <div key={ci} className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 w-44 flex-shrink-0">
                  {c.is_correct && <Icon name="check" className="w-3.5 h-3.5 text-green-600" />}
                  <span className={`break-words ${c.is_correct ? 'font-medium text-green-700' : 'text-gray-700'}`}>
                    {c.text}
                  </span>
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="bg-gray-400 h-2" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-gray-500 tabular-nums flex-shrink-0">
                  {count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Free-text responses */}
      {isFreeText && q.responses && (
        <div className="mt-2">
          {q.question_type === 'written' && q.correct_text && (
            <p className="text-xs text-gray-500 mb-1">เฉลย: <span className="text-green-700">{q.correct_text}</span></p>
          )}
          {q.responses.length === 0 ? (
            <p className="text-xs text-gray-400 italic">ยังไม่มีคำตอบ</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {q.responses.map((r, ri) => (
                <li
                  key={ri}
                  className={`text-sm px-3 py-2 rounded border ${
                    q.question_type === 'written'
                      ? (r.correct ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200')
                      : 'bg-blue-50 border-blue-100'
                  }`}
                >
                  <p className="text-xs text-gray-500 mb-0.5">{r.user_name}</p>
                  <p className="text-gray-800 break-words whitespace-pre-wrap">{r.text || <span className="italic text-gray-400">(เว้นว่าง)</span>}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
