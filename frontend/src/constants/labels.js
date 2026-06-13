// Shared label/color maps used across pages.
// Edit here to update everywhere.

export const ROLE_LABELS = {
  learner: 'ผู้เรียน',
  manager: 'หัวหน้างาน',
  instructor: 'วิทยากร',
  admin: 'ผู้ดูแลระบบ',
}

// Role badges. The redesign renders these via shadcn <Badge variant="secondary"/>
// for consistent neutral styling, so no `.color` field — keep just the label.
export const ROLE_BADGES = {
  learner: { label: 'เจ้าหน้าที่ผู้เรียน' },
  manager: { label: 'หัวหน้างาน' },
  instructor: { label: 'วิทยากร' },
  admin: { label: 'ผู้ดูแลระบบ' },
}

export const CATEGORY_BADGES = {
  compliance: { label: 'บังคับตามกฎหมาย' },
  technical: { label: 'วิชาชีพ' },
  safety: { label: 'ความปลอดภัย' },
  skill: { label: 'ทักษะทั่วไป' },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_BADGES).map(
  ([value, { label }]) => ({ value, label })
)

export const CONTENT_TYPE_OPTIONS = [
  { value: 'video_file', label: 'วิดีโอ (อัปโหลดไฟล์)' },
  { value: 'video_youtube', label: 'วิดีโอ (YouTube)' },
  { value: 'pdf', label: 'เอกสาร PDF' },
]

// Single source of truth for CTA copy.
// Keeps the UX consistent: "เริ่มเรียน" always means start, "เรียนต่อ" always
// means resume, "ถัดไป" is the in-lesson advance. Reach for these before
// inventing new copy.
export const BUTTONS = {
  // Auth
  LOGIN: 'เข้าสู่ระบบ',
  LOGGING_IN: 'กำลังเข้าสู่ระบบ...',
  REGISTER: 'สมัครสมาชิก',
  REGISTERING: 'กำลังสมัคร...',
  LOGOUT: 'ออกจากระบบ',

  // Course actions
  ENROLL: 'ลงทะเบียนเรียน',
  ENROLLING: 'กำลังลงทะเบียน...',
  UNENROLL: 'ยกเลิกการลงทะเบียน',
  START_LESSON: 'เริ่มเรียน',
  CONTINUE: 'เรียนต่อ',
  NEXT: 'ถัดไป',
  PREVIOUS: 'ก่อนหน้า',
  BACK: 'ย้อนกลับ',
  BACK_TO_COURSES: 'กลับไปหน้าหลักสูตร',
  BACK_TO_LEARNER: 'กลับสู่หน้าผู้เรียน',
  VIEW_ALL: 'ดูทั้งหมด',
  VIEW_ALL_COURSES: 'ดูหลักสูตรทั้งหมด',
  VIEW_SCORES: 'ดูคะแนนของคุณ',
  VIEW_STATS: 'ดูสถิติหลักสูตร',
  GO_TO_FINAL_EXAM: 'แบบทดสอบสุดท้าย',
  COMPLETED_COURSE: 'จบหลักสูตรแล้ว',
  CLAIM_CERTIFICATE: 'รับใบรับรอง',
  RENEW_CERTIFICATE: 'ต่ออายุใบรับรอง',
  ISSUING_CERTIFICATE: 'กำลังออก...',
  DOWNLOAD_CERTIFICATE: 'ดาวน์โหลด',

  // Quiz actions
  START_QUIZ: 'เริ่มทำแบบทดสอบ',
  RETRY_QUIZ: 'ทำใหม่',
  SUBMIT_ANSWERS: 'ส่งคำตอบ',
  SUBMITTING_ANSWERS: 'กำลังส่ง...',
  SKIP_QUIZ: 'ข้ามแบบทดสอบ',
  CONTINUE_WATCHING: 'ดำเนินการต่อ',
  GO_TO_REQUIRED_QUIZ: 'ไปทำแบบทดสอบ',

  // Form
  SAVE: 'บันทึก',
  SAVING: 'กำลังบันทึก...',
  SAVE_AND_FINISH: 'บันทึกการแก้ไข',
  EDIT: 'แก้ไข',
  CANCEL: 'ยกเลิก',
  CONFIRM: 'ยืนยัน',
  DELETE: 'ลบ',
  CONFIRM_DELETE: 'ยืนยันลบ',
  CREATE: 'สร้าง',
  ADD: 'เพิ่ม',
  CLOSE: 'ปิด',
  CLEAR_FILTERS: 'ล้างตัวกรอง',

  // Admin
  CREATE_COURSE: 'สร้างหลักสูตรใหม่',
  CREATE_USER: 'สร้างผู้ใช้',
  ADD_USER: 'เพิ่มผู้ใช้',
  ADD_MODULE: 'เพิ่มโมดูล',
  ADD_LESSON: 'เพิ่มบทเรียน',
  RESET_PASSWORD: 'รีเซ็ตรหัสผ่าน',
}
