// Shared label/color maps used across pages.
// Edit here to update everywhere.

export const ROLE_LABELS = {
  learner: 'ผู้เรียน',
  manager: 'หัวหน้างาน',
  instructor: 'วิทยากร',
  admin: 'ผู้ดูแลระบบ',
}

// Richer variant with color, used in admin user list badge.
export const ROLE_BADGES = {
  learner: { label: 'เจ้าหน้าที่ผู้เรียน', color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'หัวหน้างาน', color: 'bg-purple-100 text-purple-700' },
  instructor: { label: 'วิทยากร', color: 'bg-amber-100 text-amber-700' },
  admin: { label: 'ผู้ดูแลระบบ', color: 'bg-forest-100 text-forest-700' },
}

export const CATEGORY_BADGES = {
  compliance: { label: 'บังคับตามกฎหมาย', color: 'bg-red-100 text-red-700' },
  technical: { label: 'วิชาชีพ', color: 'bg-blue-100 text-blue-700' },
  safety: { label: 'ความปลอดภัย', color: 'bg-amber-100 text-amber-700' },
  skill: { label: 'ทักษะทั่วไป', color: 'bg-purple-100 text-purple-700' },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_BADGES).map(
  ([value, { label }]) => ({ value, label })
)

export const CONTENT_TYPE_OPTIONS = [
  { value: 'video_file', label: 'วิดีโอ (อัปโหลดไฟล์)' },
  { value: 'video_youtube', label: 'วิดีโอ (YouTube)' },
  { value: 'pdf', label: 'เอกสาร PDF' },
]
