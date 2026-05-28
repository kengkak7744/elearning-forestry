import { useEffect, useState } from 'react'
import { quizzesApi } from '../api/quizzes'
import QuizStatsModal from './QuizStatsModal'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

export default function CourseStatsModal({ open, courseId, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drillQuizId, setDrillQuizId] = useState(null)

  useEffect(() => {
    if (!open || !courseId) return
    setLoading(true)
    setError('')
    quizzesApi.getCourseStats(courseId)
      .then(setStats)
      .catch((err) => setError(err.response?.data?.detail || 'โหลดสถิติไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [open, courseId])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-4 sm:my-0 max-h-[90vh] flex flex-col"
        >
          <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3 flex-shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-800">สถิติหลักสูตร</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                สรุปคะแนนและผลการทำแบบทดสอบทุกชุดในหลักสูตร
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
                {/* Overall numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <Stat label="แบบทดสอบ" value={stats.total_quizzes} tone="gray" />
                  <Stat label="ผู้เรียน" value={stats.unique_learners} tone="forest" />
                  <Stat label="จำนวนการทำ" value={stats.total_attempts} tone="forest" />
                  <Stat label="คะแนนเฉลี่ย" value={`${stats.overall_average}%`} tone="forest" />
                  <Stat label="ผ่านเกณฑ์" value={`${stats.overall_pass_rate}%`} tone="green" />
                </div>

                {stats.total_quizzes === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                    หลักสูตรนี้ยังไม่มีแบบทดสอบ
                  </p>
                ) : (
                  <>
                    {/* Per-quiz summary */}
                    <h4 className="font-medium text-sm text-gray-800 mb-2">แบบทดสอบในหลักสูตร</h4>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 text-gray-600 text-xs">
                          <tr>
                            <th className="text-left px-3 py-2">ชื่อ</th>
                            <th className="text-left px-3 py-2 hidden sm:table-cell">ตำแหน่ง</th>
                            <th className="text-right px-3 py-2">ผู้ทำ</th>
                            <th className="text-right px-3 py-2">เฉลี่ย</th>
                            <th className="text-right px-3 py-2">ผ่าน</th>
                            <th className="text-right px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {stats.quizzes.map((q) => (
                            <tr key={q.id}>
                              <td className="px-3 py-2 text-gray-800 break-words max-w-xs">{q.title}</td>
                              <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                                {placementLabels[q.placement] || q.placement}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                {q.unique_learners}
                                <span className="text-gray-400 text-xs ml-1">({q.total_attempts})</span>
                              </td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">
                                {q.total_attempts ? `${q.average_score}%` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {q.total_attempts ? (
                                  <span className={q.pass_rate >= 70 ? 'text-green-700' : q.pass_rate >= 40 ? 'text-yellow-700' : 'text-red-600'}>
                                    {q.pass_rate}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setDrillQuizId(q.id)}
                                  className="text-xs text-forest-700 hover:text-forest-800"
                                >
                                  รายละเอียด →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Per-learner roll-up */}
                    <h4 className="font-medium text-sm text-gray-800 mb-2">
                      ผลการเรียนรายผู้เรียน
                      <span className="text-xs text-gray-500 font-normal ml-2">
                        (คะแนนสูงสุดต่อแบบทดสอบ)
                      </span>
                    </h4>
                    {stats.learners.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                        ยังไม่มีผู้เรียนทำแบบทดสอบ
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                          <thead className="bg-gray-50 text-gray-600 text-xs">
                            <tr>
                              <th className="text-left px-3 py-2">ผู้เรียน</th>
                              <th className="text-left px-3 py-2 hidden sm:table-cell">หน่วยงาน</th>
                              <th className="text-right px-3 py-2">ทำ</th>
                              <th className="text-right px-3 py-2">ผ่าน</th>
                              <th className="text-right px-3 py-2">คะแนนเฉลี่ย</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {stats.learners.map((u) => (
                              <tr key={u.user_id}>
                                <td className="px-3 py-2 text-gray-800 break-words">{u.user_name}</td>
                                <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                                  {u.user_department || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                  {u.quizzes_taken}/{stats.total_quizzes}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  <span className={u.quizzes_passed === stats.total_quizzes ? 'text-green-700 font-medium' : 'text-gray-700'}>
                                    {u.quizzes_passed}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-bold tabular-nums">
                                  <span className={u.average_score >= 70 ? 'text-green-700' : u.average_score >= 40 ? 'text-yellow-700' : 'text-red-600'}>
                                    {u.average_score}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <QuizStatsModal
        open={!!drillQuizId}
        quizId={drillQuizId}
        onClose={() => setDrillQuizId(null)}
      />
    </>
  )
}

function Stat({ label, value, tone }) {
  const bg = tone === 'forest' ? 'bg-forest-50' : tone === 'green' ? 'bg-green-50' : 'bg-gray-50'
  const color = tone === 'forest' ? 'text-forest-700' : tone === 'green' ? 'text-green-700' : 'text-gray-700'
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
