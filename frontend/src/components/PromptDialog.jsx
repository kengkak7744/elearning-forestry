import { useState, useEffect } from 'react'

export default function PromptDialog({ open, title, label, placeholder, defaultValue = '', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim()) onConfirm(value.trim())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
        
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none mb-5"
          />
          
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-2 bg-forest-500 hover:bg-forest-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              ตกลง
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}