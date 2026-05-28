import { useState } from 'react'
import { quizzesApi } from '../api/quizzes'
import QuestionEditor from './QuestionEditor'
import ConfirmDialog from './ConfirmDialog'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

export default function QuizEditor({ quiz, onUpdate, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmState, setConfirmState] = useState({ open: false })
  const [draft, setDraft] = useState({
    title: quiz.title,
    trigger_time: quiz.trigger_time || 0,
    can_skip: quiz.can_skip,
    show_correct_answer: quiz.show_correct_answer,
    passing_score: quiz.passing_score,
    randomize_questions: quiz.randomize_questions || false,
    questions_per_attempt: quiz.questions_per_attempt || '',
  })

  const handleSaveSettings = async () => {
    try {
      const payload = { ...draft }
      if (quiz.placement !== 'mid_video') delete payload.trigger_time
      // Normalize: when randomization is off, drop the count; when on, require a number.
      if (!payload.randomize_questions) {
        payload.questions_per_attempt = null
      } else {
        const n = parseInt(payload.questions_per_attempt, 10)
        payload.questions_per_attempt = Number.isFinite(n) && n > 0 ? n : null
      }
      const updated = await quizzesApi.update(quiz.id, payload)
      onUpdate(updated)
      setEditing(false)
      showToast('บันทึกการตั้งค่าสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  const handleAddQuestion = async (type) => {
    try {
      const newQ = await quizzesApi.addQuestion(quiz.id, {
        question_text: 'คำถามใหม่',
        question_type: type,
        choices: (type === 'single_choice' || type === 'multiple_choice') 
          ? [{ text: 'ตัวเลือก 1', is_correct: true }, { text: 'ตัวเลือก 2', is_correct: false }]
          : null,
        correct_text: type === 'written' ? '' : null,
        points: 1,
        order_index: quiz.questions.length,
      })
      onUpdate({ questions: [...quiz.questions, newQ] })
      showToast('เพิ่มคำถามสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'เพิ่มคำถามไม่สำเร็จ', 'error')
    }
  }

  const handleUpdateQuestion = (questionId, updates) => {
    onUpdate({
      questions: quiz.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
    })
  }

  const handleDeleteQuestion = (questionId) => {
    setConfirmState({
      open: true,
      title: 'ลบคำถาม',
      message: 'ต้องการลบคำถามนี้?',
      danger: true,
      onConfirm: async () => {
        try {
          await quizzesApi.deleteQuestion(questionId)
          onUpdate({ questions: quiz.questions.filter(q => q.id !== questionId) })
          showToast('ลบคำถามสำเร็จ')
        } catch (err) {
          showToast(err.response?.data?.detail || 'ลบไม่สำเร็จ', 'error')
        }
        setConfirmState({ open: false })
      },
    })
  }

  const placementColor = {
    mid_video: 'bg-blue-50 border-blue-200',
    end_of_lesson: 'bg-purple-50 border-purple-200',
    final: 'bg-amber-50 border-amber-200',
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${placementColor[quiz.placement]}`}>
      {/* Header */}
      <div className="p-3 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 text-sm w-5 flex-shrink-0"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="text-xs bg-white px-2 py-0.5 rounded font-medium flex-shrink-0">
          {placementLabels[quiz.placement]}
        </span>
        <span className="flex-1 font-medium text-sm text-gray-800 truncate">
          {quiz.title}
        </span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {quiz.questions.length} คำถาม
        </span>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 flex-shrink-0"
        >
          ลบ
        </button>
      </div>

      {expanded && (
        <div className="bg-white p-4 space-y-4 border-t border-gray-200">
          {/* Settings */}
          {editing ? (
            <div className="bg-gray-50 p-3 rounded space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">ชื่อแบบทดสอบ</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {quiz.placement === 'mid_video' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">เวลาที่แสดง (วินาที)</label>
                  <input
                    type="number"
                    value={draft.trigger_time}
                    onChange={(e) => setDraft({ ...draft, trigger_time: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">คะแนนผ่าน (%)</label>
                <input
                  type="number"
                  value={draft.passing_score}
                  onChange={(e) => setDraft({ ...draft, passing_score: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={100}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              <div className="border-t border-gray-200 pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.randomize_questions}
                    onChange={(e) => setDraft({ ...draft, randomize_questions: e.target.checked })}
                  />
                  สุ่มคำถามจากธนาคาร
                </label>
                {draft.randomize_questions && (
                  <div className="mt-2 ml-6">
                    <label className="block text-xs text-gray-600 mb-1">
                      จำนวนข้อต่อครั้ง (จากทั้งหมด {quiz.questions.length} ข้อ)
                    </label>
                    <input
                      type="number"
                      value={draft.questions_per_attempt}
                      onChange={(e) => setDraft({ ...draft, questions_per_attempt: e.target.value })}
                      min={1}
                      max={quiz.questions.length || undefined}
                      placeholder="เช่น 5"
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.can_skip}
                  onChange={(e) => setDraft({ ...draft, can_skip: e.target.checked })}
                />
                อนุญาตให้ข้าม
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.show_correct_answer}
                  onChange={(e) => setDraft({ ...draft, show_correct_answer: e.target.checked })}
                />
                แสดงคำตอบที่ถูกหลังตอบ
              </label>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSettings}
                  className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-1.5 rounded"
                >
                  บันทึก
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-1.5 rounded"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex gap-3 flex-wrap">
                {quiz.placement === 'mid_video' && <span>เวลา: {quiz.trigger_time}s</span>}
                <span>คะแนนผ่าน: {quiz.passing_score}%</span>
                <span>{quiz.can_skip ? 'ข้ามได้' : 'ห้ามข้าม'}</span>
                <span>{quiz.show_correct_answer ? 'แสดงเฉลย' : 'ไม่แสดงเฉลย'}</span>
                {quiz.randomize_questions && (
                  <span className="text-forest-700 font-medium">
                    สุ่ม {quiz.questions_per_attempt || 'ทั้งหมด'}/{quiz.questions.length} ข้อ
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-forest-600 hover:text-forest-700"
              >
                แก้ไขการตั้งค่า
              </button>
            </div>
          )}

          {/* Questions */}
          <div>
            <h4 className="font-medium text-sm text-gray-800 mb-2">คำถาม</h4>
            {quiz.questions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">ยังไม่มีคำถาม</p>
            ) : (
              <div className="space-y-2">
                {quiz.questions.map((q, idx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    onUpdate={(updates) => handleUpdateQuestion(q.id, updates)}
                    onDelete={() => handleDeleteQuestion(q.id)}
                    showToast={showToast}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap mt-3">
              <button
                onClick={() => handleAddQuestion('single_choice')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
              >
                + เลือกข้อเดียว
              </button>
              <button
                onClick={() => handleAddQuestion('multiple_choice')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
              >
                + เลือกหลายข้อ
              </button>
              <button
                onClick={() => handleAddQuestion('written')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
              >
                + เขียนตอบ
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ open: false })}
      />
    </div>
  )
}