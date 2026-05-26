import { useState } from 'react'
import { quizzesApi } from '../api/quizzes'

const typeLabels = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
}

export default function QuestionEditor({ question, index, onUpdate, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({
    question_text: question.question_text,
    choices: question.choices || [],
    correct_text: question.correct_text || '',
    points: question.points,
  })

  const handleSave = async () => {
    try {
      const updated = await quizzesApi.updateQuestion(question.id, draft)
      onUpdate(updated)
      setExpanded(false)
      showToast('บันทึกคำถามสำเร็จ')
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  const updateChoice = (idx, field, value) => {
    const next = [...draft.choices]
    next[idx] = { ...next[idx], [field]: value }

    // For single_choice, ensure only one is_correct
    if (question.question_type === 'single_choice' && field === 'is_correct' && value) {
      next.forEach((c, i) => {
        if (i !== idx) c.is_correct = false
      })
    }
    setDraft({ ...draft, choices: next })
  }

  const addChoice = () => {
    setDraft({
      ...draft,
      choices: [...draft.choices, { text: `ตัวเลือก ${draft.choices.length + 1}`, is_correct: false }]
    })
  }

  const removeChoice = (idx) => {
    setDraft({ ...draft, choices: draft.choices.filter((_, i) => i !== idx) })
  }

  return (
    <div className="border border-gray-200 rounded bg-gray-50">
      <div className="p-2 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 text-sm w-5 flex-shrink-0"
        >
          {expanded ? '−' : '+'}
        </button>
        <span className="text-xs text-gray-500 font-mono flex-shrink-0">Q{index + 1}</span>
        <span className="text-xs bg-white px-2 py-0.5 rounded flex-shrink-0">
          {typeLabels[question.question_type]}
        </span>
        <span className="flex-1 text-sm text-gray-800 truncate">{question.question_text}</span>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 flex-shrink-0"
        >
          ลบ
        </button>
      </div>

      {expanded && (
        <div className="bg-white p-3 space-y-3 border-t border-gray-200">
          <div>
            <label className="block text-xs text-gray-600 mb-1">คำถาม</label>
            <textarea
              value={draft.question_text}
              onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">คะแนน</label>
            <input
              type="number"
              value={draft.points}
              onChange={(e) => setDraft({ ...draft, points: parseInt(e.target.value) || 1 })}
              min={1}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Choices for single/multiple choice */}
          {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
            <div>
              <label className="block text-xs text-gray-600 mb-2">ตัวเลือก</label>
              <div className="space-y-2">
                {draft.choices.map((choice, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                      name={`q-${question.id}-correct`}
                      checked={choice.is_correct}
                      onChange={(e) => updateChoice(idx, 'is_correct', e.target.checked)}
                    />
                    <input
                      type="text"
                      value={choice.text}
                      onChange={(e) => updateChoice(idx, 'text', e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    {draft.choices.length > 2 && (
                      <button
                        onClick={() => removeChoice(idx)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addChoice}
                className="mt-2 text-xs text-forest-600 hover:text-forest-700"
              >
                + เพิ่มตัวเลือก
              </button>
              <p className="text-xs text-gray-500 mt-1">
                ติ๊กเครื่องหมายหน้าตัวเลือกที่ถูกต้อง
              </p>
            </div>
          )}

          {/* Written answer */}
          {question.question_type === 'written' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">คำตอบที่ถูกต้อง</label>
              <input
                type="text"
                value={draft.correct_text}
                onChange={(e) => setDraft({ ...draft, correct_text: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="คำตอบที่ถูก (เปรียบเทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่)"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            className="bg-forest-500 hover:bg-forest-600 text-white text-sm px-4 py-1.5 rounded"
          >
            บันทึก
          </button>
        </div>
      )}
    </div>
  )
}